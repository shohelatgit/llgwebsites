#!/usr/bin/env python3
"""Fail when the portfolio collapses back into a shared clone runtime."""

from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_COUNTS = {
    "horizonfix": 3,
    "roofrightnow": 5,
    "nextgen-windows": 4,
    "pinks-concrete": 5,
    "minuteman": 3,
    "welborn-garage": 4,
    "cincinnati-painting": 1,
    "trips-windows-small": 2,
    "trips-windows-full": 2,
}
GENERATED_CSS = {"brand-system.css", "llg-clone-override.css"}


def sha256(parts: list[bytes]) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part)
    return digest.hexdigest()


def source_css_fingerprint(directory: Path) -> tuple[str, list[str]]:
    css_root = directory / "clone-assets"
    files = sorted(path for path in css_root.rglob("*.css") if path.name not in GENERATED_CSS)
    payload: list[bytes] = []
    labels: list[str] = []
    for path in files:
        label = path.relative_to(css_root).as_posix()
        labels.append(label)
        payload.extend([label.encode("utf-8"), b"\0", path.read_bytes(), b"\0"])
    return sha256(payload), labels


def structure_fingerprint(index: Path) -> tuple[str, int]:
    soup = BeautifulSoup(index.read_text(encoding="utf-8"), "html.parser")
    signature = []
    for element in soup.find_all(["header", "nav", "main", "section", "footer"]):
        signature.append(f"{element.name}.{'-'.join(element.get('class', []))}")
    return sha256(["|".join(signature).encode("utf-8")]), len(signature)


def main() -> int:
    sites = json.loads((ROOT / "data" / "sites.json").read_text(encoding="utf-8"))["sites"]
    errors: list[str] = []
    rows = []
    css_by_family: dict[str, set[str]] = defaultdict(set)
    structure_hashes: set[str] = set()

    actual_counts = Counter(site["clone"]["id"] for site in sites)
    if dict(actual_counts) != EXPECTED_COUNTS:
        errors.append(f"clone distribution mismatch: {dict(actual_counts)}")

    for site in sites:
        directory = ROOT / site["directory"]
        family = site["clone"]["id"]
        index = directory / "index.html"
        if not index.exists():
            errors.append(f"{site['siteKey']}: missing index.html")
            continue
        css_hash, css_files = source_css_fingerprint(directory)
        structure_hash, structure_count = structure_fingerprint(index)
        css_by_family[family].add(css_hash)
        structure_hashes.add(structure_hash)
        if not css_files:
            errors.append(f"{site['siteKey']}: no adopted source CSS found")
        manifest_path = directory / "content-manifest.json"
        adopted_package = None
        adopted_export = None
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            adopted = manifest.get("sourceAdoption", {})
            adopted_package = adopted.get("package")
            adopted_export = adopted.get("homepageExport")
            if not adopted_package or not adopted_export:
                errors.append(f"{site['siteKey']}: incomplete sourceAdoption evidence")
        rows.append(
            {
                "siteKey": site["siteKey"],
                "directory": site["directory"],
                "cloneFamily": family,
                "sourceCssFingerprint": css_hash,
                "sourceCssFiles": css_files,
                "structureFingerprint": structure_hash,
                "majorLandmarkCount": structure_count,
                "adoptedPackage": adopted_package,
                "adoptedHomepageExport": adopted_export,
            }
        )

    for family, fingerprints in css_by_family.items():
        if len(fingerprints) != 1:
            errors.append(f"{family}: targets do not share one untouched source CSS runtime")

    family_css = {family: next(iter(fingerprints)) for family, fingerprints in css_by_family.items() if fingerprints}
    if len(set(family_css.values())) != len(EXPECTED_COUNTS):
        errors.append("source CSS fingerprints are not unique across all nine clone packages")

    # The two Trips exports intentionally share a DOM family, but their source CSS packages differ.
    if len(structure_hashes) < 8:
        errors.append(f"only {len(structure_hashes)} distinct landmark structures found; expected at least 8")

    summary = {
        "runDate": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "siteCount": len(sites),
        "cloneFamilyCount": len(actual_counts),
        "cloneDistribution": dict(sorted(actual_counts.items())),
        "uniqueSourceCssRuntimes": len(set(family_css.values())),
        "uniqueLandmarkStructures": len(structure_hashes),
        "notes": [
            "Generated brand-system.css and llg-clone-override.css are excluded from source fingerprints.",
            "Trips small and full exports share a landmark structure but retain different source CSS runtimes.",
            "First-wave sites predate content-manifest.json; their adopted package is proven by the same family CSS fingerprint.",
        ],
        "errors": errors,
        "sites": rows,
    }
    qa_dir = ROOT / ".qa"
    qa_dir.mkdir(exist_ok=True)
    (qa_dir / "clone-fidelity.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(
        f"Clone fidelity: {len(sites)} sites, {len(actual_counts)} families, "
        f"{len(set(family_css.values()))} source CSS runtimes, {len(structure_hashes)} structures"
    )
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("Clone fidelity audit passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
