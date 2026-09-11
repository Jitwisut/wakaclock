# AtoAxis product showcase redesign

Scope: all public marketing pages in English and Thai. Dashboard, authentication,
copy dictionaries, forms, and SEO data remain unchanged.

## Direction

Reference: https://www.apple.com/iphone/

A pearl-white product presentation with green accents replaces the dark editorial
direction. Compact navigation, centered introductory typography, an interactive
product illustration, a horizontally browseable feature collection, and generous
spacing give each part of the product a distinct presentation.

The existing authorship demo now leads the homepage in a dark product frame.
The ornamental orbital sculpture is removed. The feature collection supports
touch scrolling and previous/next buttons with disabled states at its boundaries.
Illustrations remain bounded rather than filling every page. Pricing, signup,
FAQs, editorial pages, related links, and the compact footer share the new system.
Only one marketing stylesheet is loaded; the superseded energy and cinema
override files have been removed.

## Motion and accessibility

The product stage pins only when it fits the viewport and CSS scroll timelines
are supported. Otherwise it stays in normal flow. Scroll controls its perspective,
image framing, and subtle card movement. Below-fold headings use clipped reveals;
supporting text uses short translations. No scroll hijacking or autoplay video is
introduced. Reduced-motion preferences disable animations and smooth gallery
movement. Keyboard-accessible gallery buttons and a compact live reading index
provide explicit navigation.

## Verification

- 80 marketing, interaction, gallery, and SEO tests pass.
- ESLint, full TypeScript checking, webpack production build, and prerender checks pass.
- Content character inventory across 36 prebuilt page snapshots remains unchanged,
  excluding decoration and ignoring whitespace between reordered sections.
- Existing preview at http://localhost:3000 responds with HTTP 200; opening it was
  queued in Codex. Browser visual and viewport QA have not been performed.
- No commit, push, or deployment was performed.
