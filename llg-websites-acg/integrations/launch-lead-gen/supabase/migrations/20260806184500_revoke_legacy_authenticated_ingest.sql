-- Provider ingestion is Worker-only. Authenticated dashboard users must not
-- inherit access to legacy token-gated ingestion helpers.
revoke execute on function public.ingest_callrail_precall_context(jsonb, text, text) from authenticated;
revoke execute on function public.ingest_fillout_submission(text, jsonb, jsonb, text, text) from authenticated;
revoke execute on function public.record_fillout_webhook_attempt(text, jsonb, text, text, text, text) from authenticated;
