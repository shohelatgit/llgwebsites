do $$
declare
  v_function_sql text;
begin
  select pg_get_functiondef(p.oid)
  into v_function_sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ingest_fillout_submission'
    and pg_get_function_identity_arguments(p.oid) = 'p_form_id text, p_submission jsonb, p_payload jsonb, p_request_id text, p_ingest_token text';

  if v_function_sql is null then
    raise exception 'ingest_fillout_submission function not found';
  end if;

  if position('''website_form'', ''inbound'', ''received''' in v_function_sql) = 0 then
    raise exception 'expected interaction channel fragment not found';
  end if;

  v_function_sql := replace(
    v_function_sql,
    '''website_form'', ''inbound'', ''received''',
    '''web'', ''inbound'', ''received'''
  );
  execute v_function_sql;
end;
$$;

comment on function public.ingest_fillout_submission(text, jsonb, jsonb, text, text)
is 'Authenticates and ingests a normalized Fillout submission into the lead, interaction, consent, and qualification ledgers. Uses the valid web interaction channel.';
