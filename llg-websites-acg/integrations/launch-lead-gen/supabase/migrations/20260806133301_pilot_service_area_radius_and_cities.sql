with markets(domain, center_latitude, center_longitude, radius_miles) as (
  values
    ('3vsanantoniopaverservices.com', 29.462809::numeric, -98.524635::numeric, 30::numeric),
    ('highendretainingwallcontractorstlouismo.com', 38.635699::numeric, -90.244582::numeric, 30::numeric),
    ('outdoordrainagesolutionsbridgeportct.com', 41.187393::numeric, -73.195757::numeric, 30::numeric),
    ('pghpoolservice.com', 40.439936::numeric, -79.975676::numeric, 30::numeric),
    ('retainingwallcontractorrichmondva.com', 37.531399::numeric, -77.476009::numeric, 30::numeric)
)
update public.properties p
set latitude = markets.center_latitude,
    longitude = markets.center_longitude,
    updated_at = now()
from markets
where p.domain = markets.domain;

with markets(domain, center_latitude, center_longitude, radius_miles) as (
  values
    ('3vsanantoniopaverservices.com', 29.462809::numeric, -98.524635::numeric, 30::numeric),
    ('highendretainingwallcontractorstlouismo.com', 38.635699::numeric, -90.244582::numeric, 30::numeric),
    ('outdoordrainagesolutionsbridgeportct.com', 41.187393::numeric, -73.195757::numeric, 30::numeric),
    ('pghpoolservice.com', 40.439936::numeric, -79.975676::numeric, 30::numeric),
    ('retainingwallcontractorrichmondva.com', 37.531399::numeric, -77.476009::numeric, 30::numeric)
)
update public.service_areas sa
set center_latitude = markets.center_latitude,
    center_longitude = markets.center_longitude,
    radius_miles = markets.radius_miles,
    is_included = true,
    priority = 20,
    is_active = true,
    metadata = sa.metadata || jsonb_build_object(
      'source', 'census-2025-place-centroid',
      'generated', true,
      'pilot_default', true
    ),
    updated_at = now()
from public.properties p
join markets on markets.domain = p.domain
where sa.property_id = p.id
  and sa.service_id is null
  and sa.area_type = 'radius';

with markets(domain, center_latitude, center_longitude, radius_miles) as (
  values
    ('3vsanantoniopaverservices.com', 29.462809::numeric, -98.524635::numeric, 30::numeric),
    ('highendretainingwallcontractorstlouismo.com', 38.635699::numeric, -90.244582::numeric, 30::numeric),
    ('outdoordrainagesolutionsbridgeportct.com', 41.187393::numeric, -73.195757::numeric, 30::numeric),
    ('pghpoolservice.com', 40.439936::numeric, -79.975676::numeric, 30::numeric),
    ('retainingwallcontractorrichmondva.com', 37.531399::numeric, -77.476009::numeric, 30::numeric)
)
insert into public.service_areas (
  property_id, service_id, area_type, center_latitude, center_longitude,
  radius_miles, is_included, priority, is_active, metadata
)
select p.id, null, 'radius', markets.center_latitude, markets.center_longitude,
       markets.radius_miles, true, 20, true,
       jsonb_build_object(
         'source', 'census-2025-place-centroid',
         'generated', true,
         'pilot_default', true
       )
from markets
join public.properties p on p.domain = markets.domain
where not exists (
  select 1 from public.service_areas sa
  where sa.property_id = p.id and sa.service_id is null and sa.area_type = 'radius'
);

