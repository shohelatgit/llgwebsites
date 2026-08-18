from __future__ import annotations

import html
import json
import re
from copy import copy
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

from bs4 import BeautifulSoup, NavigableString


ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data" / "sites.json").read_text(encoding="utf-8"))
TODAY = date.today().isoformat()
TURNSTILE_TEST_SITEKEY = "1x00000000000000000000AA"
DEFAULT_LEAD_ENDPOINT = "https://launch-lead-gen-integrations-staging.justin-b75.workers.dev/v1/website-leads"
PHONE_RE = re.compile(r"(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}")
EXTERNAL_IMAGE_MAP = {
    "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%2810%29-1104w.jpeg": "/images/morgantown/fence-installation-10.jpeg",
    "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%286%29-1104w.jpeg": "/images/morgantown/fence-installation-06.jpeg",
    "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%285%29-1104w.jpeg": "/images/morgantown/fence-installation-05.jpeg",
    "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%287%29-1104w.jpeg": "/images/morgantown/fence-installation-07.jpeg",
    "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%289%29-1104w.jpeg": "/images/morgantown/fence-installation-09.jpeg",
}
UNVERIFIED_CLAIM_REPLACEMENTS = (
    (re.compile(r"4\.9—STAR RATED BY 100\+ CUSTOMERS", re.I), "CUSTOMER-FOCUSED SERVICE"),
    (re.compile(r"50—YEAR PRODUCT WARRANTIES", re.I), "PROJECT TERMS CONFIRMED IN WRITING"),
    (re.compile(r"50-Year Warranty", re.I), "Written project scope"),
    (re.compile(r"50-Year water-control plan", re.I), "Written water-control plan"),
    (re.compile(r"(?:drainage|Pittsburgh) Certified Installers", re.I), "Property-specific installation planning"),
    (re.compile(r"(?:drainage|Pittsburgh) Certified", re.I), "Property-specific planning"),
    (re.compile(r"Same-Day Completion", re.I), "Scheduling confirmed after assessment"),
    (re.compile(r"Licensed and experienced drainages", re.I), "Property-specific drainage planning"),
    (re.compile(r"Top Rated retaining walls? Contractor", re.I), "Retaining wall planning"),
    (re.compile(r"over 20 years", re.I), "with project details confirmed"),
    (re.compile(r"Emergency Services", re.I), "Service availability"),
    (re.compile(r"Family Owned", re.I), "Local service"),
    (re.compile(r"(?:FGIA|AAMA|EPA|NFRC) Certified", re.I), "Professional project planning"),
    (re.compile(r"99\+ Years", re.I), "Local service experience"),
)


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def site_root(site: dict) -> Path:
    return ROOT / site["directory"]


def page_url(site: dict, slug: str, preview: bool = True) -> str:
    origin = f"https://clone-rebuild.{site['directory'].lower()}.pages.dev" if preview else f"https://{site['domain']}"
    return f"{origin}/{slug.strip('/') + '/' if slug else ''}"


def rootify(value: str | None) -> str | None:
    if not value or value.startswith(("#", "mailto:", "tel:", "javascript:", "data:", "http://", "https://", "//")):
        return value
    return "/" + value.lstrip("./")


