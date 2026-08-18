grant select(id,name,domain,status) on public.properties to anon,authenticated;
grant select(property_id,operational_bucket,registration_status,registrar,ownership_status,control_provider,website_is_live,reason_code,reason_detail,last_verified_at)
  on public.property_operational_tags to anon,authenticated;

create policy "public may read sanitized operational properties"
  on public.properties for select
  to anon,authenticated
  using (exists(select 1 from public.property_operational_tags t where t.property_id=properties.id));

create policy "public may read non-sensitive operational tags"
  on public.property_operational_tags for select
  to anon,authenticated
  using (true);

create or replace function public.public_operational_buckets()
returns jsonb
language sql
stable
security invoker
set search_path = public,pg_temp
as $$
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
      'manual_override',false,'last_verified_at',t.last_verified_at
    ) order by t.operational_bucket,p.name),'[]'::jsonb)
  )
  from public.properties p join public.property_operational_tags t on t.property_id=p.id;
$$;

revoke all on function public.public_operational_buckets() from public;
grant execute on function public.public_operational_buckets() to anon,authenticated;

comment on function public.public_operational_buckets() is 'Public non-PII domain testing queues. Lead data and admin controls remain authenticated.';
