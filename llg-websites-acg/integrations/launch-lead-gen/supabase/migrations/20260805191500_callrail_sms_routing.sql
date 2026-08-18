create unique index if not exists sms_number_assignments_active_phone_idx
  on public.sms_number_assignments (phone_e164)
  where routing_status in ('testing', 'active');

update public.sms_number_assignments
set routing_status = 'paused',
    metadata = metadata || jsonb_build_object(
      'paused_reason', 'Shared TextMagic number already serves existing campaigns',
      'paused_at', now()
    ),
    updated_at = now()
where phone_e164 = '+18337689020'
  and routing_status in ('testing', 'active');

insert into public.sms_number_assignments (
  provider_id, property_id, phone_e164, external_number_id, label,
  routing_status, is_primary, capabilities, metadata
)
select
  ip.id,
  p.id,
  '+12107968693',
  cri.tracker_id,
  '3V CallRail calls and texts',
  'testing',
  true,
  jsonb_build_object('sms', true, 'mms', true, 'voice', true),
  jsonb_build_object(
    'pilot', 'verified-five-v1',
    'account_id', cri.account_id,
    'company_id', cri.company_id,
    'tracker_id', cri.tracker_id,
    'routing_model', 'callrail_public_number'
  )
from public.integration_providers ip
join public.properties p on p.domain = '3vsanantoniopaverservices.com'
join lateral (
  select account_id, company_id, tracker_id
  from public.callrail_tracker_inventory
  where '+12107968693' = any(tracking_numbers)
    and sms_enabled is true
  order by last_seen_at desc
  limit 1
) cri on true
where ip.provider_key = 'callrail' and ip.is_active
on conflict (provider_id, phone_e164) do update
set property_id = excluded.property_id,
    external_number_id = excluded.external_number_id,
    label = excluded.label,
    routing_status = excluded.routing_status,
    is_primary = excluded.is_primary,
    capabilities = excluded.capabilities,
    metadata = public.sms_number_assignments.metadata || excluded.metadata,
    updated_at = now();

