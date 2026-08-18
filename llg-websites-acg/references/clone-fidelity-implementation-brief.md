# Clone-fidelity correction brief

## Objective

- Reference pack: nine untouched offline clone exports in `C:\Users\Justin Abrams\OneDrive\Documents\Playground\.codex-work\llg-clone-sources*`.
- Design system: the source package owns homepage DOM, section order, component geometry, responsive breakpoints, and interaction anatomy; each target brand board owns palette and typography roles.
- Target repository/stack: independently deployable static HTML directories in `llg-websites`.
- Required routes and archetypes: clone-faithful home plus the existing noindex services, service-detail, service-area, about, contact, privacy, terms, and confirmation pages.
- Content source: `data/sites.json`, per-clone original copy profiles, retained first-wave media/reviews, and evidence-pending placeholders elsewhere.

## Rights and adaptation

- Owned/licensed assets: target-supplied first-wave photos and approved reviews already present in the repository.
- Design-reference-only assets: source operator logos, copy, photography, testimonials, claims, and business facts.
- Required substitutions: replace source brand, media, reviews, phone, address, claims, trackers, and conversion destinations; preserve source layout and local runtime.

## Success criteria

- Required viewports and states: 1440x1100, 1024x900, 390x844, and 320x780; desktop/mobile navigation and quote form.
- Visual acceptance: each target matches its assigned clone family in section order, container geometry, major spacing, CTA anatomy, and responsive composition. The two Trips packages remain separate families.
- Accessibility: one H1, labeled controls, keyboard-operable navigation, visible focus, reduced-motion support, and no horizontal overflow.
- Performance: static runtime only; final Core Web Vitals remain a production gate after approved media is supplied.
- Functional checks: all local navigation resolves; preview forms reach the centralized staging Worker; phone links remain disabled until forwarding tests pass.

## Architecture

- Token location: `data/design-systems/<site>/design-system.json` and generated `brand-system.css`.
- Shared shell: none for homepages; each clone family retains its own source shell. Internal SEO pages inherit the rebuilt target header/footer.
- Component families and variants: nine immutable clone families with target-only substitutions.
- Content schema: `data/sites.json` plus source-family copy profiles in `tools/adapt-clone-homepages.py`.
- Location/service routing: primary city and four service pages per site; adjacent-city expansion remains blocked.
- Structured data: verified Organization/WebSite/Service/Breadcrumb facts only; staging remains noindex without canonical URLs.

## Validation

- Build/type/test: `python tools/adapt-clone-homepages.py --all`, `python tools/build-seo-sites.py`, `python tools/audit-static-sites.py`, and Worker tests/type-check.
- Local preview: Python static server from the repository root.
- Screenshot: `node tools/qa-screenshots.mjs` plus the clone-family capture script.
- Visual diff: matched reference/implementation captures using the bundled `compare_images.py` utility and human review.
- Deployment boundary: update only the existing `clone-rebuild` Cloudflare Pages branches; production roots, DNS, custom domains, canonicals, and indexing remain unchanged.

## Unresolved decisions

- Final vector logos, licensed font files, target-specific photos/reviews for the remaining sites, production email recipients, sender domain, and tested phone forwarding routes remain pending.
