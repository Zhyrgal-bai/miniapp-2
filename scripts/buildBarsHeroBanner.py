"""Build a sharp landscape BARS hero background (photo only, no baked text)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    r"C:\Users\zhyrg\.cursor\projects\c-Projects-miniapp\assets"
    r"\c__Users_zhyrg_AppData_Roaming_Cursor_User_workspaceStorage_32d2d5065dd90db95131fc470ed6db79"
    r"_images_image-34252b3a-a91a-47e1-b8fa-2089af4b777c.png"
)
OUT_ASSET = ROOT / "frontend" / "src" / "assets" / "bars-hero-banner.png"
OUT_PUBLIC = ROOT / "frontend" / "public" / "bars-hero-banner.png"
TARGET_SIZE = (1920, 840)


def _fix_top_right_icon(img: Image.Image) -> Image.Image:
    w, h = img.size
    out = img.copy()
    ref = img.crop((int(w * 0.72), int(h * 0.32), w, int(h * 0.48)))
    patch = ref.resize((w - int(w * 0.80), int(h * 0.14)), Image.Resampling.LANCZOS)
    mask = Image.new("L", patch.size, 255).filter(ImageFilter.GaussianBlur(radius=2))
    out.paste(patch, (int(w * 0.80), 0), mask)
    return out


def build() -> None:
    src = Image.open(SRC).convert("RGB")
    sw, sh = src.size

    upscale_h = 3200
    scale = upscale_h / sh
    up = src.resize((int(sw * scale), upscale_h), Image.Resampling.LANCZOS)
    up = _fix_top_right_icon(up)

    uw, uh = up.size
    # Model is on the left; drop the baked typography on the right.
    crop = up.crop((0, 0, int(uw * 0.74), uh))

    banner = crop.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
    banner = banner.filter(ImageFilter.UnsharpMask(radius=1.0, percent=130, threshold=2))
    banner = ImageEnhance.Contrast(banner).enhance(1.04)
    banner = ImageEnhance.Sharpness(banner).enhance(1.08)

    OUT_ASSET.parent.mkdir(parents=True, exist_ok=True)
    banner.save(OUT_ASSET, format="PNG", optimize=True)
    banner.save(OUT_PUBLIC, format="PNG", optimize=True)


if __name__ == "__main__":
    build()
