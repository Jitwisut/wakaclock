# AtoAxis local fonts

The two WOFF2 files are the Latin Geist and Geist Mono files bundled by the installed
Next.js release. They are vendored here so production builds never fetch a font from the
network. The files are used as the shared local fallback for the selectable theme aliases;
the browser still falls back to a platform font for scripts not present in the Latin subset.

Upstream project: <https://github.com/vercel/geist-font>

The Geist typeface is distributed under the SIL Open Font License 1.1. See `OFL.txt`.

## Cinema preset faces

`cinema-*.woff2` are the dashboard's Cinema preset faces, vendored from the
`@fontsource` 5.3.0 packages (Latin and Thai subsets only) so builds stay offline:

| File | Family | Licence |
| --- | --- | --- |
| `cinema-display.woff2` | Space Grotesk (variable, 300–700) | `OFL-space-grotesk.txt` |
| `cinema-serif*.woff2` | Instrument Serif 400 regular/italic | `OFL-instrument-serif.txt` |
| `cinema-mono-*.woff2` | IBM Plex Mono 400/500 | `OFL-ibm-plex-mono.txt` |
| `cinema-text-{latin,thai}-*.woff2` | IBM Plex Sans Thai 400/500/600 | `OFL-ibm-plex-sans-thai.txt` |

The Latin and Thai subsets of IBM Plex Sans Thai are two `next/font` families because
`next/font/local` cannot set `unicode-range`; the text stack lists Latin first and the
browser falls back to the Thai family per glyph.
