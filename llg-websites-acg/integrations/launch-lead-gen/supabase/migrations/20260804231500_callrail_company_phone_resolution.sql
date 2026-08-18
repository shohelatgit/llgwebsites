create or replace function public.resolve_callrail_company_phone_numbers(
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
  v_inserted integer := 0;
  v_company_mappings integer := 0;
begin
  select secret_hash into v_expected_hash
  from private.integration_secrets
  where secret_key = 'bland_ingest';

  if v_expected_hash is null
    or extensions.digest(coalesce(p_ingest_token, ''), 'sha256') <> v_expected_hash then
    raise exception 'unauthorized inventory request' using errcode = '28000';
  end if;

  select id into v_provider_id
  from public.integration_providers
  where provider_key = 'callrail' and is_active;

  with tracker_numbers as (
    select cti.company_id, cti.company_name, cti.tracker_id, cti.tracker_name,
           unnest(cti.tracking_numbers) as phone_e164
    from public.callrail_tracker_inventory cti
    where cti.tracker_status = 'active'
  ), seeds as (
    select distinct tn.company_id, vna.property_id
    from tracker_numbers tn
    join public.voice_number_assignments vna on vna.phone_e164 = tn.phone_e164
    where vna.is_primary
  ), company_resolution as (
    select company_id, min(property_id) as property_id
    from seeds
    group by company_id
    having count(distinct property_id) = 1
  ), candidates as (
    select distinct on (tn.phone_e164, cr.property_id)
      tn.phone_e164, cr.property_id, tn.tracker_id, tn.tracker_name,
      tn.company_id, tn.company_name
    from tracker_numbers tn
    join company_resolution cr using (company_id)
    where not exists (
      select 1 from public.voice_number_assignments existing
      where existing.phone_e164 = tn.phone_e164
    )
    order by tn.phone_e164, cr.property_id, tn.tracker_id
  )
  insert into public.voice_number_assignments (
    phone_e164, property_id, provider_id, external_number_id, number_role,
    routing_status, is_primary, mapping_source, confidence, metadata
  )
  select phone_e164, property_id, v_provider_id, tracker_id, 'tracking',
         'inventory', false, 'callrail_company_inference', 0.900,
         jsonb_build_object(
           'callrail_company_id', company_id,
           'callrail_company_name', company_name,
           'callrail_tracker_id', tracker_id,
           'callrail_tracker_name', tracker_name,
           'inference_basis', 'same_callrail_company_as_primary_property_number',
           'requires_destination_verification', true,
           'provider_verified_at', now()
         )
  from candidates
  on conflict (phone_e164, property_id, number_role) do nothing;

  get diagnostics v_inserted = row_count;

  insert into public.source_mappings (
    platform, external_type, external_id, external_name,
    property_id, client_id, market_id, is_active, metadata
  )
  select 'CallRail', 'Tracker Number', vna.external_number_id || ':' || vna.phone_e164,
         coalesce(vna.metadata->>'callrail_tracker_name', vna.external_number_id),
         p.id, p.client_id, p.market_id, true,
         jsonb_build_object(
           'tracker_id', vna.external_number_id,
           'tracking_phone_number', vna.phone_e164,
           'company_id', vna.metadata->>'callrail_company_id',
           'company_name', vna.metadata->>'callrail_company_name',
           'mapping_source', vna.mapping_source
         )
  from public.voice_number_assignments vna
  join public.properties p on p.id = vna.property_id
  where vna.mapping_source = 'callrail_company_inference'
  on conflict (platform, external_type, external_id) do update
  set external_name = excluded.external_name,
      property_id = excluded.property_id,
      client_id = excluded.client_id,
      market_id = excluded.market_id,
      is_active = true,
      metadata = public.source_mappings.metadata || excluded.metadata,
      updated_at = now();

  get diagnostics v_company_mappings = row_count;

  return jsonb_build_object(
    'numbers_inserted', v_inserted,
    'source_mappings_upserted', v_company_mappings
  );
end;
$$;

revoke all on function public.resolve_callrail_company_phone_numbers(text) from public;
grant execute on function public.resolve_callrail_company_phone_numbers(text) to anon, service_role;

comment on function public.resolve_callrail_company_phone_numbers(text) is
'Adds non-primary CallRail tracking numbers only when their CallRail company resolves to exactly one property through a verified primary phone; ambiguous companies remain unassigned.';
