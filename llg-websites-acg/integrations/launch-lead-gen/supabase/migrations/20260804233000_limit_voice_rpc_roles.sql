revoke execute on function public.record_bland_webhook_attempt(jsonb, text, text, text, text, text) from authenticated;
revoke execute on function public.get_bland_voice_context(text, text, uuid, text) from authenticated;
revoke execute on function public.ingest_bland_call(jsonb, text, text) from authenticated;
revoke execute on function public.sync_callrail_tracker_inventory(jsonb, text) from authenticated;
revoke execute on function public.resolve_callrail_company_phone_numbers(text) from authenticated;

comment on schema public is
'Public API schema. Server ingestion RPCs use explicit role grants and independently validate a rotated SHA-256 integration token.';
