from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
PORTFOLIO = json.loads((ROOT / "data" / "sites.json").read_text(encoding="utf-8"))["sites"]
TRACKERS = ("googletag", "google-analytics", "gtag(", "facebook", "fbq(", "clickcease", "hotjar", "callrail", "clarity", "doubleclick", "leadconnector", "lintrk")
PHONE_RE = re.compile(r"(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}")
STREET_RE = re.compile(r"\b\d{1,6}\s+[A-Z0-9][A-Z0-9 .'-]{1,50}\s(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way)\b", re.I)
UNVERIFIED_VISIBLE_CLAIM_RE = re.compile(
    r"4\.9—star rated|50—year product|50-year warranty|50-year water-control|certified installers|same-day completion|licensed and experienced|top rated|over 20 years|99\+ years|(?:fgia|aama|epa|nfrc) certified|emergency services",
    re.I,
)
INTERNAL_VISIBLE_COPY_RE = re.compile(
    r"\b(?:fake review|sample review|demo|address intake pending|verified reviews pending|phone routing pending|project photos pending|staging site|staging preview)\b",
    re.I,
)


def local_reference(site_root: Path, value: str) -> Path | None:
    if not value or value.startswith(("data:", "mailto:", "tel:", "#", "javascript:")):
        return None
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return None
    path = unquote(parsed.path).lstrip("/")
    if not path:
        return None
    target = site_root / path
    if parsed.path.endswith("/"):
        target = target / "index.html"
    return target


def audit_page(site_root: Path, html_path: Path) -> list[str]:
    issues: list[str] = []
    raw = html_path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(raw, "html.parser")
    relative = html_path.relative_to(site_root).as_posix()
    robots = soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)})
    if not robots or "noindex" not in robots.get("content", "").lower() or "nofollow" not in robots.get("content", "").lower():
        issues.append(f"{relative}: missing noindex,nofollow meta")
    if len(soup.find_all("h1")) != 1:
        issues.append(f"{relative}: expected exactly one H1")
    if not soup.title or not soup.title.get_text(strip=True):
        issues.append(f"{relative}: missing title")
    if not soup.find("meta", attrs={"name": "description"}):
        issues.append(f"{relative}: missing description")
    if soup.select('link[rel="canonical"]'):
        issues.append(f"{relative}: staging page has canonical")
    for form in soup.find_all("form"):
        if not form.has_attr("data-llg-lead-form"):
            issues.append(f"{relative}: form is not wired to centralized intake")
        consent = form.find("input", attrs={"name": "smsConsent", "type": "checkbox"})
        if consent and consent.has_attr("checked"):
            issues.append(f"{relative}: SMS consent is prechecked")
        if not form.find(class_="cf-turnstile"):
            issues.append(f"{relative}: form missing Turnstile widget")
    for schema in soup.find_all("script", attrs={"type": re.compile("ld\\+json", re.I)}):
        try:
            payload = json.loads(schema.get_text())
        except json.JSONDecodeError:
            issues.append(f"{relative}: invalid JSON-LD")
            continue
        raw_schema = json.dumps(payload)
        if any(term in raw_schema for term in ('"AggregateRating"', '"Review"', '"PostalAddress"', '"telephone"')):
            issues.append(f"{relative}: unapproved schema claim")
    return issues


def audit_site(site: dict) -> dict:
    slug = site["directory"]
    site_root = ROOT / slug
    issues: list[str] = []
    html_path = site_root / "index.html"
    if not html_path.is_file():
        return {"site": slug, "strict": True, "issues": ["missing index.html"]}
    raw = html_path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(raw, "html.parser")
    issues.extend(audit_page(site_root, html_path))
    if not (site_root / "robots.txt").is_file() or "Disallow: /" not in (site_root / "robots.txt").read_text(encoding="utf-8", errors="ignore"):
        issues.append("robots.txt does not disallow staging crawl")
    if not (site_root / "_headers").is_file() or "noindex" not in (site_root / "_headers").read_text(encoding="utf-8", errors="ignore").lower():
        issues.append("_headers missing X-Robots-Tag")
    for tag, attribute in [(tag, attr) for tag in soup.find_all(True) for attr in ("src", "href") if tag.get(attr)]:
        value = str(tag.get(attribute))
        target = local_reference(site_root, value)
        if target and not target.is_file():
            issues.append(f"missing local asset: {value}")
    active_code = " ".join(
        [f"{tag.get('src', '')} {tag.get_text(' ', strip=True)}" for tag in soup.find_all("script")]
        + [f"{tag.get('name', '')} {tag.get('property', '')} {tag.get('content', '')}" for tag in soup.find_all("meta")]
    ).lower()
    if any(term in active_code for term in TRACKERS):
        issues.append("tracking code marker remains")
    visible = soup.get_text(" ", strip=True)
    phone_ready = site["contact"].get("phoneStatus") in {"callrail-active", "callrail-shared"}
    tel_links = [str(anchor.get("href", "")) for anchor in soup.find_all("a") if str(anchor.get("href", "")).startswith("tel:")]
    if phone_ready:
        if site["contact"].get("phone") not in visible:
            issues.append("verified CallRail number is not visible")
        expected_tel = f"tel:{site['contact'].get('tel')}"
        if expected_tel not in tel_links:
            issues.append("verified CallRail tel link is missing")
    else:
        if PHONE_RE.search(visible) or tel_links:
            issues.append("non-CallRail phone remains visible")
    internal_copy = INTERNAL_VISIBLE_COPY_RE.search(visible)
    if internal_copy:
        issues.append(f"internal implementation copy remains visible: {internal_copy.group(0)}")
    claim = UNVERIFIED_VISIBLE_CLAIM_RE.search(visible)
    if claim:
        issues.append(f"unverified visible claim remains: {claim.group(0)}")
    external_images = [image.get("src") for image in soup.find_all("img") if str(image.get("src", "")).startswith(("http://", "https://", "//"))]
    if external_images:
        issues.append(f"external image remains: {external_images[0]}")
    expected_paths = {"index.html"}
    expected_paths.update(f"{page['slug']}/index.html" for page in site["pages"] if page["slug"])
    for relative in sorted(expected_paths):
        page_path = site_root / relative
        if not page_path.is_file():
            issues.append(f"missing generated page: {relative}")
        elif page_path != html_path:
            issues.extend(audit_page(site_root, page_path))
    release = site_root / "seo-release-manifest.json"
    if not release.is_file():
        issues.append("missing SEO release manifest")
    return {"site": slug, "strict": True, "issues": sorted(set(issues))}


def main() -> int:
    results = [audit_site(site) for site in PORTFOLIO]
    report = {"siteCount": len(results), "passed": sum(not item["issues"] for item in results), "failed": sum(bool(item["issues"]) for item in results), "results": results}
    output = ROOT / ".qa" / "static-audit.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for item in results:
        print(f"{item['site']}: {'PASS' if not item['issues'] else 'FAIL - ' + '; '.join(item['issues'])}")
    print(f"Static audit: {report['passed']}/{report['siteCount']} passed")
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
