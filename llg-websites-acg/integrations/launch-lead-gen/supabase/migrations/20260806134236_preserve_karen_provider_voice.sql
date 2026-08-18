with pilot_domains(domain) as (
  values
    ('3vsanantoniopaverservices.com'),
    ('highendretainingwallcontractorstlouismo.com'),
    ('outdoordrainagesolutionsbridgeportct.com'),
    ('pghpoolservice.com'),
    ('retainingwallcontractorrichmondva.com')
)
update public.property_configurations pc
set assistant_name = 'Karen',
    updated_at = now()
from public.properties p
join pilot_domains pd on pd.domain = p.domain
where pc.property_id = p.id;

with pilot_domains(domain) as (
  values
    ('3vsanantoniopaverservices.com'),
    ('highendretainingwallcontractorstlouismo.com'),
    ('outdoordrainagesolutionsbridgeportct.com'),
    ('pghpoolservice.com'),
    ('retainingwallcontractorrichmondva.com')
)
update public.property_voice_settings pvs
set settings = pvs.settings || jsonb_build_object(
      'sync_voice_id', false,
      'voice_selection', 'provider_managed_manual',
      'voice_name', 'Karen'
    ),
    updated_at = now()
from public.properties p
join pilot_domains pd on pd.domain = p.domain
where pvs.property_id = p.id;

update public.voice_agent_profiles vap
set settings = vap.settings || jsonb_build_object(
      'voice_name', 'Karen',
      'voice_selection', 'provider_managed_manual',
      'sync_voice_id', false
    ),
    updated_at = now()
where vap.id in (
  select pvs.voice_profile_id
  from public.property_voice_settings pvs
  join public.properties p on p.id = pvs.property_id
  where p.domain in (
    '3vsanantoniopaverservices.com',
    'highendretainingwallcontractorstlouismo.com',
    'outdoordrainagesolutionsbridgeportct.com',
    'pghpoolservice.com',
    'retainingwallcontractorrichmondva.com'
  )
);
