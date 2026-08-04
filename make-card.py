#!/usr/bin/env python3
"""Draws card.png — the link preview — at exactly 1200x630.

    python3 make-card.py

The card is favicon.svg's composition at card scale: the gold bar full
bleed, the wordmark above it, the tagline below. Living above the bar and
gone below is the site's whole idea, so the preview is the idea rather
than the logo.

WHY A SCRIPT AND NOT A DRAWING

The one image this repository ships is favicon.svg, and its comment says
the two PNGs beside it are regenerated with qlmanage rather than edited.
Same principle. The gold stops here are favicon.svg's, which are .bar's in
style.css; nothing imports anything, so all three stay in step by hand.

DELIBERATELY NO COUNT. An earlier version read "97,395 PICTURES HAVE
WRAPPED" and filled the space better. A number baked into a committed PNG
goes stale the next time the corpus moves, and nothing would catch it —
the card is not audited, not tested, and not looked at again once it
works. A wrong figure on the first thing anybody sees is the one failure
this project does not tolerate. The count belongs on the page, where it is
read from the corpus.

Needs Pillow and macOS system fonts. Run it when the wordmark, the palette
or the tagline changes; commit the PNG.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
INK = (22, 19, 14)          # #16130e — favicon's field, --paper dark
PAPER = (236, 231, 219)     # #ece7db
QUIET = (169, 155, 128)

# .bar in style.css, and the `gold` gradient in favicon.svg.
GOLD = [(0.00, (0x7a, 0x5e, 0x14)),
        (0.22, (0xc9, 0xa2, 0x27)),
        (0.50, (0xf0, 0xd6, 0x7a)),
        (0.78, (0xc9, 0xa2, 0x27)),
        (1.00, (0x7a, 0x5e, 0x14))]

DISPLAY = "/System/Library/Fonts/Supplemental/Iowan Old Style.ttc"
UI = "/System/Library/Fonts/Helvetica.ttc"

TITLE = "Picture Wrap"
TAGLINE = "THE PICTURE"


def gold_at(t):
    for i in range(len(GOLD) - 1):
        a, b = GOLD[i], GOLD[i + 1]
        if a[0] <= t <= b[0]:
            f = 0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
            return tuple(round(a[1][j] + (b[1][j] - a[1][j]) * f) for j in range(3))
    return GOLD[-1][1]


def tracked(draw, text, font, cx, y, fill, tracking):
    """Letter-spacing, which PIL has no notion of — the tagline is set in
       caps at 0.13em on the site and looks wrong at zero."""
    widths = [draw.textlength(c, font=font) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for c, w in zip(text, widths):
        draw.text((x, y), c, font=font, fill=fill)
        x += w + tracking


def main(out="card.png"):
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    display = ImageFont.truetype(DISPLAY, 112)
    ui = ImageFont.truetype(UI, 23)

    # Centred on the ink, not on the boxes: Iowan's line box carries more
    # space below the baseline than above, so centring the box leaves the
    # bar visibly high.
    tb = d.textbbox((0, 0), TITLE, font=display)
    th = tb[3] - tb[1]
    tag_h = ui.getbbox("E")[3] - ui.getbbox("E")[1]

    BAR_H, GAP_ABOVE, GAP_BELOW = 26, 62, 60
    y = (H - (th + GAP_ABOVE + BAR_H + GAP_BELOW + tag_h)) / 2

    tw = d.textlength(TITLE, font=display)
    d.text(((W - tw) / 2, y - tb[1]), TITLE, font=display, fill=PAPER)
    y += th + GAP_ABOVE

    for px in range(W):                      # full bleed: it is a boundary
        d.line([(px, y), (px, y + BAR_H)], fill=gold_at(px / (W - 1)))
    y += BAR_H + GAP_BELOW

    tracked(d, TAGLINE, ui, W / 2, y - ui.getbbox("E")[1], QUIET, 7)

    img.save(out, optimize=True)
    print(f"{out} {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
