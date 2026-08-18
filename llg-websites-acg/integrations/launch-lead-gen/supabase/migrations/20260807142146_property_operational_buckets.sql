create table public.property_operational_tags (
  property_id bigint primary key references public.properties(id) on delete cascade,
  operational_bucket text not null check (operational_bucket in ('ready_to_test','not_owned_or_missing','do_not_touch')),
  recommended_bucket text not null check (recommended_bucket in ('ready_to_test','not_owned_or_missing','do_not_touch')),
  manual_override boolean not null default false,
  registration_status text not null check (registration_status in ('registered','unregistered','no_domain','unknown')),
  registrar text,
  ownership_status text not null check (ownership_status in ('confirmed_current_godaddy','not_owned_or_missing','unverified')),
  control_provider text,
  website_is_live boolean,
  reason_code text not null,
  reason_detail text not null,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  last_verified_at timestamptz not null default now(),
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index property_operational_tags_bucket_idx on public.property_operational_tags(operational_bucket, property_id);
create index property_operational_tags_ownership_idx on public.property_operational_tags(ownership_status, registration_status);

alter table public.property_operational_tags enable row level security;
revoke all on public.property_operational_tags from public, anon, authenticated;
grant all on public.property_operational_tags to service_role;

with registry as (
  select unnest(array[
    'atlantadrainpros.com','baltimorefrenchdrain.com','birminghamdrainpros.com','charlestonfrenchdrain.com','cincinnatifrenchdrains.com','clevelanddrainpros.com','connecticutdrainpros.com','fortworthdrainpros.com','houstondrainpros.com','indydrainpros.com','jacksonfrenchdrain.com','jacksonvillefrenchdrain.com','littlerockfrenchdrain.com','morgantownfencepros.com','naplespoolpros.com','nashvilledrainpros.com','neworleansfrenchdrain.com','okcityfrenchdrain.com','pghfrenchdrains.com','pghpaintingpros.com','pghpoolservice.com','pittsburghfencepros.com','raleighdrainpros.com','richmondfrenchdrain.com','seattledrainpros.com','stlouisdrainpros.com','tulsadrainpros.com','vbdrainpros.com','wehomewatchnaples.com','wilmingtonfrenchdrain.com'
  ]) domain, 'GoDaddy.com, LLC'::text registrar
  union all select unnest(array[
    '3vsanantoniopaverservices.com','concretecontractorsmcallen.com','crawlspaceencapsulationconcordnc.com','crawlspaceencapsulationgastonianc.com','deckbuilderboernetx.com','deckbuilderbulverdetx.com','deckbuildercibolotx.com','deckbuildernewbraunfelstx.com','deckbuilderschertztx.com','deckprossanantonio.com','fenceprosofsanantonio.com','highendretainingwallcontractorstlouismo.com','keepitcoolpittsburgh.com','landclearingserviceswilmingtonnc.com','lawncareofsanantonio.com','maranabathroomremodeling.com','newjerseyfencingcompany.com','orovalleybathroomremodeling.com','outdoordrainagesolutionsatlantaga.com','outdoordrainagesolutionsbridgeportct.com','outdoordrainagesolutionscapecoralfl.com','outdoordrainagesolutionschicagoil.com','outdoordrainagesolutionsindianapolisin.com','outdoordrainagesolutionsnewjersey.com','outdoordrainagesolutionsocalafl.com','outdoordrainagesolutionsoklahomacityok.com','outdoordrainagesolutionssanantoniotx.com','outdoordrainagesolutionsseattlewa.com','paverinstallationprosfortworthtx.com','retainingwallcontractorrichmondva.com','retainingwallcontractorsanantoniotx.com','santaclaritatreeservicepros.com','sprinklersystemsofsanantoniotx.com','stxdeckandpatio.com','tejefrenchdraincontractor.com','treeserviceprosmcallen.com','tulsafoundationpros.com'
  ]), 'NameCheap, Inc.'
  union all select unnest(array[
    'atlantaprecisionwalls.com','austindrainguys.com','birminghamprecisionwalls.com','charlottecrawlspace.com','charlottedrainguys.com','charlotteprecisionwalls.com','chicagodrainageguys.com','cincinnatiprecisionwalls.com','columbusdrainguys.com','crawlspacecarync.com','crawlspacedurham.com','crawlspacegreensboro.com','crawlspaceraleigh.com','dallasdrainguys.com','greensborodrainguys.com','kansascitydrainguys.com','littlerockprecisionwalls.com','louisvilleprecisionwalls.com','okcprecisionwalls.com','portlanddrainguys.com','saltlakecityprecisionwalls.com','savannahdrainguys.com','seattleprecisionwalls.com','tulsaprecisionwalls.com','wscrawlspace.com'
  ]), 'Wild West Domains, LLC'
  union all select 'pristinelandscapingsa.com', 'Bluehost Inc.'
  union all select 'pghguttercleaners.com', 'Domain Science Kutatasi Szolgaltato Korlatolt Felelossegu Tarsasag'
  union all select 'handymaninpittsburgh.com', 'Dominet (HK) Limited'
  union all select 'ohiodraincleaning.com', 'DropCatch.com 1431 LLC'
  union all select 'treeserviceinpittsburgh.com', 'Dynadot Inc'
),
unregistered as (
  select unnest(array[
    'akrondrainpros.com','akronfencepros.com','cantondrainpros.com','cedarrapidsconcretecontractorpros.com','clevelandfencepros.com','crawlspacewilmington.com','napleshurricaneservices.com','nashville-crawlspace.com','nashvillebackyards.com','outdoorcontractorssanantonio.com','salemjunkremovalpro.com','schertzlawncare.com','thousandoaksfencingpros.com','tusconbathroomremodelingpros.com','wvdrainpros.com','youngstowndrainpros.com','youngstownfencepros.com'
  ]) domain
),
confirmed as (
  select unnest(array[
    'richmondfrenchdrain.com','baltimorefrenchdrain.com','charlestonfrenchdrain.com','jacksonvillefrenchdrain.com','okcityfrenchdrain.com','morgantownfencepros.com','clevelanddrainpros.com','pghpoolservice.com','fortworthdrainpros.com','raleighdrainpros.com','seattledrainpros.com','atlantadrainpros.com','cincinnatifrenchdrains.com','nashvilledrainpros.com','vbdrainpros.com','stlouisdrainpros.com','neworleansfrenchdrain.com','wilmingtonfrenchdrain.com','littlerockfrenchdrain.com','pghfrenchdrains.com','tulsadrainpros.com','indydrainpros.com','birminghamdrainpros.com','houstondrainpros.com','jacksonfrenchdrain.com','connecticutdrainpros.com'
  ]) domain
)
insert into public.property_operational_tags(
  property_id,operational_bucket,recommended_bucket,registration_status,registrar,ownership_status,
  control_provider,website_is_live,reason_code,reason_detail,evidence,last_verified_at
)
select p.id,
  case
    when p.domain is null or u.domain is not null then 'not_owned_or_missing'
    when c.domain is not null and lower(p.domain)<>'pghpoolservice.com' then 'ready_to_test'
    else 'do_not_touch'
  end,
  case
    when p.domain is null or u.domain is not null then 'not_owned_or_missing'
    when c.domain is not null and lower(p.domain)<>'pghpoolservice.com' then 'ready_to_test'
    else 'do_not_touch'
  end,
  case when p.domain is null then 'no_domain' when u.domain is not null then 'unregistered' when r.domain is not null then 'registered' else 'unknown' end,
  r.registrar,
  case when p.domain is null or u.domain is not null then 'not_owned_or_missing' when c.domain is not null then 'confirmed_current_godaddy' else 'unverified' end,
  case when c.domain is not null then 'godaddy' end,
  case when c.domain is not null then lower(p.domain)<>'pghpoolservice.com' end,
  case
    when p.domain is null then 'missing_domain'
    when u.domain is not null then 'domain_unregistered'
    when c.domain is null then 'ownership_unverified'
    when lower(p.domain)='pghpoolservice.com' then 'website_not_live'
    else 'confirmed_control_live'
  end,
  case
    when p.domain is null then 'The Supabase property has no domain assigned.'
    when u.domain is not null then 'The authoritative registry has no current registration for this domain.'
    when c.domain is null then 'Registered publicly, but not present in the currently verified GoDaddy account. Do not test until account control is confirmed.'
    when lower(p.domain)='pghpoolservice.com' then 'Present in the verified GoDaddy account, but the website audit did not find a live page.'
    else 'Present in the verified GoDaddy account and returning a live website. Safe for controlled testing.'
  end,
  jsonb_build_object('classification_version',1,'registry_checked_at','2026-08-07T14:20:00Z','godaddy_account_checked_at','2026-08-07T14:00:00Z'),
  '2026-08-07T14:20:00Z'::timestamptz
from public.properties p
left join registry r on r.domain=lower(p.domain)
left join unregistered u on u.domain=lower(p.domain)
left join confirmed c on c.domain=lower(p.domain);

create or replace function public.dashboard_operational_buckets()
returns jsonb
language plpgsql
security definer
set search_path = public,private,pg_temp
as $$
declare v_role text; v_result jsonb;
begin
  v_role := private.require_dashboard_member();
  select jsonb_build_object(
    'generated_at',now(),
    'summary',jsonb_build_object(
      'ready_to_test',count(*) filter(where t.operational_bucket='ready_to_test'),
      'not_owned_or_missing',count(*) filter(where t.operational_bucket='not_owned_or_missing'),
      'do_not_touch',count(*) filter(where t.operational_bucket='do_not_touch')
    ),
    'rows',coalesce(jsonb_agg(jsonb_build_object(
      'property_id',p.id,'property_name',p.name,'domain',p.domain,'property_status',p.status,
      'operational_bucket',t.operational_bucket,'registration_status',t.registration_status,
      'registrar',t.registrar,'ownership_status',t.ownership_status,'control_provider',t.control_provider,
      'website_is_live',t.website_is_live,'reason_code',t.reason_code,'reason_detail',t.reason_detail,
      'manual_override',t.manual_override,'last_verified_at',t.last_verified_at
    ) order by t.operational_bucket,p.name),'[]'::jsonb)
  ) into v_result
  from public.properties p join public.property_operational_tags t on t.property_id=p.id;
  return v_result;
end;
$$;

revoke all on function public.dashboard_operational_buckets() from public,anon;
grant execute on function public.dashboard_operational_buckets() to authenticated;

comment on table public.property_operational_tags is 'Conservative operational control tags: ready to test, missing/not owned, or do not touch.';
comment on function public.dashboard_operational_buckets() is 'Authenticated non-PII operational queues backed by verified registry and account-control evidence.';