create or replace function public.ingest_callrail_sms_event(
  p_event_type text,
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
  v_provider_id bigint;
  v_external_id text;
  v_event_id bigint;
  v_message_id bigint;
  v_assignment_id bigint;
  v_property_id bigint;
  v_market_id bigint;
  v_lead_id bigint;
  v_service_id bigint;
  v_direction text;
  v_from text;
  v_to text;
  v_body text;
  v_status text;
  v_occurred_at timestamptz;
  v_test_mode boolean := true;
  v_conversation_id text;
begin
  select secret_hash into v_expected_hash
  from private.integration_secrets
  where secret_key = 'fillout_ingest';

  if v_expected_hash is null
    or extensions.digest(coalesce(p_ingest_token, ''), 'sha256') <> v_expected_hash then
    raise exception 'unauthorized intake request' using errcode = '28000';
  end if;
  if p_event_type not in ('text_received', 'text_sent')
    or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid callrail sms event' using errcode = '22023';
  end if;

  select id into v_provider_id
  from public.integration_providers
  where provider_key = 'callrail' and is_active;
  if v_provider_id is null then
    raise exception 'callrail provider unavailable' using errcode = '22023';
  end if;

  v_external_id := coalesce(
    nullif(p_payload->>'resource_id', ''),
    nullif(p_payload->>'id', ''),
    p_request_id
  );
  v_direction := case when p_event_type = 'text_received' then 'inbound' else 'outbound' end;
  v_from := private.normalize_e164(p_payload->>'source_number');
  v_to := private.normalize_e164(p_payload->>'destination_number');
  v_body := nullif(p_payload->>'content', '');
  v_status := case when p_event_type = 'text_received' then 'received' else 'sent' end;
  v_conversation_id := nullif(p_payload->>'conversation_id', '');
  begin
    v_occurred_at := coalesce(nullif(p_payload->>'timestamp', '')::timestamptz, now());
  exception when others then
    v_occurred_at := now();
  end;

  if p_event_type = 'text_received' then
    select sna.id, sna.property_id, p.market_id, coalesce(pc.test_mode, true)
    into v_assignment_id, v_property_id, v_market_id, v_test_mode
    from public.sms_number_assignments sna
    join public.properties p on p.id = sna.property_id
    left join public.property_configurations pc on pc.property_id = p.id
    where sna.provider_id = v_provider_id
      and sna.phone_e164 = v_to
      and sna.routing_status in ('testing', 'active')
    order by sna.is_primary desc, sna.id
    limit 1;
  else
    select sna.id, sna.property_id, p.market_id, coalesce(pc.test_mode, true)
    into v_assignment_id, v_property_id, v_market_id, v_test_mode
    from public.sms_number_assignments sna
    join public.properties p on p.id = sna.property_id
    left join public.property_configurations pc on pc.property_id = p.id
    where sna.provider_id = v_provider_id
      and sna.phone_e164 = v_from
      and sna.routing_status in ('testing', 'active')
    order by sna.is_primary desc, sna.id
    limit 1;
  end if;

  insert into public.webhook_events (
    source_system, event_id, event_type, status, payload, received_at, attempt_count
  ) values (
    'callrail_sms', p_event_type || ':' || v_external_id, p_event_type,
    'processing', p_payload, now(), 1
  )
  on conflict (source_system, event_id) do update
  set payload = excluded.payload,
      status = 'processing',
      attempt_count = public.webhook_events.attempt_count + 1,
      error_message = null
  returning id into v_event_id;

  if v_property_id is not null then
    select l.id into v_lead_id
    from public.leads l
    where l.property_id = v_property_id
      and l.normalized_phone = case when v_direction = 'inbound' then v_from else v_to end
      and l.created_at >= now() - interval '90 days'
    order by l.created_at desc
    limit 1;
  end if;

  if p_event_type = 'text_received'
    and v_property_id is not null
    and v_from is not null
    and v_lead_id is null then
    select ps.service_id into v_service_id
    from public.property_services ps
    where ps.property_id = v_property_id and ps.is_active and ps.accepting_leads
    order by ps.is_primary desc, ps.sort_order, ps.service_id
    limit 1;

    insert into public.leads (
      ingestion_key, source_system, source_record_id, source_event_id,
      property_id, market_id, service_id, received_at, occurred_at,
      phone, normalized_phone, lead_source, source_category,
      communication_channel, conversion_source, status, qualification_status,
      is_billable, consent_to_contact, metadata
    ) values (
      'callrail:sms:' || v_property_id || ':' || v_from,
      'callrail', v_external_id, v_event_id,
      v_property_id, v_market_id, v_service_id, now(), v_occurred_at,
      v_from, v_from, 'CallRail SMS', 'direct', 'text', 'CallRail',
      case when v_test_mode then 'validating' else 'new' end,
      case when v_test_mode then 'needs_review' else 'unreviewed' end,
      case when v_test_mode then false else null end,
      true,
      jsonb_build_object(
        'test_mode', v_test_mode,
        'first_message', v_body,
        'request_id', p_request_id,
        'conversation_id', v_conversation_id
      )
    ) returning id into v_lead_id;
  end if;

  insert into public.sms_messages (
    provider_id, external_message_id, property_id, lead_id, number_assignment_id,
    direction, from_phone_e164, to_phone_e164, status, message_body, occurred_at,
    metadata
  ) values (
    v_provider_id, v_external_id, v_property_id, v_lead_id, v_assignment_id,
    v_direction, v_from, v_to, v_status, v_body, v_occurred_at,
    p_payload || jsonb_build_object(
      'request_id', p_request_id,
      'event_type', p_event_type,
      'test_mode', v_test_mode
    )
  )
  on conflict (provider_id, external_message_id) do update
  set property_id = coalesce(excluded.property_id, public.sms_messages.property_id),
      lead_id = coalesce(excluded.lead_id, public.sms_messages.lead_id),
      number_assignment_id = coalesce(excluded.number_assignment_id, public.sms_messages.number_assignment_id),
      status = excluded.status,
      message_body = coalesce(excluded.message_body, public.sms_messages.message_body),
      metadata = public.sms_messages.metadata || excluded.metadata,
      updated_at = now()
  returning id into v_message_id;

  if v_lead_id is not null and not exists (
    select 1 from public.lead_interactions li
    where li.provider_id = v_provider_id and li.source_event_id = v_external_id
  ) then
    insert into public.lead_interactions (
      lead_id, property_id, provider_id, source_event_id, conversation_id,
      interaction_type, channel, direction, status, content, occurred_at, metadata
    ) values (
      v_lead_id, v_property_id, v_provider_id, v_external_id,
      coalesce(v_conversation_id, 'callrail:' || v_property_id || ':' || coalesce(v_from, v_to)),
      'sms', 'sms', v_direction, v_status, v_body, v_occurred_at,
      jsonb_build_object(
        'sms_message_id', v_message_id,
        'number_assignment_id', v_assignment_id,
        'test_mode', v_test_mode
      )
    );
  end if;

  update public.webhook_events
  set status = 'processed', processed_at = now()
  where id = v_event_id;

  return jsonb_build_object(
    'accepted', true,
    'event_type', p_event_type,
    'external_message_id', v_external_id,
    'sms_message_id', v_message_id,
    'property_id', v_property_id,
    'lead_id', v_lead_id,
    'matched', v_property_id is not null,
    'test_mode', v_test_mode
  );
exception when others then
  if v_event_id is not null then
    update public.webhook_events
    set status = 'failed', error_message = sqlerrm
    where id = v_event_id;
  end if;
  raise;
end;
$$;

revoke all on function public.ingest_callrail_sms_event(text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.ingest_callrail_sms_event(text, jsonb, text, text)
  to anon;

comment on table public.sms_messages is
'Normalized provider-neutral SMS ledger linked to the property and lead whenever the sending or receiving number is mapped.';
