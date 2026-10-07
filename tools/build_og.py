"""Build the Open Graph card the site is shared with.

A link to this project gets posted. Without an og:image it renders as a bare URL
and a line of grey text, which is a poor showing for a project whose argument is
that how you present a number is part of the work.

The card is generated rather than drawn once by hand for the same reason every
other figure on the site is generated: the numbers on it come from
gold_report.json and dq_report.json, so re-running the pipeline with a different
seed moves the card with everything else. A hand-made PNG would be the one
artefact that could quietly go stale, and it is the one most people see first.

The artwork underneath is `tools/assets/og_background.webp`, generated with
Higgsfield (FLUX.2). It is abstract on purpose: a field of dots with one cluster
picked out, which is what the project does. Photographs of clinicians or patients
would sit badly against a site whose every page carries a synthetic-data notice.

    python tools/build_og.py
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "tools" / "assets" / "og_background.webp"
OUT = ROOT / "web" / "public" / "og.png"
HERO = ROOT / "web" / "public" / "img" / "hero.webp"

W, H = 1200, 630                      # the size every crawler expects
PAPER = (252, 250, 246)
INK, MUTE, FAINT = (23, 32, 44), (104, 116, 132), (150, 160, 172)
BLUE, ORANGE = (42, 120, 214), (235, 104, 52)

FONT = "/System/Library/Fonts/Helvetica.ttc"


def font(size, bold=True):
    return ImageFont.truetype(FONT, size, index=1 if bold else 0)


def scrim(width, height, hold=0.33, fade=0.64):
    """A left-to-right wash that is opaque under the type and gone before the art.

    A plain linear ramp across the full width was not enough: it left dots
    showing through the stat labels and never reached opaque at the left edge,
    so the card had a grey stripe down its side.
    """
    mask = Image.new("L", (width, height), 0)
    d = ImageDraw.Draw(mask)
    a, b = int(width * hold), int(width * fade)
    for x in range(width):
        if x <= a:
            alpha = 255
        elif x >= b:
            alpha = 0
        else:
            t = (x - a) / (b - a)
            alpha = int(255 * (1 - (t * t * (3 - 2 * t))))   # smoothstep
        d.line([(x, 0), (x, height)], fill=alpha)
    return mask


def background():
    src = Image.open(ART).convert("RGB")
    sw, sh = src.size
    cw = int(sh * (W / H))
    # Anchored right so the highlighted cluster survives the crop.
    art = src.crop((sw - cw, 0, sw, sh)).resize((W, H), Image.LANCZOS)
    return Image.composite(Image.new("RGB", (W, H), PAPER), art, scrim(W, H))


def build():
    gold = json.loads((ROOT / "data" / "gold_report.json").read_text())
    dq = json.loads((ROOT / "data" / "dq_report.json").read_text())

    card = background()
    d = ImageDraw.Draw(card)
    x = 72

    d.text((x, 92), "CLINICAL CARE GAP EXPLORER", font=font(21), fill=BLUE)

    y = 146
    for line in ["Which diabetic patients", "have not had an A1C", "in twelve months?"]:
        d.text((x, y), line, font=font(50), fill=INK)
        y += 62

    d.text((x, y + 18), "The query is four lines of SQL. Everything else is the",
           font=font(21, False), fill=MUTE)
    d.text((x, y + 48), "data quality work that makes the list trustworthy.",
           font=font(21, False), fill=MUTE)

    stats = [
        (f"{gold['open_gaps']} of {gold['cohort']}", "with an open gap", ORANGE),
        (str(gold["never_tested"]), "never tested at all", ORANGE),
        (f"{sum(dq['quarantine_by_check'].values()):,}", "rows quarantined, with a reason", BLUE),
    ]
    sx, sy = x, H - 132
    for value, label, colour in stats:
        d.text((sx, sy), value, font=font(34), fill=colour)
        d.text((sx, sy + 44), label, font=font(17, False), fill=MUTE)
        sx += 236

    # Never omitted. This is the image that travels furthest from the site, so
    # it is the one that most needs to say the data is not real.
    d.text((x, H - 48), "Synthetic data (Synthea) · no real patient information",
           font=font(16, False), fill=FAINT)

    # Quantised to 256 colours: halves the file with no visible loss, because
    # the card is flat type over a soft gradient rather than a photograph. Kept
    # as PNG rather than JPEG so the type stays free of ringing artefacts, which
    # is the whole reason to render the text here instead of in the artwork.
    OUT.parent.mkdir(parents=True, exist_ok=True)
    card.quantize(colors=256, method=Image.MEDIANCUT,
                  dither=Image.FLOYDSTEINBERG).save(OUT, "PNG", optimize=True)
    print(f"  {OUT.relative_to(ROOT)}  {W}x{H}  {OUT.stat().st_size // 1024} KB")


def build_hero():
    """A wide band of the same artwork, for the top of the Introduction page."""
    src = Image.open(ART).convert("RGB")
    sw, sh = src.size
    band_h = int(sw / 4.2)
    top = (sh - band_h) // 2
    band = src.crop((0, top, sw, top + band_h)).resize((1600, int(1600 / 4.2)), Image.LANCZOS)
    HERO.parent.mkdir(parents=True, exist_ok=True)
    band.save(HERO, "WEBP", quality=82, method=6)
    print(f"  {HERO.relative_to(ROOT)}  {band.size[0]}x{band.size[1]}  "
          f"{HERO.stat().st_size // 1024} KB")


def main():
    if not ART.exists():
        raise SystemExit(
            f"No artwork at {ART}.\n"
            "It is committed with the repo; if it is missing, regenerate it with:\n"
            '  higgsfield generate create flux_2 --aspect_ratio 16:9 --resolution 2k \\\n'
            '    --prompt "<see the module docstring>" --wait'
        )
    print("\nOpen Graph\n----------")
    build()
    build_hero()


if __name__ == "__main__":
    main()
