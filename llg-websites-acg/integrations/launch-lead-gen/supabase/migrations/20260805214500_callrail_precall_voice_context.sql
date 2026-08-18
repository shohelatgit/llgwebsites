create table if not exists private.callrail_precall_context (
  id bigint generated always as identity primary key,
  source_call_id text not null unique,
  caller_phone_e164 text not null,
  dialed_phone_e164 text not null,
  property_id bigint references public.properties(id) on delete set null,
  tracker_id text,
  request_id text not null,
  received_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  metadata jsonb not null default '{}'::jsonb,
  constraint callrail_precall_context_expiry_check check (expires_at > received_at)
);

create index if not exists callrail_precall_context_caller_expiry_idx
  on private.callrail_precall_context (caller_phone_e164, expires_at desc, received_at desc);

revoke all on private.callrail_precall_context from public, anon, authenticated;

create or replace function public.ingest_callrail_precall_context(
  p_payload jsonb,
  p_request_id text,
  p_ingest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected_hash bytea;
  v_caller_phone text;
  v_dialed_phone text;
  v_source_call_id text;
  v_tracker_id text;
  v_property_id bigint;
begin
  select secret_hash into v_expected_hash
  from private.integration_secrets
  where secret_key = 'bland_ingest';

  if v_expected_hash is null
    or extensions.digest(coalesce(p_ingest_token, ''), 'sha256') <> v_expected_hash then
    raise exception 'unauthorized callrail precall request' using errcode = '28000';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid callrail precall payload' using errcode = '22023';
  end if;

  v_caller_phone := private.normalize_e164(coalesce(
    p_payload->>'customer_phone_number',
    p_payload->>'customer_number',
    p_payload->>'callernum'
  ));
  v_dialed_phone := private.normalize_e164(coalesce(
    p_payload->>'tracking_phone_number',
    p_payload->>'trackingnum',
    p_payload->>'formatted_tracking_phone_number'
  ));
  v_source_call_id := coalesce(
    nullif(p_payload->>'resource_id', ''),
    nullif(p_payload->>'id', ''),
    nullif(p_request_id, ''),
    gen_random_uuid()::text
  );
  v_tracker_id := coalesce(nullif(p_payload->>'tracker_id', ''), nullif(p_payload->>'tracker_resource_id', ''));

  if v_caller_phone is null or v_dialed_phone is null then
    raise exception 'callrail precall phone numbers required' using errcode = '22023';
  end if;

  select vna.property_id into v_property_id
  from public.voice_number_assignments vna
  where vna.phone_e164 = v_dialed_phone
    and vna.routing_status in ('inventory', 'testing', 'active')
    and vna.number_role in ('website', 'tracking', 'inbound')
  order by case vna.routing_status when 'active' then 1 when 'testing' then 2 else 3 end,
           vna.is_primary desc,
           vna.id
  limit 1;

  insert into private.callrail_precall_context (
    source_call_id, caller_phone_e164, dialed_phone_e164, property_id,
    tracker_id, request_id, received_at, expires_at, metadata
  ) values (
    v_source_call_id, v_caller_phone, v_dialed_phone, v_property_id,
    v_tracker_id, coalesce(nullif(p_request_id, ''), v_source_call_id), now(), now() + interval '5 minutes',
    jsonb_build_object(
      'company_id', p_payload->>'company_id',
      'company_name', p_payload->>'company_name',
      'source_name', p_payload->>'source_name'
    )
  )
  on conflict (source_call_id) do update
  set caller_phone_e164 = excluded.caller_phone_e164,
      dialed_phone_e164 = excluded.dialed_phone_e164,
      property_id = excluded.property_id,
      tracker_id = excluded.tracker_id,
      request_id = excluded.request_id,
      received_at = excluded.received_at,
      expires_at = excluded.expires_at,
      metadata = private.callrail_precall_context.metadata || excluded.metadata;

  return jsonb_build_object(
    'accepted', true,
    'matched', v_property_id is not null,
    'source_call_id', v_source_call_id,
    'caller_phone', v_caller_phone,
    'dialed_phone', v_dialed_phone,
    'property_id', v_property_id,
    'expires_in_seconds', 300
  );
end;
$$;

create or replace function public.get_recent_callrail_voice_context(
  p_caller_phone text,
  p_ingest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected_hash bytea;
  v_caller_phone text;
  v_match_count integer;
  v_context record;
begin
  select secret_hash into v_expected_hash
  from private.integration_secrets
  where secret_key = 'bland_ingest';

  if v_expected_hash is null
    or extensions.digest(coalesce(p_ingest_token, ''), 'sha256') <> v_expected_hash then
    raise exception 'unauthorized recent call context request' using errcode = '28000';
  end if;

  v_caller_phone := private.normalize_e164(p_caller_phone);
  if v_caller_phone is null then
    return jsonb_build_object('matched', false, 'reason', 'invalid_caller_phone');
  end if;

  select count(distinct c.property_id) into v_match_count
  from private.callrail_precall_context c
  where c.caller_phone_e164 = v_caller_phone
    and c.expires_at > now()
    and c.property_id is not null;

  if v_match_count = 0 then
    return jsonb_build_object('matched', false, 'reason', 'no_recent_callrail_context');
  end if;
  if v_match_count > 1 then
    return jsonb_build_object('matched', false, 'reason', 'ambiguous_recent_callrail_context');
  end if;

  select c.source_call_id, c.dialed_phone_e164, c.property_id, c.tracker_id,
         c.received_at, p.property_key
  into v_context
  from private.callrail_precall_context c
  join public.properties p on p.id = c.property_id
  where c.caller_phone_e164 = v_caller_phone
    and c.expires_at > now()
    and c.property_id is not null
  order by c.received_at desc, c.id desc
  limit 1;

  return jsonb_build_object(
    'matched', true,
    'resolution', 'callrail_precall_caller_match',
    'source_call_id', v_context.source_call_id,
    'caller_phone', v_caller_phone,
    'dialed_phone', v_context.dialed_phone_e164,
    'property_id', v_context.property_id,
    'property_key', v_context.property_key,
    'tracker_id', v_context.tracker_id,
    'received_at', v_context.received_at
  );
end;
$$;

revoke all on function public.ingest_callrail_precall_context(jsonb, text, text) from public;
revoke all on function public.get_recent_callrail_voice_context(text, text) from public;
grant execute on function public.ingest_callrail_precall_context(jsonb, text, text) to anon, service_role;
grant execute on function public.get_recent_callrail_voice_context(text, text) to anon, service_role;

comment on table private.callrail_precall_context is
'Short-lived signed CallRail pre-call correlation used to resolve a shared Bland or SIP destination to the exact website property.';
comment on function public.ingest_callrail_precall_context(jsonb, text, text) is
'Authenticates and caches the caller, dialed CallRail number, and resolved property for five minutes.';
comment on function public.get_recent_callrail_voice_context(text, text) is
'Returns an unambiguous recent CallRail property match for a Bland caller number without exposing the private correlation table.';