def rewrite_fragment(fragment: BeautifulSoup, site: dict) -> None:
    service_slugs = [slug for slug, _ in site["services"]]
    service_index = 0
    for tag in fragment.find_all(True):
        for attribute in ("src", "href", "poster"):
            if tag.get(attribute):
                value = str(tag[attribute])
                tag[attribute] = EXTERNAL_IMAGE_MAP.get(value, rootify(value))
        if tag.get("style"):
            style = str(tag["style"])
            for remote, local in EXTERNAL_IMAGE_MAP.items():
                style = style.replace(remote, local)
            tag["style"] = style
    for anchor in fragment.find_all("a"):
        href = str(anchor.get("href", ""))
        label = " ".join(anchor.get_text(" ", strip=True).split()).lower()
        if href.startswith("tel:"):
            phone_ready = site["contact"].get("phoneStatus") in {"callrail-active", "callrail-shared"}
            if phone_ready and site["contact"].get("tel"):
                anchor["href"] = f"tel:{site['contact']['tel']}"
                anchor.attrs.pop("data-phone-status", None)
                anchor["aria-label"] = f"Call {site['brand']} at {site['contact']['phone']}"
                if label and re.search(r"\d{3}", label):
                    anchor.string = site["contact"]["phone"]
            else:
                anchor["href"] = "/contact/"
                anchor["data-phone-status"] = "online-request-only"
                anchor["aria-label"] = "Request service online"
                if label and re.search(r"\d{3}", label):
                    anchor.string = "Request Service"
        elif href.startswith("mailto:"):
            anchor["href"] = "/contact/"
        elif href in ("#", "/#"):
            anchor["href"] = "/"
        elif href.startswith("#"):
            if any(term in label for term in ("contact", "quote", "estimate", "book", "schedule", "call")):
                anchor["href"] = "/contact/"
            elif "about" in label or "why" in label:
                anchor["href"] = "/about/"
            elif "area" in label or "location" in label:
                anchor["href"] = "/service-areas/"
            elif "service" in label:
                anchor["href"] = "/services/"
        if anchor.find_parent(["header", "nav"]):
            if label == "home":
                anchor["href"] = "/"
            elif "about" in label or label == "why us":
                anchor["href"] = "/about/"
            elif "contact" in label or any(term in label for term in ("quote", "estimate", "book", "call")):
                anchor["href"] = "/contact/"
            elif "area" in label or "location" in label:
                anchor["href"] = "/service-areas/"
            elif "service" in label and service_index < len(service_slugs):
                anchor["href"] = f"/services/{service_slugs[service_index]}/"
                service_index += 1
    for image in fragment.find_all("img"):
        image["src"] = rootify(str(image.get("src", "/brandmark.svg")))
        if "logo" in " ".join(image.get("class", [])).lower() or image.get("src", "").endswith("brandmark.svg"):
            image["src"] = "/brandmark.svg"
            image["alt"] = site["brand"]
    for node in list(fragment.find_all(string=True)):
        if not isinstance(node, NavigableString) or node.parent.name in ("script", "style"):
            continue
        original = str(node)
        updated = original
        for pattern, replacement in UNVERIFIED_CLAIM_REPLACEMENTS:
            updated = pattern.sub(replacement, updated)
        if updated.strip().lower() == "licensed":
            updated = updated.replace(original.strip(), "Credentials")
        elif updated.strip().lower() == "& insured":
            updated = updated.replace(original.strip(), "Professional service")
        elif updated.strip().lower() == "family-owned":
            updated = updated.replace(original.strip(), "Local service")
        elif updated.strip().lower() == "verified reviews":
            updated = updated.replace(original.strip(), "Customer reviews")
        if updated != original:
            node.replace_with(updated)


