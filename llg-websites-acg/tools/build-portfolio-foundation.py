from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BOARD_ROOT = Path(r"C:\Users\Justin Abrams\Downloads\LLG Websites")


SITE_ROWS = """
austin-drain-guys|Austin Drain Guys|austindrainguys.com|Drainage|Austin|TX|horizonfix|HorizonFix|Austin Drain Guys.jpeg
baltimore-french-drain|Baltimore French Drain|baltimorefrenchdrain.com|Drainage|Baltimore|MD|roofrightnow|Roof Right Now|Blatimore French Drain.jpeg
charlotte-crawl-space|Charlotte Crawl Space|charlottecrawlspace.com|Crawlspace|Charlotte|NC|nextgen-windows|NextGen Windows|Charlotte Crawl Space.jpeg
charlotte-precision-walls|Charlotte Precision Walls|charlotteprecisionwalls.com|Retaining walls|Charlotte|NC|pinks-concrete|Pink's Concrete|Charlotte Precision Walls.jpeg
chicago-drainage-guys|Chicago Drainage Guys|chicagodrainageguys.com|Drainage|Chicago|IL|minuteman|Minuteman|Chicago Drainage Guys.jpeg
cincinnati-precision-walls|Cincinnati Precision Walls|cincinnatiprecisionwalls.com|Retaining walls|Cincinnati|OH|pinks-concrete|Pink's Concrete|Cincinnati Precision Walls.jpeg
connecticut-drain-pros|Connecticut Drain Pros|connecticutdrainpros.com|Drainage|Connecticut|CT|horizonfix|HorizonFix|Connecticut Drain PRos.jpeg
crawlspace-cary-nc|Crawlspace Cary NC|crawlspacecarync.com|Crawlspace|Cary|NC|trips-windows-small|Trips Windows — Small Export|Crawlspace Cary NC.jpeg
crawlspace-durham|Crawlspace Durham|crawlspacedurham.com|Crawlspace|Durham|NC|nextgen-windows|NextGen Windows|Crawlspace Durham.jpeg
crawlspace-greensboro|Crawlspace Greensboro|crawlspacegreensboro.com|Crawlspace|Greensboro|NC|welborn-garage|Welborn Garage|Crawlspace Greensboro.jpeg
crawlspace-raleigh|Crawlspace Raleigh|crawlspaceraleigh.com|Crawlspace|Raleigh|NC|trips-windows-full|Trips Windows — Full Export|Crawlspace Raleigh.jpeg
crawlspace-wilmington|Crawlspace Wilmington|crawlspacewilmington.com|Crawlspace|Wilmington|NC|nextgen-windows|NextGen Windows|Crawlspace Wilmington.jpeg
dallas-drain-guys|Dallas Drain Guys|dallasdrainguys.com|Drainage|Dallas|TX|minuteman|Minuteman|Dallas Drain Guys.jpeg
greensboro-drain-guys|Greensboro Drain Guys|greensborodrainguys.com|Drainage|Greensboro|NC|roofrightnow|Roof Right Now|Greensboro Drain Guys.jpeg
jackson-french-drain|Jackson French Drain|jacksonfrenchdrain.com|Drainage|Jackson|MS|horizonfix|HorizonFix|Jackson French Drain.jpeg
little-rock-french-drain|Little Rock French Drain|littlerockfrenchdrain.com|Drainage|Little Rock|AR|roofrightnow|Roof Right Now|Little Rock French Drain.jpeg
little-rock-precision-walls|Little Rock Precision Walls|littlerockprecisionwalls.com|Retaining walls|Little Rock|AR|pinks-concrete|Pink's Concrete|Little Rock Precision Walls.jpeg
louisville-precision-walls|Louisville Precision Walls|louisvilleprecisionwalls.com|Retaining walls|Louisville|KY|pinks-concrete|Pink's Concrete|Louisville Precision Walls.jpeg
morgantown-fence-pros|Morgantown Fence Pros|morgantownfencepros.com|Fencing|Morgantown|WV|welborn-garage|Welborn Garage|Morgantown Fence Pros.jpeg
naples-pool-pros|Naples Pool Pros|naplespoolpros.com|Pool service|Naples|FL|trips-windows-small|Trips Windows — Small Export|Naples Pool PRos.jpeg
nashville-crawlspace|Nashville Crawlspace|nashvillecrawlspace.com|Crawlspace|Nashville|TN|nextgen-windows|NextGen Windows|Nashville Crawlspace.jpeg
nashville-backyards|Nashville Backyards|nashvillebackyards.com|Backyard construction|Nashville|TN|welborn-garage|Welborn Garage|Nashvlle Backyards.jpeg
new-orleans-french-drain|New Orleans French Drain|neworleansfrenchdrain.com|Drainage|New Orleans|LA|roofrightnow|Roof Right Now|New Orleans French Drain.jpeg
pgh-painting-pros|PGH Painting Pros|pghpaintingpros.com|Painting|Pittsburgh|PA|cincinnati-painting|Cincinnati Painting|PGH Painting Pros.jpeg
pgh-pool-service|PGH Pool Service|pghpoolservice.com|Pool service|Pittsburgh|PA|trips-windows-full|Trips Windows — Full Export|PGH Pool Service.jpeg
pittsburgh-french-drain|Pittsburgh French Drain|pghfrenchdrain.com|Drainage|Pittsburgh|PA|roofrightnow|Roof Right Now|Pittsburgh French Drain.jpeg
salt-lake-city-precision-walls|Salt Lake City Precision Walls|saltlakecityprecisionwalls.com|Retaining walls|Salt Lake City|UT|pinks-concrete|Pink's Concrete|Salt Lake City Precision Walls.jpeg
tulsa-drain-pros|Tulsa Drain Pros|tulsadrainpros.com|Drainage|Tulsa|OK|minuteman|Minuteman|Tulsa Drain PRos.jpeg
ws-crawl-space|WS Crawl Space|wscrawlspace.com|Crawlspace|Winston-Salem|NC|welborn-garage|Welborn Garage|WS Crawl Space.jpeg
""".strip()


