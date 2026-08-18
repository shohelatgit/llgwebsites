# LLG site factory release

This directory is the deployable review release for the adjustable LLG website factory. It keeps the editorial roster, seven approved theme definitions, phone directory, shared runtime snapshot, per-site Worker configuration, and validation/deployment scripts together in GitHub.

## Current release

- 115 website identities in the factory and intake registry
- 86 profile-ready Cloudflare review sites
- 29 records held back because their service profile is still pending
- 12 shared industry profiles
- 7 approved rollout palettes
- DrainScape Solutions fixed to `deep-blue-white`
- all review URLs set to `noindex, nofollow`
- form intake in Supabase test mode; downstream delivery remains disabled

## Production promotion

`config/production-launch.json` is the explicit custom-domain allowlist. A listed site is deployed with clean custom-domain routing and a real Turnstile assignment while its `.workers.dev` URL remains a query-driven, noindex review surface. New custom domains launch as `live-noindex` until the Airtable `productionApproved` field is true; only then do the Worker, canonical tags, robots.txt, and sitemap switch to `index,follow`.

The manual `Factory production Worker release` GitHub workflow validates the shared source, Supabase intake mapping, Turnstile assignment, and production routing contract before deploying one allowlisted Worker. Attaching or moving the real DNS hostname remains a separate cutover after that Worker passes.

Review index: <https://llg-site-review-index.justin-b75.workers.dev/>

## System of record

1. Airtable is the editorial control surface for site identity, market, profile, theme, and later brand assets.
2. `review/homepage-palettes/airtable-websites.json` is the versioned Airtable export used by the release.
3. `config/factory-sites.json` is the versioned site-to-domain-to-Worker mapping.
4. `out/cloudflare-review/` is the shared, immutable runtime snapshot deployed to the review Pages branch.
5. Each site Worker supplies only its source ID, industry profile, and theme, then proxies the shared runtime.
6. The centralized intake Worker maps the same source ID to a Supabase property key.

This arrangement allows a site-wide design/runtime change to ship once while preserving a distinct URL, palette assignment, phone, business identity, and tracking key for every site.

## Release order

The GitHub workflow follows this dependency order:

1. validate roster, palette allowlist, phones, runtime snapshot, and intake mappings;
2. type-check and test the centralized intake Worker;
3. deploy the intake registry in dry-run/test mode;
4. deploy the shared Pages runtime;
5. deploy the 86 independent review Workers;
6. deploy the portfolio review index;
7. verify every site, asset, noindex header, theme redirect, tracking runtime, and exact CORS origin.

Run locally from this directory:

```powershell
npm ci
npm run cloudflare:prepare-sites
npm run factory:validate
npm run cloudflare:build-site-index
npm run cloudflare:verify-sites
```

## Safety boundary

The release workflow does not attach customer domains, enable search indexing, approve pending profiles, or turn on downstream lead delivery. Those are separate production promotion decisions.
