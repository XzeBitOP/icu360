#!/usr/bin/env python3
"""Generate trimmed logos, favicons and PWA icons from assets/brand/*.png.

Run once after changing a logo:  python3 scripts/make-icons.py   (needs Pillow)
Outputs go to public/brand and public/icons (committed).
"""
from PIL import Image, ImageOps
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "brand")
PUB = os.path.join(ROOT, "public")
os.makedirs(os.path.join(PUB, "brand"), exist_ok=True)
os.makedirs(os.path.join(PUB, "icons"), exist_ok=True)
DARK_BG = (10, 17, 28, 255)  # #0A111C


def trim(img, thresh=60, pad=0.02):
    a = img.getchannel("A").point(lambda v: 255 if v > thresh else 0)
    box = a.getbbox()
    img = img.crop(box)
    w, h = img.size
    s = max(w, h)
    p = int(s * pad)
    out = Image.new("RGBA", (s + 2 * p, s + 2 * p), (0, 0, 0, 0))
    out.paste(img, ((s - w) // 2 + p, (s - h) // 2 + p), img)
    return out


def square_on(img, size, bg, scale):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = int(size * scale)
    lg = img.resize((inner, inner), Image.LANCZOS)
    canvas.paste(lg, ((size - inner) // 2, (size - inner) // 2), lg)
    return canvas


logos = {}
for name in ("light", "dark"):
    im = trim(Image.open(os.path.join(SRC, f"logo-{name}.png")).convert("RGBA"))
    logos[name] = im
    for s in (96, 256, 512):
        im.resize((s, s), Image.LANCZOS).save(os.path.join(PUB, "brand", f"logo-{name}-{s}.png"), optimize=True)
    for s in (32, 48):
        im.resize((s, s), Image.LANCZOS).save(os.path.join(PUB, "icons", f"favicon-{name}-{s}.png"), optimize=True)

dark = logos["dark"]
# Home-screen icons: dark logo (one icon only; OS does not switch it with theme)
for s in (192, 512):
    dark.resize((s, s), Image.LANCZOS).save(os.path.join(PUB, "icons", f"icon-{s}.png"), optimize=True)
square_on(dark, 512, DARK_BG, 0.78).save(os.path.join(PUB, "icons", "maskable-512.png"), optimize=True)
square_on(dark, 192, DARK_BG, 0.78).save(os.path.join(PUB, "icons", "maskable-192.png"), optimize=True)
square_on(dark, 180, DARK_BG, 0.96).convert("RGB").save(os.path.join(PUB, "apple-touch-icon.png"), optimize=True)
dark.resize((48, 48), Image.LANCZOS).save(os.path.join(PUB, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

# Co-brand marks (small, shown greyscale in the footer)
for src, out in (("xzecure-source.png", "xzecure.png"), ("obecure-source.png", "obecure.png")):
    im = trim(Image.open(os.path.join(SRC, src)).convert("RGBA"), thresh=20, pad=0.04)
    im.resize((96, 96), Image.LANCZOS).save(os.path.join(PUB, "brand", out), optimize=True)
print("icons written")
