-- Drainscapes nationwide demand controller.
-- Fulfillment is a hard gate. All seeded markets begin disabled and ad mutations
-- remain independently gated in both the database and Worker environment.

create table public.drainscapes_controller_settings (
  control_key text primary key default 'national' check (control_key = 'national'),
  scoring_enabled boolean not null default true,
  mutations_enabled boolean not null default false,
  national_daily_budget numeric(12,2) not null default 0 check (national_daily_budget >= 0 and national_daily_budget <= 1000000),
  allocation_cadence_minutes integer not null default 15 check (allocation_cadence_minutes between 15 and 1440),
  report_timezone text not null default 'America/New_York',
  report_hour_local integer not null default 7 check (report_hour_local between 0 and 23),
  max_budget_change_pct numeric(6,3) not null default 0.25 check (max_budget_change_pct between 0 and 1),
  minimum_opportunity_score numeric(7,4) not null default 0.05 check (minimum_opportunity_score between 0 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drainscapes_market_controls (
  market_id bigint primary key references public.markets(id) on delete cascade,
  owned boolean not null default true,
  fulfillment_enabled boolean not null default false,
  capacity_leads_per_day integer not null default 0 check (capacity_leads_per_day between 0 and 100000),
  priority_weight numeric(6,3) not null default 1 check (priority_weight between 0 and 10),
  target_cpl numeric(10,2) not null default 125 check (target_cpl > 0 and target_cpl <= 100000),
  minimum_daily_budget numeric(10,2) not null default 0 check (minimum_daily_budget >= 0),
  maximum_daily_budget numeric(10,2) not null default 1000 check (maximum_daily_budget >= 0),
  google_ads_customer_id text,
  google_ads_campaign_id text,
  google_ads_budget_resource_name text,
  pause_reason text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not fulfillment_enabled or capacity_leads_per_day > 0),
  check (minimum_daily_budget <= maximum_daily_budget),
  check (google_ads_customer_id is null or google_ads_customer_id ~ '^[0-9]{5,20}$'),
  check (google_ads_campaign_id is null or google_ads_campaign_id ~ '^[0-9]{5,30}$'),
  check (google_ads_budget_resource_name is null or google_ads_budget_resource_name ~ '^customers/[0-9]+/campaignBudgets/[0-9]+$')
);

create table public.drainscapes_weather_snapshots (
  id bigint generated always as identity primary key,
  market_id bigint not null references public.markets(id) on delete cascade,
  observed_at timestamptz not null,
  source text not null default 'weather.gov',
  precipitation_probability numeric(6,3) not null default 0 check (precipitation_probability between 0 and 1),
  forecast_precipitation_mm numeric(10,3) not null default 0 check (forecast_precipitation_mm >= 0),
  flood_alert_count integer not null default 0 check (flood_alert_count >= 0),
  severe_alert_count integer not null default 0 check (severe_alert_count >= 0),
  weather_score numeric(7,4) not null default 0 check (weather_score between 0 and 100),
  source_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(source_summary) = 'object'),
  created_at timestamptz not null default now(),
  unique (market_id, observed_at)
);