def brand_css(site: dict) -> str:
    colors = site["brandSystem"]["colors"]
    typography = site["brandSystem"]["typography"]
    heading = typography["heading"]["fallback"]
    body = typography["body"]["fallback"]
    accent_font = typography["accent"]["fallback"]
    return f"""/* Generated from {site['brandSystem']['boardFile']}; clone geometry remains authoritative. */
:root {{
  --llg-primary: {colors['primary']};
  --llg-secondary: {colors['secondary']};
  --llg-accent: {colors['accent']};
  --llg-neutral: {colors['neutral']};
  --llg-heading: {heading};
  --llg-body: {body};
  --llg-accent-font: {accent_font};
  --primary: {colors['accent']};
  --secondary: {colors['secondary']};
  accent-color: {colors['accent']};
}}
body, input, select, textarea, button {{ font-family: var(--llg-body); }}
h1, h2, h3, h4, h5, h6, .llg-heading {{ font-family: var(--llg-heading); }}
.llg-accent-type {{ font-family: var(--llg-accent-font); }}
.text-primary, [class*="text-primary"] {{ color: var(--llg-accent) !important; }}
.bg-primary, [class*="bg-primary"] {{ background-color: var(--llg-primary) !important; }}
.border-primary {{ border-color: var(--llg-accent) !important; }}
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {{ outline: 3px solid var(--llg-accent); outline-offset: 3px; }}
.llg-page {{ color: var(--llg-primary); background: #fff; }}
.llg-inner {{ width: min(80rem, calc(100% - 2rem)); margin-inline: auto; }}
.llg-page-hero {{ padding: clamp(7rem, 13vw, 11rem) 0 clamp(3rem, 7vw, 6rem); background: linear-gradient(135deg, var(--llg-primary), var(--llg-secondary)); color: #fff; }}
.llg-kicker {{ margin: 0 0 .75rem; font: 700 .78rem/1.2 var(--llg-body); letter-spacing: .16em; text-transform: uppercase; color: var(--llg-neutral); }}
.llg-page-hero h1 {{ max-width: 18ch; margin: 0; font-size: clamp(2.6rem, 7vw, 5.8rem); line-height: .98; text-wrap: balance; }}
.llg-page-hero p {{ max-width: 48rem; margin: 1.4rem 0 0; font-size: clamp(1.05rem, 2vw, 1.3rem); line-height: 1.65; }}
.llg-section {{ padding: clamp(3.5rem, 7vw, 6.5rem) 0; }}
.llg-section--soft {{ background: color-mix(in srgb, var(--llg-neutral) 72%, white); }}
.llg-section h2 {{ font-size: clamp(2rem, 4vw, 3.6rem); line-height: 1.06; margin: 0 0 1.2rem; }}
.llg-copy {{ max-width: 48rem; font-size: 1.05rem; line-height: 1.75; }}
.llg-grid {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }}
.llg-card {{ display: flex; flex-direction: column; padding: clamp(1.25rem, 3vw, 2rem); border: 1px solid color-mix(in srgb, var(--llg-secondary) 24%, transparent); border-radius: .875rem; background: #fff; box-shadow: 0 16px 42px rgb(0 0 0 / .08); }}
.llg-card h2, .llg-card h3 {{ font-size: clamp(1.35rem, 3vw, 2rem); margin: 0 0 .75rem; }}
.llg-card p {{ flex: 1; line-height: 1.65; }}
.llg-link, .llg-button {{ display: inline-flex; align-items: center; justify-content: center; min-height: 48px; width: fit-content; padding: .8rem 1.15rem; border-radius: .5rem; color: #fff; background: var(--llg-accent); font-weight: 700; text-decoration: none; border: 0; cursor: pointer; }}
.llg-button[disabled] {{ opacity: .6; cursor: wait; }}
.llg-call-chip {{ position: fixed; z-index: 9999; right: 1rem; bottom: 1rem; display: inline-flex; align-items: center; min-height: 48px; padding: .8rem 1rem; border-radius: 999px; background: var(--llg-accent); color: #fff; box-shadow: 0 12px 32px rgb(0 0 0 / .24); font-weight: 800; text-decoration: none; }}
.llg-breadcrumbs {{ padding: 1rem 0; background: color-mix(in srgb, var(--llg-neutral) 65%, white); font-size: .92rem; }}
.llg-breadcrumbs ol {{ display: flex; flex-wrap: wrap; gap: .45rem; padding: 0; margin: 0; list-style: none; }}
.llg-breadcrumbs li + li::before {{ content: "/"; margin-right: .45rem; opacity: .5; }}
.llg-breadcrumbs a {{ color: inherit; }}
.llg-form {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; max-width: 56rem; }}
.llg-field {{ display: grid; gap: .4rem; }}
.llg-field--full, .llg-consent, .llg-form-status, .cf-turnstile {{ grid-column: 1 / -1; }}
.llg-field label, .llg-consent label {{ font-weight: 700; }}
.llg-field input, .llg-field select, .llg-field textarea {{ width: 100%; min-height: 48px; padding: .72rem .8rem; border: 1px solid color-mix(in srgb, var(--llg-primary) 35%, white); border-radius: .45rem; background: #fff; color: #111; }}
.llg-field textarea {{ min-height: 8rem; resize: vertical; }}
.llg-consent label {{ display: grid; grid-template-columns: 1.25rem 1fr; gap: .65rem; align-items: start; font-weight: 400; line-height: 1.5; }}
.llg-consent input {{ width: 1.1rem; height: 1.1rem; margin-top: .18rem; }}
.llg-honeypot {{ position: absolute !important; left: -9999px !important; width: 1px !important; height: 1px !important; overflow: hidden !important; }}
.llg-form-status {{ min-height: 1.5rem; font-weight: 700; }}
.llg-proof-note {{ padding: 1rem 1.2rem; border-left: .3rem solid var(--llg-accent); background: color-mix(in srgb, var(--llg-neutral) 70%, white); line-height: 1.55; }}
.llg-meta {{ font-size: .9rem; opacity: .72; }}
.llg-legal {{ max-width: 54rem; line-height: 1.75; }}
.llg-legal h2 {{ margin-top: 2.3rem; }}
.llg-page-footer {{ padding: 3rem 0; background: var(--llg-primary); color: #fff; }}
.llg-page-footer nav {{ display: flex; flex-wrap: wrap; gap: 1rem 1.5rem; }}
.llg-page-footer a {{ color: inherit; }}
.llg-visually-hidden {{ position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }}
@media (max-width: 720px) {{
  .llg-grid, .llg-form {{ grid-template-columns: 1fr; }}
  .llg-page-hero {{ padding-top: 6.5rem; }}
  .llg-call-chip {{ right: .75rem; bottom: .75rem; }}
}}
@media (prefers-reduced-motion: reduce) {{ *, *::before, *::after {{ scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }} }}
"""


