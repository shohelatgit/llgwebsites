-- Idempotent rollout-state operation for the first seven no-live-website voice pilots.
-- Production calling and client delivery remain disabled; this only constrains test eligibility.

begin;

with selected(domain) as (
  values
    ('3vsanantoniopaverservices.com'),
    ('highendretainingwallcontractorstlouismo.com'),
    ('outdoordrainagesolutionsbridgeportct.com'),
    ('retainingwallcontractorrichmondva.com'),
    ('retainingwallcontractorsanantoniotx.com'),
    ('pghpoolservice.com'),
    ('wscrawlspace.com')
)
update public.property_voice_settings pvs
set status = case when s.domain is not null then 'testing' else 'paused' end,
    test_mode = true,
    settings = coalesce(pvs.settings, '{}'::jsonb) || jsonb_build_object(
      'pilot_scope', s.domain is not null,
      'pilot_cohort', case when s.domain is not null then 'no-live-site-v1' else null end,
      'production_calls_enabled', false,
      'lookup_provider', 'cloudflare-supabase',
      'lookup_response_key', 'triage_context'
    ),
    updated_at = now()
from public.properties p
left join selected s on lower(p.domain) = s.domain
where pvs.property_id = p.id;

commit;
