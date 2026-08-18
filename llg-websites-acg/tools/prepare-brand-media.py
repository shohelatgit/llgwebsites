from __future__ import annotations

import base64
import hashlib
import io
import json
import shutil
import urllib.request
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BOARD_ROOT = Path(r"C:\Users\Justin Abrams\Downloads\LLG Websites")
PRIOR_DRAINAGE = Path(
    r"C:\Users\Justin Abrams\OneDrive\Documents\Playground\website-clones"
    r"\apps\general-drain-pros\public\images\drainage-hero-1920.webp"
)
PRIOR_GENERATED_ROOT = Path(
    r"C:\Users\Justin Abrams\OneDrive\Documents\Playground\outputs"
    r"\019fce0b-1812-7a13-91e9-097943eb3f86\images"
)
BRAND_ROOT = ROOT / "assets" / "brand"
STOCK_ROOT = ROOT / "assets" / "stock"
REFERENCE_ROOT = ROOT / "references" / "media-provenance"
TODAY = date.today().isoformat()


STOCK = {
    "drainage-pipe-detail": (37627673, "D Goug", "Drainage pipe installation in an excavated trench", "drainage"),
    "drainage-trench-wide": (37627672, "D Goug", "Construction trench and drainage pipes in a suburban area", "drainage"),
    "crawlspace-inspection": (32497163, "Kathleen Austin Kuhn", "Home inspector examining a crawlspace entrance", "crawlspace"),
    "empty-basement": (4092030, "Curtis Adams", "Unfinished basement with exposed framing and utilities", "crawlspace"),
    "insulation-worker": (6124239, "Erik Mclean", "Worker installing insulation in a building interior", "crawlspace"),
    "retaining-wall-pond": (12763046, "Muhammed Zahid Bulut", "Stone retaining wall beside a landscaped pond", "retaining-walls"),
    "masonry-worker": (35281188, "Azraf Mohammod Nakib", "Masonry worker building an outdoor wall", "retaining-walls"),
    "stone-blocks": (18648300, "Boris Hamer", "Stacked stone blocks at an outdoor work site", "retaining-walls"),
    "fence-installation": (36617431, "Nothing Ahead", "Workers installing a fence post outdoors", "fencing"),
    "wood-fence": (14388496, "Rev. Lisa J Winston", "Wood fence in an outdoor landscape", "fencing"),
    "fence-repair": (8447789, "Los Muertos Crew", "Carpenter repairing a wood fence", "fencing"),
    "pool-maintenance": (30546817, "Chris Wade Ntezicimpa", "Pool maintenance worker cleaning an outdoor pool", "pool-service"),
    "patio-pool": (37885738, "Alexander Mass", "Outdoor patio, pool, and gazebo", "pool-service"),
    "infinity-pool": (2417862, "Roberto Nickson", "Clean outdoor infinity pool at sunset", "pool-service"),
    "painting-exterior": (34264478, "Soc Nang Dong", "Workers painting a building exterior", "painting"),
    "painting-interior": (5493668, "AI25.Studio Studio", "Construction worker painting a building interior", "painting"),
    "painting-highrise": (35570308, "Soc Nang Dong", "Professional painter working on a building exterior", "painting"),
    "backyard-residential": (8288955, "Allyson SALNESS", "Landscaped residential backyard and patio", "backyard-construction"),
    "backyard-patio": (17240696, "hi room", "Residential backyard patio and lawn", "backyard-construction"),
    "backyard-garden": (29886661, "Pew Nguyen", "Garden patio with outdoor seating", "backyard-construction"),
}