def runtime_js() -> str:
    return """(() => {
  const root = document.documentElement;
  const endpoint = root.dataset.leadEndpoint;
  const params = new URLSearchParams(location.search);
  const attribution = Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid'].map(k => [k, params.get(k)]).filter(([,v]) => v));
  document.querySelectorAll('form[data-llg-lead-form]').forEach((form) => {
    const status = form.querySelector('[data-form-status]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!endpoint) { status.textContent = 'This preview is not connected to the lead service yet.'; return; }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      status.textContent = 'Sending your request…';
      const data = Object.fromEntries(new FormData(form).entries());
      const payload = {
        submissionId: crypto.randomUUID(),
        siteKey: root.dataset.siteKey,
        pagePath: location.pathname,
        firstName: data.firstName || '', lastName: data.lastName || '',
        phone: data.phone || '', email: data.email || '', zip: data.zip || '',
        service: data.service || '', message: data.message || '',
        smsConsent: data.smsConsent === 'on', company: data.company || '',
        turnstileToken: data['cf-turnstile-response'] || '',
        utm: attribution, referrer: document.referrer || null, landingPage: location.href,
      };
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'We could not send the request.');
        status.textContent = `Request received. Reference ${result.leadId || payload.submissionId}.`;
        form.reset();
        if (window.turnstile) window.turnstile.reset();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'We could not send the request. Please try again.';
      } finally { submit.disabled = false; }
    });
  });
})();
"""


def standard_form(site: dict) -> str:
    options = "".join(f'<option value="{esc(slug)}">{esc(title)}</option>' for slug, title in site["services"])
    return f"""
<form class="llg-form" data-llg-lead-form novalidate>
  <div class="llg-field"><label for="first-name">First name</label><input id="first-name" name="firstName" autocomplete="given-name" required></div>
  <div class="llg-field"><label for="last-name">Last name</label><input id="last-name" name="lastName" autocomplete="family-name" required></div>
  <div class="llg-field"><label for="phone">Phone</label><input id="phone" name="phone" type="tel" autocomplete="tel" required></div>
  <div class="llg-field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
  <div class="llg-field"><label for="zip">ZIP code</label><input id="zip" name="zip" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{{5}}(?:-[0-9]{{4}})?" required></div>
  <div class="llg-field"><label for="service">Service</label><select id="service" name="service" required><option value="">Choose a service</option>{options}</select></div>
  <div class="llg-field llg-field--full"><label for="message">What is happening?</label><textarea id="message" name="message" required></textarea></div>
  <div class="llg-honeypot" aria-hidden="true"><label>Company<input name="company" tabindex="-1" autocomplete="off"></label></div>
  <div class="llg-consent"><label><input name="smsConsent" type="checkbox"><span>By checking this box, I agree to receive service-related calls and text messages at the number provided. Consent is optional and is not a condition of purchase. Message and data rates may apply. Reply STOP to opt out.</span></label></div>
  <div class="cf-turnstile" data-sitekey="{TURNSTILE_TEST_SITEKEY}" data-action="lead_submit"></div>
  <button class="llg-button" type="submit">Request Service</button>
  <p class="llg-form-status" data-form-status role="status" aria-live="polite"></p>
</form>"""