BRANDS = {
    "austin-drain-guys": ("#0D1B2A", "#415A6B", "#E4572E", "#F4F1EA", "Bebas Neue", "DM Sans", "Oswald"),
    "baltimore-french-drain": ("#0A1F3D", "#3B4A63", "#93C23D", "#F2F4F7", "Barlow Condensed", "DM Sans", "Crimson Text"),
    "charlotte-crawl-space": ("#1F2D36", "#3D6E7A", "#A18C78", "#F3F1ED", "Bellota", "Manrope", "Great Vibes"),
    "charlotte-precision-walls": ("#0F2E27", "#3B4A44", "#CDA14A", "#F3F1ED", "Cinzel Decorative", "Inter Tight", "Cormorant Garamond"),
    "chicago-drainage-guys": ("#0B1D33", "#1296F7", "#5B6770", "#E9EBEE", "Urbanist", "Nunito", "Caveat"),
    "cincinnati-precision-walls": ("#1B2226", "#D26A2C", "#7E7366", "#F4F1EC", "Aileron", "Work Sans", "Allura"),
    "connecticut-drain-pros": ("#0A1D3D", "#00B8F1", "#455A64", "#E8ECEF", "Barlow Condensed", "DM Sans", "Oswald"),
    "crawlspace-cary-nc": ("#0E3B43", "#2F6F73", "#F07A2E", "#F2F1EE", "Bebas Neue Pro", "Outfit", "Satisfy"),
    "crawlspace-durham": ("#0B2D3A", "#5F6F44", "#C48A53", "#E9E6DB", "Barlow Condensed", "Source Sans 3", "DM Serif Display"),
    "crawlspace-greensboro": ("#113B2F", "#6D8266", "#D4A32C", "#E7E5E0", "Oswald SemiCondensed", "Lora", "Poppins"),
    "crawlspace-raleigh": ("#1E2E28", "#6F8A5B", "#D9D2C2", "#2A2A2A", "Saira Condensed", "Work Sans", "Space Mono"),
    "crawlspace-wilmington": ("#0F2D4D", "#5BAAA8", "#C8B79C", "#F2F4F5", "League Spartan", "Work Sans", "Pacifico"),
    "dallas-drain-guys": ("#2F3A2E", "#6B7368", "#C15A34", "#E7E4DD", "Bungee", "DM Sans", "Koulen"),
    "greensboro-drain-guys": ("#1D3B2F", "#68A05F", "#68A7B3", "#F1F3EF", "Sora", "DM Sans", "Caveat"),
    "jackson-french-drain": ("#0E2238", "#1E73BE", "#6B747D", "#E6E9ED", "Practica", "Inter", "DIN 2014"),
    "little-rock-french-drain": ("#1F2A37", "#5B6B49", "#7CA0B3", "#E7E4DE", "Cormorant Garamond", "Source Sans 3", "Caveat"),
    "little-rock-precision-walls": ("#1F2328", "#6B7177", "#A31D23", "#F2F3F4", "Oswald", "Barlow Condensed", "Space Grotesk"),
    "louisville-precision-walls": ("#1F2A25", "#6E7270", "#B85D2A", "#F4F1EC", "Saira Stencil One", "Work Sans", "Kalam"),
    "morgantown-fence-pros": ("#1E3A34", "#B66A3C", "#8FA79A", "#F3EFE8", "Chivo", "Manrope", "Syne"),
    "naples-pool-pros": ("#0D2B3A", "#0F5C6E", "#D1AF6A", "#F3EFE6", "Cinzel Decorative", "Manrope", "Allura"),
    "nashville-crawlspace": ("#0F1B2A", "#A3683A", "#D9D5CC", "#6B7077", "Bebas Neue", "DM Sans", "Satisfy"),
    "nashville-backyards": ("#2F3E2E", "#6B7D4D", "#C9B38A", "#F2EFE8", "Cormorant Garamond", "Source Serif 4", "Marck Script"),
    "new-orleans-french-drain": ("#2B1D3A", "#6E6478", "#C89D47", "#F4F1EA", "Cormorant Unicase", "Manrope", "Great Vibes"),
    "pgh-painting-pros": ("#1F2328", "#FDB813", "#6B6F76", "#F5F5F5", "Oswald", "Work Sans", "Brusher"),
    "pgh-pool-service": ("#0D1B2A", "#00AEEF", "#2DD4BF", "#E6E8EB", "Barlow Condensed", "Source Sans 3", "Sora"),
    "pittsburgh-french-drain": ("#0D1B2A", "#1E88E5", "#00B4D8", "#F2F2F2", "Teko", "Barlow Condensed", "Archivo Narrow"),
    "salt-lake-city-precision-walls": ("#1F2A30", "#C9B79C", "#D06B3B", "#F4F1EC", "Syne", "Albert Sans", "IBM Plex Mono"),
    "tulsa-drain-pros": ("#0B2540", "#0DA1B4", "#63B15C", "#F2F4F6", "Nunito Sans", "DM Sans", "Caveat"),
    "ws-crawl-space": ("#0D1B2A", "#C48F2C", "#6B7280", "#F2F3F5", "Anton", "DM Sans", "Space Grotesk"),
}


