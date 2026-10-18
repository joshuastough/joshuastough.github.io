"""Render a picture as ASCII art and write it into a page.

Usage: python3 -I tools/ascii_art.py IMAGE PAGE [--cols 64] [--crop X0,Y0,X1,Y1]

Darker pixels get denser characters, so the art reads as a positive on a light
page and glows on a dark one. Orange and green cells are wrapped in
<span class="o"> / <span class="g"> so the page can color them. The result
replaces whatever sits between <!-- ascii-art --> and <!-- /ascii-art --> in PAGE.
"""
import argparse
import colorsys
import html
import re

from PIL import Image

RAMP = " .,:;-=+*#%@"
CELL_ASPECT = 1.1 / 0.6  # line-height / advance width of a monospace cell


def cell_class(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h *= 360
    if 8 <= h <= 45 and s > 0.45 and v > 0.25:
        return "o"
    if 60 <= h <= 160 and s > 0.30 and v > 0.25:
        return "g"
    return ""


def render(path, cols, crop):
    im = Image.open(path).convert("RGB")
    if crop:
        im = im.crop(crop)
    rows = round(cols * im.height / im.width / CELL_ASPECT)
    small = im.resize((cols, rows), Image.BOX)
    gray = small.convert("L")

    # Black point at the darkest 2%; white point at the median, so the gray
    # panel (most of the picture) drops out to blank space.
    lum = sorted(gray.getdata())
    lo, hi = lum[int(0.02 * len(lum))], lum[int(0.5 * len(lum))]

    lines = []
    for y in range(rows):
        runs = []  # [class, text]
        for x in range(cols):
            d = 1 - (gray.getpixel((x, y)) - lo) / max(1, hi - lo)
            d = min(1.0, max(0.0, d)) ** 1.5
            ch = RAMP[min(len(RAMP) - 1, int(d * len(RAMP)))]
            cls = cell_class(*small.getpixel((x, y))) if ch != " " else ""
            if runs and runs[-1][0] == cls:
                runs[-1][1] += ch
            else:
                runs.append([cls, ch])
        line = "".join(
            f'<span class="{c}">{html.escape(t)}</span>' if c else html.escape(t)
            for c, t in runs
        )
        lines.append(line.rstrip())
    return "\n".join(lines).strip("\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("page")
    ap.add_argument("--cols", type=int, default=64)
    ap.add_argument("--crop", type=lambda s: tuple(int(v) for v in s.split(",")))
    args = ap.parse_args()

    art = render(args.image, args.cols, args.crop)
    with open(args.page, encoding="utf-8") as f:
        page = f.read()
    pattern = re.compile(r"(<!-- ascii-art -->).*?(<!-- /ascii-art -->)", re.S)
    if not pattern.search(page):
        raise SystemExit(f"no <!-- ascii-art --> markers in {args.page}")
    page = pattern.sub(lambda m: m.group(1) + art + m.group(2), page)
    with open(args.page, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"wrote {args.cols}-column art into {args.page}")


if __name__ == "__main__":
    main()
