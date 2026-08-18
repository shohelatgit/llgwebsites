create or replace function private.normalize_lead_source_category()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if new.source_category is null or new.source_category not in (
    'paid', 'organic', 'referral', 'direct', 'partner', 'offline', 'unknown'
  ) then
    new.source_category := case
      when lower(coalesce(new.lead_source, '')) in (
        'google_ads', 'meta_ads', 'microsoft_ads', 'paid_search', 'paid_social'
      ) then 'paid'
      when lower(coalesce(new.lead_source, '')) in (
        'organic', 'organic_search', 'google_organic', 'bing_organic'
      ) then 'organic'
      when lower(coalesce(new.lead_source, '')) = 'referral' then 'referral'
      when lower(coalesce(new.lead_source, '')) = 'direct' then 'direct'
      when lower(coalesce(new.lead_source, '')) = 'partner' then 'partner'
      when lower(coalesce(new.lead_source, '')) = 'offline' then 'offline'
      else 'unknown'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_normalize_source_category on public.leads;
create trigger leads_normalize_source_category
before insert or update of lead_source, source_category on public.leads
for each row execute function private.normalize_lead_source_category();

comment on function private.normalize_lead_source_category()
is 'Keeps detailed acquisition in lead_source while constraining source_category to reporting groups.';
