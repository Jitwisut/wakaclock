# AtoAxis local fonts

The two WOFF2 files are the Latin Geist and Geist Mono files bundled by the installed
Next.js release. They are vendored here so production builds never fetch a font from the
network. The files are used as the shared local fallback for the selectable theme aliases;
the browser still falls back to a platform font for scripts not present in the Latin subset.

Upstream project: <https://github.com/vercel/geist-font>

The Geist typeface is distributed under the SIL Open Font License 1.1. See `OFL.txt`.