def breadcrumbs(site: dict, page: dict) -> tuple[str, list[dict]]:
    items = [("Home", "/")]
    if page["type"] == "service":
        items.append(("Services", "/services/"))
    if page["slug"]:
        items.append((page_title(site, page, heading_only=True), f"/{page['slug']}/"))
    crumb_parts = []
    for index, (label, url) in enumerate(items):
        content = esc(label) if index == len(items) - 1 else f'<a href="{url}">{esc(label)}</a>'
        crumb_parts.append(f"<li>{content}</li>")
    markup = '<nav class="llg-breadcrumbs" aria-label="Breadcrumb"><div class="llg-inner"><ol>' + "".join(crumb_parts) + "</ol></div></nav>"
    data = [{"@type": "ListItem", "position": index + 1, "name": label, "item": page_url(site, url.strip("/"))} for index, (label, url) in enumerate(items)]
    return markup, data


def page_title(site: dict, page: dict, heading_only: bool = False) -> str:
    if page["type"] == "services-hub": return "Services"
    if page["type"] == "service": return page["service"]
    if page["type"] == "service-areas-hub": return "Service Area"
    if page["type"] == "about": return f"About {site['brand']}"
    if page["type"] == "contact": return "Request Service"
    if page["type"] == "legal": return "Privacy Policy" if page["slug"] == "privacy" else "Terms of Use"
    if page["type"] == "confirmation": return "Thank You"
    return site["brand"] if heading_only else f"{site['brand']} | {site['trade']} in {site['city']}"


def description(site: dict, page: dict) -> str:
    name = page_title(site, page, heading_only=True)
    if page["type"] == "service": return f"Learn how {site['brand']} approaches {name.lower()} for properties in {site['city']}, {site['state']}, then request a site assessment."
    if page["type"] == "services-hub": return f"Explore {site['brand']} {site['trade'].lower()} services for {site['city']}, {site['state']} properties."
    if page["type"] == "service-areas-hub": return f"Confirm the primary {site['brand']} service area in {site['city']}, {site['state']}."
    if page["type"] == "about": return f"Learn about the assessment, planning, and project communication process used by {site['brand']}."
    if page["type"] == "contact": return f"Request a {site['trade'].lower()} assessment from {site['brand']} in {site['city']}, {site['state']}."
    return f"{name} for the {site['brand']} website."