with generated_cities(domain, state_region, city, priority) as (
  values
    ('3vsanantoniopaverservices.com', 'TX', 'San Antonio', 10),
    ('3vsanantoniopaverservices.com', 'TX', 'New Braunfels', 30),
    ('3vsanantoniopaverservices.com', 'TX', 'Schertz', 31),
    ('3vsanantoniopaverservices.com', 'TX', 'Cibolo', 32),
    ('3vsanantoniopaverservices.com', 'TX', 'Converse', 33),
    ('3vsanantoniopaverservices.com', 'TX', 'Universal City', 34),
    ('3vsanantoniopaverservices.com', 'TX', 'Live Oak', 35),
    ('3vsanantoniopaverservices.com', 'TX', 'Boerne', 36),
    ('3vsanantoniopaverservices.com', 'TX', 'Timberwood Park', 37),
    ('3vsanantoniopaverservices.com', 'TX', 'Leon Valley', 38),
    ('3vsanantoniopaverservices.com', 'TX', 'Selma', 39),
    ('3vsanantoniopaverservices.com', 'TX', 'Helotes', 40),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'St. Louis', 10),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'O''Fallon', 30),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Saint Charles', 31),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Saint Peters', 32),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Florissant', 33),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Chesterfield', 34),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Oakville', 35),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Wildwood', 36),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'University City', 37),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Ballwin', 38),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Kirkwood', 39),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Webster Groves', 40),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Bridgeport', 10),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'New Haven', 30),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Stamford', 31),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Waterbury', 32),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Norwalk', 33),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Danbury', 34),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Hamden', 35),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Fairfield', 36),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'West Haven', 37),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Milford', 38),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Stratford', 39),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Shelton', 40),
    ('pghpoolservice.com', 'PA', 'Pittsburgh', 10),
    ('pghpoolservice.com', 'PA', 'Penn Hills', 30),
    ('pghpoolservice.com', 'PA', 'Mount Lebanon', 31),
    ('pghpoolservice.com', 'PA', 'Bethel Park', 32),
    ('pghpoolservice.com', 'PA', 'Monroeville', 33),
    ('pghpoolservice.com', 'PA', 'Cranberry Township', 34),
    ('pghpoolservice.com', 'PA', 'Plum', 35),
    ('pghpoolservice.com', 'PA', 'Allison Park', 36),
    ('pghpoolservice.com', 'PA', 'Murrysville', 37),
    ('pghpoolservice.com', 'PA', 'West Mifflin', 38),
    ('pghpoolservice.com', 'PA', 'Upper Saint Clair', 39),
    ('pghpoolservice.com', 'PA', 'Greensburg', 40),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Richmond', 10),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Tuckahoe', 30),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Mechanicsville', 31),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Petersburg', 32),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Short Pump', 33),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Hopewell', 34),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Chester', 35),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Midlothian', 36),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Meadowbrook', 37),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Colonial Heights', 38),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Bon Air', 39),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Glen Allen', 40)
)
update public.service_areas sa
set priority = generated_cities.priority,
    is_included = true,
    is_active = true,
    metadata = sa.metadata || jsonb_build_object(
      'source', 'census-2025-geonames-cities5000-2026-02-09',
      'generated', true,
      'radius_miles', 30,
      'review_status', 'pilot-approved'
    ),
    updated_at = now()
from public.properties p
join generated_cities on generated_cities.domain = p.domain
where sa.property_id = p.id
  and sa.service_id is null
  and sa.area_type = 'city'
  and lower(sa.city) = lower(generated_cities.city)
  and lower(coalesce(sa.state_region, '')) = lower(generated_cities.state_region);

with generated_cities(domain, state_region, city, priority) as (
  values
    ('3vsanantoniopaverservices.com', 'TX', 'San Antonio', 10),
    ('3vsanantoniopaverservices.com', 'TX', 'New Braunfels', 30),
    ('3vsanantoniopaverservices.com', 'TX', 'Schertz', 31),
    ('3vsanantoniopaverservices.com', 'TX', 'Cibolo', 32),
    ('3vsanantoniopaverservices.com', 'TX', 'Converse', 33),
    ('3vsanantoniopaverservices.com', 'TX', 'Universal City', 34),
    ('3vsanantoniopaverservices.com', 'TX', 'Live Oak', 35),
    ('3vsanantoniopaverservices.com', 'TX', 'Boerne', 36),
    ('3vsanantoniopaverservices.com', 'TX', 'Timberwood Park', 37),
    ('3vsanantoniopaverservices.com', 'TX', 'Leon Valley', 38),
    ('3vsanantoniopaverservices.com', 'TX', 'Selma', 39),
    ('3vsanantoniopaverservices.com', 'TX', 'Helotes', 40),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'St. Louis', 10),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'O''Fallon', 30),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Saint Charles', 31),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Saint Peters', 32),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Florissant', 33),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Chesterfield', 34),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Oakville', 35),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Wildwood', 36),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'University City', 37),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Ballwin', 38),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Kirkwood', 39),
    ('highendretainingwallcontractorstlouismo.com', 'MO', 'Webster Groves', 40),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Bridgeport', 10),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'New Haven', 30),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Stamford', 31),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Waterbury', 32),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Norwalk', 33),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Danbury', 34),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Hamden', 35),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Fairfield', 36),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'West Haven', 37),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Milford', 38),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Stratford', 39),
    ('outdoordrainagesolutionsbridgeportct.com', 'CT', 'Shelton', 40),
    ('pghpoolservice.com', 'PA', 'Pittsburgh', 10),
    ('pghpoolservice.com', 'PA', 'Penn Hills', 30),
    ('pghpoolservice.com', 'PA', 'Mount Lebanon', 31),
    ('pghpoolservice.com', 'PA', 'Bethel Park', 32),
    ('pghpoolservice.com', 'PA', 'Monroeville', 33),
    ('pghpoolservice.com', 'PA', 'Cranberry Township', 34),
    ('pghpoolservice.com', 'PA', 'Plum', 35),
    ('pghpoolservice.com', 'PA', 'Allison Park', 36),
    ('pghpoolservice.com', 'PA', 'Murrysville', 37),
    ('pghpoolservice.com', 'PA', 'West Mifflin', 38),
    ('pghpoolservice.com', 'PA', 'Upper Saint Clair', 39),
    ('pghpoolservice.com', 'PA', 'Greensburg', 40),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Richmond', 10),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Tuckahoe', 30),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Mechanicsville', 31),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Petersburg', 32),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Short Pump', 33),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Hopewell', 34),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Chester', 35),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Midlothian', 36),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Meadowbrook', 37),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Colonial Heights', 38),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Bon Air', 39),
    ('retainingwallcontractorrichmondva.com', 'VA', 'Glen Allen', 40)
)
insert into public.service_areas (
  property_id, service_id, area_type, country_code, state_region, city,
  is_included, priority, is_active, metadata
)
select p.id, null, 'city', 'US', generated_cities.state_region, generated_cities.city,
       true, generated_cities.priority, true,
       jsonb_build_object(
         'source', 'census-2025-geonames-cities5000-2026-02-09',
         'generated', true,
         'radius_miles', 30,
         'review_status', 'pilot-approved'
       )
