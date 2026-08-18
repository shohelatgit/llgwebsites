with spoken_names(domain, spoken_business_name) as (
  values
    ('3vsanantoniopaverservices.com', '3V Paver Services'),
    ('highendretainingwallcontractorstlouismo.com', 'St. Louis Retaining Walls'),
    ('outdoordrainagesolutionsbridgeportct.com', 'Bridgeport Drainage Solutions'),
    ('pghpoolservice.com', 'PGH Pool Service'),
    ('retainingwallcontractorrichmondva.com', 'Richmond Retaining Walls')
)
update public.property_voice_settings pvs
set settings = pvs.settings || jsonb_build_object(
      'spoken_business_name', spoken_names.spoken_business_name,
      'spoken_name_source', 'property_override'
    ),
    updated_at = now()
from public.properties p
join spoken_names on spoken_names.domain = p.domain
where pvs.property_id = p.id;

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
  v_latest_received_at timestamptz;
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

  select max(c.received_at) into v_latest_received_at
  from private.callrail_precall_context c
  where c.caller_phone_e164 = v_caller_phone
    and c.expires_at > now()
    and c.property_id is not null;

  if v_latest_received_at is null then
    return jsonb_build_object('matched', false, 'reason', 'no_recent_callrail_context');
  end if;

  select count(distinct c.property_id) into v_match_count
  from private.callrail_precall_context c
  where c.caller_phone_e164 = v_caller_phone
    and c.expires_at > now()
    and c.property_id is not null
    and c.received_at = v_latest_received_at;

  if v_match_count > 1 then
    return jsonb_build_object('matched', false, 'reason', 'ambiguous_latest_callrail_context');
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
    'resolution', 'callrail_precall_latest_caller_match',
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

revoke all on function public.get_recent_callrail_voice_context(text, text) from public, authenticated;
grant execute on function public.get_recent_callrail_voice_context(text, text) to anon, service_role;

comment on function public.get_recent_callrail_voice_context(text, text) is
'Returns the newest unambiguous active CallRail pre-call property context for a shared Bland caller number.';