def page_content(site: dict, page: dict) -> str:
    title = page_title(site, page, heading_only=True)
    intro = description(site, page)
    if page["type"] == "services-hub":
        cards = "".join(f'<article class="llg-card"><h2>{esc(name)}</h2><p>Review the problem, assessment, planning, and next-step considerations for this service.</p><a class="llg-link" href="/services/{esc(slug)}/">Explore {esc(name)}</a></article>' for slug, name in site["services"])
        body = f'<section class="llg-section"><div class="llg-inner"><div class="llg-grid">{cards}</div></div></section>'
    elif page["type"] == "service":
        body = f"""<section class="llg-section"><div class="llg-inner"><div class="llg-copy"><h2>Start with the source of the problem</h2><p>{esc(title)} should begin with an on-site review of the property, the visible symptoms, and the route a practical solution would need to follow. The final scope reflects the conditions found at your property.</p><h2>What the assessment covers</h2><p>The assessment documents the affected area, relevant access constraints, existing systems, and the result you want. Recommendations and pricing follow that property review.</p><h2>Clear next steps</h2><p>You receive a plain-language explanation of the proposed work and an opportunity to ask questions before scheduling, with project details confirmed in writing.</p></div></div></section><section class="llg-section llg-section--soft"><div class="llg-inner"><h2>Request an assessment</h2>{standard_form(site)}</div></section>"""
    elif page["type"] == "service-areas-hub":
        body = f"""<section class="llg-section"><div class="llg-inner"><div class="llg-copy"><h2>Primary service area</h2><p>{esc(site['brand'])} handles service requests in {esc(site['city'])}, {esc(site['state'])}. Availability at a specific address is confirmed when you submit your project details.</p><div class="llg-proof-note">If your property is near the edge of the service area, include the ZIP code and neighborhood so the team can confirm coverage.</div></div></div></section>"""
    elif page["type"] == "about":
        body = f"""<section class="llg-section"><div class="llg-inner"><div class="llg-grid"><article class="llg-card"><h2>1. Listen</h2><p>Start with what you are seeing, when it happens, and what outcome matters most.</p></article><article class="llg-card"><h2>2. Assess</h2><p>Review the relevant property conditions before recommending work.</p></article><article class="llg-card"><h2>3. Explain</h2><p>Present the proposed scope in plain language with clear next steps.</p></article><article class="llg-card"><h2>4. Confirm</h2><p>Finalize scheduling only after the serving provider and project details are confirmed.</p></article></div></div></section>"""
    elif page["type"] == "contact":
        phone_ready = site["contact"].get("phoneStatus") in {"callrail-active", "callrail-shared"}
        phone_note = f"Call {site['contact']['phone']} or use the form below." if phone_ready else "Use the form below to request service and share the project details."
        body = f'<section class="llg-section"><div class="llg-inner"><p class="llg-proof-note">{esc(phone_note)}</p>{standard_form(site)}</div></section>'
    elif page["type"] == "legal":
        legal = """<h2>Information collected</h2><p>When you submit a request, the form collects the contact and project information you provide, along with basic attribution data such as the page, referrer, and campaign parameters.</p><h2>How information is used</h2><p>Information is used to route and respond to your service request, protect the form from abuse, and audit delivery.</p><h2>Text messages</h2><p>Text-message consent is optional and unchecked by default. If you opt in, message and data rates may apply and you can reply STOP to opt out.</p><h2>Questions</h2><p>Use the request form to ask a question about this policy.</p>""" if page["slug"] == "privacy" else """<h2>Website information</h2><p>Information on this site is general and may change after a property assessment. A request submitted through the site does not create a service agreement.</p><h2>Project scope</h2><p>Availability, pricing, scheduling, materials, warranties, and service details are confirmed before work is authorized.</p><h2>Using this site</h2><p>Use the information and request forms on this site to begin a project conversation. Final terms are provided with the project scope.</p>"""
        body = f'<section class="llg-section"><div class="llg-inner llg-legal">{legal}</div></section>'
    elif page["type"] == "confirmation":
        body = '<section class="llg-section"><div class="llg-inner"><div class="llg-copy"><h2>Your request has been received</h2><p>Keep the reference number shown after submission. The team will use the contact details you provided to follow up.</p><a class="llg-link" href="/">Return home</a></div></div></section>'
    else:
        body = ""
    return f'<section class="llg-page-hero"><div class="llg-inner"><p class="llg-kicker">{esc(site["brand"])} · {esc(site["city"])}, {esc(site["state"])}</p><h1>{esc(title)}</h1><p>{esc(intro)}</p></div></section>{body}'


def schema_for(site: dict, page: dict, breadcrumb_items: list[dict]) -> dict:
    org_id = f"urn:llg:{site['siteKey']}:organization"
    graph = [{"@type": "Organization", "@id": org_id, "name": site["brand"]}, {"@type": "BreadcrumbList", "itemListElement": breadcrumb_items}]
    if page["type"] == "service":
        graph.append({"@type": "Service", "name": page["service"], "provider": {"@id": org_id}, "areaServed": {"@type": "City", "name": site["city"]}, "description": description(site, page)})
    return {"@context": "https://schema.org", "@graph": graph}


