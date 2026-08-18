# Product context

## Scope

This repository powers Launch Lead Gen's shared website lead intake and communications infrastructure. The current visual surface is a functional staging pilot, not a production brand system.

## Platform and users

- Platform: responsive local-service websites served through Cloudflare Workers.
- Primary user: a homeowner looking for a local service and wanting to call, text, or request a quote.
- Operator: Launch Lead Gen, which needs every request tied to the correct domain, service, market, phone number, and client delivery path.

## Current pilot

- First visual test: 3V San Antonio Paver Services.
- Data authority: Supabase property configuration and verified CallRail inventory.
- Form: property-aware Fillout embed with UTM and click-ID attribution.
- Delivery: Supabase first, then a queued Zapier handoff.
- Voice: shared Bland pathway/context lookup remains in test mode until an inbound-number method is confirmed.
- Texting: the shared website widget can start an opted-in TextMagic qualification thread; sending remains controlled by an explicit runtime flag.
- Search visibility: staging pages must be `noindex` and must not establish production canonicals.

## Content and trust rules

- Do not invent reviews, years in business, licenses, addresses, hours, prices, availability, warranties, or contractor claims.
- Clearly label the integration test and avoid implying that client delivery or live Bland handling is complete.
- Use a conventional, restrained local-service layout for this baseline test. It is not durable visual-brand canon.

## Open decisions

- Production visual identity, photography, and approved sales copy.
- Client delivery destinations and qualification rules.
- Whether existing CallRail numbers forward/import into Bland or require another telephony provider.
- LLM reply provider for free-form AI qualification. The current TextMagic flow is automated and database-scripted, not presented to visitors as generative AI.
- Production domains, Cloudflare routing, analytics, and consent versioning.
