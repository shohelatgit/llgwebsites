# LLG Lead Router (legacy reference)

The 29 rebuilt sites no longer submit to this D1/Queue prototype. Their current
preview forms post to `https://launch-lead-gen-integrations-staging.justin-b75.workers.dev/v1/website-leads`,
where Cloudflare Turnstile and origin checks run before the normalized event is
ingested into Supabase. Keep this directory only as deployment history; do not
deploy it over the active integrations Worker.

Central Cloudflare Worker for the 29-site LLG portfolio. The staging environment validates Turnstile, normalizes submissions, writes only a non-PII delivery audit to D1, and queues the lead body without emailing it. Production delivery remains blocked until an Email Sending domain and both recipient routes are configured in Cloudflare.

## Data boundary

- Git contains public site keys, brands, and allowed preview origins.
- D1 contains route state and recipient addresses; recipient values are not seeded in Git.
- Queue messages temporarily contain the normalized lead body for delivery.
- D1 audit rows never contain names, phone numbers, emails, ZIP codes, messages, referrers, or campaign values.
- Logs contain only lead ID, site key, status, and attempt count.

## Release sequence

1. Create the staging D1 database and the lead/DLQ queues.
2. Apply migrations.
3. Generate types, run typecheck and tests, and deploy with `wrangler.staging.jsonc`.
4. Confirm accepted staging submissions and audit rows.
5. Onboard a transactional sending domain, set `TURNSTILE_SECRET_KEY` with `wrangler secret put`, and configure D1 recipient routes.
6. Deploy the production config only after route, origin, sender, and recipient tests pass.
