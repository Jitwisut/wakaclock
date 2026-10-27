"""Generate AtoAxis brand SVGs: vector mark traced from atoaxis-symbol-v2.png + Geist wordmark.

Usage: python3 brand/make_brand.py frontend/app/public/fonts/atoaxis-sans.woff2 brand
       node brand/render.mjs frontend/app/node_modules/sharp brand
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

font_path, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

GREEN = "#146F47"
INK = "#0F1A14"
MINT = "#F3F8F5"

# Traced in the 1254x1254 space of atoaxis-symbol-v2.png.
MARK = (
    "M187 1117Q336 790 458 463L616 320L528 757L801 757L758 830L514 830L463 1117Z"
    "M809 134Q896 625 1062 1117L783 1117L754 874L831 746L741 746L677 257Z"
)
MX0, MY0, MX1, MY1 = 187, 134, 1062, 1117
MW, MH = MX1 - MX0, MY1 - MY0


def mark_g(x, y, h, fill):
    s = h / MH
    return f'<g transform="translate({x:.2f} {y:.2f}) scale({s:.5f}) translate({-MX0} {-MY0})"><path fill="{fill}" d="{MARK}"/></g>'


def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')


def write(name, text):
    (out / name).write_text(text, encoding="utf-8")


# 1. Mark alone, transparent, 10% padding.
pad = 0.1 * MH
side = MH + 2 * pad
write("atoaxis-mark.svg", svg(round(side), round(side),
      mark_g((side - MW) / 2, pad, MH, GREEN), "AtoAxis"))


# 2. App / store icons (1024 grid, rounded square).
def icon(bg, fg):
    S, r, mh = 1024, 224, 600
    mw = MW * mh / MH
    return svg(S, S, f'<rect width="{S}" height="{S}" rx="{r}" fill="{bg}"/>'
               + mark_g((S - mw) / 2, (S - mh) / 2, mh, fg), "AtoAxis")


write("atoaxis-icon.svg", icon(MINT, GREEN))
write("atoaxis-icon-green.svg", icon(GREEN, "#FFFFFF"))


# Full-bleed squares: the platform applies its own mask (Apple touch icon, PWA maskable).
# The maskable mark stays inside the 80% safe-zone circle.
def full_bleed(bg, mark_share):
    S = 1024
    mh = S * mark_share
    mw = MW * mh / MH
    return svg(S, S, f'<rect width="{S}" height="{S}" fill="{bg}"/>'
               + mark_g((S - mw) / 2, (S - mh) / 2, mh, GREEN), "AtoAxis")


write("atoaxis-apple-touch.svg", full_bleed(MINT, 0.6))
write("atoaxis-maskable.svg", full_bleed(MINT, 0.5))

# 3. Horizontal logo: mark + "AtoAxis" in Geist SemiBold.
f = TTFont(font_path)
f = instantiateVariableFont(f, {"wght": 600})
gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm
hmtx = f["hmtx"]
cap = f["OS/2"].sCapHeight

H = 200                 # mark height
cap_px = H * 0.62       # wordmark cap height relative to mark
scale = cap_px / cap
gap = H * 0.22
P = round(H * 0.12)     # clear space around the lockup
text_x = P + MW * H / MH + gap
baseline = P + H

pen = SVGPathPen(gs)
bounds = BoundsPen(gs)
x = 0
for ch in "AtoAxis":
    g = cmap[ord(ch)]
    t = (scale, 0, 0, -scale, text_x + x * scale, baseline)
    gs[g].draw(TransformPen(pen, t))
    gs[g].draw(TransformPen(bounds, t))
    x += hmtx[g][0]
text_d = pen.getCommands()
right = bounds.bounds[2]
W = round(right + P)


def lockup(mark_fill, text_fill):
    return svg(W, H + 2 * P, mark_g(P, P, H, mark_fill) + f'<path fill="{text_fill}" d="{text_d}"/>', "AtoAxis")


write("atoaxis-logo.svg", lockup(GREEN, INK))
write("atoaxis-logo-white.svg", lockup("#FFFFFF", "#FFFFFF"))
print("wrote", sorted(p.name for p in out.glob("*.svg")))
