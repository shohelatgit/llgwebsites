# Remaining-wave clone adoption brief

## Objective

- Reference pack: nine supplied offline clone packages; exact homepage exports recorded in `tools/remaining-sites.json`.
- Design system: each target retains its assigned source homepage DOM/class tree, local CSS/JS/font runtime, section order, and source breakpoints.
- Target repository/stack: independently deployable static HTML folders under `llg-websites`.
- Required route: homepage only for each of the remaining 24 staging targets.
- Content source: `tools/remaining-sites.json`, with per-site handoff details in each generated `content-manifest.json`.

## Rights and adaptation

- Owned/licensed assets: none asserted for the source operators.
- Design-reference-only assets: source DOM/classes and supplied clone runtime CSS/JS/fonts.
- Required substitutions: remove source operator logos, photography, reviews, trackers, addresses, phone numbers, credentials, awards, and unsupported claims; use neutral local SVG placeholders and a local wordmark.

## Success criteria

- Viewports: 1440x900, 390x844, and 320x780.
- Visual acceptance: source section order and responsive composition retained; zero horizontal overflow, broken images, or missing noindex metadata.
- Accessibility: labeled form fields, skip link, visible focus, reduced-motion override, explicit image dimensions.
- Performance: static staging smoke only; production Core Web Vitals deferred until final media and intake are supplied.
- Functional checks: navigation remains local, forms are explicitly marked staging and use mailto only, and source trackers are removed.

## Architecture

- Clone foundations: source CSS/JS/fonts copied beneath each target's `clone-assets/` directory.
- Target overrides: `clone-override.css` and `clone-behavior.js` generated per site.
- Content schema: site identity, source assignment, location, trade, neutral service copy, contact placeholders, and asset intake live in JSON.
- Structured data: omitted while business facts are unverified.

## Validation

- Generation: `python tools/adapt-clone-homepages.py --remaining`.
- Static audit: `python tools/audit-static-sites.py`.
- Preview: `python -m http.server 4173` from the repository root.
- Screenshots/smoke: `node tools/qa-screenshots.mjs`.
- Deployment boundary: no deploy, commit, push, domain, canonical, indexing, analytics, or production form changes.

## Unresolved decisions

- Final logo/wordmark, photography, testimonials, phone number, address/GBP, business claims, and production intake endpoint remain explicitly pending per site.