PUBLIC_FACTS = {
    "austindrainguys.com": ("512-270-6356", None, None, None),
    "baltimorefrenchdrain.com": ("410-770-2644", None, None, None),
    "charlottecrawlspace.com": ("704-288-4170", None, None, None),
    "charlotteprecisionwalls.com": ("980-480-3201", "Verified", None, None),
    "chicagodrainageguys.com": ("773-741-0057", None, None, None),
    "cincinnatiprecisionwalls.com": ("513-640-2487", None, None, None),
    "connecticutdrainpros.com": ("860-744-5564", None, None, None),
    "crawlspacecarync.com": ("919-858-6704", "Verified", "https://www.google.com/maps?cid=11290235859367532450", "https://search.google.com/local/writereview?placeid=ChIJVcPTUHJRSmkRopf6I7L5rpw"),
    "crawlspacedurham.com": ("984-400-5668", "Verified", "https://www.google.com/maps?cid=9778678237731538673", "https://search.google.com/local/writereview?placeid=ChIJzXqrdrwzjiMR8cbULAzYtIc"),
    "crawlspacegreensboro.com": ("336-933-9193", "Verified", "https://www.google.com/maps?cid=101014055828142505", "https://search.google.com/local/writereview?placeid=ChIJR5kdRTfG_20RqTn1or_fZgE"),
    "crawlspaceraleigh.com": ("919-646-9887", None, None, None),
    "crawlspacewilmington.com": ("910-444-0021", None, None, None),
    "dallasdrainguys.com": ("214-833-6141", None, None, None),
    "greensborodrainguys.com": ("336-444-6048", None, None, None),
    "jacksonfrenchdrain.com": ("601-688-7997", "Verified", "https://www.google.com/maps?cid=7266724139285102729", "https://search.google.com/local/writereview?placeid=ChIJzZ7Op-38UaQRiUDYmhqX2GQ"),
    "littlerockfrenchdrain.com": ("501-459-7779", None, None, None),
    "littlerockprecisionwalls.com": ("501-300-8626", None, None, None),
    "louisvilleprecisionwalls.com": ("502-490-3600", "Verified", None, None),
    "morgantownfencepros.com": ("304-648-4298", "TBD", None, None),
    "naplespoolpros.com": ("239-310-7007", None, None, None),
    "nashvillecrawlspace.com": (None, None, None, None),
    "nashvillebackyards.com": ("615-241-6010", None, None, None),
    "neworleansfrenchdrain.com": ("504-221-8993", "Verified", None, None),
    "pghpaintingpros.com": ("412-775-2235", None, None, None),
    "pghpoolservice.com": ("412-615-3550", "Verified", "https://maps.app.goo.gl/1aGmUSEffhSuM21f7", None),
    "pghfrenchdrain.com": ("412-850-4615", "Verified x2 - domain mismatch in workbook", "https://www.google.com/maps?cid=3352128493361850862", None),
    "saltlakecityprecisionwalls.com": ("801-823-4285", None, None, None),
    "tulsadrainpros.com": ("918-255-5206", "Verified", None, None),
    "wscrawlspace.com": ("336-842-0660", None, None, None),
}


