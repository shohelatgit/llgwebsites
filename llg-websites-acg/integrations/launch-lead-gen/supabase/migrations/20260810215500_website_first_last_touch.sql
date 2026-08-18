create or replace function public.record_website_attribution_touches(
  p_lead_id bigint,
  p_first_touch jsonb,
  p_last_touch jsonb,
  p_ingest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_first jsonb := coalesce(p_first_touch, '{}'::jsonb);
  v_last jsonb := coalesce(p_last_touch, '{}'::jsonb);
begin
  perform private.assert_portfolio_ingest_token(p_ingest_token);

  if jsonb_typeof(v_first) <> 'object' or jsonb_typeof(v_last) <> 'object' then
    raise exception 'attribution touches must be objects' using errcode = '22023';
  end if;

  select * into v_lead
  from public.leads
  where id = p_lead_id
  for update;

  if not found or v_lead.source_system <> 'website' then
    raise exception 'website lead not found' using errcode = '22023';
  end if;

  update public.leads
  set first_touch = nullif(v_first, '{}'::jsonb),
      last_touch = nullif(v_last, '{}'::jsonb),
      updated_at = now()
  where id = p_lead_id;

  delete from public.lead_attribution_touches
  where lead_id = p_lead_id and touch_order in (1, 2);

  insert into public.lead_attribution_touches(
    lead_id, touch_order, touch_type, occurred_at, source, medium, campaign,
    campaign_id, ad_group_id, ad_id, keyword, landing_page_url, referrer_url,
    gclid, gbraid, wbraid, fbclid, msclkid, visitor_id, session_id, metadata
  )
  values
  (
    p_lead_id, 1, 'first_touch', v_lead.occurred_at,
    coalesce(nullif(v_first->>'utm_source', ''), case when nullif(v_first->>'referrer_url', '') is null then 'direct' else 'referral' end),
    nullif(v_first->>'utm_medium', ''), nullif(v_first->>'utm_campaign', ''),
    nullif(v_first->>'campaign_id', ''), nullif(v_first->>'ad_group_id', ''), nullif(v_first->>'ad_id', ''),
    nullif(v_first->>'utm_term', ''), nullif(v_first->>'landing_page_url', ''), nullif(v_first->>'referrer_url', ''),
    nullif(v_first->>'gclid', ''), nullif(v_first->>'gbraid', ''), nullif(v_first->>'wbraid', ''),
    nullif(v_first->>'fbclid', ''), nullif(v_first->>'msclkid', ''), nullif(v_first->>'visitor_id', ''),
    nullif(v_first->>'session_id', ''), jsonb_build_object('website_attribution_contract', 'v1', 'raw', v_first)
  ),
  (
    p_lead_id, 2, 'last_touch', v_lead.occurred_at,
    coalesce(nullif(v_lead.lead_source, ''), 'direct'),
    nullif(v_last->>'utm_medium', ''), nullif(v_last->>'utm_campaign', ''),
    nullif(v_last->>'campaign_id', ''), nullif(v_last->>'ad_group_id', ''), nullif(v_last->>'ad_id', ''),
    nullif(v_last->>'utm_term', ''), nullif(v_last->>'landing_page_url', ''), nullif(v_last->>'referrer_url', ''),
    nullif(v_last->>'gclid', ''), nullif(v_last->>'gbraid', ''), nullif(v_last->>'wbraid', ''),
    nullif(v_last->>'fbclid', ''), nullif(v_last->>'msclkid', ''), nullif(v_last->>'visitor_id', ''),
    nullif(v_last->>'session_id', ''), jsonb_build_object('website_attribution_contract', 'v1', 'raw', v_last)
  );

  return jsonb_build_object('lead_id', p_lead_id, 'recorded', true);
end;
$$;

revoke all on function public.record_website_attribution_touches(bigint, jsonb, jsonb, text) from public;
grant execute on function public.record_website_attribution_touches(bigint, jsonb, jsonb, text) to anon, authenticated;
