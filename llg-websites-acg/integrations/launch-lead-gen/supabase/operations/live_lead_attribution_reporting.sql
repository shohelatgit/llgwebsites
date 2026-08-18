-- Live historical lead reconciliation and channel attribution reporting.
-- Applied to Launch Lead Gen — Agency OS through the Supabase management API.

create table if not exists private.historical_lead_stage (
  ledger_id text primary key,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  staged_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.historical_lead_stage enable row level security;
revoke all on private.historical_lead_stage from public, anon, authenticated;

create table if not exists private.historical_lead_property_rules (
  id bigint generated always as identity primary key,
  market_label text not null,
  source_workbook_pattern text,
  property_id bigint references public.properties(id) on delete restrict,
  confidence text not null check (confidence in ('high', 'medium', 'unresolved')),
  priority integer not null default 100,
  rationale text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists historical_lead_property_rules_identity_idx
  on private.historical_lead_property_rules (
    lower(market_label),
    coalesce(lower(source_workbook_pattern), '')
  );

alter table private.historical_lead_property_rules enable row level security;
revoke all on private.historical_lead_property_rules from public, anon, authenticated;

create index if not exists historical_lead_property_rules_property_id_idx
  on private.historical_lead_property_rules (property_id)
  where property_id is not null;

create table if not exists private.historical_lead_matches (
  ledger_id text primary key references private.historical_lead_stage(ledger_id) on delete cascade,
  lead_id bigint not null references public.leads(id) on delete cascade,
  match_method text not null,
  matched_at timestamptz not null default now()
);

alter table private.historical_lead_matches enable row level security;
revoke all on private.historical_lead_matches from public, anon, authenticated;

create index if not exists historical_lead_matches_lead_id_idx
  on private.historical_lead_matches (lead_id);

with rules(market_label, source_workbook_pattern, domain, confidence, priority, rationale) as (
  values
    ('San Antonio Decks', '%New Braunfels%', 'deckbuildernewbraunfelstx.com', 'high', 300, 'Workbook names the New Braunfels site.'),
    ('San Antonio Decks', '%Boerne%', 'deckbuilderboernetx.com', 'high', 300, 'Workbook names the Boerne site.'),
    ('San Antonio Decks', '%Bulverde%', 'deckbuilderbulverdetx.com', 'high', 300, 'Workbook names the Bulverde site.'),
    ('San Antonio Decks', '%Schertz%', 'deckbuilderschertztx.com', 'high', 300, 'Workbook names the Schertz site.'),
    ('San Antonio Decks', '%Cibolo%', 'deckbuildercibolotx.com', 'high', 300, 'Workbook names the Cibolo site.'),
    ('San Antonio Decks', null, 'deckprossanantonio.com', 'medium', 100, 'Market-level fallback for the main San Antonio deck site.'),
    ('San Antonio drain', null, 'outdoordrainagesolutionssanantoniotx.com', 'high', 100, 'Exact market and service match.'),
    ('Houston drain', null, 'houstondrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('Summerfield FL drain', null, 'outdoordrainagesolutionsocalafl.com', 'high', 100, 'Summerfield/Ocala service property.'),
    ('Raleigh drain', null, 'raleighdrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('San Antonio Fence', null, 'fenceprosofsanantonio.com', 'high', 100, 'Exact market and service match.'),
    ('ALL FB DRAIN - ZIP', null, null, 'unresolved', 100, 'Portfolio-wide Meta campaign; no single site can be assigned safely.'),
    ('Seattle drain (Jesus)', null, 'outdoordrainagesolutionsseattlewa.com', 'high', 100, 'Market label includes the operator tied to this property.'),
    ('Nashville drain', null, 'nashvilledrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('Columbus drain', null, 'columbusdrainguys.com', 'high', 100, 'Exact market and service match.'),
    ('Savannah drain', null, 'savannahdrainguys.com', 'high', 100, 'Exact market and service match.'),
    ('Jacksonville drain', null, 'jacksonvillefrenchdrain.com', 'high', 100, 'Exact market and service match.'),
    ('Portland drain', null, 'portlanddrainguys.com', 'high', 100, 'Exact market and service match.'),
    ('STL Drain', null, 'stlouisdrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('Fort Worth drain', null, 'fortworthdrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('Charleston drain', null, 'charlestonfrenchdrain.com', 'high', 100, 'Exact market and service match.'),
    ('VB Drain', null, 'vbdrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('Tulsa walls-drain', '%Tulsa drain forms%', 'tulsadrainpros.com', 'high', 300, 'Workbook explicitly identifies Tulsa drain forms.'),
    ('Tulsa walls-drain', null, 'tulsaprecisionwalls.com', 'medium', 100, 'Remaining combined-market records are sourced from Tulsa walls workbooks.'),
    ('Atlanta drain', null, 'atlantadrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('Wilmington drain', null, 'wilmingtonfrenchdrain.com', 'high', 100, 'Exact market and service match.'),
    ('Charlotte drain', null, 'charlottedrainguys.com', 'high', 100, 'Exact market and service match.'),
    ('Seattle walls', null, 'seattleprecisionwalls.com', 'high', 100, 'Exact market and service match.'),
    ('Cleveland drain', null, 'clevelanddrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('OKC Walls', null, 'okcprecisionwalls.com', 'high', 100, 'Exact market and service match.'),
    ('OKC Drain', null, 'okcityfrenchdrain.com', 'high', 100, 'Exact market and service match.'),
    ('Seattle drain (Thalia)', null, 'seattledrainpros.com', 'high', 100, 'Market label includes the operator tied to this property.'),
    ('Indianapolis drain', null, 'indydrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('Atlanta walls', null, 'atlantaprecisionwalls.com', 'high', 100, 'Exact market and service match.'),
    ('IL drain', null, null, 'unresolved', 100, 'Historical operator does not map deterministically to either Chicago drainage property.'),
    ('ALL FB DRAIN - STREET', null, null, 'unresolved', 100, 'Portfolio-wide Meta campaign; no single site can be assigned safely.'),
    ('Birmingham walls', null, 'birminghamprecisionwalls.com', 'high', 100, 'Exact market and service match.'),
    ('Birmingham drain', null, 'birminghamdrainpros.com', 'high', 100, 'Exact market and service match.'),
    ('Cincinnati drain', null, 'cincinnatifrenchdrains.com', 'high', 100, 'Exact market and service match.'),
    ('Richmond drain', null, 'richmondfrenchdrain.com', 'high', 100, 'Exact market and service match.'),
    ('Kansas City drain', null, 'kansascitydrainguys.com', 'high', 100, 'Exact market and service match.'),
    ('AL drain', null, null, 'unresolved', 100, 'State-wide label has no deterministic property mapping.'),
    ('Jackson drain', null, 'jacksonfrenchdrain.com', 'high', 100, 'Exact market and service match.'),
    ('SW FL Drain', null, 'outdoordrainagesolutionscapecoralfl.com', 'medium', 100, 'Southwest Florida drainage property; retained as medium confidence.'),
    ('Morgantown Fence', null, 'morgantownfencepros.com', 'high', 100, 'Exact market and service match.'),
    ('Houston drain CUFR', null, 'houstondrainpros.com', 'medium', 100, 'Historical CUFR Houston drainage book maps to the current Houston property.'),
    ('PGH Drain', null, 'pghfrenchdrains.com', 'high', 100, 'Exact market and service match.'),
    ('Dallas drain', null, 'dallasdrainguys.com', 'high', 100, 'Exact market and service match.'),
    ('OK drain', null, 'outdoordrainagesolutionsoklahomacityok.com', 'medium', 100, 'Oklahoma drainage property; market label is broader than the city.'),
    ('Chicago drain DRR', null, 'chicagodrainageguys.com', 'medium', 100, 'Do Right Rooter historical Chicago drainage book.'),
    ('NorCal drain', null, null, 'unresolved', 100, 'No Northern California drainage property exists in the current portfolio.'),
    ('CT Connecticut drain', null, 'connecticutdrainpros.com', 'high', 100, 'Exact state and service match.'),
    ('NJ Drain', null, 'outdoordrainagesolutionsnewjersey.com', 'high', 100, 'Exact state and service match.'),
    ('New Jersey Fence', null, 'newjerseyfencingcompany.com', 'high', 100, 'Exact market and service match.'),
    ('VA drain', null, null, 'unresolved', 100, 'State-wide label is ambiguous between Virginia Beach and Richmond.'),
    ('Greensboro drain', null, 'greensborodrainguys.com', 'high', 100, 'Exact market and service match.'),
    ('Louisville walls', null, 'louisvilleprecisionwalls.com', 'high', 100, 'Exact market and service match.'),
    ('Charlotte crawl space', null, 'charlottecrawlspace.com', 'high', 100, 'Exact market and service match.'),
    ('Cincinnati walls', null, 'cincinnatiprecisionwalls.com', 'high', 100, 'Exact market and service match.'),
    ('Hitman Solutions', null, null, 'unresolved', 100, 'Client label does not identify a current website property.'),
    ('Dayton drain-walls', null, null, 'unresolved', 100, 'No Dayton drainage or wall property exists in the current portfolio.'),
    ('Richmond walls', null, 'retainingwallcontractorrichmondva.com', 'high', 100, 'Exact market and service match.'),
    ('Salt Lake Wall', null, 'saltlakecityprecisionwalls.com', 'high', 100, 'Exact market and service match.'),
    ('St. Louis walls', null, 'highendretainingwallcontractorstlouismo.com', 'high', 100, 'Exact market and service match.'),
    ('CK Landscaping', null, 'pristinelandscapingsa.com', 'medium', 100, 'Historical CK landscaping book maps to the current San Antonio landscaping property.'),
    ('Fort Worth Hardscape', null, 'paverinstallationprosfortworthtx.com', 'high', 100, 'Exact market and service match.'),
    ('Louisville Wall', null, 'louisvilleprecisionwalls.com', 'high', 100, 'Exact market and service match.'),
    ('New Orleans Drain', null, 'neworleansfrenchdrain.com', 'high', 100, 'Exact market and service match.'),
    ('Little Rock Drain', null, 'littlerockfrenchdrain.com', 'high', 100, 'Exact market and service match.'),
    ('Baltimore Drain', null, 'baltimorefrenchdrain.com', 'high', 100, 'Exact market and service match.'),
    ('San Antonio walls', null, 'retainingwallcontractorsanantoniotx.com', 'high', 100, 'Exact market and service match.'),
    ('Wilmington land clearing', null, 'landclearingserviceswilmingtonnc.com', 'high', 100, 'Exact market and service match.'),
    ('McAllen Concrete', null, 'concretecontractorsmcallen.com', 'high', 100, 'Exact market and service match.'),
    ('Little Rock Wall', null, 'littlerockprecisionwalls.com', 'high', 100, 'Exact market and service match.'),
    ('Raleigh crawlspace', null, 'crawlspaceraleigh.com', 'high', 100, 'Exact market and service match.'),
    ('Austin Drain', null, 'austindrainguys.com', 'high', 100, 'Exact market and service match.')
)
insert into private.historical_lead_property_rules (
  market_label, source_workbook_pattern, property_id, confidence, priority, rationale
)
select r.market_label, r.source_workbook_pattern, p.id, r.confidence, r.priority, r.rationale
from rules r
left join public.properties p on p.domain = r.domain
on conflict (lower(market_label), coalesce(lower(source_workbook_pattern), ''))
do update set
  property_id = excluded.property_id,
  confidence = excluded.confidence,
  priority = excluded.priority,
  rationale = excluded.rationale,
  is_active = true,
  updated_at = now();

create or replace function private.merge_historical_leads()
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_matched integer := 0;
  v_updated integer := 0;
  v_inserted integer := 0;
begin
  insert into private.historical_lead_matches (ledger_id, lead_id, match_method)
  select s.ledger_id, l.id, 'exact_original_source_record_id'
  from private.historical_lead_stage s
  join public.leads l
    on nullif(l.metadata->>'original_source_record_id', '') is not null
   and nullif(l.metadata->>'original_source_record_id', '') = nullif(s.payload->>'Source Lead ID', '')
  where nullif(s.payload->>'Source Lead ID', '') is not null
  on conflict (ledger_id) do nothing;
  get diagnostics v_matched = row_count;

  with resolved as (
    select s.ledger_id, rule.property_id, rule.confidence, rule.rationale
    from private.historical_lead_stage s
    left join lateral (
      select r.property_id, r.confidence, r.rationale
      from private.historical_lead_property_rules r
      where r.is_active
        and lower(r.market_label) = lower(s.payload->>'Market / Client')
        and (r.source_workbook_pattern is null or s.payload->>'Source Workbook' ilike r.source_workbook_pattern)
      order by (r.source_workbook_pattern is not null) desc, r.priority desc, r.id
      limit 1
    ) rule on true
  )
  update public.leads l
  set property_id = coalesce(l.property_id, r.property_id),
      assigned_client_id = coalesce(l.assigned_client_id, p.client_id),
      metadata = l.metadata || jsonb_strip_nulls(jsonb_build_object(
        'historical_ledger_id', m.ledger_id,
        'historical_market_label', s.payload->>'Market / Client',
        'site_attribution_confidence', r.confidence,
        'site_attribution_rationale', r.rationale
      )),
      updated_at = now()
  from private.historical_lead_matches m
  join private.historical_lead_stage s on s.ledger_id = m.ledger_id
  join resolved r on r.ledger_id = m.ledger_id
  left join public.properties p on p.id = r.property_id
  where l.id = m.lead_id;
  get diagnostics v_updated = row_count;

  with staged as (
    select
      s.ledger_id,
      s.payload,
      rule.property_id,
      rule.confidence,
      rule.rationale,
      regexp_replace(coalesce(s.payload->>'Phone', ''), '[^0-9]', '', 'g') as phone_digits
    from private.historical_lead_stage s
    left join lateral (
      select r.property_id, r.confidence, r.rationale
      from private.historical_lead_property_rules r
      where r.is_active
        and lower(r.market_label) = lower(s.payload->>'Market / Client')
        and (r.source_workbook_pattern is null or s.payload->>'Source Workbook' ilike r.source_workbook_pattern)
      order by (r.source_workbook_pattern is not null) desc, r.priority desc, r.id
      limit 1
    ) rule on true
    where not exists (
      select 1 from private.historical_lead_matches m where m.ledger_id = s.ledger_id
    )
  )
  insert into public.leads (
    ingestion_key, source_system, source_record_id,
    property_id, market_id, service_id, assigned_client_id,
    received_at, occurred_at,
    full_name, phone, normalized_phone, email, normalized_email,
    address_line_1, city, postal_code,
    lead_source, source_category, communication_channel, conversion_source,
    campaign_name, first_touch, last_touch,
    status, qualification_status, is_billable, is_duplicate,
    metadata, created_at, updated_at
  )
  select
    'historical-ledger:' || st.ledger_id,
    'historical_ledger',
    st.ledger_id,
    st.property_id,
    p.market_id,
    ps.service_id,
    p.client_id,
    case
      when st.payload->>'Submitted At' ~ '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$'
        then to_timestamp(st.payload->>'Submitted At', 'YYYY-MM-DD HH24:MI')
      else timestamptz '1900-01-01 00:00:00+00'
    end,
    case
      when st.payload->>'Submitted At' ~ '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$'
        then to_timestamp(st.payload->>'Submitted At', 'YYYY-MM-DD HH24:MI')
      else null
    end,
    nullif(st.payload->>'Name', ''),
    nullif(st.payload->>'Phone', ''),
    case
      when length(st.phone_digits) = 10 then '+1' || st.phone_digits
      when length(st.phone_digits) = 11 and left(st.phone_digits, 1) = '1' then '+' || st.phone_digits
      when length(st.phone_digits) between 8 and 15 then '+' || st.phone_digits
      else null
    end,
    nullif(st.payload->>'Email', ''),
    nullif(lower(trim(st.payload->>'Email')), ''),
    nullif(st.payload->>'Address', ''),
    nullif(st.payload->>'City', ''),
    nullif(st.payload->>'ZIP', ''),
    case st.payload->>'Lead Source'
      when 'Facebook / Meta' then 'Meta'
      when 'Inbound Call' then 'Website Phone Call'
      else nullif(st.payload->>'Lead Source', '')
    end,
    case
      when st.payload->>'Lead Source' = 'Facebook / Meta' then 'paid'
      else 'unknown'
    end,
    case
      when st.payload->>'Record Type' = 'Call' then 'call'
      else 'website_form'
    end,
    case st.payload->>'Lead Source'
      when 'Facebook / Meta' then 'Meta Lead Form'
      when 'Inbound Call' then 'Historical Website-Routed Call'
      when 'Sitepanda Form' then 'Sitepanda'
      when 'Fillout Form' then 'Fillout'
      when 'Website Form' then 'Website Form'
      when 'Google / Website Form' then 'Google / Website Form (Ambiguous)'
      else 'Historical Lead Ledger'
    end,
    nullif(st.payload->>'Form / Campaign', ''),
    jsonb_strip_nulls(jsonb_build_object(
      'source', st.payload->>'Lead Source',
      'campaign', nullif(st.payload->>'Form / Campaign', ''),
      'historical', true
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'source', st.payload->>'Lead Source',
      'campaign', nullif(st.payload->>'Form / Campaign', ''),
      'historical', true
    )),
    case
      when st.payload->>'Workflow Status' in ('Contacted', 'Answered Call', 'Left VM', 'Voicemail', 'Voicemail w/ Transcript') then 'contacted'
      when st.payload->>'Workflow Status' in ('Scheduled Quote', 'Sent Quote', 'In Process') then 'qualified'
      when st.payload->>'Workflow Status' in ('Not Qualified', 'Outside Service Area', 'Doesn''t Need Services', 'Phone # Not Working', 'Didn''t Contact Us', 'Service not offered') then 'unqualified'
      when st.payload->>'Workflow Status' = 'SPAM' then 'spam'
      when st.payload->>'Workflow Status' = 'Duplicate' then 'duplicate'
      when st.payload->>'Workflow Status' in ('Closed', 'Hired Other Company') then 'lost'
      else 'new'
    end,
    case
      when st.payload->>'Workflow Status' in ('Scheduled Quote', 'Sent Quote', 'In Process') then 'qualified'
      when st.payload->>'Workflow Status' in ('Not Qualified', 'Outside Service Area', 'Doesn''t Need Services', 'Phone # Not Working', 'Didn''t Contact Us', 'Service not offered') then 'unqualified'
      else 'unreviewed'
    end,
    null,
    st.payload->>'Workflow Status' = 'Duplicate',
    jsonb_strip_nulls(jsonb_build_object(
      'historical_import', true,
      'historical_ledger_id', st.ledger_id,
      'historical_market_label', st.payload->>'Market / Client',
      'historical_lead_source', st.payload->>'Lead Source',
      'historical_record_type', st.payload->>'Record Type',
      'historical_workflow_status', st.payload->>'Workflow Status',
      'service_requested', nullif(st.payload->>'Service Requested', ''),
      'timeline', nullif(st.payload->>'Timeline', ''),
      'budget', nullif(st.payload->>'Budget', ''),
      'project_details', nullif(st.payload->>'Project Details', ''),
      'source_workbook', st.payload->>'Source Workbook',
      'source_sheet', st.payload->>'Source Sheet',
      'source_row', nullif(st.payload->>'Source Row', ''),
      'source_lead_id', nullif(st.payload->>'Source Lead ID', ''),
      'duplicate_source_count', nullif(st.payload->>'Duplicate Source Count', ''),
      'duplicate_key', nullif(st.payload->>'Duplicate Key', ''),
      'site_attribution_confidence', coalesce(st.confidence, 'unresolved'),
      'site_attribution_rationale', coalesce(st.rationale, 'No active property rule matched.'),
      'test_mode', st.payload->>'Workflow Status' = 'Test',
      'historical_timestamp_timezone', 'unknown; stored using database session timezone'
    )),
    now(),
    now()
  from staged st
  left join public.properties p on p.id = st.property_id
  left join lateral (
    select property_service.service_id
    from public.property_services property_service
    where property_service.property_id = st.property_id
    order by property_service.is_primary desc, property_service.service_id
    limit 1
  ) ps on true
  on conflict (source_system, source_record_id)
  do update set
    property_id = coalesce(public.leads.property_id, excluded.property_id),
    market_id = coalesce(public.leads.market_id, excluded.market_id),
    service_id = coalesce(public.leads.service_id, excluded.service_id),
    assigned_client_id = coalesce(public.leads.assigned_client_id, excluded.assigned_client_id),
    metadata = public.leads.metadata || excluded.metadata,
    updated_at = now();
  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'staged', (select count(*) from private.historical_lead_stage),
    'matched_existing_this_run', v_matched,
    'updated_existing', v_updated,
    'inserted_or_refreshed_historical', v_inserted,
    'total_public_leads', (select count(*) from public.leads)
  );
end;
$$;

revoke all on function private.merge_historical_leads() from public, anon, authenticated;

drop view if exists public.lead_attribution_by_site_channel;
drop view if exists public.lead_attribution_detail;

create or replace view public.lead_attribution_detail
with (security_invoker = true)
as
select
  l.id as lead_id,
  l.public_id as lead_public_id,
  l.received_at,
  l.occurred_at,
  l.property_id,
  p.property_key,
  p.domain,
  p.name as property_name,
  p.status as property_status,
  c.id as client_id,
  c.name as client_name,
  l.source_system,
  l.lead_source as raw_lead_source,
  l.source_category,
  l.communication_channel,
  l.conversion_source,
  l.utm_source,
  l.utm_medium,
  l.utm_campaign,
  l.campaign_name,
  case
    when l.gclid is not null or l.gbraid is not null or l.wbraid is not null
      or (lower(coalesce(l.utm_source, '')) in ('google', 'adwords') and lower(coalesce(l.utm_medium, '')) in ('cpc', 'ppc', 'paid', 'paid_search'))
      then 'google_ads_confirmed'
    when l.fbclid is not null
      or lower(coalesce(l.utm_source, '')) in ('facebook', 'fb', 'instagram', 'ig', 'meta')
      or lower(coalesce(l.lead_source, '')) in ('meta', 'facebook', 'facebook ads', 'instagram', 'instagram ads')
      or lower(coalesce(l.conversion_source, '')) in ('facebook ads', 'instagram ads', 'meta lead form')
      then 'meta_ads'
    when lower(coalesce(l.campaign_name, '')) ~ '(gads|google ads)'
      then 'google_ads_inferred'
    when lower(coalesce(l.campaign_name, '')) ~ '(gmb|organic)'
      then 'google_organic_inferred'
    when lower(coalesce(l.campaign_name, '')) = 'google'
      then 'google_source_unverified'
    when lower(coalesce(l.lead_source, '')) = 'google / website form'
      or lower(coalesce(l.conversion_source, '')) like 'google / website form%'
      then 'google_or_website_unresolved'
    when l.communication_channel in ('website_form', 'general_form') then 'website_or_direct'
    else 'unknown'
  end as acquisition_source,
  case
    when l.gclid is not null or l.gbraid is not null or l.wbraid is not null or l.fbclid is not null then 'confirmed'
    when lower(coalesce(l.utm_source, '')) <> '' then 'confirmed'
    when lower(coalesce(l.campaign_name, '')) ~ '(gads|google ads|gmb|organic)' then 'inferred'
    when lower(coalesce(l.lead_source, '')) = 'google / website form'
      or lower(coalesce(l.conversion_source, '')) like 'google / website form%' then 'ambiguous'
    when lower(coalesce(l.lead_source, '')) in ('meta', 'facebook', 'facebook ads', 'instagram', 'instagram ads')
      or lower(coalesce(l.conversion_source, '')) in ('facebook ads', 'instagram ads', 'meta lead form') then 'source_label'
    else 'unknown'
  end as acquisition_confidence,
  case
    when l.communication_channel = 'call' or l.callrail_call_id is not null or l.bland_call_id is not null then 'phone_call'
    when l.communication_channel = 'text' or l.source_system in ('textmagic', 'callrail_sms') then 'sms'
    when l.communication_channel in ('website_form', 'general_form') then 'website_form'
    when l.communication_channel = 'email' then 'email'
    else 'other'
  end as conversion_channel,
  case
    when l.gclid is not null or l.gbraid is not null or l.wbraid is not null
      or (lower(coalesce(l.utm_source, '')) in ('google', 'adwords') and lower(coalesce(l.utm_medium, '')) in ('cpc', 'ppc', 'paid', 'paid_search'))
      then 'google_ads'
    when l.fbclid is not null
      or lower(coalesce(l.utm_source, '')) in ('facebook', 'fb', 'instagram', 'ig', 'meta')
      or lower(coalesce(l.lead_source, '')) in ('meta', 'facebook', 'facebook ads', 'instagram', 'instagram ads')
      or lower(coalesce(l.conversion_source, '')) in ('facebook ads', 'instagram ads', 'meta lead form')
      then 'meta_ads'
    when lower(coalesce(l.lead_source, '')) = 'google / website form'
      or lower(coalesce(l.conversion_source, '')) like 'google / website form%'
      then 'google_or_website_form'
    when l.communication_channel = 'call' or l.callrail_call_id is not null or l.bland_call_id is not null
      then 'phone_call'
    when l.communication_channel = 'text' or l.source_system in ('textmagic', 'callrail_sms')
      then 'sms'
    when l.communication_channel in ('website_form', 'general_form')
      then 'website_form'
    when l.communication_channel = 'email' then 'email'
    else 'other'
  end as channel_group,
  case
    when l.communication_channel = 'call' and l.property_id is not null then 'phone_call_via_mapped_site'
    when l.communication_channel = 'call' then 'phone_call_unattributed'
    when l.communication_channel in ('website_form', 'general_form') and l.property_id is not null then 'form_via_mapped_site'
    when l.communication_channel in ('website_form', 'general_form') then 'form_unattributed'
    else coalesce(l.conversion_source, l.communication_channel, 'unknown')
  end as channel_detail,
  case
    when l.property_id is not null then 'attributed'
    else 'unattributed'
  end as site_attribution_status,
  coalesce(l.metadata->>'site_attribution_confidence', case when l.property_id is not null then 'direct' else 'unresolved' end) as site_attribution_confidence,
  coalesce((l.metadata->>'test_mode')::boolean, false) as is_test,
  l.status,
  l.qualification_status,
  l.is_billable,
  l.is_duplicate
from public.leads l
left join public.properties p on p.id = l.property_id
left join public.clients c on c.id = coalesce(l.assigned_client_id, p.client_id);

create or replace view public.lead_attribution_by_site_channel
with (security_invoker = true)
as
select
  property_id,
  property_key,
  domain,
  property_name,
  client_id,
  client_name,
  channel_group,
  channel_detail,
  acquisition_source,
  acquisition_confidence,
  conversion_channel,
  site_attribution_status,
  site_attribution_confidence,
  is_test,
  count(*)::bigint as lead_count,
  count(*) filter (where not is_duplicate)::bigint as non_duplicate_lead_count,
  count(*) filter (where qualification_status = 'qualified')::bigint as qualified_lead_count,
  count(*) filter (where is_billable is true)::bigint as billable_lead_count,
  min(received_at) as first_lead_at,
  max(received_at) as latest_lead_at
from public.lead_attribution_detail
group by
  property_id, property_key, domain, property_name, client_id, client_name,
  channel_group, channel_detail, acquisition_source, acquisition_confidence, conversion_channel,
  site_attribution_status, site_attribution_confidence, is_test;

revoke all on public.lead_attribution_detail from public, anon, authenticated, service_role;
revoke all on public.lead_attribution_by_site_channel from public, anon, authenticated, service_role;
grant select on public.lead_attribution_detail to service_role;
grant select on public.lead_attribution_by_site_channel to service_role;

comment on view public.lead_attribution_detail is
  'Live per-lead site and channel attribution. Google Ads requires click or paid UTM evidence; ambiguous historical Google/website forms remain a separate bucket.';

comment on view public.lead_attribution_by_site_channel is
  'Live rollup of leads by site, channel, attribution confidence, and test status. Restricted to service-role and database operators.';
