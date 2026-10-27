# AtoAxis logo

Asset: `public/atoaxis-mark.svg` (vector, emerald `#146F47`). Traced from the
original generated `public/atoaxis-symbol-v2.png` (1254 × 1254 RGBA PNG), which
stays in place for external links but is no longer referenced by the site.

Masters, store icons, the horizontal wordmark lockup and the generator live in
`/brand` at the repository root. Regenerate every derived file with:

```bash
python3 brand/make_brand.py frontend/app/public/fonts/atoaxis-sans.woff2 brand
node brand/render.mjs frontend/app/node_modules/sharp brand
```

Web exports in `public/`: `atoaxis-mark-{192,512}.png` (icon fallback, manifest,
organization structured data), `atoaxis-apple-touch-180.png` and
`atoaxis-maskable-512.png` (full-bleed for platform masks). `app/icon.png` is
the 512 px mark.

The symbol combines an ascending A silhouette with a broken horizontal axis.
Use it beside the written name AtoAxis, on a light background. The mark is
decorative where the adjacent wordmark supplies the accessible name.

Integrated in marketing navigation, footer, publisher identity, organization
structured data, browser icon metadata, Apple touch icon metadata, and manifest.
Existing logo assets and social preview artwork were preserved.

## Generation prompt

Create one final professional logo SYMBOL for AtoAxis, a developer time tracking
and AI contribution analytics product. Transparent background with real alpha.
Square 1024x1024 asset. A single original geometric monogram combining a capital A
and two coordinate axes: two solid tapered ascending pillars and a crisp short
horizontal crossbar, a small negative-space break expressing a timeline. Emerald
green #177044 only, flat vector-like crisp silhouette, no gradient, no shadow,
no 3D, no texture, no mockup. Sophisticated restrained precision, strong distinctive
balanced geometry, legible at 24 pixels. Center the symbol, it occupies approximately
80 percent of canvas with equal padding. No lettering, no wordmark, no captions,
no grid, no additional alternatives. Do not resemble Apple logo or another existing
brand. Production-ready isolated mark for a clean white and green premium SaaS
website.
