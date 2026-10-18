"""Convert photos for the image lab into small, metadata-free webp files.

Usage: python3 -I tools/add_picture.py PHOTO [PHOTO ...] [--name NAME] [--max 900] [--out assets/lab]

Each photo is turned upright (EXIF orientation), shrunk to fit within MAX x MAX
pixels, and saved as OUT/NAME.webp with no metadata at all (no GPS, no camera
data). The original is never changed. Prints a pictures.js entry to fill in.
"""
import argparse
import os
import re

from PIL import Image, ImageOps


def slug(path):
    base = os.path.splitext(os.path.basename(path))[0]
    return re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("photos", nargs="+")
    ap.add_argument("--name", help="output name (one photo only), e.g. ricketts-glen")
    ap.add_argument("--max", type=int, default=900)
    ap.add_argument("--out", default="assets/lab")
    ap.add_argument("--quality", type=int, default=82)
    args = ap.parse_args()
    if args.name and len(args.photos) > 1:
        ap.error("--name works with one photo at a time")
    os.makedirs(args.out, exist_ok=True)

    for path in args.photos:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((args.max, args.max), Image.LANCZOS)
            # A fresh image carries no EXIF, XMP or ICC data from the original.
            clean = Image.new("RGB", im.size)
            clean.paste(im)
        out = os.path.join(args.out, (args.name or slug(path)) + ".webp")
        clean.save(out, "WEBP", quality=args.quality, method=6)
        with Image.open(out) as check:
            leftovers = [k for k in ("exif", "xmp", "icc_profile") if check.info.get(k)]
        if leftovers:
            raise SystemExit(f"{out}: metadata left: {leftovers}")
        kb = os.path.getsize(out) / 1024
        print(f"{out}  {clean.width}x{clean.height}  {kb:.0f} KB  (no metadata)")
        print("  {\n"
              f"    src: '{out}', w: {clean.width}, h: {clean.height},\n"
              "    alt: 'TODO',\n"
              "    caption: 'TODO'\n"
              "  },")


if __name__ == "__main__":
    main()
