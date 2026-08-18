-- Authenticated internal reporting surface and explicit readiness seeding.

create table if not exists public.dashboard_email_allowlist (
  email text primary key,
  role text not null default 'analyst' check (role in ('admin','analyst')),
  is_active boolean not null default true,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(btrim(email)))
);

create table if not exists public.dashboard_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','analyst')),
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(btrim(email)))
);

create index if not exists dashboard_members_active_role_idx on public.dashboard_members(is_active,role,user_id);
alter table public.dashboard_email_allowlist enable row level security;
alter table public.dashboard_members enable row level security;
revoke all on public.dashboard_email_allowlist from anon,authenticated;
revoke all on public.dashboard_members from anon,authenticated;
grant select on public.dashboard_members to authenticated;

drop policy if exists dashboard_members_select_self on public.dashboard_members;
create policy dashboard_members_select_self on public.dashboard_members
for select to authenticated
using ((select auth.uid()) = user_id and is_active);

create or replace function private.dashboard_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select dm.role from public.dashboard_members dm
  where dm.user_id=(select auth.uid()) and dm.is_active limit 1;
$$;

revoke all on function private.dashboard_role() from public,anon,authenticated;

create or replace function private.require_dashboard_member()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_role text;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='28000'; end if;
  select dm.role into v_role from public.dashboard_members dm
  where dm.user_id=(select auth.uid()) and dm.is_active;
  if v_role is null then raise exception 'dashboard membership required' using errcode='42501'; end if;
  return v_role;
end;
$$;

revoke all on function private.require_dashboard_member() from public,anon,authenticated;

create or replace function public.claim_dashboard_access()
returns jsonb
language plpgsql
security definer
set search_path = public,auth,pg_temp
as $$
declare v_user_id uuid := (select auth.uid()); v_email text; v_role text;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode='28000'; end if;
  select lower(email) into v_email from auth.users where id=v_user_id;
  select a.role into v_role from public.dashboard_email_allowlist a
  where a.email=v_email and a.is_active;
  if v_role is null then return jsonb_build_object('allowed',false,'reason','email_not_allowlisted','email',v_email); end if;
  insert into public.dashboard_members(user_id,email,role,is_active,last_seen_at)
  values (v_user_id,v_email,v_role,true,now())
  on conflict (user_id) do update set email=excluded.email,role=excluded.role,is_active=true,last_seen_at=now(),updated_at=now();
  return jsonb_build_object('allowed',true,'role',v_role,'email',v_email);
end;
$$;

revoke all on function public.claim_dashboard_access() from public,anon;
grant execute on function public.claim_dashboard_access() to authenticated;

insert into public.property_channel_readiness(property_id,channel,status,blockers,mapping_evidence)
select p.id,c.channel,
  case
    when c.channel='website_form' and exists(select 1 from public.property_form_templates pft where pft.property_id=p.id and pft.is_active) then 'test'
    when c.channel='phone_call' and exists(select 1 from public.voice_number_assignments vna where vna.property_id=p.id and vna.mapping_source='callrail_api' and vna.routing_status<>'conflict' and vna.confidence>=0.9) then 'test'
    else 'blocked'
  end,
  case
    when c.channel='website_form' and not exists(select 1 from public.property_form_templates pft where pft.property_id=p.id and pft.is_active) then array['missing_form_assignment']::text[]
    when c.channel='phone_call' and not exists(select 1 from public.voice_number_assignments vna where vna.property_id=p.id and vna.mapping_source='callrail_api' and vna.routing_status<>'conflict' and vna.confidence>=0.9) then array['missing_verified_callrail_mapping']::text[]
    when c.channel='google_ads' then array['missing_property_google_mapping']::text[]
    when c.channel='meta_ads' then array['missing_property_meta_mapping']::text[]
    else array[]::text[]
  end,
  jsonb_build_object('seeded_from','verified_supabase_inventory','seeded_at',now())
from public.properties p
cross join (values ('website_form'),('phone_call'),('google_ads'),('meta_ads')) c(channel)
where p.status='active'
on conflict (property_id,channel) do nothing;

update public.property_channel_readiness r
set blockers = array(select distinct x from unnest(
  r.blockers
  || case when p.domain is null then array['missing_domain']::text[] else array[]::text[] end
  || case when coalesce(pc.timezone,'')='' then array['missing_timezone']::text[] else array[]::text[] end
  || case when not exists(select 1 from public.property_services ps where ps.property_id=p.id and ps.is_active and ps.accepting_leads) then array['missing_services']::text[] else array[]::text[] end
) x), updated_at=now()
from public.properties p left join public.property_configurations pc on pc.property_id=p.id
where r.property_id=p.id;

