# Public frontend UI audit and creative direction — 2026-09-09

## Scope and evidence

Read-only product review of the local Next.js development frontend before dashboard entry. No application code was changed. Inspected `/`, `/th`, `/pricing`, `/integrations`, `/docs/getting-started`, `/early-access`, `/login`, `/register` in headless Chrome at 320, 390, 1024 and 1440 CSS pixels wide, initially with a 900px viewport height. All 32 route/viewport combinations returned HTTP 200, with no captured `pageerror` during initial navigation. Document width matched viewport width in those cases; clipped code blocks and decorative marquees are not document overflow bugs.

Additional checks covered 844×390 landscape navigation, keyboard focus on the Early Access select, hash navigation, and local form POST behavior. Axe was run on home, Early Access and login. This is not a Safari/Firefox, production deployment, exhaustive link, authentication, or performance certification. Other public routes and their Thai variants remain outside this browser sample.

Screenshots and machine-readable observations currently live in `/tmp/waka-ui-*.png`, `/tmp/waka-ui-audit.json`, and `/tmp/waka-ui-followup.json`. These temporary files can expire; the observations below are retained in the repository.

## Confirmed findings

| Priority | Finding | Evidence and impact | Recommended correction |
| --- | --- | --- | --- |
| P1 | Early Access has no working handler in the tested local runtime | `early-access-form.tsx:60` POSTs to `/__forms.html`; a request with a filled honeypot and no personal data returned HTTP 405. The component expects Netlify Forms, while the repository Next config has no matching handler or rewrite. | Supply a hosting-independent server endpoint with input validation, durable persistence, abuse limits and an explicit success contract. Verify the deployed Vercel endpoint separately; local 405 alone does not prove its deployed configuration. |
| P2 | Weekly preview bars are invisible | `dashboard-preview-section.tsx:112` uses percentage heights inside auto-height flex columns. All seven bar rectangles measured 0px at all four viewport widths. | Give each plot column a definite height, keep labels outside the scaling region, and verify positive, correctly ordered bar heights. |
| P2 | Tablet navigation breaks words and branding | At `/th`, 1024×900, AtoAxis, Analytics, Teams and EN wrap within words. The menu switches to desktop at `lg`, before the complete navigation fits. | Keep compact navigation until it fits, such as `xl`; prevent shrink/wrapping for logo and language control; group secondary links if needed. Test EN and TH with increased text size. |
| P2 | Landscape mobile menu extends below viewport | At 844×390, menu top=106px and bottom=582px; overflow is visible and max-height is none. Lower items are outside the initial viewport. | Bound the panel using remaining dynamic viewport height, add internal vertical scrolling, and verify lower links remain reachable by touch and keyboard. |
| P2 | Anchor headings are obscured by sticky navigation | Navigating to `/#at-a-glance` placed the section at approximately 0px while the header ended at 109px. | Add responsive scroll margins/padding to anchored sections and verify actual heading visibility after clicks and direct hash loads. |
| P2 | Early Access select has no keyboard focus indicator | Tab from email focuses the interest select, but computed outline style is none and box-shadow is none. `marketing.css:285` includes inputs and textarea, omitting select; the control also has `outline-none`. | Add select to the shared focus treatment and verify keyboard focus across every control. |
| P3 | Hero panel caption has weak contrast | Axe reported a 4.21 contrast ratio for the 12px caption on the dark code panel. | Increase caption contrast. Other homepage contrast findings coincided with scroll-reveal opacity and require settled-state verification before being called permanent color failures. |

## Experience and visual improvements

- The English homepage measured about 12,296px high at 1440px wide and 17,844px at 390px. It mixes a landing page with extensive article-style content. Keep the core explanation visible, move detailed setup/reference material to the existing docs or contextual disclosures, and bring the working preview near the top.
- The hero presents setup configuration before demonstrating the result. Shorten the lead to a benefit plus a concrete explanation, then show an interactive illustrative activity preview. Keep configuration in the quick-start section.
- Keep the green/ivory palette and restrained pixel details, but vary visual hierarchy: softer everyday content surfaces, stronger borders on primary interactive panels, and one dominant CTA. Use monospace for events, timestamps and code; use readable proportional text for long passages.
- Login/register have an English-only copy dictionary and links from Thai navigation do not preserve locale. Extend account copy and return navigation to retain the visitor's language. Password visibility and actionable, field-linked errors would improve form usability.
- The existing motion already includes CSS entrance effects, button press states, scrolling marquees and reduced-motion overrides. A redesign should consolidate those behaviors rather than layering another effect onto every element.

## Proposed creative direction: a studio for coding activity

The defining interaction should explain how an edit becomes a useful record. All demo data must be marked as illustrative and must never imply live collection, guaranteed detection, or certified support for every runtime.

1. **Interactive hero: edit → event → timeline.** A miniature editor shows a short sample edit. The user selects Human, AI, or Mixed. The sample edit becomes a small event chip, moves along a connecting line, and updates the corresponding timeline region. Include Unknown explicitly when no provenance exists. Play a short introductory sequence once, with Replay and Pause controls; do not loop indefinitely.
2. **Attribution lens.** A draggable divider reveals two views of the same sample: total activity and its Human / AI / Unknown breakdown. Provide buttons and arrow-key operation so touch and keyboard users can reach the same states. Preserve total values while animating categories.
3. **A day in the editor.** A horizontal timeline supports scrub/step interaction. Selecting a moment updates the sample file, duration and attribution in one panel. On phones, use stacked cards with Previous/Next controls rather than a pinned full-screen sequence.
4. **Integration constellation.** A small set of editor tiles connects to a central activity panel when selected. Show editor protocol compatibility separately from AI provenance support. Link to the existing integration detail pages. Replace the endlessly moving logo wall with an interaction users control.
5. **Tactile pricing and form feedback.** Use a short sliding billing selector, a restrained number transition, and clear pending → success/error states. Only show a success animation after the server confirms persistence. Avoid shaking inputs or hiding error text on timers.

## Motion and accessibility contract

- Hover/press feedback: roughly 120–180ms; UI state transitions: 180–260ms; one-time reveals: 350–500ms. These are initial design targets, to tune in the browser.
- Prefer transform and opacity; avoid layout-changing animation for surrounding text. Reserve space for numeric and panel changes.
- Keep headings, CTA and core content server-rendered and visible without animation support. Load interactive demo code only where needed.
- Respect reduced motion with immediate state changes and static connectors; retain every action and explanation.
- Pause decorative animation offscreen or when the tab is hidden. Pointer effects apply only to suitable pointing devices; touch/keyboard retain equivalent interactions.
- Do not hijack scrolling, replace the pointer, auto-play sound, or require animation completion before interaction.

## Implementation order and acceptance

1. Repair form delivery, graph geometry, navigation breakpoints, anchor offsets and focus indicators. Validate form persistence separately from HTTP success and test network failure/retry without duplicate submissions.
2. Restructure the homepage around hero → interactive preview → benefits → integration compatibility → pricing → FAQ → final CTA. Preserve meaningful explanatory text and source links without duplicating long sections.
3. Implement the hero demo and attribution lens first; establish motion tokens and reduced-motion behavior before expanding interactions.
4. Align EN/TH marketing and account pages, including mobile font sizing and line breaks.
5. Validate Chromium, WebKit and Firefox at 320, 390, 768, 1024, 1280 and 1440px; include landscape, keyboard-only use, reduced motion, text zoom, and slow/offline form submission. Measure production loading and animation responsiveness before release.

No conversion improvement or performance budget compliance is claimed from this audit. The current request produced findings and a design plan, not a deployed redesign.
