# LLG 29-site clone-faithful rebuild

## Scope

Rebuild all 29 LLG local-service websites from the assigned clone exports. Each homepage keeps the source clone's DOM, section order, component geometry, typography rhythm, interaction model, and responsive behavior while substituting the target brand system, service copy, media, reviews, and conversion routes.

The portfolio uses nine distinct clone families: HorizonFix, Minuteman, Pink's Concrete, Roof Right Now, Welborn Garage, Cincinnati Painting, NextGen Windows, Trips Windows small, and Trips Windows full. The assignment in `data/sites.json` is authoritative.

## Content and asset boundary

- Brand boards in `C:\Users\Justin Abrams\Downloads\LLG Websites` are the authority for logos, colors, and typography.
- The first five retain their supplied site photos and review wording.
- The remaining sites use the prior LLG generated service-image library by trade, with licensed Pexels assets retained only as fallback media.
- Interim review copy is natural customer-facing content and does not produce Review or AggregateRating schema.
- Source-clone trademarks, addresses, operator claims, warranties, awards, credentials, analytics, and testimonials are excluded.

## Conversion contract

- Every form posts through Cloudflare Turnstile to the LLG integrations Worker and then to the Supabase `ingest_provider_event` RPC.
- Site identity is allowlisted and mapped to `domain:<domain>` property keys; private Supabase credentials remain Worker-side.
- Call CTAs appear only for numbers confirmed in the CallRail inventory. Shared trackers remain callable but are flagged for unique-number cleanup. Sites not found in CallRail use the online form until a tracking number is assigned.
- Preview deployments remain `noindex,nofollow`; custom-domain indexing and production Turnstile keys require a separate release approval.

## Acceptance

- All 29 homepages preserve their assigned clone anatomy and display the correct brand identity and trade media.
- Desktop, 390px, and 320px renders have no horizontal overflow, broken local images, or same-origin resource failures.
- Every page has a unique title, description, single H1, accessible navigation, labeled form, visible focus state, reduced-motion behavior, and no unapproved Review, rating, address, or telephone schema.
- Static audit passes 29/29 and a browser submission is verified in Supabase before the Pages previews are promoted.
