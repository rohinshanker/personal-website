"""Regenerates the loader wallpaper by widening the archived original.

A 2304x1024 canvas lets `cover` fit screens up to 2.25:1 by height, so the
rays at the top and the mountains at the bottom both stay in frame. The sky
keeps its original pixels (rays included) and continues to the right by
mirror-tiling the flat strip at its right edge; the mountain band is stretched
horizontally with nearest-neighbour by exactly 1.5, so its 6 px blocks become
9 px and nothing is blended, repeated or redrawn.

    python3 -m venv /tmp/loader-wallpaper-venv
    /tmp/loader-wallpaper-venv/bin/pip install pillow
    /tmp/loader-wallpaper-venv/bin/python docs/assets-src/widen-mountain-and-sky.py
    /tmp/loader-wallpaper-venv/bin/python docs/assets-src/widen-mountain-and-sky.py --check
"""

import argparse
import pathlib
import sys

from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs" / "assets-src" / "mountain-and-sky.png"
OUTPUT = ROOT / "assets" / "mountain-and-sky.png"

# First source row with ridge texture; everything above is sky and horizon glow.
RIDGE_TOP = 819
# Sky columns from here to the right edge are flat (no rays), so they tile cleanly.
FLAT_SKY_LEFT = 1200
# 1.5x the 1536 px source width, so every 6 px block becomes exactly 9 px.
WIDTH = 2304


def flat_sky_column(offset, source_width):
  """Returns the source column for extension column `offset` (mirror tiling)."""
  span = source_width - FLAT_SKY_LEFT
  step = offset % (2 * span)
  return source_width - 1 - step if step < span else FLAT_SKY_LEFT + step - span


def widen(source, new_width):
  """Returns the wallpaper widened to new_width with sky extended, band stretched."""
  width, height = source.size
  out = Image.new("RGB", (new_width, height))
  out.paste(source.crop((0, 0, width, RIDGE_TOP)), (0, 0))
  for offset in range(new_width - width):
    x = flat_sky_column(offset, width)
    out.paste(source.crop((x, 0, x + 1, RIDGE_TOP)), (width + offset, 0))
  band = source.crop((0, RIDGE_TOP, width, height))
  out.paste(band.resize((new_width, band.height), Image.NEAREST), (0, RIDGE_TOP))
  return out


def matches(path, image):
  """Returns whether the PNG at path has exactly the pixels of image."""
  if not path.exists():
    return False
  committed = Image.open(path).convert("RGB")
  if committed.size != image.size:
    return False
  return ImageChops.difference(committed, image).getbbox() is None


def main(argv):
  parser = argparse.ArgumentParser(description="Regenerate assets/mountain-and-sky.png.")
  parser.add_argument(
      "--check", action="store_true", help="fail if the deployed wallpaper differs from a rebuild"
  )
  args = parser.parse_args(argv)
  image = widen(Image.open(SOURCE).convert("RGB"), WIDTH)
  if args.check:
    if not matches(OUTPUT, image):
      print(f"{OUTPUT.relative_to(ROOT)} differs from a rebuild.", file=sys.stderr)
      return 1
    print(f"{OUTPUT.relative_to(ROOT)} matches a fresh build.")
    return 0
  image.save(OUTPUT, optimize=True)
  print(f"{OUTPUT.relative_to(ROOT)} {image.width}x{image.height}")
  return 0


if __name__ == "__main__":
  sys.exit(main(sys.argv[1:]))