alter table public.properties enable row level security;
alter table public.leads enable row level security;
alter table public.lead_attribution_touches enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.webhook_events enable row level security;
alter table public.daily_ad_metrics enable row level security;
alter table public.source_mappings enable row level security;

revoke all on public.properties,public.leads,public.lead_attribution_touches,public.lead_interactions,
  public.webhook_events,public.daily_ad_metrics,public.source_mappings from anon,authenticated;

create or replace view public.portfolio_performance_by_site_channel
with (security_invoker=true) as
select p.id property_id,p.property_key,p.name property_name,p.domain,p.status property_status,
  coalesce(d.acquisition_source,'none') acquisition_source,coalesce(d.conversion_channel,'none') conversion_channel,
  count(d.lead_id) filter(where d.received_at>=now()-interval '7 days') leads_7d,
  count(d.lead_id) filter(where d.received_at>=now()-interval '30 days') leads_30d,
  count(d.lead_id) filter(where d.received_at>=now()-interval '90 days') leads_90d,
  count(d.lead_id) lifetime_leads,max(d.received_at) last_lead_at
from public.properties p
left join public.lead_attribution_detail d on d.property_id=p.id and not d.is_test and not d.is_duplicate
group by p.id,p.property_key,p.name,p.domain,p.status,coalesce(d.acquisition_source,'none'),coalesce(d.conversion_channel,'none');

create or replace view public.site_tracking_readiness
with (security_invoker=true) as
select p.id property_id,p.property_key,p.name property_name,p.domain,p.status property_status,
  r.channel,coalesce(r.status,'blocked') readiness_status,
  case when p.domain is null then 'site_not_registered'
       when p.status<>'active' then 'site_not_live'
       when r.property_id is null then 'channel_not_tracked'
       when r.status='blocked' then 'channel_not_tracked'
       else 'tracked' end reporting_state,
  coalesce(r.blockers,array['missing_readiness_record']::text[]) blockers,
  r.last_tested_at,r.last_verified_at,r.mapping_evidence
from public.properties p
cross join (values ('website_form'),('phone_call'),('google_ads'),('meta_ads')) c(channel)
left join public.property_channel_readiness r on r.property_id=p.id and r.channel=c.channel;

create or replace view public.unmapped_provider_events
with (security_invoker=true) as
select n.id,n.provider,n.provider_event_id,n.event_type,n.mapping_status,n.processing_status,n.mapping_evidence,
  n.acquisition_source,n.conversion_channel,n.received_at,n.error_message
from public.normalized_provider_events n
where n.mapping_status in ('unmapped','ambiguous','blocked') or n.processing_status in ('rejected','failed');

create or replace view public.portfolio_paid_media_performance
with (security_invoker=true) as
select m.metric_date,m.platform,m.property_id,p.property_key,p.domain,m.account_id,m.campaign_id,m.campaign_name,
  sum(m.impressions) impressions,sum(m.clicks) clicks,sum(m.spend) spend,sum(m.conversions) platform_conversions,
  count(distinct l.id) filter(where not coalesce((l.metadata->>'test_mode')::boolean,false) and not l.is_duplicate) accepted_leads,
  case when count(distinct l.id) filter(where not coalesce((l.metadata->>'test_mode')::boolean,false) and not l.is_duplicate)>0
    then sum(m.spend)/count(distinct l.id) filter(where not coalesce((l.metadata->>'test_mode')::boolean,false) and not l.is_duplicate) else null end cpl
from public.daily_ad_metrics m
left join public.properties p on p.id=m.property_id
left join public.leads l on l.property_id=m.property_id and l.received_at::date=m.metric_date
  and ((m.platform='Google Ads' and (l.gclid is not null or l.gbraid is not null or l.wbraid is not null))
    or (m.platform='Meta Ads' and (l.fbclid is not null or l.lead_source='meta_ads')))
group by m.metric_date,m.platform,m.property_id,p.property_key,p.domain,m.account_id,m.campaign_id,m.campaign_name;

create or replace view public.portfolio_integration_health
with (security_invoker=true) as
select provider,max(started_at) last_run_at,max(finished_at) last_finished_at,
  (array_agg(status order by started_at desc))[1] last_status,
  (array_agg(records_received order by started_at desc))[1] last_records_received,
  (array_agg(records_unmapped order by started_at desc))[1] last_records_unmapped,
  count(*) filter(where status in ('partial','failed') and started_at>=now()-interval '7 days') failures_7d
from public.integration_sync_runs group by provider;

revoke all on public.portfolio_performance_by_site_channel,public.site_tracking_readiness,public.unmapped_provider_events,
  public.portfolio_paid_media_performance,public.portfolio_integration_health from public,anon,authenticated;