PRIOR_GENERATED = {
    "generated-drainage-french-drain": ("B01/photo-drainage-project_type-french-drain.png", "French drain installation beside a home", "drainage"),
    "generated-drainage-yard": ("B01/photo-drainage-project_type-yard-drainage.png", "Yard drainage installation", "drainage"),
    "generated-drainage-downspout": ("B01/photo-drainage-project_type-downspout-drainage.png", "Buried downspout drainage", "drainage"),
    "generated-crawlspace-encapsulation": ("B03/photo-crawlspace-project_type-encapsulation.png", "Completed crawlspace encapsulation", "crawlspace"),
    "generated-crawlspace-inspection": ("B03/photo-crawlspace-project_type-inspection.png", "Crawlspace inspection", "crawlspace"),
    "generated-crawlspace-dehumidifier": ("B03/photo-crawlspace-project_type-dehumidifier.png", "Crawlspace dehumidifier installation", "crawlspace"),
    "generated-wall-new": ("B02/photo-retaining-walls-project_type-new-wall.png", "New retaining wall", "retaining-walls"),
    "generated-wall-stone": ("B02/photo-retaining-walls-wall_material-natural-stone.png", "Natural stone retaining wall", "retaining-walls"),
    "generated-wall-repair": ("B02/photo-retaining-walls-project_type-repair-a-wall.png", "Retaining wall repair", "retaining-walls"),
    "generated-fence-new": ("B04/photo-fencing-project_type-new-fence.png", "New residential fence", "fencing"),
    "generated-fence-wood": ("B04/photo-fencing-fence_material-wood.png", "Wood privacy fence", "fencing"),
    "generated-fence-gate": ("B04/photo-fencing-project_type-gate-installation-or-repair.png", "Fence gate installation", "fencing"),
    "generated-pool-cleaning": ("B06/photo-pool-service-project_type-routine-cleaning.png", "Routine residential pool cleaning", "pool-service"),
    "generated-pool-equipment": ("B06/photo-pool-service-project_type-equipment-repair.png", "Pool equipment service", "pool-service"),
    "generated-pool-inspection": ("B06/photo-pool-service-project_type-pool-inspection.png", "Residential pool inspection", "pool-service"),
    "generated-painting-interior": ("B08/photo-painting-project_type-interior.png", "Interior painting", "painting"),
    "generated-painting-exterior": ("B08/photo-painting-project_type-exterior.png", "Exterior painting", "painting"),
    "generated-painting-commercial": ("B08/photo-painting-project_type-commercial.png", "Commercial painting", "painting"),
    "generated-backyard-design": ("B05/photo-landscaping-lawn-project_type-landscape-design.png", "Residential backyard design", "backyard-construction"),
    "generated-backyard-hardscape": ("B05/photo-landscaping-lawn-project_type-hardscaping.png", "Backyard hardscaping", "backyard-construction"),
    "generated-backyard-patio": ("B05/photo-concrete-pavers-project_type-patio.png", "Backyard patio", "backyard-construction"),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def transparent_crop(
    source: Image.Image,
    box: tuple[int, int, int, int],
    drop_label: bool = True,
    trim_right_divider: bool = False,
) -> Image.Image:
    board = np.asarray(source.convert("RGB"), dtype=np.int16)
    left, top, right, bottom = box
    crop = board[top:bottom, left:right]
    corner = min(16, crop.shape[0] // 4, crop.shape[1] // 4)
    corners = np.concatenate(
        [
            crop[:corner, :corner].reshape(-1, 3),
            crop[:corner, -corner:].reshape(-1, 3),
            crop[-corner:, :corner].reshape(-1, 3),
            crop[-corner:, -corner:].reshape(-1, 3),
        ],
        axis=0,
    )
    background = np.median(corners, axis=0)
    distance = np.sqrt(np.sum((crop - background) ** 2, axis=2))
    mask = distance > 20
    if trim_right_divider:
        raw_column_counts = mask.sum(axis=0)
        dividers = np.flatnonzero(
            (raw_column_counts > crop.shape[0] * 0.80)
            & (np.arange(crop.shape[1]) > crop.shape[1] * 0.72)
        )
        if dividers.size:
            mask[:, int(dividers[0]):] = False
    mask[np.flatnonzero(mask.sum(axis=1) > crop.shape[1] * 0.88), :] = False
    mask[:, np.flatnonzero(mask.sum(axis=0) > crop.shape[0] * 0.88)] = False

    if drop_label:
        row_counts = mask.sum(axis=1)
        window = 12
        rolling = np.convolve(row_counts, np.ones(window, dtype=int), mode="same")
        candidates = np.flatnonzero(rolling > 1100)
        if candidates.size:
            first = max(0, int(candidates[0]) - 8)
            mask[:first] = False

    ys, xs = np.nonzero(mask)
    if not xs.size:
        raise ValueError(f"No artwork found in crop {box}")
    x0, x1 = max(0, int(xs.min()) - 12), min(crop.shape[1], int(xs.max()) + 13)
    y0, y1 = max(0, int(ys.min()) - 12), min(crop.shape[0], int(ys.max()) + 13)
    crop = crop[y0:y1, x0:x1].astype(np.uint8)
    distance = distance[y0:y1, x0:x1]
    cropped_mask = mask[y0:y1, x0:x1]
    alpha = np.clip((distance - 18) * (255 / 28), 0, 255).astype(np.uint8)
    alpha[~cropped_mask] = 0
    rgba = np.dstack([crop, alpha])
    return Image.fromarray(rgba, "RGBA")


def save_brand_assets(site: dict) -> dict:
    board_file = BOARD_ROOT / site["brandSystem"]["boardFile"]
    if not board_file.is_file():
        raise FileNotFoundError(board_file)
    destination = BRAND_ROOT / site["siteKey"]
    destination.mkdir(parents=True, exist_ok=True)
    with Image.open(board_file) as board:
        if site["siteKey"] == "charlotte-crawl-space":
            crops = {
                "brandmark-source": ((25, 45, 710, 500), False),
                "brand-icon": ((715, 55, 970, 250), False),
                "wordmark": ((950, 55, 1370, 250), False),
                "favicon": ((1370, 55, 1585, 250), False),
            }
        elif site["siteKey"] == "austin-drain-guys":
            crops = {
                "brandmark-source": ((35, 45, 790, 325), True),
                "brand-icon": ((820, 55, 1060, 330), False),
                "wordmark": ((1055, 55, 1380, 330), False),
                "favicon": ((1370, 55, 1585, 330), False),
            }
        elif site["siteKey"] == "louisville-precision-walls":
            crops = {
                "brandmark-source": ((40, 40, 690, 490), False),
                "brand-icon": ((750, 45, 930, 235), False),
                "wordmark": ((950, 55, 1370, 230), False),
                "favicon": ((1390, 45, 1555, 230), False),
            }
        elif site["siteKey"] == "nashville-backyards":
            crops = {
                "brandmark-source": ((45, 70, 820, 330), True),
                "brand-icon": ((830, 65, 1040, 320), True),
                "wordmark": ((1055, 65, 1370, 310), True),
                "favicon": ((1380, 65, 1560, 300), True),
            }
        elif site["siteKey"] == "ws-crawl-space":
            crops = {
                "brandmark-source": ((35, 45, 775, 330), True),
                "brand-icon": ((820, 55, 1060, 330), False),
                "wordmark": ((1055, 55, 1380, 330), False),
                "favicon": ((1370, 55, 1585, 330), False),
            }
        elif site["siteKey"] == "morgantown-fence-pros":
            crops = {
                "brandmark-source": ((25, 185, 845, 455), False),
                "brand-icon": ((875, 65, 1080, 230), False),
                "wordmark": ((1110, 65, 1580, 230), False),
                "favicon": ((885, 345, 1065, 505), False),
            }
        elif site["siteKey"] == "naples-pool-pros":
            crops = {
                "brandmark-source": ((35, 105, 570, 390), False),
                "brand-icon": ((590, 55, 820, 225), False),
                "wordmark": ((580, 245, 835, 380), False),
                "favicon": ((640, 390, 780, 510), False),
            }
        elif site["siteKey"] == "pittsburgh-french-drain":
            crops = {
                "brandmark-source": ((540, 75, 940, 225), False),
                "brand-icon": ((960, 70, 1120, 225), False),
                "wordmark": ((1130, 70, 1400, 225), False),
                "favicon": ((1410, 70, 1570, 225), False),
            }
        elif site["siteKey"] == "salt-lake-city-precision-walls":
            crops = {
                "brandmark-source": ((45, 55, 755, 305), False),
                "brand-icon": ((790, 55, 985, 300), False),
                "wordmark": ((995, 55, 1365, 300), False),
                "favicon": ((1375, 55, 1575, 300), False),
            }
        elif board.size == (1536, 1024) and site["siteKey"] == "tulsa-drain-pros":
            crops = {
                "brandmark-source": ((35, 20, 625, 535), False),
                "brand-icon": ((650, 25, 900, 250), True),
                "wordmark": ((900, 55, 1300, 235), False),
                "favicon": ((1300, 25, 1520, 250), True),
            }
        elif board.size == (1600, 900):
            crops = {
                "brandmark-source": ((35, 45, 825, 320), True),
                "brand-icon": ((715, 55, 985, 270), False),
                "wordmark": ((1020, 55, 1380, 270), False),
                "favicon": ((1370, 55, 1585, 330), False),
            }
        else:
            raise ValueError(f"Unexpected board size for {board_file.name}: {board.size}")
        output = {}
        for name, (box, drop_label) in crops.items():
            image = transparent_crop(board, box, drop_label=drop_label, trim_right_divider=name == "brandmark-source")
            path = destination / f"{name}.png"
            image.save(path, optimize=True)
            output[name] = {"path": path.relative_to(ROOT).as_posix(), "width": image.width, "height": image.height}

    brandmark_path = destination / "brandmark.png"
    shutil.copy2(destination / "brandmark-source.png", brandmark_path)
    with Image.open(brandmark_path) as brandmark:
        output["brandmark"] = {"path": brandmark_path.relative_to(ROOT).as_posix(), "width": brandmark.width, "height": brandmark.height}

    header_image_path = brandmark_path
    if site["siteKey"] in {"charlotte-crawl-space", "louisville-precision-walls", "tulsa-drain-pros"}:
        with Image.open(destination / "brand-icon.png") as source_icon, Image.open(destination / "wordmark.png") as source_wordmark:
            icon = source_icon.convert("RGBA")
            wordmark = source_wordmark.convert("RGBA")
            maximum_height = 150
            if icon.height > maximum_height:
                icon = icon.resize((round(icon.width * maximum_height / icon.height), maximum_height), Image.Resampling.LANCZOS)
            if wordmark.height > maximum_height:
                wordmark = wordmark.resize((round(wordmark.width * maximum_height / wordmark.height), maximum_height), Image.Resampling.LANCZOS)
            padding, gap = 10, 18
            lockup = Image.new("RGBA", (padding * 2 + icon.width + gap + wordmark.width, padding * 2 + max(icon.height, wordmark.height)), (255, 255, 255, 0))
            lockup.alpha_composite(icon, (padding, (lockup.height - icon.height) // 2))
            lockup.alpha_composite(wordmark, (padding + icon.width + gap, (lockup.height - wordmark.height) // 2))
            header_image_path = destination / "header-lockup.png"
            lockup.save(header_image_path, optimize=True)
            output["header-lockup"] = {"path": header_image_path.relative_to(ROOT).as_posix(), "width": lockup.width, "height": lockup.height}

    png_bytes = header_image_path.read_bytes()
    with Image.open(header_image_path) as mark:
        width, height = mark.size
    encoded = base64.b64encode(png_bytes).decode("ascii")
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" '
        f'aria-labelledby="title"><title id="title">{site["brand"]}</title>'
        f'<image width="{width}" height="{height}" href="data:image/png;base64,{encoded}"/></svg>'
    )
    (destination / "brandmark.svg").write_text(svg, encoding="utf-8")
    output["brandmark-svg"] = {"path": (destination / "brandmark.svg").relative_to(ROOT).as_posix(), "width": width, "height": height}
    return {
        "siteKey": site["siteKey"],
        "brand": site["brand"],
        "sourceBoard": board_file.name,
        "sourceSha256": sha256(board_file),
        "sourceDimensions": list(board.size),
        "method": "Deterministic crop from the approved brand board; near-white board background made transparent; artwork not redrawn.",
        "assets": output,
    }


def cover_webp(source: Image.Image, destination: Path, size: tuple[int, int] = (1600, 1000)) -> None:
    image = source.convert("RGB")
    target_ratio = size[0] / size[1]
    ratio = image.width / image.height
    if ratio > target_ratio:
        new_width = int(image.height * target_ratio)
        left = (image.width - new_width) // 2
        image = image.crop((left, 0, left + new_width, image.height))
    else:
        new_height = int(image.width / target_ratio)
        top = (image.height - new_height) // 2
        image = image.crop((0, top, image.width, top + new_height))
    image = image.resize(size, Image.Resampling.LANCZOS)
    image.save(destination, "WEBP", quality=84, method=6)


def prepare_stock() -> list[dict]:
    STOCK_ROOT.mkdir(parents=True, exist_ok=True)
    records = []
    for slug, (photo_id, creator, description, trade) in STOCK.items():
        page = f"https://www.pexels.com/photo/{photo_id}/"
        direct = f"https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w=2000"
        destination = STOCK_ROOT / f"{slug}.webp"
        if not destination.is_file():
            request = urllib.request.Request(direct, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read()
            with Image.open(io.BytesIO(payload)) as image:
                cover_webp(image, destination)
        records.append(
            {
                "id": slug,
                "file": destination.relative_to(ROOT).as_posix(),
                "trade": trade,
                "description": description,
                "provider": "Pexels",
                "creator": creator,
                "sourcePage": page,
                "directAsset": direct,
                "license": "Pexels license",
                "licenseUrl": "https://www.pexels.com/license/",
                "retrieved": TODAY,
                "usage": "Representative staging imagery only; not presented as completed work by an LLG operator.",
                "sha256": sha256(destination),
            }
        )

    if PRIOR_DRAINAGE.is_file():
        destination = STOCK_ROOT / "prior-generated-drainage.webp"
        shutil.copy2(PRIOR_DRAINAGE, destination)
        records.append(
            {
                "id": "prior-generated-drainage",
                "file": destination.relative_to(ROOT).as_posix(),
                "trade": "drainage",
                "description": "French drain installation scene generated during prior LLG site work",
                "provider": "Prior LLG workspace output",
                "creator": "LLG / OpenAI image workflow",
                "sourcePage": None,
                "license": "User-owned generated project asset",
                "retrieved": TODAY,
                "usage": "Representative staging imagery only; not presented as a documented customer project.",
                "sha256": sha256(destination),
            }
        )
    for slug, (relative, description, trade) in PRIOR_GENERATED.items():
        source = PRIOR_GENERATED_ROOT / relative
        if not source.is_file():
            continue
        destination = STOCK_ROOT / f"{slug}.webp"
        with Image.open(source) as image:
            cover_webp(image, destination)
        records.append(
            {
                "id": slug,
                "file": destination.relative_to(ROOT).as_posix(),
                "trade": trade,
                "description": description,
                "provider": "Prior LLG workspace output",
                "creator": "LLG / OpenAI image workflow",
                "sourcePage": None,
                "license": "User-owned generated project asset",
                "retrieved": TODAY,
                "usage": "Representative service imagery.",
                "sha256": sha256(destination),
            }
        )
    return records


def main() -> None:
    data_path = ROOT / "data" / "sites.json"
    data = json.loads(data_path.read_text(encoding="utf-8"))
    brand_records = []
    for site in data["sites"]:
        brand_records.append(save_brand_assets(site))
        site["brandSystem"]["logoSlots"] = {
            "primary": f"assets/brand/{site['siteKey']}/brandmark.svg",
            "raster": f"assets/brand/{site['siteKey']}/brandmark.png",
            "icon": f"assets/brand/{site['siteKey']}/brand-icon.png",
            "favicon": f"assets/brand/{site['siteKey']}/favicon.png",
        }
        site["brandSystem"]["status"] = "approved-board-assets-extracted"
    data_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    stock_records = prepare_stock()
    REFERENCE_ROOT.mkdir(parents=True, exist_ok=True)
    (REFERENCE_ROOT / "brand-assets.json").write_text(json.dumps({"generated": TODAY, "items": brand_records}, indent=2) + "\n", encoding="utf-8")
    (REFERENCE_ROOT / "stock-assets.json").write_text(json.dumps({"generated": TODAY, "items": stock_records}, indent=2) + "\n", encoding="utf-8")
    print(f"prepared {len(brand_records)} approved brand systems and {len(stock_records)} representative media assets")


if __name__ == "__main__":
    main()