ADDRESSES = {
    "pghpoolservice.com": "730 Beulah Rd, Turtle Creek, PA 15145",
    "tulsadrainpros.com": "201 N Main St #215, Tulsa, OK 74103",
}


SERVICES = {
    "Drainage": [
        ("french-drain-installation", "French Drain Installation"),
        ("yard-drainage", "Yard Drainage"),
        ("downspout-drainage", "Downspout Drainage"),
        ("stormwater-control", "Stormwater Control"),
    ],
    "Crawlspace": [
        ("crawlspace-encapsulation", "Crawlspace Encapsulation"),
        ("crawlspace-drainage", "Crawlspace Drainage"),
        ("moisture-control", "Crawlspace Moisture Control"),
        ("dehumidifier-solutions", "Crawlspace Dehumidifier Solutions"),
    ],
    "Retaining walls": [
        ("retaining-wall-installation", "Retaining Wall Installation"),
        ("segmental-block-walls", "Segmental Block Walls"),
        ("natural-stone-walls", "Natural Stone Walls"),
        ("retaining-wall-repair", "Retaining Wall Repair"),
    ],
    "Fencing": [
        ("wood-fencing", "Wood Fence Installation"),
        ("vinyl-fencing", "Vinyl Fence Installation"),
        ("aluminum-fencing", "Aluminum Fence Installation"),
        ("fence-repair", "Fence and Gate Repair"),
    ],
    "Pool service": [
        ("pool-cleaning", "Pool Cleaning"),
        ("pool-maintenance", "Pool Maintenance"),
        ("pool-equipment-service", "Pool Equipment Service"),
        ("water-care", "Pool Water Care"),
    ],
    "Painting": [
        ("interior-painting", "Interior Painting"),
        ("exterior-painting", "Exterior Painting"),
        ("cabinet-painting", "Cabinet Painting"),
        ("commercial-painting", "Commercial Painting"),
    ],
    "Backyard construction": [
        ("patios-hardscapes", "Patios and Hardscapes"),
        ("pergolas-shade", "Pergolas and Shade Structures"),
        ("outdoor-living", "Outdoor Living Spaces"),
        ("backyard-renovation", "Backyard Renovation"),
    ],
}


DIRECTORY_OVERRIDES = {"pittsburgh-french-drain": "Pittsburgh-French-Drain-Site"}


def sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tel(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(character for character in phone if character.isdigit())
    return f"+1{digits}" if len(digits) == 10 else f"+{digits}"


def font_stack(font: str, role: str) -> str:
    fallback = "Georgia, 'Times New Roman', serif" if any(name in font.lower() for name in ("garamond", "serif", "crimson", "unicase")) else "Arial, Helvetica, sans-serif"
    if role == "accent" and any(name in font.lower() for name in ("vibes", "allura", "caveat", "kalam", "satisfy", "pacifico", "script", "brusher")):
        fallback = "'Segoe Script', 'Brush Script MT', cursive"
    return f"'{font}', {fallback}"


def make_pages(site: dict) -> list[dict]:
    pages = [
        {"slug": "", "type": "home", "intent": f"{site['trade']} help in {site['city']}", "indexState": "noindex"},
        {"slug": "services", "type": "services-hub", "intent": f"Compare {site['brand']} services", "indexState": "noindex"},
    ]
    for slug, title in site["services"]:
        pages.append({"slug": f"services/{slug}", "type": "service", "service": title, "intent": f"Understand {title.lower()} in {site['city']}", "indexState": "noindex"})
    pages.extend([
        {"slug": "service-areas", "type": "service-areas-hub", "intent": f"Confirm service availability in {site['city']}", "indexState": "noindex"},
        {"slug": "about", "type": "about", "intent": f"Understand the {site['brand']} process", "indexState": "noindex"},
        {"slug": "contact", "type": "contact", "intent": "Request an assessment", "indexState": "noindex"},
        {"slug": "privacy", "type": "legal", "intent": "Privacy information", "indexState": "noindex"},
        {"slug": "terms", "type": "legal", "intent": "Terms information", "indexState": "noindex"},
        {"slug": "thank-you", "type": "confirmation", "intent": "Lead confirmation", "indexState": "noindex"},
    ])
    return pages


def build() -> None:
    sites = []
    evidence_dir = ROOT / "data" / "brand-evidence"
    systems_dir = ROOT / "data" / "design-systems"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    systems_dir.mkdir(parents=True, exist_ok=True)

    for raw in SITE_ROWS.splitlines():
        slug, brand, domain, trade, city, state, clone, clone_label, board_file = raw.split("|")
        primary, secondary, accent, neutral, heading, body, accent_font = BRANDS[slug]
        phone, gbp_status, gbp_url, review_url = PUBLIC_FACTS[domain]
        board_path = BOARD_ROOT / board_file
        site = {
            "schemaVersion": 2,
            "siteKey": slug,
            "directory": DIRECTORY_OVERRIDES.get(slug, slug),
            "brand": brand,
            "domain": domain,
            "trade": trade,
            "city": city,
            "state": state,
            "stage": "staging",
            "clone": {"id": clone, "label": clone_label, "contract": "literal-homepage-structure"},
            "brandSystem": {
                "boardFile": board_file,
                "boardSha256": sha256(board_path),
                "status": "tokens-extracted-logo-files-pending",
                "colors": {"primary": primary, "secondary": secondary, "accent": accent, "neutral": neutral},
                "typography": {
                    "heading": {"family": heading, "fallback": font_stack(heading, "heading"), "licenseStatus": "file-not-supplied"},
                    "body": {"family": body, "fallback": font_stack(body, "body"), "licenseStatus": "file-not-supplied"},
                    "accent": {"family": accent_font, "fallback": font_stack(accent_font, "accent"), "licenseStatus": "file-not-supplied"},
                },
                "logoSlots": {
                    "primary": f"assets/brand/{site_key}/brandmark.svg",
                    "raster": f"assets/brand/{site_key}/brandmark.png",
                    "icon": f"assets/brand/{site_key}/brand-icon.png",
                    "favicon": f"assets/brand/{site_key}/favicon.png",
                },
            },
            "contact": {
                "phone": phone,
                "tel": tel(phone),
                "phoneStatus": "portfolio-import-unverified" if phone else "missing",
                "publicAddress": ADDRESSES.get(domain),
                "addressStatus": "portfolio-import-reverify" if domain in ADDRESSES else "not-supplied",
            },
            "gbp": {"status": gbp_status or "not-verified", "url": gbp_url, "reviewUrl": review_url, "verificationSource": "LLG Portfolio workbook"},
            "services": SERVICES[trade],
            "serviceArea": {"primaryCity": city, "state": state, "adjacentCities": [], "status": "primary-city-only"},
            "evidence": {"reviews": "pending-approved-records", "projectPhotos": "pending-attributable-assets", "sharedTradePhotos": "generic-service-use-only", "claims": "pending-verification"},
            "routing": {"status": "disabled-until-recipient-and-forwarding-test", "activeClientRecipient": "cloudflare-only", "llgCopyRecipient": "cloudflare-only", "smsCapability": "disabled"},
            "indexing": {"siteState": "noindex", "productionEligible": False, "blockers": ["routing approval", "claim review", "phone forwarding test", "canonical/domain approval"]},
            "analytics": {"cloudflareWebAnalytics": "pending-production-domain", "searchConsole": "pending-production-domain", "ga4": "not-planned"},
        }
        site["pages"] = make_pages(site)
        sites.append(site)

        evidence = {
            "version": 1,
            "siteKey": slug,
            "sourceType": "brand-board-jpeg",
            "sourceFile": board_file,
            "sha256": sha256(board_path),
            "dimensions": {"width": 1600, "height": 900},
            "observations": ["four printed brand colors", "heading, body, and accent font roles", "logo, wordmark, icon, and favicon examples"],
            "confidence": "high",
            "assetPolicy": "board is token evidence; website logo slots remain placeholders until source vector files are supplied",
        }
        (evidence_dir / f"{slug}.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")

        design_system = {
            "version": 1,
            "sourceManifest": f"../../brand-evidence/{slug}.json",
            "tokens": {
                "color": {"brand-primary": primary, "brand-secondary": secondary, "action-primary": accent, "surface-soft": neutral},
                "spacing": {"1": "0.25rem", "2": "0.5rem", "3": "0.75rem", "4": "1rem", "section": "clamp(3.75rem, 8vw, 7.5rem)"},
                "radius": {"control": "0.5rem", "card": "0.875rem"},
                "shadow": {"card": "0 16px 42px rgb(0 0 0 / 0.12)"},
            },
            "typography": {
                "heading": {"family": heading, "weights": [600, 700], "confidence": "high", "fallback": font_stack(heading, "heading")},
                "body": {"family": body, "weights": [400, 600], "confidence": "high", "fallback": font_stack(body, "body")},
                "accent": {"family": accent_font, "weights": [400, 600], "confidence": "high", "fallback": font_stack(accent_font, "accent")},
            },
            "layout": {"containerMax": "80rem", "gutter": "clamp(1rem, 3vw, 2rem)", "observedBreakpoints": [{"at": 768, "change": "navigation collapses according to adopted clone"}, {"at": 1024, "change": "clone desktop grids activate"}]},
            "components": [
                {"name": "CloneHeader", "purpose": "Preserve the assigned clone navigation geometry", "anatomy": ["logo slot", "crawlable navigation", "primary CTA"], "variants": [clone], "contentFields": ["brand", "phone", "navigation"], "responsiveRules": ["use observed clone collapse behavior"], "states": ["default", "scrolled", "menu-open"], "accessibility": ["keyboard operable", "visible focus", "44px targets"], "evidence": [clone_label]},
                {"name": "LeadForm", "purpose": "Collect service requests", "anatomy": ["identity fields", "contact fields", "service", "message", "unchecked SMS consent", "Turnstile", "status"], "variants": ["full", "compact"], "contentFields": ["siteKey", "pagePath", "service"], "responsiveRules": ["single column under 640px"], "states": ["idle", "submitting", "success", "error"], "accessibility": ["explicit labels", "error summary", "aria-live status"], "evidence": ["approved portfolio plan"]},
            ],
            "signatureDetails": [f"Homepage section order and component geometry remain from {clone_label}", "Brand board palette replaces source-clone palette", "Logo artwork remains an explicit slot until source vectors are supplied"],
            "unresolved": ["exact font file or redistribution license not supplied", "final vector logo suite not supplied", "project photo provenance pending"],
        }
        system_root = systems_dir / slug
        system_root.mkdir(parents=True, exist_ok=True)
        (system_root / "design-system.json").write_text(json.dumps(design_system, indent=2) + "\n", encoding="utf-8")
        (system_root / "component-matrix.md").write_text(
            f"# {brand} component matrix\n\n| Page group | Clone shell | Components | Evidence state |\n|---|---|---|---|\n| Home | {clone_label} literal adoption | Header, hero, services, proof slots, CTA, form, footer | staging |\n| Service pages | {clone_label} derived shell | Header, breadcrumbs, service content, CTA, form, footer | noindex pending review |\n| About/contact | {clone_label} derived shell | Header, process, contact, form, footer | noindex pending facts |\n| Legal/thank-you | minimal branded shell | Header, content, footer | permanently noindex |\n",
            encoding="utf-8",
        )

    data_root = ROOT / "data"
    data_root.mkdir(exist_ok=True)
    (data_root / "sites.json").write_text(json.dumps({"schemaVersion": 2, "generatedFrom": ["LLG brand boards", "LLG Portfolio workbook public fields", "clone assignment tracker"], "sites": sites}, indent=2) + "\n", encoding="utf-8")
    print(f"built source of truth for {len(sites)} sites")


if __name__ == "__main__":
    build()