def prepare_home(site: dict) -> BeautifulSoup:
    root = site_root(site)
    soup = BeautifulSoup((root / "index.html").read_text(encoding="utf-8", errors="ignore"), "html.parser")
    soup.html["lang"] = "en"
    soup.html["data-site-key"] = site["siteKey"]
    soup.html["data-lead-endpoint"] = DEFAULT_LEAD_ENDPOINT
    for canonical in soup.select('link[rel="canonical"]'):
        canonical.decompose()
    robots = soup.find("meta", attrs={"name": "robots"})
    if not robots:
        robots = soup.new_tag("meta", attrs={"name": "robots"})
        soup.head.append(robots)
    robots["content"] = "noindex,nofollow"
    for tag in soup.select('link[data-llg-brand], script[data-llg-runtime], script[data-llg-turnstile], script[data-llg-schema]'):
        tag.decompose()
    # These archived Webflow application bundles request split chunks that were
    # never present in the reference packages. The local clone behavior script
    # owns the retained navigation interactions, so omit only the incomplete
    # bundles instead of shipping predictable browser errors.
    incomplete_bundle_ids = ("/6882c1282f53c7e5715cb060/js/", "/67766a15d926061fb5525ff7/js/")
    for tag in soup.find_all("script", src=True):
        if any(bundle_id in tag.get("src", "") for bundle_id in incomplete_bundle_ids):
            tag.decompose()
    brand_link = soup.new_tag("link", rel="stylesheet", href="brand-system.css")
    brand_link["data-llg-brand"] = ""
    soup.head.append(brand_link)
    turnstile = soup.new_tag("script", src="https://challenges.cloudflare.com/turnstile/v0/api.js", attrs={"async": "", "defer": "", "data-llg-turnstile": ""})
    soup.head.append(turnstile)
    organization_schema = {"@context": "https://schema.org", "@graph": [{"@type": "Organization", "@id": f"urn:llg:{site['siteKey']}:organization", "name": site["brand"]}, {"@type": "WebSite", "name": site["brand"]}]}
    schema = soup.new_tag("script", type="application/ld+json", attrs={"data-llg-schema": ""})
    schema.string = json.dumps(organization_schema, separators=(",", ":"))
    soup.head.append(schema)
    rewrite_fragment(soup, site)
    phone_ready = site["contact"].get("phoneStatus") in {"callrail-active", "callrail-shared"}
    if phone_ready and site["contact"].get("tel") and not soup.select_one('a[href^="tel:"]'):
        call_chip = soup.new_tag("a", href=f"tel:{site['contact']['tel']}")
        call_chip["class"] = "llg-call-chip"
        call_chip["aria-label"] = f"Call {site['brand']} at {site['contact']['phone']}"
        call_chip.string = f"Call {site['contact']['phone']}"
        soup.body.append(call_chip)
    if not phone_ready:
        for node in list(soup.find_all(string=PHONE_RE)):
            if isinstance(node, NavigableString) and node.parent.name not in ("script", "style"):
                node.replace_with(PHONE_RE.sub("Request Service", str(node)))
    forms = soup.find_all("form")
    if forms:
        replacement = BeautifulSoup(standard_form(site), "html.parser").form
        forms[0].replace_with(replacement)
        for extra in forms[1:]:
            extra.decompose()
    else:
        target = soup.find(id="contact") or soup.find("main") or soup.body
        target.append(BeautifulSoup(f'<section class="llg-section llg-section--soft"><div class="llg-inner"><h2>Request Service</h2>{standard_form(site)}</div></section>', "html.parser"))
    if not soup.find("h1"):
        main = soup.find("main") or soup.body
        hidden_h1 = soup.new_tag("h1")
        hidden_h1["class"] = "llg-visually-hidden"
        hidden_h1.string = f"{site['brand']} {site['trade']} in {site['city']}"
        main.insert(0, hidden_h1)
    runtime = soup.new_tag("script", src="portfolio-runtime.js", defer="", attrs={"data-llg-runtime": ""})
    soup.body.append(runtime)
    return soup