grant select on public.portfolio_performance_by_site_channel,public.site_tracking_readiness,public.unmapped_provider_events,
  public.portfolio_paid_media_performance,public.portfolio_integration_health to service_role;

create or replace function public.dashboard_bootstrap(p_window_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public,private,pg_temp
as $$
declare v_role text; v_days integer; v_result jsonb;
begin
  v_role := private.require_dashboard_member();
  v_days := greatest(1,least(coalesce(p_window_days,30),3650));
  update public.dashboard_members set last_seen_at=now(),updated_at=now() where user_id=(select auth.uid());
  select jsonb_build_object(
    'role',v_role,'window_days',v_days,'generated_at',now(),
    'portfolio',jsonb_build_object(
      'property_rows',(select count(*) from public.properties),
      'known_domains',(select count(distinct lower(domain)) from public.properties where domain is not null),
      'active_properties',(select count(*) from public.properties where status='active'),
      'live_channels',(select count(*) from public.property_channel_readiness where status='live'),
      'blocked_channels',(select count(*) from public.property_channel_readiness where status='blocked'),
      'leads_in_window',(select count(*) from public.leads where received_at>=now()-make_interval(days=>v_days) and not is_duplicate and not coalesce((metadata->>'test_mode')::boolean,false)),
      'spend_in_window',(select coalesce(sum(spend),0) from public.daily_ad_metrics where metric_date>=current_date-v_days)
    ),
    'channel_totals',(select coalesce(jsonb_agg(x order by x.lead_count desc),'[]'::jsonb) from (
      select acquisition_source,conversion_channel,count(*) lead_count
      from public.lead_attribution_detail where received_at>=now()-make_interval(days=>v_days) and not is_test and not is_duplicate
      group by acquisition_source,conversion_channel) x),
    'sites',(select coalesce(jsonb_agg(x order by x.leads_in_window desc,x.property_name),'[]'::jsonb) from (
      select p.id property_id,p.property_key,p.name property_name,p.domain,p.status,
        (select count(*) from public.leads l where l.property_id=p.id and l.received_at>=now()-make_interval(days=>v_days) and not l.is_duplicate and not coalesce((l.metadata->>'test_mode')::boolean,false)) leads_in_window,
        (select count(*) from public.leads l where l.property_id=p.id and l.received_at>=now()-interval '7 days' and not l.is_duplicate and not coalesce((l.metadata->>'test_mode')::boolean,false)) leads_7d,
        (select count(*) from public.leads l where l.property_id=p.id and l.received_at>=now()-interval '30 days' and not l.is_duplicate and not coalesce((l.metadata->>'test_mode')::boolean,false)) leads_30d,
        (select count(*) from public.leads l where l.property_id=p.id and l.received_at>=now()-interval '90 days' and not l.is_duplicate and not coalesce((l.metadata->>'test_mode')::boolean,false)) leads_90d,
        (select count(*) from public.leads l where l.property_id=p.id and not l.is_duplicate and not coalesce((l.metadata->>'test_mode')::boolean,false)) lifetime_leads,
        (select max(l.received_at) from public.leads l where l.property_id=p.id and not l.is_duplicate and not coalesce((l.metadata->>'test_mode')::boolean,false)) last_lead_at,
        jsonb_build_object(
          'website_form',coalesce((select r.status from public.property_channel_readiness r where r.property_id=p.id and r.channel='website_form'),'blocked'),
          'phone_call',coalesce((select r.status from public.property_channel_readiness r where r.property_id=p.id and r.channel='phone_call'),'blocked'),
          'google_ads',coalesce((select r.status from public.property_channel_readiness r where r.property_id=p.id and r.channel='google_ads'),'blocked'),
          'meta_ads',coalesce((select r.status from public.property_channel_readiness r where r.property_id=p.id and r.channel='meta_ads'),'blocked')) readiness,
        coalesce((select array_agg(distinct blocker) from public.property_channel_readiness r cross join lateral unnest(r.blockers) blocker where r.property_id=p.id),array[]::text[]) blockers
      from public.properties p) x),
    'readiness',(select coalesce(jsonb_agg(x order by x.channel,x.status),'[]'::jsonb) from (
      select channel,status,count(*) properties from public.property_channel_readiness group by channel,status) x),
    'ad_performance',(select coalesce(jsonb_agg(x order by x.metric_date desc,x.spend desc),'[]'::jsonb) from (
      select metric_date,platform,property_id,property_key,domain,account_id,campaign_id,campaign_name,impressions,clicks,spend,platform_conversions,accepted_leads,cpl
      from public.portfolio_paid_media_performance where metric_date>=current_date-v_days limit 500) x),
    'integration_health',(select coalesce(jsonb_agg(x order by x.provider),'[]'::jsonb) from public.portfolio_integration_health x),
    'unmapped_events',(select coalesce(jsonb_agg(x order by x.received_at desc),'[]'::jsonb) from (select * from public.unmapped_provider_events order by received_at desc limit 100) x)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.dashboard_bootstrap(integer) from public,anon;
grant execute on function public.dashboard_bootstrap(integer) to authenticated;

create or replace function public.dashboard_lead_page(
  p_limit integer default 50,
  p_cursor_received_at timestamptz default null,
  p_cursor_id bigint default null,
  p_property_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,private,pg_temp
as $$
declare v_role text; v_limit integer; v_rows jsonb; v_next_at timestamptz; v_next_id bigint;
begin
  v_role := private.require_dashboard_member();
  v_limit := greatest(1,least(coalesce(p_limit,50),100));
  with page as (
    select l.id,l.public_id,l.received_at,l.occurred_at,l.property_id,p.property_key,p.name property_name,
      l.source_system,l.lead_source acquisition_source,l.communication_channel conversion_channel,l.status,l.qualification_status,
      l.is_duplicate,coalesce((l.metadata->>'test_mode')::boolean,false) is_test,
      case when v_role='admin' then l.full_name else case when l.full_name is null then null else left(l.full_name,1)||'•••' end end full_name,
      case when v_role='admin' then l.phone else case when l.phone is null then null else '•••-•••-'||right(regexp_replace(l.phone,'\D','','g'),4) end end phone,
      case when v_role='admin' then l.email else case when l.email is null then null else left(l.email,1)||'•••@'||split_part(l.email,'@',2) end end email,
      l.campaign_name,l.utm_source,l.utm_medium,l.gclid is not null or l.gbraid is not null or l.wbraid is not null google_click_evidence,
      l.fbclid is not null meta_click_evidence,l.metadata
    from public.leads l left join public.properties p on p.id=l.property_id
    where (p_property_id is null or l.property_id=p_property_id)
      and (p_cursor_received_at is null or (l.received_at,l.id)<(p_cursor_received_at,coalesce(p_cursor_id,9223372036854775807)))
    order by l.received_at desc,l.id desc limit v_limit
  )
  select coalesce(jsonb_agg(page order by received_at desc,id desc),'[]'::jsonb),min(received_at),min(id) into v_rows,v_next_at,v_next_id from page;
  return jsonb_build_object('role',v_role,'rows',v_rows,'next_cursor',case when jsonb_array_length(v_rows)=v_limit then jsonb_build_object('received_at',v_next_at,'id',v_next_id) else null end);
end;
$$;

revoke all on function public.dashboard_lead_page(integer,timestamptz,bigint,bigint) from public,anon;
grant execute on function public.dashboard_lead_page(integer,timestamptz,bigint,bigint) to authenticated;

create or replace function public.dashboard_site_detail(p_property_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public,private,pg_temp
as $$
declare v_role text; v_result jsonb;
begin
  v_role := private.require_dashboard_member();
  select jsonb_build_object(
    'property',(select to_jsonb(x) from (select id,property_key,name,domain,status,city,state_region,primary_phone from public.properties where id=p_property_id) x),
    'readiness',(select coalesce(jsonb_agg(r order by channel),'[]'::jsonb) from public.site_tracking_readiness r where property_id=p_property_id),
    'attribution',(select coalesce(jsonb_agg(x order by x.lead_count desc),'[]'::jsonb) from (
      select acquisition_source,conversion_channel,count(*) lead_count,max(received_at) last_lead_at
      from public.lead_attribution_detail where property_id=p_property_id and not is_test and not is_duplicate group by acquisition_source,conversion_channel) x),
    'timeline',(select coalesce(jsonb_agg(x order by x.received_at desc),'[]'::jsonb) from (
      select n.provider,n.provider_event_id,n.event_type,n.acquisition_source,n.conversion_channel,n.mapping_status,n.processing_status,n.received_at,n.error_message
      from public.normalized_provider_events n where n.property_id=p_property_id order by n.received_at desc limit 100) x)
  ) into v_result;
  if v_result->'property' is null then raise exception 'property not found' using errcode='P0002'; end if;
  return v_result;
end;
$$;

revoke all on function public.dashboard_site_detail(bigint) from public,anon;
grant execute on function public.dashboard_site_detail(bigint) to authenticated;

comment on function public.dashboard_bootstrap(integer) is 'Authenticated aggregate dashboard payload. Defaults exclude tests and duplicates.';
comment on function public.dashboard_lead_page(integer,timestamptz,bigint,bigint) is 'Cursor-paginated leads. Analyst PII is masked; admin PII is visible.';
