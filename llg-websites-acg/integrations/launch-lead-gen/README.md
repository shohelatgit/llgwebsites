# Launch Lead Gen integrations

Supabase-first portfolio lead capture and reporting for the Launch Lead Gen website fleet.

## Live staging

- Worker: `https://launch-lead-gen-integrations-staging.justin-b75.workers.dev`
- Dashboard: `https://llg-portfolio-dashboard.pages.dev`
- Supabase project: `zjhpxhyqdrrrwoadjdbj`

The Worker health endpoint must report `sourceOfRecord: "supabase"`, `dryRun: true`, and `deliveryEnabled: false`.

## What it does

- Accepts signed CallRail, Meta Lead Ads, Fillout, Bland, and messaging provider webhooks.
- Serves a reusable lower-right website texting widget that can start a TextMagic qualification conversation.
- Retains raw events before normalizing them into one provider-event contract.
- Resolves properties only from stable property keys or explicit provider identifiers.
- Stores leads, attribution touches, interactions, ad metrics, integration runs, and tracking readiness in Supabase.
- Keeps acquisition source separate from conversion channel.
- Correlates Bland intelligence to an existing CallRail lead before considering a standalone lead.
- Refreshes current- and previous-day Google/Meta metrics every 15 minutes.
- Scores Drainscapes fulfillment markets from Weather.gov rainfall and flood-alert data, then records guarded Google Ads budget recommendations every 15 minutes.
- Serves an authenticated React dashboard using Supabase magic links.

## Safety boundary

Every new lead is internal, unassigned, non-billable, and in review. Delivery is disabled in Worker configuration and by a database trigger that rejects new `lead_deliveries` rows.

No runtime path writes to Airtable, Zapier, Google Sheets, email, or a client webhook. SMS sending remains off unless `TEXTMAGIC_DELIVERY_ENABLED` is explicitly enabled and the TextMagic API secret is present. The historical Airtable base and existing Google Sheet remain untouched.

## Commands

```bash
npm run types
npm run check
npm test
npm run deploy:staging
npm run dashboard:build
npm run dashboard:deploy
```

The dashboard has its own dependencies under `dashboard/`.

## Documentation

- [Supabase-first operations](docs/supabase-first-operations.md)
- [Lead attribution definitions](docs/lead-attribution-reporting.md)
- [Portfolio readiness matrix](artifacts/portfolio-readiness-matrix.json)
- [Drainscapes demand controller](docs/drainscapes-demand-control.md)

Do not promote a channel to `live` until its exact source mapping and signed controlled event prove property attribution, acquisition evidence, conversion channel, deduplication, and delivery-disabled behavior.
