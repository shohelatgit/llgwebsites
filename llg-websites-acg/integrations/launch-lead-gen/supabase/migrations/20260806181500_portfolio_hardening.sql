create index if not exists dashboard_email_allowlist_added_by_idx
  on public.dashboard_email_allowlist(added_by) where added_by is not null;
create index if not exists property_channel_readiness_verified_by_idx
  on public.property_channel_readiness(verified_by) where verified_by is not null;
create index if not exists normalized_provider_events_raw_webhook_event_id_idx
  on public.normalized_provider_events(raw_webhook_event_id) where raw_webhook_event_id is not null;

revoke execute on function public.ingest_provider_event(jsonb,jsonb,text,text) from authenticated;
revoke execute on function public.upsert_portfolio_ad_metric(jsonb,text) from authenticated;
revoke execute on function public.record_integration_sync_run(jsonb,text) from authenticated;
revoke execute on function public.prepare_bland_call_correlation(jsonb,text) from authenticated;

comment on function public.claim_dashboard_access() is 'Intentional authenticated SECURITY DEFINER boundary: checks auth.uid and the private allowlist before membership creation.';
comment on function public.dashboard_bootstrap(integer) is 'Intentional authenticated SECURITY DEFINER boundary: private.require_dashboard_member rejects non-members.';
comment on function public.dashboard_lead_page(integer,timestamptz,bigint,bigint) is 'Intentional authenticated SECURITY DEFINER boundary: membership required; analyst PII is masked.';
comment on function public.dashboard_site_detail(bigint) is 'Intentional authenticated SECURITY DEFINER boundary: membership required before portfolio access.';