def shell_parts(home: BeautifulSoup, site: dict) -> tuple[str, str, list[str]]:
    header = home.find("header") or home.find("nav")
    footer = home.find("footer")
    header_html = str(copy(header)) if header else f'<header class="llg-page-footer"><div class="llg-inner"><a href="/"><img src="/brandmark.svg" alt="{esc(site["brand"])}" width="260" height="80"></a></div></header>'
    footer_html = str(copy(footer)) if footer else f'<footer class="llg-page-footer"><div class="llg-inner"><p>{esc(site["brand"])}</p></div></footer>'
    header_soup = BeautifulSoup(header_html, "html.parser")
    footer_soup = BeautifulSoup(footer_html, "html.parser")
    for fragment in (header_soup, footer_soup):
        for heading in fragment.find_all("h1"):
            heading.name = "div"
            heading["role"] = "presentation"
    rewrite_fragment(header_soup, site)
    rewrite_fragment(footer_soup, site)
    styles = []
    for link in home.select('link[rel="stylesheet"]'):
        href = rootify(str(link.get("href", "")))
        if href and href not in styles:
            styles.append(href)
    return str(header_soup), str(footer_soup), styles


def inner_page(site: dict, page: dict, header_html: str, footer_html: str, styles: list[str]) -> str:
    title = page_title(site, page)
    if page["type"] != "home":
        title = f"{page_title(site, page, heading_only=True)} | {site['brand']}"
    crumb_html, crumb_items = breadcrumbs(site, page)
    schema = schema_for(site, page, crumb_items)
    style_links = "".join(f'<link rel="stylesheet" href="{esc(href)}">' for href in styles)
    return f"""<!doctype html>
<html lang="en" data-site-key="{esc(site['siteKey'])}" data-lead-endpoint="{esc(DEFAULT_LEAD_ENDPOINT)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description(site, page))}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description(site, page))}">
  <meta property="og:site_name" content="{esc(site['brand'])}">
  <meta property="og:url" content="{esc(page_url(site, page['slug']))}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(description(site, page))}">
  <link rel="icon" href="/favicon.png" type="image/png">
  {style_links}<link rel="stylesheet" href="/brand-system.css">
  <script type="application/ld+json">{json.dumps(schema, separators=(',', ':'))}</script>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body class="llg-page" data-clone="{esc(site['clone']['id'])}">
  <a class="clone-skip" href="#main-content">Skip to content</a>
  {header_html}
  {crumb_html}
  <main id="main-content">{page_content(site, page)}</main>
  {footer_html}
  <footer class="llg-page-footer"><div class="llg-inner"><nav aria-label="Footer"><a href="/services/">Services</a><a href="/service-areas/">Service Area</a><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav><p class="llg-meta">© 2026 {esc(site['brand'])}. Serving {esc(site['city'])}, {esc(site['state'])}.</p></div></footer>
  <script src="/portfolio-runtime.js" defer></script>
</body>
</html>
"""


def build_site(site: dict) -> None:
    root = site_root(site)
    if not (root / "index.html").is_file():
        raise FileNotFoundError(root / "index.html")
    home = prepare_home(site)
    (root / "brand-system.css").write_text(brand_css(site), encoding="utf-8")
    (root / "portfolio-runtime.js").write_text(runtime_js(), encoding="utf-8")
    (root / "index.html").write_text("<!doctype html>\n" + str(home), encoding="utf-8")
    header_html, footer_html, styles = shell_parts(home, site)
    for page in site["pages"]:
        if not page["slug"]:
            continue
        target = root / page["slug"]
        target.mkdir(parents=True, exist_ok=True)
        (target / "index.html").write_text(inner_page(site, page, header_html, footer_html, styles), encoding="utf-8")
    (root / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
    (root / "_headers").write_text("/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Content-Type-Options: nosniff\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n", encoding="utf-8")
    (root / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n', encoding="utf-8")
    release = {
        "siteKey": site["siteKey"],
        "stage": "staging",
        "currentCrawlContract": {"metaRobots": "noindex,nofollow", "robotsTxt": "Disallow: /", "xRobotsTag": "noindex, nofollow", "sitemap": "empty"},
        "productionCandidate": {"origin": f"https://{site['domain']}", "urls": [{"path": "/" + (page["slug"].strip("/") + "/" if page["slug"] else ""), "canonical": page_url(site, page["slug"], preview=False), "indexState": "pending-approval"} for page in site["pages"] if page["type"] not in ("legal", "confirmation")]},
        "releaseBlockers": site["indexing"]["blockers"],
    }
    (root / "seo-release-manifest.json").write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    for site in DATA["sites"]:
        build_site(site)
        print(f"built SEO staging system for {site['siteKey']}")


if __name__ == "__main__":
    main()