from generated_cities
join public.properties p on p.domain = generated_cities.domain
where not exists (
  select 1 from public.service_areas sa
  where sa.property_id = p.id
    and sa.service_id is null
    and sa.area_type = 'city'
    and lower(sa.city) = lower(generated_cities.city)
    and lower(coalesce(sa.state_region, '')) = lower(generated_cities.state_region)
);

create index if not exists service_areas_property_lookup_idx
  on public.service_areas (property_id, area_type, is_active, is_included);

create or replace function public.check_property_service_area(
  p_property_key text,
  p_city text,
  p_state_region text,
  p_postal_code text,
  p_latitude numeric,
  p_longitude numeric,
  p_ingest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected_hash bytea;
  v_property_id bigint;
  v_city text := lower(nullif(btrim(p_city), ''));
  v_state text := upper(nullif(btrim(p_state_region), ''));
  v_postal text := nullif(btrim(p_postal_code), '');
  v_center_latitude numeric;
  v_center_longitude numeric;
  v_radius_miles numeric;
  v_distance_miles double precision;
begin
  select secret_hash into v_expected_hash
  from private.integration_secrets
  where secret_key = 'bland_ingest';

  if v_expected_hash is null
    or extensions.digest(coalesce(p_ingest_token, ''), 'sha256') <> v_expected_hash then
    raise exception 'unauthorized service area request' using errcode = '28000';
  end if;

  select id into v_property_id
  from public.properties
  where property_key = lower(btrim(p_property_key));

  if v_property_id is null then
    return jsonb_build_object('decision', 'manual_review', 'reason', 'property_not_found');
  end if;

  if exists (
    select 1 from public.service_areas sa
    where sa.property_id = v_property_id and sa.is_active and not sa.is_included
      and ((v_postal is not null and sa.area_type = 'postal_code' and sa.postal_code = v_postal)
        or (v_city is not null and sa.area_type = 'city' and lower(sa.city) = v_city
          and (v_state is null or upper(sa.state_region) = v_state)))
  ) then
    return jsonb_build_object('decision', 'outside', 'reason', 'explicit_exclusion');
  end if;

  if exists (
    select 1 from public.service_areas sa
    where sa.property_id = v_property_id and sa.is_active and sa.is_included
      and ((v_postal is not null and sa.area_type = 'postal_code' and sa.postal_code = v_postal)
        or (v_city is not null and sa.area_type = 'city' and lower(sa.city) = v_city
          and (v_state is null or upper(sa.state_region) = v_state)))
  ) then
    return jsonb_build_object('decision', 'inside', 'reason', 'explicit_inclusion');
  end if;

  select sa.center_latitude, sa.center_longitude, sa.radius_miles
  into v_center_latitude, v_center_longitude, v_radius_miles
  from public.service_areas sa
  where sa.property_id = v_property_id and sa.is_active and sa.is_included
    and sa.area_type = 'radius'
  order by sa.priority, sa.id
  limit 1;

  if v_radius_miles is not null and p_latitude is not null and p_longitude is not null then
    v_distance_miles := 3958.7613 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians((p_latitude - v_center_latitude)::double precision) / 2), 2)
      + cos(radians(v_center_latitude::double precision))
      * cos(radians(p_latitude::double precision))
      * power(sin(radians((p_longitude - v_center_longitude)::double precision) / 2), 2)
    ))));
    return jsonb_build_object(
      'decision', case when v_distance_miles <= v_radius_miles then 'inside' else 'outside' end,
      'reason', 'radius_distance',
      'distance_miles', round(v_distance_miles::numeric, 1),
      'radius_miles', v_radius_miles
    );
  end if;

  return jsonb_build_object(
    'decision', 'manual_review',
    'reason', 'unlisted_location',
    'radius_miles', v_radius_miles
  );
end;
$$;

revoke all on function public.check_property_service_area(text, text, text, text, numeric, numeric, text)
  from public, authenticated;
grant execute on function public.check_property_service_area(text, text, text, text, numeric, numeric, text)
  to anon, service_role;

comment on function public.check_property_service_area(text, text, text, text, numeric, numeric, text) is
'Token-authenticated voice lookup returning inside, outside, or manual_review from explicit areas and the configured radius.';
