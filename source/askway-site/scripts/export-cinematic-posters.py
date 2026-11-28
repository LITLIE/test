"""Reproducible mobile composition of existing attributed photography; no CG input.

Run from the site with Python -B. All output and process caches stay in this site.
"""
from pathlib import Path
import hashlib
import json
import os

ROOT = Path(__file__).resolve().parents[1]
for name, value in {
    "TEMP": ROOT / ".agent_tmp", "TMP": ROOT / ".agent_tmp", "TMPDIR": ROOT / ".agent_tmp",
    "APPDATA": ROOT / ".agent_tmp/appdata", "LOCALAPPDATA": ROOT / ".agent_tmp/localappdata",
    "XDG_CACHE_HOME": ROOT / ".agent_cache", "XDG_CONFIG_HOME": ROOT / ".agent_cache/config",
}.items():
    os.environ[name] = str(value)

from PIL import Image

OUTPUT = ROOT / "public/assets/cinematic"
OUTPUT.resolve().relative_to(ROOT)
OUTPUT.mkdir(parents=True, exist_ok=True)
source = Image.open(ROOT / "public/assets/hero.webp").convert("RGB")
# Keep both shells in the upper half and reserve the lower sea for HTML copy.
# The navy extension is a presentation backdrop, not invented photographic detail.
crop_box = (600, 0, 1550, 900)
crop = source.crop(crop_box).resize((720, 682), Image.Resampling.LANCZOS)
poster = Image.new("RGB", (720, 1280), (6, 35, 50))
poster.paste(crop, (0, 36))
# Extend only the sky edge above the real crop, then fade the real water to navy.
poster.paste(crop.crop((0, 0, 720, 1)).resize((720, 36)), (0, 0))
pixels = poster.load()
for y in range(560, 719):
    t = max(0, min(1, (y - 560) / 158))
    alpha = t * t * (3 - 2 * t)
    for x in range(720):
        pixel = pixels[x, y]
        pixels[x, y] = tuple(round(pixel[c] * (1 - alpha) + (6, 35, 50)[c] * alpha) for c in range(3))
poster.save(OUTPUT / "hero-mobile.webp", "WEBP", quality=91, method=6)

credits = json.loads((ROOT / "public/asset-credits.json").read_text(encoding="utf-8"))
assets = []
for name in ("hero.webp", "theatre.webp", "architecture.webp", "cinematic/hero-mobile.webp"):
    path = ROOT / "public/assets" / name
    original = "assets/hero.webp" if name.startswith("cinematic/") else "assets/" + name
    credit = next(item for item in credits["images"] if item["file"] == original)
    with Image.open(path) as image:
        width, height = image.size
    assets.append({
        "file": "assets/" + name, "kind": "photography", "width": width, "height": height,
        "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "author": credit["author"], "license": credit["license"], "source": credit["source"],
        "changes": "Dedicated crop [600,0,1550,900], 720x682 photograph, navy presentation extension and water fade on 720x1280 canvas" if name.startswith("cinematic/") else credit["changes"],
    })
manifest = {
    "id": "askway-city-story-photographic-prototype", "version": "1.1.0",
    "scope": "Photographic planes with a continuous CSS 3D camera pose and XYZ perspective particles; not a surveyed 3D city or rendered camera sequence.",
    "editableMaster": "scripts/export-cinematic-posters.py",
    "assets": assets,
    "chapters": [
        {"id": "city", "progress": [0, 0.24], "desktop": "assets/hero.webp", "mobile": "assets/cinematic/hero-mobile.webp", "kind": "photography"},
        {"id": "route", "progress": [0.24, 0.56], "source": "src/components/RouteDiagram.tsx", "kind": "diagram", "places": ["海滨公园", "香炉湾", "日月贝"]},
        {"id": "theatre", "progress": [0.56, 0.9], "desktop": "assets/theatre.webp", "detail": "assets/architecture.webp", "kind": "photography"},
        {"id": "product", "progress": [0.9, 1], "source": "src/features/experience/ui/JourneyPreview.tsx", "kind": "curated-readonly-preview"},
    ],
    "safeAreas": {"desktopTitle": [0.06, 0.25, 0.43, 0.6], "mobileLandmark": [0.06, 0.16, 0.94, 0.48], "mobileTitle": [0.06, 0.59, 0.94, 0.84]},
    "derivativeLicense": "CC BY-SA 4.0; original authors and source URLs retained per asset.",
}
(OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"output": str(OUTPUT), "newBytes": (OUTPUT / "hero-mobile.webp").stat().st_size, "assets": assets}, ensure_ascii=False))
