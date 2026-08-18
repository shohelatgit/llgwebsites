drop function if exists public.get_pilot_site_sms_enabled(text, text);

create or replace function public.get_pilot_site_config(
  p_site_key text,
  p_ingest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected_hash bytea;
  v_config jsonb;
begin
  select secret_hash into v_expected_hash
  from private.integration_secrets
  where secret_key = 'fillout_ingest';

  if v_expected_hash is null
    or extensions.digest(coalesce(p_ingest_token, ''), 'sha256') <> v_expected_hash then
    raise exception 'unauthorized configuration request' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'property_key', p.property_key,
    'domain', p.domain,
    'display_name', coalesce(pc.display_name, p.name),
    'primary_phone', coalesce(p.primary_phone, ''),
    'sms_enabled', exists (
      select 1
      from public.voice_number_assignments vna
      join public.callrail_tracker_inventory cri
        on cri.tracker_id = vna.external_number_id
        and vna.phone_e164 = any(cri.tracking_numbers)
      where vna.property_id = p.id
        and vna.phone_e164 = p.primary_phone
        and vna.routing_status in ('inventory', 'testing', 'active')
        and cri.sms_enabled is true
        and cri.tracker_status = 'active'
    ),
    'city', coalesce(p.city, ''),
    'state_region', coalesce(p.state_region, ''),
    'timezone', coalesce(pc.timezone, ''),
    'consent_disclosure', coalesce(pc.consent_disclosure, ''),
    'test_mode', pc.test_mode,
    'form', (
      select jsonb_build_object(
        'provider', 'fillout',
        'form_id', ft.fillout_form_id,
        'template_key', ft.template_key,
        'status', ft.status
      )
      from public.property_form_templates pft
      join public.form_templates ft on ft.id = pft.form_template_id
      where pft.property_id = p.id
        and pft.is_active
        and pft.is_primary
        and ft.webhook_enabled
        and ft.status in ('testing', 'active')
        and ft.fillout_form_id is not null
      order by ft.id
      limit 1
    ),
    'services', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slug', s.slug,
          'name', coalesce(ps.public_name, s.name)
        ) order by ps.sort_order, s.name
      )
      from public.property_services ps
      join public.services s on s.id = ps.service_id
      where ps.property_id = p.id
        and ps.is_active
        and ps.accepting_leads
        and s.is_active
    ), '[]'::jsonb)
  )
  into v_config
  from public.properties p
  join public.property_configurations pc on pc.property_id = p.id
  join public.property_voice_settings pvs on pvs.property_id = p.id
  where p.property_key = lower(btrim(p_site_key))
    and p.status in ('onboarding', 'active')
    and pc.test_mode
    and coalesce((pc.brand_settings->>'lead_pilot_enabled')::boolean, false)
    and pvs.status = 'testing'
    and pvs.test_mode
    and coalesce((pvs.settings->>'pilot_scope')::boolean, false)
    and pvs.settings->>'pilot_cohort' = 'verified-five-v1'
    and exists (
      select 1
      from public.property_form_templates pft
      join public.form_templates ft on ft.id = pft.form_template_id
      where pft.property_id = p.id
        and pft.is_active
        and pft.is_primary
        and ft.webhook_enabled
        and ft.status in ('testing', 'active')
        and ft.fillout_form_id is not null
    );

  return v_config;
end;
$$;

revoke all on function public.get_pilot_site_config(text, text) from public, anon, authenticated;
grant execute on function public.get_pilot_site_config(text, text) to anon;

comment on function public.get_pilot_site_config(text, text)
is 'Returns public website, form, and verified SMS configuration for the five-site pilot after server-side token authentication.';
