insert into public.integration_sync_runs(provider,sync_kind,status,started_at,finished_at,failure_details,metadata)
values
  ('google_ads','deployment_audit','failed',now(),now(),'[{"reason":"missing_google_ads_runtime_credentials"}]'::jsonb,'{"source":"verified_worker_secret_inventory"}'::jsonb),
  ('meta_ads','deployment_audit','failed',now(),now(),'[{"reason":"missing_meta_page_access_token_and_app_secret"}]'::jsonb,'{"source":"verified_worker_secret_inventory"}'::jsonb);