create table public.drainscapes_allocation_runs (
  id uuid primary key default gen_random_uuid(),
  calculated_at timestamptz not null default now(),
  national_daily_budget numeric(12,2) not null check (national_daily_budget >= 0),
  enabled_market_count integer not null default 0 check (enabled_market_count >= 0),
  allocated_daily_budget numeric(12,2) not null default 0 check (allocated_daily_budget >= 0),
  dry_run boolean not null default true,
  status text not null default 'succeeded' check (status in ('running','succeeded','partial','failed','skipped')),
  reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.drainscapes_market_allocations (
  run_id uuid not null references public.drainscapes_allocation_runs(id) on delete cascade,
  market_id bigint not null references public.markets(id) on delete cascade,
  opportunity_score numeric(9,4) not null default 0 check (opportunity_score >= 0),
  recommended_daily_budget numeric(10,2) not null default 0 check (recommended_daily_budget >= 0),
  previous_daily_budget numeric(10,2) check (previous_daily_budget is null or previous_daily_budget >= 0),
  applied_daily_budget numeric(10,2) check (applied_daily_budget is null or applied_daily_budget >= 0),
  decision text not null,
  apply_status text not null default 'dry_run' check (apply_status in ('dry_run','applied','skipped','failed')),
  factors jsonb not null default '{}'::jsonb check (jsonb_typeof(factors) = 'object'),
  error_message text,
  created_at timestamptz not null default now(),
  primary key (run_id, market_id)
);

create table public.drainscapes_daily_reports (
  report_date date primary key,
  generated_at timestamptz not null default now(),
  timezone text not null default 'America/New_York',
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  delivery_channel text not null default 'dashboard' check (delivery_channel in ('dashboard','webhook','email','sms','slack')),
  delivery_status text not null default 'stored' check (delivery_status in ('stored','sent','failed','skipped')),
  external_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drainscapes_control_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null check (target_type in ('controller','market')),
  target_key text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index drainscapes_weather_market_time_idx on public.drainscapes_weather_snapshots(market_id, observed_at desc);
create index drainscapes_allocation_runs_time_idx on public.drainscapes_allocation_runs(calculated_at desc);
create index drainscapes_market_allocations_market_time_idx on public.drainscapes_market_allocations(market_id, created_at desc);
create index drainscapes_audit_created_idx on public.drainscapes_control_audit(created_at desc);
create index drainscapes_controls_enabled_idx on public.drainscapes_market_controls(fulfillment_enabled, market_id) where fulfillment_enabled;

alter table public.drainscapes_controller_settings enable row level security;
alter table public.drainscapes_market_controls enable row level security;
alter table public.drainscapes_weather_snapshots enable row level security;
alter table public.drainscapes_allocation_runs enable row level security;
alter table public.drainscapes_market_allocations enable row level security;
alter table public.drainscapes_daily_reports enable row level security;
alter table public.drainscapes_control_audit enable row level security;

revoke all on public.drainscapes_controller_settings from public, anon, authenticated;
revoke all on public.drainscapes_market_controls from public, anon, authenticated;
revoke all on public.drainscapes_weather_snapshots from public, anon, authenticated;
revoke all on public.drainscapes_allocation_runs from public, anon, authenticated;
revoke all on public.drainscapes_market_allocations from public, anon, authenticated;
revoke all on public.drainscapes_daily_reports from public, anon, authenticated;
revoke all on public.drainscapes_control_audit from public, anon, authenticated;

insert into public.drainscapes_controller_settings(control_key) values ('national');

with state_seed(code, name, latitude, longitude, timezone) as (
  values
    ('AL','Alabama',32.8067,-86.7911,'America/Chicago'),
    ('AK','Alaska',61.3707,-152.4044,'America/Anchorage'),
    ('AZ','Arizona',33.7298,-111.4312,'America/Phoenix'),
    ('AR','Arkansas',34.9697,-92.3731,'America/Chicago'),
    ('CA','California',36.1162,-119.6816,'America/Los_Angeles'),
    ('CO','Colorado',39.0598,-105.3111,'America/Denver'),
    ('CT','Connecticut',41.5978,-72.7554,'America/New_York'),
    ('DE','Delaware',39.3185,-75.5071,'America/New_York'),
    ('DC','District of Columbia',38.8974,-77.0268,'America/New_York'),
    ('FL','Florida',27.7663,-81.6868,'America/New_York'),
    ('GA','Georgia',33.0406,-83.6431,'America/New_York'),
    ('HI','Hawaii',21.0943,-157.4983,'Pacific/Honolulu'),
    ('ID','Idaho',44.2405,-114.4788,'America/Boise'),
    ('IL','Illinois',40.3495,-88.9861,'America/Chicago'),
    ('IN','Indiana',39.8494,-86.2583,'America/Indiana/Indianapolis'),
    ('IA','Iowa',42.0115,-93.2105,'America/Chicago'),
    ('KS','Kansas',38.5266,-96.7265,'America/Chicago'),
    ('KY','Kentucky',37.6681,-84.6701,'America/New_York'),
    ('LA','Louisiana',31.1695,-91.8678,'America/Chicago'),
    ('ME','Maine',44.6939,-69.3819,'America/New_York'),
    ('MD','Maryland',39.0639,-76.8021,'America/New_York'),
    ('MA','Massachusetts',42.2302,-71.5301,'America/New_York'),
    ('MI','Michigan',43.3266,-84.5361,'America/Detroit'),
    ('MN','Minnesota',45.6945,-93.9002,'America/Chicago'),
    ('MS','Mississippi',32.7416,-89.6787,'America/Chicago'),
    ('MO','Missouri',38.4561,-92.2884,'America/Chicago'),
    ('MT','Montana',46.9219,-110.4544,'America/Denver'),
    ('NE','Nebraska',41.1254,-98.2681,'America/Chicago'),
    ('NV','Nevada',38.3135,-117.0554,'America/Los_Angeles'),
    ('NH','New Hampshire',43.4525,-71.5639,'America/New_York'),
    ('NJ','New Jersey',40.2989,-74.5210,'America/New_York'),
    ('NM','New Mexico',34.8405,-106.2485,'America/Denver'),
    ('NY','New York',42.1657,-74.9481,'America/New_York'),
    ('NC','North Carolina',35.6301,-79.8064,'America/New_York'),
    ('ND','North Dakota',47.5289,-99.7840,'America/Chicago'),
    ('OH','Ohio',40.3888,-82.7649,'America/New_York'),
    ('OK','Oklahoma',35.5653,-96.9289,'America/Chicago'),
    ('OR','Oregon',44.5720,-122.0709,'America/Los_Angeles'),
    ('PA','Pennsylvania',40.5908,-77.2098,'America/New_York'),
    ('RI','Rhode Island',41.6809,-71.5118,'America/New_York'),
    ('SC','South Carolina',33.8569,-80.9450,'America/New_York'),
    ('SD','South Dakota',44.2998,-99.4388,'America/Chicago'),
    ('TN','Tennessee',35.7478,-86.6923,'America/Chicago'),
    ('TX','Texas',31.0545,-97.5635,'America/Chicago'),
    ('UT','Utah',40.1500,-111.8624,'America/Denver'),
    ('VT','Vermont',44.0459,-72.7107,'America/New_York'),
    ('VA','Virginia',37.7693,-78.1700,'America/New_York'),
    ('WA','Washington',47.4009,-121.4905,'America/Los_Angeles'),
    ('WV','West Virginia',38.4912,-80.9545,'America/New_York'),
    ('WI','Wisconsin',44.2685,-89.6165,'America/Chicago'),
    ('WY','Wyoming',42.7560,-107.3025,'America/Denver')
), inserted_markets as (
  insert into public.markets(market_key,name,state_region,country_code,timezone,status,latitude,longitude)
  select 'drainscapes:state:' || code,name,code,'US',timezone,'active',latitude,longitude from state_seed
  on conflict (market_key) do update set
    name=excluded.name,state_region=excluded.state_region,country_code=excluded.country_code,
    timezone=excluded.timezone,latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now()
  returning id
)
insert into public.drainscapes_market_controls(market_id)
select id from inserted_markets
on conflict (market_id) do nothing;

create or replace function public.get_drainscapes_controller_state(p_ingest_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_portfolio_ingest_token(p_ingest_token);
  return jsonb_build_object(
    'controller',(select to_jsonb(s) from public.drainscapes_controller_settings s where s.control_key='national'),
    'markets',coalesce((
      select jsonb_agg(jsonb_build_object(
        'market_id',m.id,'market_key',m.market_key,'name',m.name,'state_region',m.state_region,
        'timezone',m.timezone,'latitude',m.latitude,'longitude',m.longitude,
        'owned',c.owned,'fulfillment_enabled',c.fulfillment_enabled,
        'capacity_leads_per_day',c.capacity_leads_per_day,'priority_weight',c.priority_weight,
        'target_cpl',c.target_cpl,'minimum_daily_budget',c.minimum_daily_budget,
        'maximum_daily_budget',c.maximum_daily_budget,'google_ads_customer_id',c.google_ads_customer_id,
        'google_ads_campaign_id',c.google_ads_campaign_id,
        'google_ads_budget_resource_name',c.google_ads_budget_resource_name,'pause_reason',c.pause_reason,
        'observed_cpl',perf.observed_cpl,'spend_30d',perf.spend_30d,'conversions_30d',perf.conversions_30d,
        'last_recommended_daily_budget',last_allocation.recommended_daily_budget
      ) order by m.name)
      from public.markets m
      join public.drainscapes_market_controls c on c.market_id=m.id
      left join lateral (
        select round(sum(d.spend)/nullif(sum(d.conversions),0),2) observed_cpl,
          round(sum(d.spend),2) spend_30d,round(sum(d.conversions),2) conversions_30d
        from public.daily_ad_metrics d
        where d.platform='Google Ads' and d.account_id=c.google_ads_customer_id
          and d.campaign_id=c.google_ads_campaign_id and d.metric_date >= current_date-29
      ) perf on true
      left join lateral (
        select a.recommended_daily_budget from public.drainscapes_market_allocations a
        where a.market_id=m.id order by a.created_at desc limit 1
      ) last_allocation on true
      where m.status='active'
    ),'[]'::jsonb)
    ,'latest_report_date',(select r.report_date from public.drainscapes_daily_reports r order by r.report_date desc limit 1)
  );
end;
$$;

revoke all on function public.get_drainscapes_controller_state(text) from public, authenticated;
grant execute on function public.get_drainscapes_controller_state(text) to anon, service_role;

create or replace function public.record_drainscapes_allocation_run(p_run jsonb,p_markets jsonb,p_ingest_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid := coalesce(nullif(p_run->>'id','')::uuid,gen_random_uuid());
  v_item jsonb;
  v_market_id bigint;
begin
  perform private.assert_portfolio_ingest_token(p_ingest_token);
  if jsonb_typeof(p_run) <> 'object' or jsonb_typeof(p_markets) <> 'array' then
    raise exception 'run must be an object and markets must be an array' using errcode='22023';
  end if;
  insert into public.drainscapes_allocation_runs(id,calculated_at,national_daily_budget,enabled_market_count,allocated_daily_budget,dry_run,status,reason,metadata)
  values (v_run_id,coalesce(nullif(p_run->>'calculated_at','')::timestamptz,now()),
    coalesce((p_run->>'national_daily_budget')::numeric,0),coalesce((p_run->>'enabled_market_count')::integer,0),
    coalesce((p_run->>'allocated_daily_budget')::numeric,0),coalesce((p_run->>'dry_run')::boolean,true),
    coalesce(nullif(p_run->>'status',''),'succeeded'),nullif(p_run->>'reason',''),coalesce(p_run->'metadata','{}'::jsonb));
  for v_item in select value from jsonb_array_elements(p_markets)
  loop
    v_market_id := (v_item->>'market_id')::bigint;
    if not exists (select 1 from public.drainscapes_market_controls c where c.market_id=v_market_id) then
      raise exception 'unknown Drainscapes market %',v_market_id using errcode='22023';
    end if;
    insert into public.drainscapes_weather_snapshots(market_id,observed_at,source,precipitation_probability,
      forecast_precipitation_mm,flood_alert_count,severe_alert_count,weather_score,source_summary)
    values (v_market_id,coalesce(nullif(v_item#>>'{weather,observed_at}','')::timestamptz,now()),
      coalesce(nullif(v_item#>>'{weather,source}',''),'weather.gov'),
      coalesce((v_item#>>'{weather,precipitation_probability}')::numeric,0),
      coalesce((v_item#>>'{weather,forecast_precipitation_mm}')::numeric,0),
      coalesce((v_item#>>'{weather,flood_alert_count}')::integer,0),
      coalesce((v_item#>>'{weather,severe_alert_count}')::integer,0),
      coalesce((v_item#>>'{weather,weather_score}')::numeric,0),
      coalesce(v_item#>'{weather,source_summary}','{}'::jsonb))
    on conflict (market_id,observed_at) do update set
      precipitation_probability=excluded.precipitation_probability,
      forecast_precipitation_mm=excluded.forecast_precipitation_mm,
      flood_alert_count=excluded.flood_alert_count,severe_alert_count=excluded.severe_alert_count,
      weather_score=excluded.weather_score,source_summary=excluded.source_summary;
    insert into public.drainscapes_market_allocations(run_id,market_id,opportunity_score,recommended_daily_budget,
      previous_daily_budget,applied_daily_budget,decision,apply_status,factors,error_message)
    values (v_run_id,v_market_id,coalesce((v_item->>'opportunity_score')::numeric,0),
      coalesce((v_item->>'recommended_daily_budget')::numeric,0),nullif(v_item->>'previous_daily_budget','')::numeric,
      nullif(v_item->>'applied_daily_budget','')::numeric,coalesce(nullif(v_item->>'decision',''),'hold'),
      coalesce(nullif(v_item->>'apply_status',''),'dry_run'),coalesce(v_item->'factors','{}'::jsonb),nullif(v_item->>'error_message',''));
  end loop;
  return jsonb_build_object('run_id',v_run_id,'markets',jsonb_array_length(p_markets));
end;
$$;

revoke all on function public.record_drainscapes_allocation_run(jsonb,jsonb,text) from public, authenticated;
grant execute on function public.record_drainscapes_allocation_run(jsonb,jsonb,text) to anon, service_role;

create or replace function public.record_drainscapes_daily_report(p_report jsonb,p_ingest_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.drainscapes_daily_reports;
begin
  perform private.assert_portfolio_ingest_token(p_ingest_token);
  insert into public.drainscapes_daily_reports(report_date,generated_at,timezone,payload,delivery_channel,delivery_status,external_message_id,error_message)
  values ((p_report->>'report_date')::date,coalesce(nullif(p_report->>'generated_at','')::timestamptz,now()),
    coalesce(nullif(p_report->>'timezone',''),'America/New_York'),coalesce(p_report->'payload','{}'::jsonb),
    coalesce(nullif(p_report->>'delivery_channel',''),'dashboard'),coalesce(nullif(p_report->>'delivery_status',''),'stored'),
    nullif(p_report->>'external_message_id',''),nullif(p_report->>'error_message',''))
  on conflict (report_date) do update set generated_at=excluded.generated_at,timezone=excluded.timezone,
    payload=excluded.payload,delivery_channel=excluded.delivery_channel,delivery_status=excluded.delivery_status,
    external_message_id=excluded.external_message_id,error_message=excluded.error_message,updated_at=now()
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.record_drainscapes_daily_report(jsonb,text) from public, authenticated;
grant execute on function public.record_drainscapes_daily_report(jsonb,text) to anon, service_role;

create or replace function public.dashboard_drainscapes_control()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_role text;
begin
  v_role := private.require_dashboard_member();
  return jsonb_build_object(
    'role',v_role,'can_edit',v_role='admin','generated_at',now(),
    'controller',(select to_jsonb(s) from public.drainscapes_controller_settings s where s.control_key='national'),
    'markets',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.name) from (
        select m.id market_id,m.market_key,m.name,m.state_region,m.timezone,m.latitude,m.longitude,
          c.owned,c.fulfillment_enabled,c.capacity_leads_per_day,c.priority_weight,c.target_cpl,
          c.minimum_daily_budget,c.maximum_daily_budget,c.google_ads_customer_id,c.google_ads_campaign_id,
          c.google_ads_budget_resource_name,c.pause_reason,c.updated_at,
          w.observed_at weather_observed_at,w.precipitation_probability,w.forecast_precipitation_mm,
          w.flood_alert_count,w.severe_alert_count,w.weather_score,
          a.opportunity_score,a.recommended_daily_budget,a.decision,a.apply_status,a.created_at allocation_created_at,
          perf.observed_cpl,perf.spend_30d,perf.conversions_30d
        from public.markets m
        join public.drainscapes_market_controls c on c.market_id=m.id
        left join lateral (select ws.* from public.drainscapes_weather_snapshots ws where ws.market_id=m.id order by ws.observed_at desc limit 1) w on true
        left join lateral (select ma.* from public.drainscapes_market_allocations ma where ma.market_id=m.id order by ma.created_at desc limit 1) a on true
        left join lateral (
          select round(sum(d.spend)/nullif(sum(d.conversions),0),2) observed_cpl,
            round(sum(d.spend),2) spend_30d,round(sum(d.conversions),2) conversions_30d
          from public.daily_ad_metrics d
          where d.platform='Google Ads' and d.account_id=c.google_ads_customer_id
            and d.campaign_id=c.google_ads_campaign_id and d.metric_date >= current_date-29
        ) perf on true
        where m.status='active'
      ) x
    ),'[]'::jsonb),
    'latest_run',(select to_jsonb(r) from public.drainscapes_allocation_runs r order by r.calculated_at desc limit 1),
    'latest_report',(select to_jsonb(r) from public.drainscapes_daily_reports r order by r.report_date desc limit 1),
    'recent_audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from
      (select ca.* from public.drainscapes_control_audit ca order by ca.created_at desc limit 20) a),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.dashboard_drainscapes_control() from public, anon;
grant execute on function public.dashboard_drainscapes_control() to authenticated;

create or replace function public.dashboard_update_drainscapes_market(p_market_id bigint,p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text; v_before public.drainscapes_market_controls; v_after public.drainscapes_market_controls; v_state text;
begin
  v_role := private.require_dashboard_member();
  if v_role <> 'admin' then raise exception 'admin role required' using errcode='42501'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'patch must be an object' using errcode='22023'; end if;
  select * into v_before from public.drainscapes_market_controls where market_id=p_market_id for update;
  if not found then raise exception 'unknown Drainscapes market' using errcode='22023'; end if;
  select state_region into v_state from public.markets where id=p_market_id;
  update public.drainscapes_market_controls set
    fulfillment_enabled=case when p_patch ? 'fulfillment_enabled' then (p_patch->>'fulfillment_enabled')::boolean else fulfillment_enabled end,
    capacity_leads_per_day=case when p_patch ? 'capacity_leads_per_day' then (p_patch->>'capacity_leads_per_day')::integer else capacity_leads_per_day end,
    priority_weight=case when p_patch ? 'priority_weight' then (p_patch->>'priority_weight')::numeric else priority_weight end,
    target_cpl=case when p_patch ? 'target_cpl' then (p_patch->>'target_cpl')::numeric else target_cpl end,
    minimum_daily_budget=case when p_patch ? 'minimum_daily_budget' then (p_patch->>'minimum_daily_budget')::numeric else minimum_daily_budget end,
    maximum_daily_budget=case when p_patch ? 'maximum_daily_budget' then (p_patch->>'maximum_daily_budget')::numeric else maximum_daily_budget end,
    google_ads_customer_id=case when p_patch ? 'google_ads_customer_id' then nullif(regexp_replace(p_patch->>'google_ads_customer_id','\D','','g'),'') else google_ads_customer_id end,
    google_ads_campaign_id=case when p_patch ? 'google_ads_campaign_id' then nullif(regexp_replace(p_patch->>'google_ads_campaign_id','\D','','g'),'') else google_ads_campaign_id end,
    google_ads_budget_resource_name=case when p_patch ? 'google_ads_budget_resource_name' then nullif(btrim(p_patch->>'google_ads_budget_resource_name'),'') else google_ads_budget_resource_name end,
    pause_reason=case when p_patch ? 'pause_reason' then nullif(btrim(p_patch->>'pause_reason'),'') else pause_reason end,
    updated_by=(select auth.uid()),updated_at=now()
  where market_id=p_market_id returning * into v_after;
  insert into public.drainscapes_control_audit(actor_user_id,action,target_type,target_key,before_state,after_state)
  values ((select auth.uid()),'market_update','market',coalesce(v_state,p_market_id::text),to_jsonb(v_before),to_jsonb(v_after));
  return to_jsonb(v_after);
end;
$$;

revoke all on function public.dashboard_update_drainscapes_market(bigint,jsonb) from public, anon;
grant execute on function public.dashboard_update_drainscapes_market(bigint,jsonb) to authenticated;

create or replace function public.dashboard_update_drainscapes_controller(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text; v_before public.drainscapes_controller_settings; v_after public.drainscapes_controller_settings;
begin
  v_role := private.require_dashboard_member();
  if v_role <> 'admin' then raise exception 'admin role required' using errcode='42501'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'patch must be an object' using errcode='22023'; end if;
  select * into v_before from public.drainscapes_controller_settings where control_key='national' for update;
  update public.drainscapes_controller_settings set
    scoring_enabled=case when p_patch ? 'scoring_enabled' then (p_patch->>'scoring_enabled')::boolean else scoring_enabled end,
    national_daily_budget=case when p_patch ? 'national_daily_budget' then (p_patch->>'national_daily_budget')::numeric else national_daily_budget end,
    allocation_cadence_minutes=case when p_patch ? 'allocation_cadence_minutes' then (p_patch->>'allocation_cadence_minutes')::integer else allocation_cadence_minutes end,
    report_timezone=case when p_patch ? 'report_timezone' then btrim(p_patch->>'report_timezone') else report_timezone end,
    report_hour_local=case when p_patch ? 'report_hour_local' then (p_patch->>'report_hour_local')::integer else report_hour_local end,
    max_budget_change_pct=case when p_patch ? 'max_budget_change_pct' then (p_patch->>'max_budget_change_pct')::numeric else max_budget_change_pct end,
    minimum_opportunity_score=case when p_patch ? 'minimum_opportunity_score' then (p_patch->>'minimum_opportunity_score')::numeric else minimum_opportunity_score end,
    updated_by=(select auth.uid()),updated_at=now()
  where control_key='national' returning * into v_after;
  insert into public.drainscapes_control_audit(actor_user_id,action,target_type,target_key,before_state,after_state)
  values ((select auth.uid()),'controller_update','controller','national',to_jsonb(v_before),to_jsonb(v_after));
  return to_jsonb(v_after);
end;
$$;

revoke all on function public.dashboard_update_drainscapes_controller(jsonb) from public, anon;
grant execute on function public.dashboard_update_drainscapes_controller(jsonb) to authenticated;

comment on table public.drainscapes_market_controls is 'Nationwide fulfillment and Google Ads control surface. Fulfillment is a hard zero-budget gate.';
comment on column public.drainscapes_controller_settings.mutations_enabled is 'Second database-side safety gate; the Worker environment must also explicitly enable mutations.';
comment on function public.dashboard_drainscapes_control() is 'Authenticated SECURITY DEFINER read boundary protected by private.require_dashboard_member.';
comment on function public.dashboard_update_drainscapes_market(bigint,jsonb) is 'Admin-only audited market control update boundary.';
comment on function public.dashboard_update_drainscapes_controller(jsonb) is 'Admin-only audited controller settings update boundary. Cannot enable ad mutations.';
