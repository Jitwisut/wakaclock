# PRD: Component & Page Documentation - Complete Task Breakdown

## Executive Summary

This PRD defines **micro-tasks** for documenting every component and page in the
codebase following the **Button component enterprise pattern** (5-file
documentation triad).

---

## Task ID Convention

```
UC-XXX  = UI Component
CC-XXX  = Custom Component
LC-XXX  = Layout Component
TC-XXX  = Theme Customizer
DP-XXX  = Dashboard Page
AP-XXX  = Auth Page
```

---

# SECTION 1: UI COMPONENTS (52 Components)

## 1.1 Core Interactive Components

### UC-001: Accordion

**File:** `components/ui/accordion.tsx` (9.4K) **Status:** Needs enterprise
upgrade

| Task ID  | Task                                                             | Priority | Est. Lines |
| -------- | ---------------------------------------------------------------- | -------- | ---------- |
| UC-001-A | Add comprehensive JSDoc to all exports                           | HIGH     | +150       |
| UC-001-B | Add data-\* attributes (data-slot, data-state, data-orientation) | HIGH     | +30        |
| UC-001-C | Create `accordion.factory.ts` with enterprise pattern            | HIGH     | +400       |
| UC-001-D | Create `accordion.handlers.ts` with full HTTP status coverage    | MEDIUM   | +300       |
| UC-001-E | Add i18n keys to `en.ts` and `ja.ts`                             | MEDIUM   | +50        |
| UC-001-F | Add dark mode story variants                                     | MEDIUM   | +100       |
| UC-001-G | Add play tests for keyboard navigation                           | HIGH     | +150       |
| UC-001-H | Add RTL support story                                            | LOW      | +50        |

---

### UC-002: Alert Dialog

**File:** `components/ui/alert-dialog.tsx` (12K) **Status:** Needs enterprise
upgrade

| Task ID  | Task                                                                           | Priority | Est. Lines |
| -------- | ------------------------------------------------------------------------------ | -------- | ---------- |
| UC-002-A | Add comprehensive JSDoc to AlertDialog, AlertDialogTrigger, AlertDialogContent | HIGH     | +200       |
| UC-002-B | Add data-\* attributes for testing                                             | HIGH     | +40        |
| UC-002-C | Expand `alert-dialog.factory.ts` with matrix factories                         | HIGH     | +300       |
| UC-002-D | Expand `alert-dialog.handlers.ts` with all status codes                        | MEDIUM   | +250       |
| UC-002-E | Add confirmation flow play tests                                               | HIGH     | +200       |
| UC-002-F | Add focus trap testing                                                         | HIGH     | +100       |
| UC-002-G | Add escape key dismissal test                                                  | MEDIUM   | +50        |

---

### UC-003: Alert

**File:** `components/ui/alert.tsx` (6.1K) **Status:** Needs enterprise upgrade

| Task ID  | Task                                                  | Priority | Est. Lines |
| -------- | ----------------------------------------------------- | -------- | ---------- |
| UC-003-A | Add JSDoc with @example blocks                        | HIGH     | +100       |
| UC-003-B | Add enterprise variant types (info, success, warning) | HIGH     | +80        |
| UC-003-C | Verify `alert.factory.ts` has matrix factories        | MEDIUM   | +200       |
| UC-003-D | Add dismissible alert play tests                      | HIGH     | +150       |
| UC-003-E | Add auto-dismiss timer story                          | MEDIUM   | +100       |

---

### UC-004: Aspect Ratio

**File:** `components/ui/aspect-ratio.tsx` (2.6K) **Status:** Needs factory &
handlers

| Task ID  | Task                                   | Priority | Est. Lines |
| -------- | -------------------------------------- | -------- | ---------- |
| UC-004-A | Add JSDoc documentation                | MEDIUM   | +50        |
| UC-004-B | Create `aspect-ratio.factory.ts`       | HIGH     | +200       |
| UC-004-C | Add responsive aspect ratio stories    | MEDIUM   | +150       |
| UC-004-D | Add image loading skeleton integration | LOW      | +100       |

---

### UC-005: Avatar

**File:** `components/ui/avatar.tsx` (7.6K) **Status:** Needs play tests & dark
mode

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| UC-005-A | Add comprehensive JSDoc         | HIGH     | +120       |
| UC-005-B | Add fallback loading play tests | HIGH     | +100       |
| UC-005-C | Add avatar group story          | MEDIUM   | +150       |
| UC-005-D | Add dark mode variants          | MEDIUM   | +80        |

---

### UC-006: Badge

**File:** `components/ui/badge.tsx` (4.4K) **Status:** Needs play tests

| Task ID  | Task                                     | Priority | Est. Lines |
| -------- | ---------------------------------------- | -------- | ---------- |
| UC-006-A | Add JSDoc with variant examples          | HIGH     | +80        |
| UC-006-B | Add notification badge factory           | MEDIUM   | +150       |
| UC-006-C | Add animated badge story (pulse, bounce) | LOW      | +100       |
| UC-006-D | Add badge with icon combinations         | MEDIUM   | +80        |

---

### UC-007: Breadcrumb

**File:** `components/ui/breadcrumb.tsx` (9.7K) **Status:** Needs i18n expansion

| Task ID  | Task                                             | Priority | Est. Lines |
| -------- | ------------------------------------------------ | -------- | ---------- |
| UC-007-A | Add JSDoc to all subcomponents                   | HIGH     | +150       |
| UC-007-B | Expand `breadcrumb.factory.ts` with deep nesting | MEDIUM   | +200       |
| UC-007-C | Add truncation/ellipsis story                    | MEDIUM   | +100       |
| UC-007-D | Expand i18n keys (15+ keys needed)               | HIGH     | +100       |
| UC-007-E | Add mobile responsive collapse story             | MEDIUM   | +150       |

---

### UC-008: Button Group

**File:** `components/ui/button-group.tsx` (6.0K) **Status:** Needs play tests

| Task ID  | Task                               | Priority | Est. Lines |
| -------- | ---------------------------------- | -------- | ---------- |
| UC-008-A | Add JSDoc documentation            | HIGH     | +100       |
| UC-008-B | Add keyboard navigation play tests | HIGH     | +150       |
| UC-008-C | Add toggle group behavior story    | MEDIUM   | +120       |
| UC-008-D | Add responsive stacking story      | MEDIUM   | +100       |

---

### UC-009: Button

**File:** `components/ui/button.tsx` (44K) **Status:** REFERENCE
IMPLEMENTATION - Complete

| Task ID  | Task                  | Priority | Est. Lines |
| -------- | --------------------- | -------- | ---------- |
| UC-009-A | Maintain as reference | -        | -          |

---

### UC-010: Calendar

**File:** `components/ui/calendar.tsx` (18K) **Status:** Needs play tests &
handlers

| Task ID  | Task                                            | Priority | Est. Lines |
| -------- | ----------------------------------------------- | -------- | ---------- |
| UC-010-A | Add comprehensive JSDoc                         | HIGH     | +200       |
| UC-010-B | Create `calendar.handlers.ts` for date fetching | HIGH     | +300       |
| UC-010-C | Add date range selection play tests             | HIGH     | +200       |
| UC-010-D | Add disabled dates story                        | MEDIUM   | +100       |
| UC-010-E | Add min/max date validation                     | MEDIUM   | +100       |
| UC-010-F | Add locale-aware formatting stories             | HIGH     | +150       |

---

### UC-011: Card

**File:** `components/ui/card.tsx` (8.7K) **Status:** Needs dark mode & play
tests

| Task ID  | Task                                                   | Priority | Est. Lines |
| -------- | ------------------------------------------------------ | -------- | ---------- |
| UC-011-A | Add JSDoc to Card, CardHeader, CardContent, CardFooter | HIGH     | +150       |
| UC-011-B | Add interactive card play tests (hover, click)         | MEDIUM   | +100       |
| UC-011-C | Add card grid layout stories                           | MEDIUM   | +150       |
| UC-011-D | Add skeleton loading card story                        | MEDIUM   | +100       |

---

### UC-012: Carousel

**File:** `components/ui/carousel.tsx` (9.3K) **Status:** Needs JSDoc & handlers

| Task ID  | Task                                                  | Priority | Est. Lines |
| -------- | ----------------------------------------------------- | -------- | ---------- |
| UC-012-A | Add comprehensive JSDoc                               | HIGH     | +180       |
| UC-012-B | Create `carousel.handlers.ts` for async slide loading | HIGH     | +250       |
| UC-012-C | Add autoplay play tests                               | HIGH     | +150       |
| UC-012-D | Add swipe gesture story                               | MEDIUM   | +100       |
| UC-012-E | Add infinite loop story                               | MEDIUM   | +80        |

---

### UC-013: Chart

**File:** `components/ui/chart.tsx` (15K) **Status:** Needs JSDoc & specialized
factories

| Task ID  | Task                                            | Priority | Est. Lines |
| -------- | ----------------------------------------------- | -------- | ---------- |
| UC-013-A | Add comprehensive JSDoc                         | HIGH     | +250       |
| UC-013-B | Expand `chart.factory.ts` with time series data | HIGH     | +400       |
| UC-013-C | Add real-time data update story                 | HIGH     | +200       |
| UC-013-D | Add responsive chart resize story               | MEDIUM   | +150       |
| UC-013-E | Add empty/loading state stories                 | MEDIUM   | +100       |

---

### UC-014: Checkbox

**File:** `components/ui/checkbox.tsx` (3.4K) **Status:** Needs handlers & play
tests

| Task ID  | Task                                     | Priority | Est. Lines |
| -------- | ---------------------------------------- | -------- | ---------- |
| UC-014-A | Add JSDoc with form integration examples | HIGH     | +80        |
| UC-014-B | Create `checkbox.handlers.ts`            | HIGH     | +200       |
| UC-014-C | Add indeterminate state story            | MEDIUM   | +80        |
| UC-014-D | Add checkbox group play tests            | HIGH     | +150       |
| UC-014-E | Add form validation story                | HIGH     | +120       |

---

### UC-015: Collapsible

**File:** `components/ui/collapsible.tsx` (4.4K) **Status:** Needs handlers &
i18n

| Task ID  | Task                             | Priority | Est. Lines |
| -------- | -------------------------------- | -------- | ---------- |
| UC-015-A | Add JSDoc documentation          | HIGH     | +80        |
| UC-015-B | Create `collapsible.handlers.ts` | HIGH     | +200       |
| UC-015-C | Add animation timing stories     | MEDIUM   | +100       |
| UC-015-D | Expand i18n (12+ keys needed)    | HIGH     | +80        |
| UC-015-E | Add nested collapsible story     | MEDIUM   | +120       |

---

### UC-016: Command

**File:** `components/ui/command.tsx` (9.0K) **Status:** Needs factory &
handlers

| Task ID  | Task                                    | Priority | Est. Lines |
| -------- | --------------------------------------- | -------- | ---------- |
| UC-016-A | Add comprehensive JSDoc                 | HIGH     | +150       |
| UC-016-B | Create `command.factory.ts`             | HIGH     | +350       |
| UC-016-C | Create `command.handlers.ts` for search | HIGH     | +300       |
| UC-016-D | Add keyboard navigation play tests      | HIGH     | +200       |
| UC-016-E | Add async search debounce story         | HIGH     | +150       |
| UC-016-F | Add command palette shortcut story      | MEDIUM   | +100       |

---

### UC-017: Context Menu

**File:** `components/ui/context-menu.tsx` (15K) **Status:** Needs handlers &
play tests

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| UC-017-A | Add JSDoc to all subcomponents    | HIGH     | +200       |
| UC-017-B | Create `context-menu.handlers.ts` | HIGH     | +250       |
| UC-017-C | Add right-click play tests        | HIGH     | +150       |
| UC-017-D | Add nested submenu story          | MEDIUM   | +120       |
| UC-017-E | Add disabled items story          | MEDIUM   | +80        |

---

### UC-018: Dialog

**File:** `components/ui/dialog.tsx` (9.9K) **Status:** Needs play tests & dark
mode

| Task ID  | Task                             | Priority | Est. Lines |
| -------- | -------------------------------- | -------- | ---------- |
| UC-018-A | Add comprehensive JSDoc          | HIGH     | +150       |
| UC-018-B | Add focus trap play tests        | HIGH     | +150       |
| UC-018-C | Add form submission dialog story | HIGH     | +200       |
| UC-018-D | Add nested dialog story          | MEDIUM   | +120       |
| UC-018-E | Add mobile fullscreen story      | MEDIUM   | +100       |

---

### UC-019: Drawer

**File:** `components/ui/drawer.tsx` (8.3K) **Status:** Needs handlers & play
tests

| Task ID  | Task                                                  | Priority | Est. Lines |
| -------- | ----------------------------------------------------- | -------- | ---------- |
| UC-019-A | Add JSDoc documentation                               | HIGH     | +120       |
| UC-019-B | Create `drawer.handlers.ts`                           | HIGH     | +250       |
| UC-019-C | Add swipe-to-close play tests                         | HIGH     | +150       |
| UC-019-D | Add drawer positions story (left, right, top, bottom) | MEDIUM   | +150       |
| UC-019-E | Add nested content story                              | MEDIUM   | +100       |

---

### UC-020: Dropdown Menu

**File:** `components/ui/dropdown-menu.tsx` (16K) **Status:** Needs handlers &
play tests

| Task ID  | Task                               | Priority | Est. Lines |
| -------- | ---------------------------------- | -------- | ---------- |
| UC-020-A | Add comprehensive JSDoc            | HIGH     | +250       |
| UC-020-B | Create `dropdown-menu.handlers.ts` | HIGH     | +300       |
| UC-020-C | Add keyboard navigation play tests | HIGH     | +200       |
| UC-020-D | Add checkbox/radio items story     | MEDIUM   | +150       |
| UC-020-E | Add dynamic items loading story    | MEDIUM   | +120       |

---

### UC-021: Empty

**File:** `components/ui/empty.tsx` (5.7K) **Status:** Needs handlers & factory

| Task ID  | Task                             | Priority | Est. Lines |
| -------- | -------------------------------- | -------- | ---------- |
| UC-021-A | Add JSDoc documentation          | HIGH     | +80        |
| UC-021-B | Create `empty.factory.ts`        | HIGH     | +200       |
| UC-021-C | Create `empty.handlers.ts`       | MEDIUM   | +150       |
| UC-021-D | Add action button variants story | MEDIUM   | +100       |
| UC-021-E | Add illustration variants story  | LOW      | +80        |

---

### UC-022: Field

**File:** `components/ui/field.tsx` (11K) **Status:** Needs handlers & play
tests

| Task ID  | Task                                      | Priority | Est. Lines |
| -------- | ----------------------------------------- | -------- | ---------- |
| UC-022-A | Add comprehensive JSDoc                   | HIGH     | +150       |
| UC-022-B | Create `field.handlers.ts` for validation | HIGH     | +300       |
| UC-022-C | Add error state play tests                | HIGH     | +150       |
| UC-022-D | Add helper text variants story            | MEDIUM   | +100       |
| UC-022-E | Add required field indicator story        | MEDIUM   | +80        |

---

### UC-023: Form

**File:** `components/ui/form.tsx` (7.9K) **Status:** Needs play tests & dark
mode

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| UC-023-A | Add comprehensive JSDoc        | HIGH     | +120       |
| UC-023-B | Add form submission play tests | HIGH     | +200       |
| UC-023-C | Add validation feedback story  | HIGH     | +150       |
| UC-023-D | Add multi-step form story      | MEDIUM   | +200       |
| UC-023-E | Add form reset play tests      | MEDIUM   | +100       |

---

### UC-024: Hover Card

**File:** `components/ui/hover-card.tsx` (4.1K) **Status:** Needs handlers &
play tests

| Task ID  | Task                                              | Priority | Est. Lines |
| -------- | ------------------------------------------------- | -------- | ---------- |
| UC-024-A | Add JSDoc documentation                           | HIGH     | +80        |
| UC-024-B | Create `hover-card.handlers.ts` for async content | HIGH     | +200       |
| UC-024-C | Add hover delay play tests                        | HIGH     | +100       |
| UC-024-D | Add rich content story (images, actions)          | MEDIUM   | +120       |
| UC-024-E | Add mobile touch behavior story                   | MEDIUM   | +80        |

---

### UC-025: Input Group

**File:** `components/ui/input-group.tsx` (8.8K) **Status:** Needs play tests

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| UC-025-A | Add comprehensive JSDoc         | HIGH     | +120       |
| UC-025-B | Add prefix/suffix play tests    | HIGH     | +150       |
| UC-025-C | Add addon button actions story  | MEDIUM   | +120       |
| UC-025-D | Add currency/phone format story | MEDIUM   | +100       |

---

### UC-026: Input OTP

**File:** `components/ui/input-otp.tsx` (5.4K) **Status:** Needs handlers & i18n

| Task ID  | Task                                            | Priority | Est. Lines |
| -------- | ----------------------------------------------- | -------- | ---------- |
| UC-026-A | Add JSDoc documentation                         | HIGH     | +80        |
| UC-026-B | Create `input-otp.handlers.ts` for verification | HIGH     | +250       |
| UC-026-C | Add auto-submit play tests                      | HIGH     | +150       |
| UC-026-D | Add paste handling story                        | MEDIUM   | +100       |
| UC-026-E | Expand i18n (10+ keys needed)                   | HIGH     | +60        |
| UC-026-F | Add resend code timer story                     | MEDIUM   | +120       |

---

### UC-027: Input

**File:** `components/ui/input.tsx` (3.1K) **Status:** Needs play tests

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| UC-027-A | Add JSDoc with type examples | HIGH     | +60        |
| UC-027-B | Add input masking play tests | HIGH     | +150       |
| UC-027-C | Add clear button story       | MEDIUM   | +80        |
| UC-027-D | Add character counter story  | MEDIUM   | +80        |

---

### UC-028: Item

**File:** `components/ui/item.tsx` (8.9K) **Status:** Needs handlers & factory

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| UC-028-A | Add JSDoc documentation        | HIGH     | +120       |
| UC-028-B | Create `item.factory.ts`       | HIGH     | +250       |
| UC-028-C | Create `item.handlers.ts`      | MEDIUM   | +200       |
| UC-028-D | Add selectable item play tests | HIGH     | +150       |
| UC-028-E | Add drag-and-drop story        | MEDIUM   | +150       |

---

### UC-029: Kanban

**File:** `components/ui/kanban.tsx` (35K) **Status:** Needs JSDoc expansion

| Task ID  | Task                                   | Priority | Est. Lines |
| -------- | -------------------------------------- | -------- | ---------- |
| UC-029-A | Add comprehensive JSDoc to all exports | HIGH     | +400       |
| UC-029-B | Add drag-and-drop play tests           | HIGH     | +250       |
| UC-029-C | Add column CRUD operations story       | HIGH     | +200       |
| UC-029-D | Add card details modal story           | MEDIUM   | +150       |
| UC-029-E | Add swimlane view story                | MEDIUM   | +150       |

---

### UC-030: Kbd

**File:** `components/ui/kbd.tsx` (2.6K) **Status:** Needs factory & handlers

| Task ID  | Task                                  | Priority | Est. Lines |
| -------- | ------------------------------------- | -------- | ---------- |
| UC-030-A | Add JSDoc documentation               | HIGH     | +50        |
| UC-030-B | Create `kbd.factory.ts`               | HIGH     | +200       |
| UC-030-C | Add modifier key combinations story   | MEDIUM   | +100       |
| UC-030-D | Add platform-specific shortcuts story | MEDIUM   | +80        |

---

### UC-031: Label

**File:** `components/ui/label.tsx` (2.4K) **Status:** Needs handlers

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| UC-031-A | Add JSDoc documentation       | HIGH     | +40        |
| UC-031-B | Create `label.handlers.ts`    | MEDIUM   | +150       |
| UC-031-C | Add required indicator story  | MEDIUM   | +60        |
| UC-031-D | Add tooltip integration story | LOW      | +80        |

---

### UC-032: Menubar

**File:** `components/ui/menubar.tsx` (15K) **Status:** Needs factory & handlers

| Task ID  | Task                               | Priority | Est. Lines |
| -------- | ---------------------------------- | -------- | ---------- |
| UC-032-A | Add comprehensive JSDoc            | HIGH     | +200       |
| UC-032-B | Create `menubar.factory.ts`        | HIGH     | +350       |
| UC-032-C | Create `menubar.handlers.ts`       | HIGH     | +250       |
| UC-032-D | Add keyboard navigation play tests | HIGH     | +200       |
| UC-032-E | Add submenu hover behavior story   | MEDIUM   | +120       |

---

### UC-033: Native Select

**File:** `components/ui/native-select.tsx` (4.6K) **Status:** Needs factory &
i18n

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| UC-033-A | Add JSDoc documentation           | HIGH     | +80        |
| UC-033-B | Create `native-select.factory.ts` | HIGH     | +200       |
| UC-033-C | Add mobile optimization story     | MEDIUM   | +100       |
| UC-033-D | Expand i18n (10+ keys needed)     | HIGH     | +60        |

---

### UC-034: Navigation Menu

**File:** `components/ui/navigation-menu.tsx` (11K) **Status:** Needs factory &
handlers

| Task ID  | Task                                 | Priority | Est. Lines |
| -------- | ------------------------------------ | -------- | ---------- |
| UC-034-A | Add comprehensive JSDoc              | HIGH     | +150       |
| UC-034-B | Create `navigation-menu.factory.ts`  | HIGH     | +300       |
| UC-034-C | Create `navigation-menu.handlers.ts` | HIGH     | +250       |
| UC-034-D | Add mega menu story                  | HIGH     | +200       |
| UC-034-E | Add mobile responsive collapse story | HIGH     | +150       |

---

### UC-035: Pagination

**File:** `components/ui/pagination.tsx` (7.3K) **Status:** Needs factory
expansion

| Task ID  | Task                                           | Priority | Est. Lines |
| -------- | ---------------------------------------------- | -------- | ---------- |
| UC-035-A | Add JSDoc documentation                        | HIGH     | +100       |
| UC-035-B | Expand `pagination.factory.ts` with edge cases | HIGH     | +200       |
| UC-035-C | Add page size selector story                   | MEDIUM   | +100       |
| UC-035-D | Add jump-to-page story                         | MEDIUM   | +80        |
| UC-035-E | Add infinite scroll integration story          | LOW      | +150       |

---

### UC-036: Popover

**File:** `components/ui/popover.tsx` (5.3K) **Status:** Needs handlers & play
tests

| Task ID  | Task                                 | Priority | Est. Lines |
| -------- | ------------------------------------ | -------- | ---------- |
| UC-036-A | Add JSDoc documentation              | HIGH     | +80        |
| UC-036-B | Create `popover.handlers.ts`         | HIGH     | +200       |
| UC-036-C | Add click-outside dismiss play tests | HIGH     | +100       |
| UC-036-D | Add form-in-popover story            | MEDIUM   | +150       |
| UC-036-E | Add positioning variants story       | MEDIUM   | +100       |

---

### UC-037: Progress

**File:** `components/ui/progress.tsx` (3.3K) **Status:** Needs factory
expansion

| Task ID  | Task                                      | Priority | Est. Lines |
| -------- | ----------------------------------------- | -------- | ---------- |
| UC-037-A | Add JSDoc documentation                   | HIGH     | +60        |
| UC-037-B | Verify `progress.factory.ts` completeness | MEDIUM   | +100       |
| UC-037-C | Add animated progress story               | MEDIUM   | +100       |
| UC-037-D | Add circular progress variant story       | MEDIUM   | +150       |
| UC-037-E | Add step progress story                   | MEDIUM   | +120       |

---

### UC-038: Radio Group

**File:** `components/ui/radio-group.tsx` (4.5K) **Status:** Needs factory &
handlers

| Task ID  | Task                               | Priority | Est. Lines |
| -------- | ---------------------------------- | -------- | ---------- |
| UC-038-A | Add JSDoc documentation            | HIGH     | +80        |
| UC-038-B | Create `radio-group.factory.ts`    | HIGH     | +200       |
| UC-038-C | Create `radio-group.handlers.ts`   | HIGH     | +200       |
| UC-038-D | Add card-style radio story         | MEDIUM   | +120       |
| UC-038-E | Add keyboard navigation play tests | HIGH     | +100       |

---

### UC-039: Reel

**File:** `components/ui/reel.tsx` (25K) **Status:** Needs factory & handlers

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| UC-039-A | Add comprehensive JSDoc           | HIGH     | +300       |
| UC-039-B | Create `reel.factory.ts`          | HIGH     | +350       |
| UC-039-C | Create `reel.handlers.ts`         | HIGH     | +300       |
| UC-039-D | Add video playback controls story | HIGH     | +200       |
| UC-039-E | Add swipe navigation play tests   | HIGH     | +150       |
| UC-039-F | Add infinite scroll loading story | MEDIUM   | +150       |

---

### UC-040: Resizable

**File:** `components/ui/resizable.tsx` (5.2K) **Status:** Needs factory &
handlers

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| UC-040-A | Add JSDoc documentation        | HIGH     | +80        |
| UC-040-B | Create `resizable.factory.ts`  | HIGH     | +200       |
| UC-040-C | Create `resizable.handlers.ts` | MEDIUM   | +150       |
| UC-040-D | Add min/max constraints story  | MEDIUM   | +100       |
| UC-040-E | Add nested panels story        | MEDIUM   | +120       |

---

### UC-041: Scroll Area

**File:** `components/ui/scroll-area.tsx` (4.4K) **Status:** Needs factory &
handlers

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| UC-041-A | Add JSDoc documentation         | HIGH     | +60        |
| UC-041-B | Create `scroll-area.factory.ts` | HIGH     | +150       |
| UC-041-C | Add virtual scrolling story     | HIGH     | +200       |
| UC-041-D | Add scroll snap story           | MEDIUM   | +100       |
| UC-041-E | Add scroll restoration story    | LOW      | +80        |

---

### UC-042: Select

**File:** `components/ui/select.tsx` (12K) **Status:** Needs play tests

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| UC-042-A | Add comprehensive JSDoc         | HIGH     | +180       |
| UC-042-B | Add async options loading story | HIGH     | +150       |
| UC-042-C | Add multi-select story          | HIGH     | +200       |
| UC-042-D | Add grouped options story       | MEDIUM   | +100       |
| UC-042-E | Add search/filter play tests    | HIGH     | +150       |

---

### UC-043: Separator

**File:** `components/ui/separator.tsx` (2.4K) **Status:** Needs factory

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| UC-043-A | Add JSDoc documentation       | HIGH     | +40        |
| UC-043-B | Create `separator.factory.ts` | MEDIUM   | +100       |
| UC-043-C | Add labeled separator story   | MEDIUM   | +60        |
| UC-043-D | Add gradient separator story  | LOW      | +50        |

---

### UC-044: Sheet

**File:** `components/ui/sheet.tsx` (9.4K) **Status:** Needs handlers & play
tests

| Task ID  | Task                                               | Priority | Est. Lines |
| -------- | -------------------------------------------------- | -------- | ---------- |
| UC-044-A | Add comprehensive JSDoc                            | HIGH     | +120       |
| UC-044-B | Create `sheet.handlers.ts`                         | HIGH     | +250       |
| UC-044-C | Add swipe-to-close play tests                      | HIGH     | +150       |
| UC-044-D | Add all positions story (top, right, bottom, left) | MEDIUM   | +150       |
| UC-044-E | Add form submission in sheet story                 | MEDIUM   | +150       |

---

### UC-045: Sidebar

**File:** `components/ui/sidebar.tsx` (33K) **Status:** Needs JSDoc expansion

| Task ID  | Task                                       | Priority | Est. Lines |
| -------- | ------------------------------------------ | -------- | ---------- |
| UC-045-A | Add comprehensive JSDoc to all 20+ exports | HIGH     | +400       |
| UC-045-B | Add collapse/expand play tests             | HIGH     | +200       |
| UC-045-C | Add mobile drawer mode story               | HIGH     | +150       |
| UC-045-D | Add nested navigation story                | MEDIUM   | +150       |
| UC-045-E | Add keyboard shortcuts story               | MEDIUM   | +100       |

---

### UC-046: Skeleton

**File:** `components/ui/skeleton.tsx` (2.2K) **Status:** Needs factory

| Task ID  | Task                                | Priority | Est. Lines |
| -------- | ----------------------------------- | -------- | ---------- |
| UC-046-A | Add JSDoc documentation             | HIGH     | +40        |
| UC-046-B | Create `skeleton.factory.ts`        | HIGH     | +200       |
| UC-046-C | Add animation variants story        | MEDIUM   | +80        |
| UC-046-D | Add card skeleton composition story | MEDIUM   | +100       |
| UC-046-E | Add table skeleton story            | MEDIUM   | +100       |

---

### UC-047: Slider

**File:** `components/ui/slider.tsx` (4.6K) **Status:** Needs factory & handlers

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| UC-047-A | Add JSDoc documentation         | HIGH     | +80        |
| UC-047-B | Create `slider.factory.ts`      | HIGH     | +200       |
| UC-047-C | Create `slider.handlers.ts`     | MEDIUM   | +150       |
| UC-047-D | Add range slider story          | HIGH     | +120       |
| UC-047-E | Add step marks story            | MEDIUM   | +100       |
| UC-047-F | Add keyboard control play tests | HIGH     | +100       |

---

### UC-048: Sonner (Toast)

**File:** `components/ui/sonner.tsx` (3.0K) **Status:** Needs factory expansion

| Task ID  | Task                                           | Priority | Est. Lines |
| -------- | ---------------------------------------------- | -------- | ---------- |
| UC-048-A | Add JSDoc documentation                        | HIGH     | +50        |
| UC-048-B | Verify `sonner.factory.ts` in feedback.factory | MEDIUM   | +100       |
| UC-048-C | Add action button toast story                  | MEDIUM   | +100       |
| UC-048-D | Add promise toast story                        | HIGH     | +120       |
| UC-048-E | Add custom styling story                       | LOW      | +80        |

---

### UC-049: Spinner

**File:** `components/ui/spinner.tsx` (1.9K) **Status:** Needs factory

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| UC-049-A | Add JSDoc documentation     | HIGH     | +40        |
| UC-049-B | Create `spinner.factory.ts` | HIGH     | +150       |
| UC-049-C | Add size variants story     | MEDIUM   | +80        |
| UC-049-D | Add color variants story    | MEDIUM   | +60        |
| UC-049-E | Add overlay spinner story   | MEDIUM   | +100       |

---

### UC-050: Switch

**File:** `components/ui/switch.tsx` (3.5K) **Status:** Needs factory & handlers

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| UC-050-A | Add JSDoc documentation         | HIGH     | +60        |
| UC-050-B | Create `switch.factory.ts`      | HIGH     | +150       |
| UC-050-C | Create `switch.handlers.ts`     | MEDIUM   | +150       |
| UC-050-D | Add form integration play tests | HIGH     | +100       |
| UC-050-E | Add labeled switch story        | MEDIUM   | +80        |

---

### UC-051: Table

**File:** `components/ui/table.tsx` (7.7K) **Status:** Needs play tests

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| UC-051-A | Add comprehensive JSDoc        | HIGH     | +120       |
| UC-051-B | Add sorting play tests         | HIGH     | +150       |
| UC-051-C | Add row selection play tests   | HIGH     | +150       |
| UC-051-D | Add column resize story        | MEDIUM   | +150       |
| UC-051-E | Add sticky header/footer story | MEDIUM   | +100       |

---

### UC-052: Tabs

**File:** `components/ui/tabs.tsx` (4.8K) **Status:** Needs factory expansion

| Task ID  | Task                                  | Priority | Est. Lines |
| -------- | ------------------------------------- | -------- | ---------- |
| UC-052-A | Add JSDoc documentation               | HIGH     | +80        |
| UC-052-B | Verify `tabs.factory.ts` completeness | MEDIUM   | +100       |
| UC-052-C | Add keyboard navigation play tests    | HIGH     | +100       |
| UC-052-D | Add vertical tabs story               | MEDIUM   | +100       |
| UC-052-E | Add closable tabs story               | MEDIUM   | +120       |

---

### UC-053: Textarea

**File:** `components/ui/textarea.tsx` (2.6K) **Status:** Needs handlers

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| UC-053-A | Add JSDoc documentation        | HIGH     | +50        |
| UC-053-B | Create `textarea.handlers.ts`  | HIGH     | +200       |
| UC-053-C | Add auto-resize story          | HIGH     | +100       |
| UC-053-D | Add character limit play tests | MEDIUM   | +80        |
| UC-053-E | Add markdown preview story     | LOW      | +150       |

---

### UC-054: Timeline

**File:** `components/ui/timeline.tsx` (11K) **Status:** Needs factory &
handlers

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| UC-054-A | Add comprehensive JSDoc       | HIGH     | +150       |
| UC-054-B | Create `timeline.factory.ts`  | HIGH     | +300       |
| UC-054-C | Create `timeline.handlers.ts` | HIGH     | +250       |
| UC-054-D | Add horizontal timeline story | MEDIUM   | +120       |
| UC-054-E | Add alternating layout story  | MEDIUM   | +100       |
| UC-054-F | Add loading more items story  | MEDIUM   | +150       |

---

### UC-055: Toast

**File:** `components/ui/toast.tsx` (8.5K) **Status:** Needs play tests

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| UC-055-A | Add comprehensive JSDoc      | HIGH     | +120       |
| UC-055-B | Add auto-dismiss play tests  | HIGH     | +100       |
| UC-055-C | Add action button play tests | HIGH     | +100       |
| UC-055-D | Add stacking behavior story  | MEDIUM   | +120       |
| UC-055-E | Add position variants story  | MEDIUM   | +100       |

---

### UC-056: Toggle Group

**File:** `components/ui/toggle-group.tsx` (4.9K) **Status:** Needs factory &
handlers

| Task ID  | Task                                     | Priority | Est. Lines |
| -------- | ---------------------------------------- | -------- | ---------- |
| UC-056-A | Add JSDoc documentation                  | HIGH     | +80        |
| UC-056-B | Create `toggle-group.factory.ts`         | HIGH     | +200       |
| UC-056-C | Add single/multiple selection play tests | HIGH     | +150       |
| UC-056-D | Add icon-only variant story              | MEDIUM   | +80        |

---

### UC-057: Toggle

**File:** `components/ui/toggle.tsx` (3.8K) **Status:** Needs factory & i18n

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| UC-057-A | Add JSDoc documentation       | HIGH     | +60        |
| UC-057-B | Create `toggle.factory.ts`    | HIGH     | +150       |
| UC-057-C | Add pressed state play tests  | HIGH     | +80        |
| UC-057-D | Expand i18n (10+ keys needed) | HIGH     | +60        |

---

### UC-058: Tooltip

**File:** `components/ui/tooltip.tsx` (5.2K) **Status:** Needs play tests

| Task ID  | Task                             | Priority | Est. Lines |
| -------- | -------------------------------- | -------- | ---------- |
| UC-058-A | Add comprehensive JSDoc          | HIGH     | +80        |
| UC-058-B | Add hover delay play tests       | HIGH     | +100       |
| UC-058-C | Add keyboard focus trigger story | MEDIUM   | +80        |
| UC-058-D | Add rich content tooltip story   | MEDIUM   | +100       |
| UC-058-E | Add arrow positioning story      | LOW      | +80        |

---

# SECTION 2: CUSTOM COMPONENTS (27 Components)

## 2.1 Root Custom Components

### CC-001: Count Animation

**File:** `components/ui/custom/count-animation.tsx` (3.1K) **Status:** Needs
handlers & i18n

| Task ID  | Task                                 | Priority | Est. Lines |
| -------- | ------------------------------------ | -------- | ---------- |
| CC-001-A | Add JSDoc documentation              | HIGH     | +60        |
| CC-001-B | Create `count-animation.handlers.ts` | MEDIUM   | +150       |
| CC-001-C | Add decimal formatting story         | MEDIUM   | +80        |
| CC-001-D | Expand i18n (10+ keys needed)        | HIGH     | +60        |
| CC-001-E | Add currency animation story         | MEDIUM   | +100       |

---

## 2.2 Minimal TipTap Components (16 Components)

### CC-002: Link Bubble Menu

**File:**
`components/ui/custom/minimal-tiptap/components/bubble-menu/link-bubble-menu.tsx`
(4.3K)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| CC-002-A | Add JSDoc documentation       | HIGH     | +80        |
| CC-002-B | Add URL validation play tests | HIGH     | +100       |
| CC-002-C | Add edit link flow story      | MEDIUM   | +120       |

---

### CC-003: Image Edit Block

**File:**
`components/ui/custom/minimal-tiptap/components/image/image-edit-block.tsx`
(3.8K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| CC-003-A | Add JSDoc documentation        | HIGH     | +60        |
| CC-003-B | Add image upload play tests    | HIGH     | +150       |
| CC-003-C | Add URL input validation story | MEDIUM   | +100       |

---

### CC-004: Image Edit Dialog

**File:**
`components/ui/custom/minimal-tiptap/components/image/image-edit-dialog.tsx`
(2.9K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| CC-004-A | Add JSDoc documentation      | HIGH     | +50        |
| CC-004-B | Add dialog submit play tests | HIGH     | +100       |
| CC-004-C | Add image preview story      | MEDIUM   | +80        |

---

### CC-005: Link Edit Block

**File:**
`components/ui/custom/minimal-tiptap/components/link/link-edit-block.tsx` (4.4K)

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| CC-005-A | Add JSDoc documentation           | HIGH     | +80        |
| CC-005-B | Add URL validation play tests     | HIGH     | +100       |
| CC-005-C | Add target="\_blank" toggle story | MEDIUM   | +60        |

---

### CC-006: Link Edit Popover

**File:**
`components/ui/custom/minimal-tiptap/components/link/link-edit-popover.tsx`
(3.6K)

| Task ID  | Task                               | Priority | Est. Lines |
| -------- | ---------------------------------- | -------- | ---------- |
| CC-006-A | Add JSDoc documentation            | HIGH     | +60        |
| CC-006-B | Add popover interaction play tests | HIGH     | +100       |

---

### CC-007: Link Popover Block

**File:**
`components/ui/custom/minimal-tiptap/components/link/link-popover-block.tsx`
(4.9K)

| Task ID  | Task                     | Priority | Est. Lines |
| -------- | ------------------------ | -------- | ---------- |
| CC-007-A | Add JSDoc documentation  | HIGH     | +80        |
| CC-007-B | Add copy link play tests | HIGH     | +80        |
| CC-007-C | Add unlink action story  | MEDIUM   | +60        |

---

### CC-008: Measured Container

**File:**
`components/ui/custom/minimal-tiptap/components/measured-container.tsx` (1.6K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| CC-008-A | Add JSDoc documentation        | HIGH     | +40        |
| CC-008-B | Add resize observer play tests | MEDIUM   | +80        |

---

### CC-009: Section One (Formatting)

**File:** `components/ui/custom/minimal-tiptap/components/section/one.tsx`
(5.6K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| CC-009-A | Add JSDoc documentation      | HIGH     | +100       |
| CC-009-B | Add format toggle play tests | HIGH     | +150       |

---

### CC-010: Section Two (Lists)

**File:** `components/ui/custom/minimal-tiptap/components/section/two.tsx`
(5.3K)

| Task ID  | Task                       | Priority | Est. Lines |
| -------- | -------------------------- | -------- | ---------- |
| CC-010-A | Add JSDoc documentation    | HIGH     | +80        |
| CC-010-B | Add list toggle play tests | HIGH     | +120       |

---

### CC-011: Section Three (Alignment)

**File:** `components/ui/custom/minimal-tiptap/components/section/three.tsx`
(8.7K)

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| CC-011-A | Add JSDoc documentation         | HIGH     | +120       |
| CC-011-B | Add alignment change play tests | HIGH     | +100       |

---

### CC-012: Section Four (Color)

**File:** `components/ui/custom/minimal-tiptap/components/section/four.tsx`
(4.0K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| CC-012-A | Add JSDoc documentation     | HIGH     | +60        |
| CC-012-B | Add color picker play tests | HIGH     | +100       |

---

### CC-013: Section Five (Insert)

**File:** `components/ui/custom/minimal-tiptap/components/section/five.tsx`
(4.5K)

| Task ID  | Task                             | Priority | Est. Lines |
| -------- | -------------------------------- | -------- | ---------- |
| CC-013-A | Add JSDoc documentation          | HIGH     | +80        |
| CC-013-B | Add insert operations play tests | HIGH     | +120       |

---

### CC-014: Shortcut Key

**File:** `components/ui/custom/minimal-tiptap/components/shortcut-key.tsx`
(1.4K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| CC-014-A | Add JSDoc documentation      | HIGH     | +30        |
| CC-014-B | Add platform detection story | MEDIUM   | +60        |

---

### CC-015: Spinner (TipTap)

**File:** `components/ui/custom/minimal-tiptap/components/spinner.tsx` (1.2K)

| Task ID  | Task                    | Priority | Est. Lines |
| -------- | ----------------------- | -------- | ---------- |
| CC-015-A | Add JSDoc documentation | HIGH     | +25        |
| CC-015-B | Add loading state story | LOW      | +50        |

---

### CC-016: Toolbar Button

**File:** `components/ui/custom/minimal-tiptap/components/toolbar-button.tsx`
(1.7K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| CC-016-A | Add JSDoc documentation     | HIGH     | +40        |
| CC-016-B | Add active state play tests | MEDIUM   | +80        |

---

### CC-017: Toolbar Section

**File:** `components/ui/custom/minimal-tiptap/components/toolbar-section.tsx`
(4.7K)

| Task ID  | Task                             | Priority | Est. Lines |
| -------- | -------------------------------- | -------- | ---------- |
| CC-017-A | Add JSDoc documentation          | HIGH     | +80        |
| CC-017-B | Add dropdown behavior play tests | HIGH     | +100       |

---

### CC-018: Minimal TipTap (Main)

**File:** `components/ui/custom/minimal-tiptap/minimal-tiptap.tsx` (5.4K)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| CC-018-A | Add comprehensive JSDoc       | HIGH     | +100       |
| CC-018-B | Add content change play tests | HIGH     | +150       |
| CC-018-C | Add readonly mode story       | MEDIUM   | +80        |
| CC-018-D | Add placeholder story         | MEDIUM   | +60        |

---

## 2.3 Prompt Components (8 Components)

### CC-019: Chat Container

**File:** `components/ui/custom/prompt/chat-container.tsx` (9.6K)

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| CC-019-A | Add comprehensive JSDoc           | HIGH     | +150       |
| CC-019-B | Create `chat.handlers.ts`         | HIGH     | +300       |
| CC-019-C | Add message submission play tests | HIGH     | +200       |
| CC-019-D | Add scroll behavior story         | MEDIUM   | +100       |
| CC-019-E | Add i18n keys                     | HIGH     | +80        |

---

### CC-020: Code Block

**File:** `components/ui/custom/prompt/code-block.tsx` (6.4K)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| CC-020-A | Add JSDoc documentation       | HIGH     | +100       |
| CC-020-B | Add syntax highlighting story | HIGH     | +150       |
| CC-020-C | Add copy button play tests    | HIGH     | +100       |
| CC-020-D | Expand i18n (8+ keys needed)  | HIGH     | +50        |

---

### CC-021: Prompt Input

**File:** `components/ui/custom/prompt/input.tsx` (9.5K)

| Task ID  | Task                                         | Priority | Est. Lines |
| -------- | -------------------------------------------- | -------- | ---------- |
| CC-021-A | Add comprehensive JSDoc                      | HIGH     | +150       |
| CC-021-B | Add submit key play tests (Enter, Cmd+Enter) | HIGH     | +150       |
| CC-021-C | Add file attachment story                    | MEDIUM   | +120       |
| CC-021-D | Add i18n keys                                | HIGH     | +60        |

---

### CC-022: Loader

**File:** `components/ui/custom/prompt/loader.tsx` (19K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| CC-022-A | Add comprehensive JSDoc      | HIGH     | +200       |
| CC-022-B | Add animation variants story | MEDIUM   | +150       |
| CC-022-C | Add typing indicator story   | MEDIUM   | +100       |
| CC-022-D | Expand i18n (5+ keys needed) | HIGH     | +40        |

---

### CC-023: Markdown

**File:** `components/ui/custom/prompt/markdown.tsx` (4.6K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| CC-023-A | Add JSDoc documentation        | HIGH     | +80        |
| CC-023-B | Add code block rendering story | HIGH     | +100       |
| CC-023-C | Add table rendering story      | MEDIUM   | +80        |
| CC-023-D | Add i18n keys                  | HIGH     | +40        |

---

### CC-024: Message

**File:** `components/ui/custom/prompt/message.tsx` (7.5K)

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| CC-024-A | Add comprehensive JSDoc           | HIGH     | +120       |
| CC-024-B | Add message actions play tests    | HIGH     | +150       |
| CC-024-C | Add user/assistant variants story | MEDIUM   | +100       |
| CC-024-D | Add i18n keys                     | HIGH     | +60        |

---

### CC-025: Scroll Button

**File:** `components/ui/custom/prompt/scroll-button.tsx` (4.2K)

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| CC-025-A | Add JSDoc documentation         | HIGH     | +60        |
| CC-025-B | Add scroll-to-bottom play tests | HIGH     | +80        |
| CC-025-C | Expand i18n (6+ keys needed)    | HIGH     | +40        |

---

### CC-026: Suggestion

**File:** `components/ui/custom/prompt/suggestion.tsx` (4.4K)

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| CC-026-A | Add JSDoc documentation         | HIGH     | +80        |
| CC-026-B | Add suggestion click play tests | HIGH     | +100       |
| CC-026-C | Add keyboard navigation story   | MEDIUM   | +80        |
| CC-026-D | Add i18n keys                   | HIGH     | +50        |

---

# SECTION 3: LAYOUT COMPONENTS (10 Components)

### LC-001: Site Header

**File:** `components/layout/header/index.tsx` (3.5K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| LC-001-A | Add JSDoc documentation     | HIGH     | +60        |
| LC-001-B | Add mobile responsive story | HIGH     | +100       |
| LC-001-C | Add sticky header story     | MEDIUM   | +80        |

---

### LC-002: Header Notifications

**File:** `components/layout/header/notifications.tsx` (6.4K)

| Task ID  | Task                                | Priority | Est. Lines |
| -------- | ----------------------------------- | -------- | ---------- |
| LC-002-A | Add JSDoc documentation             | HIGH     | +100       |
| LC-002-B | Add notification actions play tests | HIGH     | +150       |
| LC-002-C | Add empty state story               | MEDIUM   | +80        |
| LC-002-D | Expand i18n (12+ keys needed)       | HIGH     | +80        |

---

### LC-003: Header Search

**File:** `components/layout/header/search.tsx` (5.4K)

| Task ID  | Task                               | Priority | Est. Lines |
| -------- | ---------------------------------- | -------- | ---------- |
| LC-003-A | Add JSDoc documentation            | HIGH     | +80        |
| LC-003-B | Add search submit play tests       | HIGH     | +100       |
| LC-003-C | Add command palette shortcut story | MEDIUM   | +80        |

---

### LC-004: Theme Switch

**File:** `components/layout/header/theme-switch.tsx` (2.4K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| LC-004-A | Add JSDoc documentation      | HIGH     | +40        |
| LC-004-B | Add theme toggle play tests  | HIGH     | +80        |
| LC-004-C | Expand i18n (5+ keys needed) | HIGH     | +40        |

---

### LC-005: User Menu

**File:** `components/layout/header/user-menu.tsx` (6.4K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| LC-005-A | Add JSDoc documentation        | HIGH     | +100       |
| LC-005-B | Add menu navigation play tests | HIGH     | +120       |
| LC-005-C | Add logout confirmation story  | MEDIUM   | +100       |

---

### LC-006: Logo

**File:** `components/layout/logo.tsx` (1.5K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| LC-006-A | Add JSDoc documentation      | HIGH     | +30        |
| LC-006-B | Expand i18n (5+ keys needed) | HIGH     | +40        |
| LC-006-C | Add size variants story      | LOW      | +60        |

---

### LC-007: App Sidebar

**File:** `components/layout/sidebar/app-sidebar.tsx` (8.0K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| LC-007-A | Add comprehensive JSDoc        | HIGH     | +120       |
| LC-007-B | Add collapse/expand play tests | HIGH     | +150       |
| LC-007-C | Add mobile drawer story        | HIGH     | +100       |
| LC-007-D | Add dark mode variant          | MEDIUM   | +80        |

---

### LC-008: Nav Main

**File:** `components/layout/sidebar/nav-main.tsx` (18K)

| Task ID  | Task                               | Priority | Est. Lines |
| -------- | ---------------------------------- | -------- | ---------- |
| LC-008-A | Add comprehensive JSDoc            | HIGH     | +200       |
| LC-008-B | Add keyboard navigation play tests | HIGH     | +200       |
| LC-008-C | Add nested navigation story        | HIGH     | +150       |
| LC-008-D | Add badge indicators story         | MEDIUM   | +100       |

---

### LC-009: Nav User

**File:** `components/layout/sidebar/nav-user.tsx` (5.4K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| LC-009-A | Add JSDoc documentation      | HIGH     | +80        |
| LC-009-B | Add dropdown menu play tests | HIGH     | +100       |
| LC-009-C | Add avatar loading story     | MEDIUM   | +80        |

---

### LC-010: Header Data

**File:** `components/layout/header/data.ts` (3.5K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| LC-010-A | Expand i18n (8+ keys needed) | HIGH     | +60        |
| LC-010-B | Add type documentation       | MEDIUM   | +40        |

---

# SECTION 4: THEME CUSTOMIZER (9 Components)

### TC-001: Panel

**File:** `components/theme-customizer/panel.tsx` (4.0K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| TC-001-A | Add JSDoc documentation      | HIGH     | +80        |
| TC-001-B | Add panel toggle play tests  | HIGH     | +100       |
| TC-001-C | Expand i18n (8+ keys needed) | HIGH     | +60        |

---

### TC-002: Color Mode Selector

**File:** `components/theme-customizer/color-mode-selector.tsx` (2.9K)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| TC-002-A | Add JSDoc documentation       | HIGH     | +50        |
| TC-002-B | Add mode selection play tests | HIGH     | +100       |
| TC-002-C | Add dark mode variant         | MEDIUM   | +60        |

---

### TC-003: Content Layout Selector

**File:** `components/theme-customizer/content-layout-selector.tsx` (3.2K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| TC-003-A | Add JSDoc documentation      | HIGH     | +60        |
| TC-003-B | Add layout change play tests | HIGH     | +100       |
| TC-003-C | Add preview thumbnails story | MEDIUM   | +80        |

---

### TC-004: Preset Selector

**File:** `components/theme-customizer/preset-selector.tsx` (3.2K)

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| TC-004-A | Add JSDoc documentation           | HIGH     | +60        |
| TC-004-B | Add preset application play tests | HIGH     | +100       |
| TC-004-C | Add color preview swatches story  | MEDIUM   | +80        |

---

### TC-005: Radius Selector

**File:** `components/theme-customizer/radius-selector.tsx` (4.1K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| TC-005-A | Add JSDoc documentation      | HIGH     | +60        |
| TC-005-B | Add radius change play tests | HIGH     | +100       |
| TC-005-C | Add preview component story  | MEDIUM   | +80        |

---

### TC-006: Scale Selector

**File:** `components/theme-customizer/scale-selector.tsx` (3.6K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| TC-006-A | Add JSDoc documentation      | HIGH     | +60        |
| TC-006-B | Add scale slider play tests  | HIGH     | +100       |
| TC-006-C | Add accessibility zoom story | MEDIUM   | +80        |

---

### TC-007: Sidebar Mode Selector

**File:** `components/theme-customizer/sidebar-mode-selector.tsx` (3.0K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| TC-007-A | Add JSDoc documentation     | HIGH     | +50        |
| TC-007-B | Add mode toggle play tests  | HIGH     | +100       |
| TC-007-C | Add preview animation story | MEDIUM   | +80        |

---

### TC-008: Reset Theme

**File:** `components/theme-customizer/reset-theme.tsx` (2.0K)

| Task ID  | Task                               | Priority | Est. Lines |
| -------- | ---------------------------------- | -------- | ---------- |
| TC-008-A | Add JSDoc documentation            | HIGH     | +40        |
| TC-008-B | Add confirmation dialog play tests | HIGH     | +80        |
| TC-008-C | Expand i18n (5+ keys needed)       | HIGH     | +40        |

---

# SECTION 5: DASHBOARD PAGES (65 Pages)

## 5.1 Academy Dashboard

### DP-001: Academy Page

**File:** `app/dashboard/(auth)/academy/page.tsx` (1.5K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| DP-001-A | Create story file            | HIGH     | +150       |
| DP-001-B | Add play tests for page load | HIGH     | +100       |
| DP-001-C | Add loading skeleton story   | MEDIUM   | +80        |

---

### DP-002: Chart Most Activity

**File:** `app/dashboard/(auth)/academy/components/chart-most-activity.tsx`
(2.2K)

| Task ID  | Task                   | Priority | Est. Lines |
| -------- | ---------------------- | -------- | ---------- |
| DP-002-A | Create story file      | HIGH     | +100       |
| DP-002-B | Add data loading story | MEDIUM   | +80        |

---

### DP-003: Course Progress

**File:** `app/dashboard/(auth)/academy/components/course-progress-by-month.tsx`
(2.6K)

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| DP-003-A | Create story file               | HIGH     | +100       |
| DP-003-B | Add month navigation play tests | MEDIUM   | +80        |

---

### DP-004: Courses List

**File:** `app/dashboard/(auth)/academy/components/courses-list.tsx` (7.4K)

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| DP-004-A | Create story file               | HIGH     | +150       |
| DP-004-B | Add course selection play tests | HIGH     | +120       |
| DP-004-C | Add filter/search story         | MEDIUM   | +100       |

---

## 5.2 Apps

### DP-005: AI Chat

**File:** `app/dashboard/(auth)/apps/ai-chat/page.tsx` (641B)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| DP-005-A | Create story file            | HIGH     | +150       |
| DP-005-B | Add message send play tests  | HIGH     | +200       |
| DP-005-C | Add streaming response story | HIGH     | +150       |

---

### DP-006: AI Chat V2

**File:** `app/dashboard/(auth)/apps/ai-chat-v2/page.tsx` (814B)

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| DP-006-A | Create story file                 | HIGH     | +150       |
| DP-006-B | Add sidebar navigation play tests | HIGH     | +120       |
| DP-006-C | Add upgrade modal story           | MEDIUM   | +100       |

---

### DP-007: AI Image Generator

**File:** `app/dashboard/(auth)/apps/ai-image-generator/page.tsx` (571B)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| DP-007-A | Create story file              | HIGH     | +150       |
| DP-007-B | Add generation form play tests | HIGH     | +150       |
| DP-007-C | Add gallery view story         | MEDIUM   | +120       |

---

### DP-008: API Keys

**File:** `app/dashboard/(auth)/apps/api-keys/page.tsx` (1.5K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| DP-008-A | Create story file           | HIGH     | +150       |
| DP-008-B | Add key creation play tests | HIGH     | +150       |
| DP-008-C | Add key revocation story    | HIGH     | +100       |

---

### DP-009: Calendar

**File:** `app/dashboard/(auth)/apps/calendar/page.tsx` (530B)

| Task ID  | Task                      | Priority | Est. Lines |
| -------- | ------------------------- | -------- | ---------- |
| DP-009-A | Create story file         | HIGH     | +200       |
| DP-009-B | Add event CRUD play tests | HIGH     | +250       |
| DP-009-C | Add drag-and-drop story   | HIGH     | +200       |
| DP-009-D | Add view switching story  | MEDIUM   | +150       |

---

### DP-010: Chat

**File:** `app/dashboard/(auth)/apps/chat/page.tsx` (1.5K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| DP-010-A | Create story file           | HIGH     | +200       |
| DP-010-B | Add message send play tests | HIGH     | +150       |
| DP-010-C | Add contact selection story | MEDIUM   | +120       |
| DP-010-D | Add call dialog story       | MEDIUM   | +100       |

---

### DP-011: Courses

**File:** `app/dashboard/(auth)/apps/courses/page.tsx` (2.1K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| DP-011-A | Create story file           | HIGH     | +150       |
| DP-011-B | Add course enrollment story | MEDIUM   | +100       |

---

### DP-012: File Manager

**File:** `app/dashboard/(auth)/apps/file-manager/page.tsx` (482B)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| DP-012-A | Create story file           | HIGH     | +200       |
| DP-012-B | Add file upload play tests  | HIGH     | +150       |
| DP-012-C | Add folder navigation story | HIGH     | +150       |
| DP-012-D | Add pagination story        | MEDIUM   | +100       |

---

### DP-013: Kanban

**File:** `app/dashboard/(auth)/apps/kanban/page.tsx` (469B)

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| DP-013-A | Create story file                 | HIGH     | +200       |
| DP-013-B | Add card drag-and-drop play tests | HIGH     | +200       |
| DP-013-C | Add column CRUD story             | HIGH     | +150       |
| DP-013-D | Add assignee management story     | MEDIUM   | +120       |

---

### DP-014: Mail

**File:** `app/dashboard/(auth)/apps/mail/page.tsx` (1.1K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| DP-014-A | Create story file              | HIGH     | +200       |
| DP-014-B | Add email selection play tests | HIGH     | +150       |
| DP-014-C | Add compose dialog story       | HIGH     | +150       |
| DP-014-D | Add folder navigation story    | MEDIUM   | +120       |

---

### DP-015: Notes

**File:** `app/dashboard/(auth)/apps/notes/page.tsx` (432B)

| Task ID  | Task                       | Priority | Est. Lines |
| -------- | -------------------------- | -------- | ---------- |
| DP-015-A | Create story file          | HIGH     | +150       |
| DP-015-B | Add note CRUD play tests   | HIGH     | +150       |
| DP-015-C | Add label management story | MEDIUM   | +100       |

---

### DP-016: POS System

**File:** `app/dashboard/(auth)/apps/pos-system/page.tsx` (2.0K)

| Task ID  | Task                             | Priority | Est. Lines |
| -------- | -------------------------------- | -------- | ---------- |
| DP-016-A | Create story file                | HIGH     | +200       |
| DP-016-B | Add product selection play tests | HIGH     | +150       |
| DP-016-C | Add cart management story        | HIGH     | +150       |
| DP-016-D | Add table assignment story       | MEDIUM   | +120       |

---

### DP-017: POS Tables

**File:** `app/dashboard/(auth)/apps/pos-system/tables/page.tsx` (1.3K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| DP-017-A | Create story file              | HIGH     | +150       |
| DP-017-B | Add table selection play tests | HIGH     | +100       |
| DP-017-C | Add order detail dialog story  | MEDIUM   | +120       |

---

### DP-018: Social Media

**File:** `app/dashboard/(auth)/apps/social-media/page.tsx` (1.6K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| DP-018-A | Create story file            | HIGH     | +200       |
| DP-018-B | Add post creation play tests | HIGH     | +150       |
| DP-018-C | Add story carousel story     | MEDIUM   | +120       |
| DP-018-D | Add sidebar navigation story | MEDIUM   | +100       |

---

### DP-019: Tasks

**File:** `app/dashboard/(auth)/apps/tasks/page.tsx` (893B)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| DP-019-A | Create story file             | HIGH     | +200       |
| DP-019-B | Add task filtering play tests | HIGH     | +150       |
| DP-019-C | Add column sorting story      | HIGH     | +120       |
| DP-019-D | Add row actions story         | MEDIUM   | +100       |

---

### DP-020: Text to Speech

**File:** `app/dashboard/(auth)/apps/text-to-speech/page.tsx` (2.1K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| DP-020-A | Create story file              | HIGH     | +150       |
| DP-020-B | Add voice selection play tests | MEDIUM   | +100       |
| DP-020-C | Add playback controls story    | MEDIUM   | +120       |

---

### DP-021: Todo List

**File:** `app/dashboard/(auth)/apps/todo-list-app/page.tsx` (855B)

| Task ID  | Task                       | Priority | Est. Lines |
| -------- | -------------------------- | -------- | ---------- |
| DP-021-A | Create story file          | HIGH     | +200       |
| DP-021-B | Add todo CRUD play tests   | HIGH     | +200       |
| DP-021-C | Add status filtering story | HIGH     | +120       |
| DP-021-D | Add detail sheet story     | MEDIUM   | +120       |

---

## 5.3 CRM Dashboard

### DP-022: CRM Page

**File:** `app/dashboard/(auth)/crm/page.tsx` (1.5K)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| DP-022-A | Create story file             | HIGH     | +200       |
| DP-022-B | Add metric card loading story | MEDIUM   | +100       |
| DP-022-C | Add leads table play tests    | HIGH     | +150       |

---

## 5.4 Crypto Dashboard

### DP-023: Crypto Page

**File:** `app/dashboard/(auth)/crypto/page.tsx` (1.6K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| DP-023-A | Create story file           | HIGH     | +200       |
| DP-023-B | Add trading card play tests | HIGH     | +150       |
| DP-023-C | Add wallet balance story    | MEDIUM   | +100       |

---

## 5.5 Default Dashboard

### DP-024: Default Page

**File:** `app/dashboard/(auth)/default/page.tsx` (1.6K)

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| DP-024-A | Create story file                 | HIGH     | +200       |
| DP-024-B | Add widget interaction play tests | HIGH     | +150       |
| DP-024-C | Add chat widget story             | MEDIUM   | +120       |

---

## 5.6 Ecommerce Dashboard

### DP-025: Ecommerce Page

**File:** `app/dashboard/(auth)/ecommerce/page.tsx` (2.2K)

| Task ID  | Task                       | Priority | Est. Lines |
| -------- | -------------------------- | -------- | ---------- |
| DP-025-A | Create story file          | HIGH     | +250       |
| DP-025-B | Add order table play tests | HIGH     | +150       |
| DP-025-C | Add product list story     | HIGH     | +150       |
| DP-025-D | Add revenue chart story    | MEDIUM   | +120       |

---

## 5.7 File Manager Dashboard

### DP-026: File Manager Dashboard

**File:** `app/dashboard/(auth)/file-manager/page.tsx` (1.2K)

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| DP-026-A | Create story file            | HIGH     | +150       |
| DP-026-B | Add upload dialog play tests | HIGH     | +120       |
| DP-026-C | Add folder cards story       | MEDIUM   | +100       |

---

## 5.8 Finance Dashboard

### DP-027: Finance Page

**File:** `app/dashboard/(auth)/finance/page.tsx` (1.7K)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| DP-027-A | Create story file             | HIGH     | +200       |
| DP-027-B | Add wallet card play tests    | HIGH     | +150       |
| DP-027-C | Add transaction history story | MEDIUM   | +120       |

---

## 5.9 Hospital Management Dashboard

### DP-028: Hospital Page

**File:** `app/dashboard/(auth)/hospital-management/page.tsx` (2.7K)

| Task ID  | Task                                | Priority | Est. Lines |
| -------- | ----------------------------------- | -------- | ---------- |
| DP-028-A | Create story file                   | HIGH     | +250       |
| DP-028-B | Add appointment calendar play tests | HIGH     | +200       |
| DP-028-C | Add patient list story              | HIGH     | +150       |
| DP-028-D | Add reports card story              | MEDIUM   | +120       |

---

## 5.10 Hotel Dashboard

### DP-029: Hotel Page

**File:** `app/dashboard/(auth)/hotel/page.tsx` (1.9K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| DP-029-A | Create story file           | HIGH     | +200       |
| DP-029-B | Add booking list play tests | HIGH     | +150       |
| DP-029-C | Add revenue stats story     | MEDIUM   | +120       |

---

### DP-030: Hotel Bookings

**File:** `app/dashboard/(auth)/hotel/bookings/page.tsx` (565B)

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| DP-030-A | Create story file               | HIGH     | +200       |
| DP-030-B | Add booking form play tests     | HIGH     | +200       |
| DP-030-C | Add meeting room schedule story | HIGH     | +150       |

---

## 5.11 Payment Dashboard

### DP-031: Payment Page

**File:** `app/dashboard/(auth)/payment/page.tsx` (879B)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| DP-031-A | Create story file             | HIGH     | +150       |
| DP-031-B | Add balance overview story    | MEDIUM   | +100       |
| DP-031-C | Add exchange rates play tests | HIGH     | +120       |

---

### DP-032: Payment Transactions

**File:** `app/dashboard/(auth)/payment/transactions/page.tsx` (4.6K)

| Task ID  | Task                                 | Priority | Est. Lines |
| -------- | ------------------------------------ | -------- | ---------- |
| DP-032-A | Create story file                    | HIGH     | +200       |
| DP-032-B | Add transaction filtering play tests | HIGH     | +150       |
| DP-032-C | Add export functionality story       | MEDIUM   | +100       |

---

## 5.12 Project Management Dashboard

### DP-033: Project List

**File:** `app/dashboard/(auth)/project-list/page.tsx` (3.0K)

| Task ID  | Task                             | Priority | Est. Lines |
| -------- | -------------------------------- | -------- | ---------- |
| DP-033-A | Create story file                | HIGH     | +200       |
| DP-033-B | Add project filtering play tests | HIGH     | +150       |
| DP-033-C | Add card/list view toggle story  | MEDIUM   | +100       |

---

### DP-034: Project Management

**File:** `app/dashboard/(auth)/project-management/page.tsx` (2.2K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| DP-034-A | Create story file              | HIGH     | +250       |
| DP-034-B | Add reminder dialog play tests | HIGH     | +150       |
| DP-034-C | Add reports table story        | HIGH     | +150       |
| DP-034-D | Add chart interactions story   | MEDIUM   | +120       |

---

## 5.13 Sales Dashboard

### DP-035: Sales Page

**File:** `app/dashboard/(auth)/sales/page.tsx` (1.9K)

| Task ID  | Task                       | Priority | Est. Lines |
| -------- | -------------------------- | -------- | ---------- |
| DP-035-A | Create story file          | HIGH     | +200       |
| DP-035-B | Add order table play tests | HIGH     | +150       |
| DP-035-C | Add revenue chart story    | MEDIUM   | +120       |

---

## 5.14 Website Analytics Dashboard

### DP-036: Analytics Page

**File:** `app/dashboard/(auth)/website-analytics/page.tsx` (2.2K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| DP-036-A | Create story file              | HIGH     | +250       |
| DP-036-B | Add earnings report play tests | HIGH     | +150       |
| DP-036-C | Add sales by country story     | MEDIUM   | +120       |
| DP-036-D | Add ticket card story          | MEDIUM   | +100       |

---

## 5.15 Widgets

### DP-037: Analytics Widgets

**File:** `app/dashboard/(auth)/widgets/analytics/page.tsx` (535B)

| Task ID  | Task                      | Priority | Est. Lines |
| -------- | ------------------------- | -------- | ---------- |
| DP-037-A | Create story file         | HIGH     | +150       |
| DP-037-B | Add widget showcase story | MEDIUM   | +100       |

---

### DP-038: Ecommerce Widgets

**File:** `app/dashboard/(auth)/widgets/ecommerce/page.tsx` (554B)

| Task ID  | Task                      | Priority | Est. Lines |
| -------- | ------------------------- | -------- | ---------- |
| DP-038-A | Create story file         | HIGH     | +150       |
| DP-038-B | Add widget showcase story | MEDIUM   | +100       |

---

### DP-039: Fitness Widgets

**File:** `app/dashboard/(auth)/widgets/fitness/page.tsx` (1.7K)

| Task ID  | Task                        | Priority | Est. Lines |
| -------- | --------------------------- | -------- | ---------- |
| DP-039-A | Create story file           | HIGH     | +200       |
| DP-039-B | Add fitness card play tests | HIGH     | +150       |
| DP-039-C | Add activity chart story    | MEDIUM   | +120       |

---

## 5.16 Logistics

### DP-040: Logistics Page

**File:** `app/dashboard/(auth)/logistics/page.tsx` (1.7K)

| Task ID  | Task                    | Priority | Est. Lines |
| -------- | ----------------------- | -------- | ---------- |
| DP-040-A | Create story file       | HIGH     | +150       |
| DP-040-B | Add tracking map story  | MEDIUM   | +150       |
| DP-040-C | Add shipment list story | MEDIUM   | +120       |

---

# SECTION 6: AUTH PAGES (5 Pages)

### AP-001: Forgot Password

**File:** `app/dashboard/(guest)/forgot-password/page.tsx` (3.4K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| AP-001-A | Create story file              | HIGH     | +150       |
| AP-001-B | Add form submission play tests | HIGH     | +150       |
| AP-001-C | Add validation error story     | HIGH     | +100       |
| AP-001-D | Add success state story        | MEDIUM   | +80        |

---

### AP-002: Login V1

**File:** `app/dashboard/(guest)/login/v1/page.tsx` (4.6K)

| Task ID  | Task                                | Priority | Est. Lines |
| -------- | ----------------------------------- | -------- | ---------- |
| AP-002-A | Create story file                   | HIGH     | +200       |
| AP-002-B | Add login form play tests           | HIGH     | +200       |
| AP-002-C | Add social login buttons story      | MEDIUM   | +100       |
| AP-002-D | Add error states story              | HIGH     | +120       |
| AP-002-E | Add remember me functionality story | MEDIUM   | +80        |

---

### AP-003: Login V2

**File:** `app/dashboard/(guest)/login/v2/page.tsx` (3.7K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| AP-003-A | Create story file              | HIGH     | +150       |
| AP-003-B | Add split layout story         | MEDIUM   | +100       |
| AP-003-C | Add form validation play tests | HIGH     | +150       |

---

### AP-004: Register V1

**File:** `app/dashboard/(guest)/register/v1/page.tsx` (5.0K)

| Task ID  | Task                                  | Priority | Est. Lines |
| -------- | ------------------------------------- | -------- | ---------- |
| AP-004-A | Create story file                     | HIGH     | +200       |
| AP-004-B | Add registration flow play tests      | HIGH     | +200       |
| AP-004-C | Add password strength indicator story | HIGH     | +100       |
| AP-004-D | Add terms acceptance story            | MEDIUM   | +80        |

---

### AP-005: Register V2

**File:** `app/dashboard/(guest)/register/v2/page.tsx` (4.0K)

| Task ID  | Task                           | Priority | Est. Lines |
| -------- | ------------------------------ | -------- | ---------- |
| AP-005-A | Create story file              | HIGH     | +150       |
| AP-005-B | Add split layout story         | MEDIUM   | +100       |
| AP-005-C | Add form validation play tests | HIGH     | +150       |

---

# SECTION 7: GLOBAL COMPONENTS (5 Components)

### GC-001: Active Theme

**File:** `components/active-theme.tsx` (5.5K)

| Task ID  | Task                                 | Priority | Est. Lines |
| -------- | ------------------------------------ | -------- | ---------- |
| GC-001-A | Add JSDoc documentation              | HIGH     | +80        |
| GC-001-B | Create story file                    | HIGH     | +100       |
| GC-001-C | Add theme provider integration story | MEDIUM   | +80        |

---

### GC-002: Card Action Menus

**File:** `components/CardActionMenus.tsx` (3.2K)

| Task ID  | Task                       | Priority | Est. Lines |
| -------- | -------------------------- | -------- | ---------- |
| GC-002-A | Add JSDoc documentation    | HIGH     | +60        |
| GC-002-B | Create story file          | HIGH     | +100       |
| GC-002-C | Add menu action play tests | HIGH     | +80        |

---

### GC-003: Custom Date Range Picker

**File:** `components/custom-date-range-picker.tsx` (12K)

| Task ID  | Task                                | Priority | Est. Lines |
| -------- | ----------------------------------- | -------- | ---------- |
| GC-003-A | Add comprehensive JSDoc             | HIGH     | +150       |
| GC-003-B | Create story file                   | HIGH     | +200       |
| GC-003-C | Add date range selection play tests | HIGH     | +200       |
| GC-003-D | Add preset ranges story             | MEDIUM   | +100       |

---

### GC-004: Date Time Picker

**File:** `components/date-time-picker.tsx` (7.2K)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| GC-004-A | Add comprehensive JSDoc       | HIGH     | +120       |
| GC-004-B | Create story file             | HIGH     | +150       |
| GC-004-C | Add time selection play tests | HIGH     | +150       |
| GC-004-D | Add 12/24 hour format story   | MEDIUM   | +80        |

---

### GC-005: Icon

**File:** `components/icon.tsx` (2.4K)

| Task ID  | Task                          | Priority | Est. Lines |
| -------- | ----------------------------- | -------- | ---------- |
| GC-005-A | Add JSDoc documentation       | HIGH     | +50        |
| GC-005-B | Create story file             | HIGH     | +150       |
| GC-005-C | Add icon gallery story        | MEDIUM   | +100       |
| GC-005-D | Add size/color variants story | MEDIUM   | +80        |

---

# SUMMARY STATISTICS

## Total Tasks by Section

| Section           | Components | Tasks   | Est. Lines  |
| ----------------- | ---------- | ------- | ----------- |
| UI Components     | 58         | 290     | ~29,000     |
| Custom Components | 27         | 108     | ~8,500      |
| Layout Components | 10         | 50      | ~4,000      |
| Theme Customizer  | 9          | 36      | ~3,000      |
| Dashboard Pages   | 40         | 200     | ~20,000     |
| Auth Pages        | 5          | 25      | ~2,500      |
| Global Components | 5          | 25      | ~2,000      |
| **TOTAL**         | **154**    | **734** | **~69,000** |

## Priority Distribution

| Priority | Task Count | Percentage |
| -------- | ---------- | ---------- |
| HIGH     | 450        | 61%        |
| MEDIUM   | 234        | 32%        |
| LOW      | 50         | 7%         |

## Task Type Distribution

| Type                  | Count |
| --------------------- | ----- |
| JSDoc Documentation   | 154   |
| Factory Files         | 45    |
| Handler Files         | 38    |
| Play Tests            | 180   |
| Story Variants        | 150   |
| i18n Expansion        | 35    |
| Dark Mode Stories     | 80    |
| Accessibility Stories | 52    |

---

# EXECUTION WORKFLOW

## Phase 1: Foundation (Week 1-2)

- Complete all JSDoc documentation tasks (UC-\*-A)
- Create missing factory files
- Create missing handler files

## Phase 2: Core Stories (Week 3-4)

- Add play tests to all UI components
- Add dark mode variants
- Add RTL support stories

## Phase 3: Page Stories (Week 5-6)

- Create all dashboard page stories
- Add page-level play tests
- Add loading state stories

## Phase 4: Polish (Week 7-8)

- Complete i18n expansion
- Add accessibility stories
- Add edge case stories

## Verification Checklist

For each component/page:

- [ ] JSDoc complete with @example
- [ ] Factory file exists with matrix factories
- [ ] Handler file exists with full HTTP status coverage
- [ ] Story file has autodocs tag
- [ ] Play tests cover primary interactions
- [ ] Dark mode variant exists
- [ ] i18n keys comprehensive
- [ ] RTL support verified

---

# SECTION 8: INFRASTRUCTURE TASKS

## 8.1 Missing Factory Files (13 Files)

### MF-001: Create command.factory.ts

**Target:** Command component

| Task ID  | Task                                             | Priority | Est. Lines |
| -------- | ------------------------------------------------ | -------- | ---------- |
| MF-001-A | Define CommandItem, CommandGroup types           | HIGH     | +50        |
| MF-001-B | Create createFakeCommandItem function            | HIGH     | +60        |
| MF-001-C | Create createFakeCommandPalette (full structure) | HIGH     | +100       |
| MF-001-D | Export COMMAND_CATEGORIES constant               | MEDIUM   | +30        |

---

### MF-002: Create kbd.factory.ts

**Target:** Kbd component

| Task ID  | Task                                   | Priority | Est. Lines |
| -------- | -------------------------------------- | -------- | ---------- |
| MF-002-A | Define KbdVariant, KbdSize types       | HIGH     | +30        |
| MF-002-B | Create createFakeKbd function          | HIGH     | +40        |
| MF-002-C | Create createFakeShortcut (combo keys) | HIGH     | +50        |
| MF-002-D | Export COMMON_SHORTCUTS constant       | MEDIUM   | +40        |

---

### MF-003: Create menubar.factory.ts

**Target:** Menubar component

| Task ID  | Task                                             | Priority | Est. Lines |
| -------- | ------------------------------------------------ | -------- | ---------- |
| MF-003-A | Define MenubarItem, MenubarMenu types            | HIGH     | +60        |
| MF-003-B | Create createFakeMenubarItem function            | HIGH     | +80        |
| MF-003-C | Create createFakeMenubar (full menu structure)   | HIGH     | +120       |
| MF-003-D | Export FILE_MENU, EDIT_MENU, VIEW_MENU constants | MEDIUM   | +80        |

---

### MF-004: Create navigation-menu.factory.ts

**Target:** Navigation Menu component

| Task ID  | Task                                                   | Priority | Est. Lines |
| -------- | ------------------------------------------------------ | -------- | ---------- |
| MF-004-A | Define NavigationMenuItem, NavigationMenuSection types | HIGH     | +50        |
| MF-004-B | Create createFakeNavigationMenu function               | HIGH     | +100       |
| MF-004-C | Create createFakeNavigationMenuItems                   | HIGH     | +80        |
| MF-004-D | Export MAIN_NAV, FOOTER_NAV constants                  | MEDIUM   | +60        |

---

### MF-005: Create native-select.factory.ts

**Target:** Native Select component

| Task ID  | Task                                               | Priority | Est. Lines |
| -------- | -------------------------------------------------- | -------- | ---------- |
| MF-005-A | Define NativeSelectOption, NativeSelectSize types  | HIGH     | +30        |
| MF-005-B | Create createFakeNativeSelect function             | HIGH     | +50        |
| MF-005-C | Create createFakeNativeSelectOptions               | HIGH     | +60        |
| MF-005-D | Export COUNTRY_OPTIONS, CATEGORY_OPTIONS constants | MEDIUM   | +80        |

---

### MF-006: Create pagination.factory.ts

**Target:** Pagination component

| Task ID  | Task                                           | Priority | Est. Lines |
| -------- | ---------------------------------------------- | -------- | ---------- |
| MF-006-A | Define PaginationConfig, PaginationState types | HIGH     | +40        |
| MF-006-B | Create createFakePagination function           | HIGH     | +60        |
| MF-006-C | Create createFakePaginationRange               | HIGH     | +50        |
| MF-006-D | Export PAGINATION_PRESETS constant             | MEDIUM   | +40        |

---

### MF-007: Create progress.factory.ts

**Target:** Progress component

| Task ID  | Task                                       | Priority | Est. Lines |
| -------- | ------------------------------------------ | -------- | ---------- |
| MF-007-A | Define ProgressVariant, ProgressSize types | HIGH     | +30        |
| MF-007-B | Create createFakeProgress function         | HIGH     | +50        |
| MF-007-C | Create createFakeProgressList              | HIGH     | +40        |
| MF-007-D | Export PROGRESS_SCENARIOS constant         | MEDIUM   | +30        |

---

### MF-008: Create radio-group.factory.ts

**Target:** Radio Group component

| Task ID  | Task                                       | Priority | Est. Lines |
| -------- | ------------------------------------------ | -------- | ---------- |
| MF-008-A | Define RadioOption, RadioGroupConfig types | HIGH     | +40        |
| MF-008-B | Create createFakeRadioGroup function       | HIGH     | +60        |
| MF-008-C | Create createFakeRadioOptions              | HIGH     | +50        |
| MF-008-D | Export COMMON_RADIO_GROUPS constant        | MEDIUM   | +60        |

---

### MF-009: Create reel.factory.ts

**Target:** Reel component

| Task ID  | Task                              | Priority | Est. Lines |
| -------- | --------------------------------- | -------- | ---------- |
| MF-009-A | Define ReelItem, ReelConfig types | HIGH     | +50        |
| MF-009-B | Create createFakeReel function    | HIGH     | +80        |
| MF-009-C | Create createFakeReelItems        | HIGH     | +60        |
| MF-009-D | Export REEL_PRESETS constant      | MEDIUM   | +50        |

---

### MF-010: Create resizable.factory.ts

**Target:** Resizable component

| Task ID  | Task                                               | Priority | Est. Lines |
| -------- | -------------------------------------------------- | -------- | ---------- |
| MF-010-A | Define ResizablePanelConfig, ResizableLayout types | HIGH     | +50        |
| MF-010-B | Create createFakeResizableLayout function          | HIGH     | +80        |
| MF-010-C | Create createFakeResizablePanels                   | HIGH     | +60        |
| MF-010-D | Export LAYOUT_PRESETS constant                     | MEDIUM   | +50        |

---

### MF-011: Create scroll-area.factory.ts

**Target:** Scroll Area component

| Task ID  | Task                                         | Priority | Est. Lines |
| -------- | -------------------------------------------- | -------- | ---------- |
| MF-011-A | Define ScrollAreaConfig, ScrollContent types | HIGH     | +40        |
| MF-011-B | Create createFakeScrollContent function      | HIGH     | +60        |
| MF-011-C | Create createFakeLongContent                 | HIGH     | +50        |
| MF-011-D | Export SCROLL_DEMOS constant                 | MEDIUM   | +40        |

---

### MF-012: Create separator.factory.ts

**Target:** Separator component

| Task ID  | Task                                | Priority | Est. Lines |
| -------- | ----------------------------------- | -------- | ---------- |
| MF-012-A | Define SeparatorOrientation type    | HIGH     | +20        |
| MF-012-B | Create createFakeSeparator function | HIGH     | +30        |
| MF-012-C | Export SEPARATOR_VARIANTS constant  | MEDIUM   | +20        |

---

### MF-013: Create skeleton.factory.ts

**Target:** Skeleton component

| Task ID  | Task                                               | Priority | Est. Lines |
| -------- | -------------------------------------------------- | -------- | ---------- |
| MF-013-A | Define SkeletonVariant, SkeletonConfig types       | HIGH     | +40        |
| MF-013-B | Create createFakeSkeleton function                 | HIGH     | +50        |
| MF-013-C | Create createFakeSkeletonLayout (card, list, etc.) | HIGH     | +80        |
| MF-013-D | Export SKELETON_PRESETS constant                   | MEDIUM   | +50        |

---

## 8.2 Missing Handler Files (16 Files)

### MH-001: Create checkbox.handlers.ts

**Target:** Checkbox component

| Task ID  | Task                                | Priority | Est. Lines |
| -------- | ----------------------------------- | -------- | ---------- |
| MH-001-A | Create toggle state handlers        | HIGH     | +60        |
| MH-001-B | Add form validation handlers        | HIGH     | +50        |
| MH-001-C | Add error state handlers (400, 422) | MEDIUM   | +40        |
| MH-001-D | Export checkboxStatusHandlers       | MEDIUM   | +30        |

---

### MH-002: Create collapsible.handlers.ts

**Target:** Collapsible component

| Task ID  | Task                                  | Priority | Est. Lines |
| -------- | ------------------------------------- | -------- | ---------- |
| MH-002-A | Create expand/collapse state handlers | HIGH     | +50        |
| MH-002-B | Add content loading handlers          | HIGH     | +60        |
| MH-002-C | Add error state handlers              | MEDIUM   | +40        |

---

### MH-003: Create command.handlers.ts

**Target:** Command component

| Task ID  | Task                                     | Priority | Est. Lines |
| -------- | ---------------------------------------- | -------- | ---------- |
| MH-003-A | Create command execution handlers        | HIGH     | +80        |
| MH-003-B | Add search/filter handlers with debounce | HIGH     | +70        |
| MH-003-C | Add async command loading handlers       | HIGH     | +60        |
| MH-003-D | Add error state handlers                 | MEDIUM   | +50        |

---

### MH-004: Create context-menu.handlers.ts

**Target:** Context Menu component

| Task ID  | Task                                           | Priority | Est. Lines |
| -------- | ---------------------------------------------- | -------- | ---------- |
| MH-004-A | Create menu action execution handlers          | HIGH     | +70        |
| MH-004-B | Add clipboard operation handlers (copy, paste) | HIGH     | +60        |
| MH-004-C | Add async operation handlers                   | MEDIUM   | +50        |
| MH-004-D | Add error state handlers                       | MEDIUM   | +40        |

---

### MH-005: Create drawer.handlers.ts

**Target:** Drawer component

| Task ID  | Task                                       | Priority | Est. Lines |
| -------- | ------------------------------------------ | -------- | ---------- |
| MH-005-A | Create drawer content loading handlers     | HIGH     | +60        |
| MH-005-B | Add form submission handlers               | HIGH     | +80        |
| MH-005-C | Add error state handlers (400, 401, 500)   | MEDIUM   | +60        |
| MH-005-D | Add loading state handler (infinite delay) | MEDIUM   | +30        |

---

### MH-006: Create dropdown-menu.handlers.ts

**Target:** Dropdown Menu component

| Task ID  | Task                                        | Priority | Est. Lines |
| -------- | ------------------------------------------- | -------- | ---------- |
| MH-006-A | Create menu action handlers                 | HIGH     | +70        |
| MH-006-B | Add async menu item loading                 | HIGH     | +60        |
| MH-006-C | Add state toggle handlers (checkbox, radio) | MEDIUM   | +50        |
| MH-006-D | Add error state handlers                    | MEDIUM   | +40        |

---

### MH-007: Create empty.handlers.ts

**Target:** Empty State component

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| MH-007-A | Create retry operation handlers | HIGH     | +50        |
| MH-007-B | Add create new item handlers    | HIGH     | +60        |
| MH-007-C | Add error recovery handlers     | MEDIUM   | +40        |

---

### MH-008: Create field.handlers.ts

**Target:** Field component

| Task ID  | Task                                              | Priority | Est. Lines |
| -------- | ------------------------------------------------- | -------- | ---------- |
| MH-008-A | Create validation handlers                        | HIGH     | +80        |
| MH-008-B | Add async validation handlers (email check, etc.) | HIGH     | +70        |
| MH-008-C | Add error state handlers (422 validation)         | MEDIUM   | +50        |

---

### MH-009: Create hover-card.handlers.ts

**Target:** Hover Card component

| Task ID  | Task                            | Priority | Est. Lines |
| -------- | ------------------------------- | -------- | ---------- |
| MH-009-A | Create content loading handlers | HIGH     | +60        |
| MH-009-B | Add user profile fetch handlers | HIGH     | +70        |
| MH-009-C | Add error state handlers        | MEDIUM   | +40        |

---

### MH-010: Create input-group.handlers.ts

**Target:** Input Group component

| Task ID  | Task                             | Priority | Est. Lines |
| -------- | -------------------------------- | -------- | ---------- |
| MH-010-A | Create validation handlers       | HIGH     | +60        |
| MH-010-B | Add search autocomplete handlers | HIGH     | +80        |
| MH-010-C | Add error state handlers         | MEDIUM   | +40        |

---

### MH-011: Create input-otp.handlers.ts

**Target:** Input OTP component

| Task ID  | Task                                       | Priority | Est. Lines |
| -------- | ------------------------------------------ | -------- | ---------- |
| MH-011-A | Create OTP verification handlers           | HIGH     | +80        |
| MH-011-B | Add resend code handlers                   | HIGH     | +60        |
| MH-011-C | Add error handlers (invalid code, expired) | HIGH     | +50        |
| MH-011-D | Add rate limiting handlers (429)           | MEDIUM   | +40        |

---

### MH-012: Create item.handlers.ts

**Target:** Item component

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| MH-012-A | Create item action handlers  | HIGH     | +60        |
| MH-012-B | Add async operation handlers | MEDIUM   | +50        |
| MH-012-C | Add error state handlers     | MEDIUM   | +40        |

---

### MH-013: Create label.handlers.ts

**Target:** Label component

| Task ID  | Task                                          | Priority | Est. Lines |
| -------- | --------------------------------------------- | -------- | ---------- |
| MH-013-A | Create minimal handlers (tooltip fetch, etc.) | LOW      | +40        |

---

### MH-014: Create popover.handlers.ts

**Target:** Popover component

| Task ID  | Task                                  | Priority | Est. Lines |
| -------- | ------------------------------------- | -------- | ---------- |
| MH-014-A | Create async content loading handlers | HIGH     | +60        |
| MH-014-B | Add form submission handlers          | HIGH     | +70        |
| MH-014-C | Add error state handlers              | MEDIUM   | +40        |

---

### MH-015: Create sheet.handlers.ts

**Target:** Sheet component

| Task ID  | Task                                     | Priority | Est. Lines |
| -------- | ---------------------------------------- | -------- | ---------- |
| MH-015-A | Create content loading handlers          | HIGH     | +60        |
| MH-015-B | Add form submission handlers             | HIGH     | +80        |
| MH-015-C | Add error state handlers (400, 401, 500) | MEDIUM   | +60        |

---

### MH-016: Create textarea.handlers.ts

**Target:** Textarea component

| Task ID  | Task                      | Priority | Est. Lines |
| -------- | ------------------------- | -------- | ---------- |
| MH-016-A | Create auto-save handlers | HIGH     | +60        |
| MH-016-B | Add validation handlers   | HIGH     | +50        |
| MH-016-C | Add error state handlers  | MEDIUM   | +40        |

---

## 8.3 i18n Expansion Tasks (20 Namespaces)

### I18N-001 to I18N-005: High Priority Namespaces

| Task ID  | Namespace       | Current | Target | Est. Keys |
| -------- | --------------- | ------- | ------ | --------- |
| I18N-001 | dateTimePicker  | 2       | 12+    | +10       |
| I18N-002 | inputOtp        | 3       | 13+    | +10       |
| I18N-003 | promptCodeBlock | 1       | 9+     | +8        |
| I18N-004 | promptInput     | 0       | 8+     | +8        |
| I18N-005 | promptMessage   | 0       | 10+    | +10       |

**Subtasks (Each):**

- [ ] Add component.label keys
- [ ] Add component.a11y.\* accessibility keys
- [ ] Add component.error.\* error message keys
- [ ] Add component.action.\* action label keys
- [ ] Mirror to ja.ts with Japanese translations

---

### I18N-006 to I18N-012: Medium Priority Namespaces

| Task ID  | Namespace            | Current | Target | Est. Keys |
| -------- | -------------------- | ------- | ------ | --------- |
| I18N-006 | breadcrumb           | 3       | 15+    | +12       |
| I18N-007 | collapsible          | 4       | 12+    | +8        |
| I18N-008 | headerNotifications  | 4       | 12+    | +8        |
| I18N-009 | nativeSelect         | 4       | 10+    | +6        |
| I18N-010 | promptLoader         | 1       | 5+     | +4        |
| I18N-011 | themeCustomizerPanel | 1       | 8+     | +7        |
| I18N-012 | toggle               | 2       | 10+    | +8        |

---

### I18N-013 to I18N-020: Low Priority Namespaces

| Task ID  | Namespace          | Current | Target | Est. Keys |
| -------- | ------------------ | ------- | ------ | --------- |
| I18N-013 | countAnimation     | 3       | 10+    | +7        |
| I18N-014 | exportButton       | 3       | 8+     | +5        |
| I18N-015 | headerData         | 2       | 8+     | +6        |
| I18N-016 | logo               | 1       | 5+     | +4        |
| I18N-017 | moduleExports      | 4       | 8+     | +4        |
| I18N-018 | promptScrollButton | 2       | 6+     | +4        |
| I18N-019 | resetThemeButton   | 1       | 5+     | +4        |
| I18N-020 | themeSwitch        | 1       | 5+     | +4        |

---

## 8.4 JSDoc Documentation Tasks (25 Components)

### JD-001 to JD-025: Components Needing JSDoc

| Task ID | Component           | Priority | Est. Lines |
| ------- | ------------------- | -------- | ---------- |
| JD-001  | carousel.tsx        | HIGH     | +180       |
| JD-002  | chart.tsx           | HIGH     | +250       |
| JD-003  | command.tsx         | HIGH     | +150       |
| JD-004  | context-menu.tsx    | HIGH     | +200       |
| JD-005  | dialog.tsx          | HIGH     | +150       |
| JD-006  | drawer.tsx          | HIGH     | +120       |
| JD-007  | dropdown-menu.tsx   | HIGH     | +250       |
| JD-008  | form.tsx            | HIGH     | +120       |
| JD-009  | hover-card.tsx      | HIGH     | +80        |
| JD-010  | kanban.tsx          | HIGH     | +400       |
| JD-011  | menubar.tsx         | HIGH     | +200       |
| JD-012  | navigation-menu.tsx | HIGH     | +150       |
| JD-013  | pagination.tsx      | HIGH     | +100       |
| JD-014  | popover.tsx         | HIGH     | +80        |
| JD-015  | reel.tsx            | HIGH     | +300       |
| JD-016  | resizable.tsx       | HIGH     | +80        |
| JD-017  | scroll-area.tsx     | HIGH     | +60        |
| JD-018  | select.tsx          | HIGH     | +180       |
| JD-019  | sheet.tsx           | HIGH     | +120       |
| JD-020  | sidebar.tsx         | HIGH     | +400       |
| JD-021  | sonner.tsx          | HIGH     | +50        |
| JD-022  | table.tsx           | HIGH     | +120       |
| JD-023  | timeline.tsx        | HIGH     | +150       |
| JD-024  | toast.tsx           | HIGH     | +120       |
| JD-025  | tooltip.tsx         | HIGH     | +80        |

**Standard JSDoc Pattern:**

````typescript
/**
 * Component description and purpose.
 *
 * @description Detailed explanation of what the component does,
 * when to use it, and its key features.
 *
 * @example
 * ```tsx
 * <Component prop="value">
 *   Content
 * </Component>
 * ```
 *
 * @see {@link RelatedComponent} - For similar functionality
 */
````

---

## 8.5 Helper/Internal Story Tasks (4 Components)

### HS-001: Async Wrapper Component

**File:** `_components/async-wrapper`

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| HS-001-A | Add JSDoc documentation      | HIGH     | +60        |
| HS-001-B | Add autodocs tag             | HIGH     | +10        |
| HS-001-C | Add state transition stories | MEDIUM   | +100       |
| HS-001-D | Add i18n keys                | MEDIUM   | +30        |

---

### HS-002: Empty State Helper

**File:** `_components/empty-state`

| Task ID  | Task                                             | Priority | Est. Lines |
| -------- | ------------------------------------------------ | -------- | ---------- |
| HS-002-A | Add JSDoc documentation                          | HIGH     | +60        |
| HS-002-B | Add variant stories (no data, no results, error) | HIGH     | +120       |
| HS-002-C | Add action button tests                          | MEDIUM   | +80        |
| HS-002-D | Add i18n keys                                    | MEDIUM   | +40        |

---

### HS-003: Error Display Component

**File:** `_components/error-display`

| Task ID  | Task                    | Priority | Est. Lines |
| -------- | ----------------------- | -------- | ---------- |
| HS-003-A | Add JSDoc documentation | HIGH     | +60        |
| HS-003-B | Add error type stories  | HIGH     | +100       |
| HS-003-C | Add retry button tests  | MEDIUM   | +60        |
| HS-003-D | Add i18n keys           | MEDIUM   | +40        |

---

### HS-004: Loading Skeleton Component

**File:** `_components/loading-skeleton`

| Task ID  | Task                         | Priority | Est. Lines |
| -------- | ---------------------------- | -------- | ---------- |
| HS-004-A | Add JSDoc documentation      | HIGH     | +40        |
| HS-004-B | Add skeleton variant stories | HIGH     | +100       |
| HS-004-C | Add animation tests          | MEDIUM   | +40        |
| HS-004-D | Add i18n keys                | MEDIUM   | +20        |

---

# SECTION 9: ADDITIONAL PAGES

## 9.1 Landing/Marketing Pages (18 Pages)

### LP-001 to LP-018: Landing & Marketing Pages

| Task ID | Page                 | Priority | Est. Lines |
| ------- | -------------------- | -------- | ---------- |
| LP-001  | Landing Hero         | HIGH     | +200       |
| LP-002  | Landing Features     | HIGH     | +200       |
| LP-003  | Landing Pricing      | HIGH     | +200       |
| LP-004  | Landing Testimonials | MEDIUM   | +150       |
| LP-005  | Landing FAQ          | MEDIUM   | +150       |
| LP-006  | Landing CTA          | MEDIUM   | +100       |
| LP-007  | Landing Footer       | MEDIUM   | +120       |
| LP-008  | About Page           | MEDIUM   | +150       |
| LP-009  | Contact Page         | HIGH     | +200       |
| LP-010  | Blog List            | MEDIUM   | +180       |
| LP-011  | Blog Post            | MEDIUM   | +200       |
| LP-012  | Changelog            | LOW      | +120       |
| LP-013  | Documentation        | MEDIUM   | +200       |
| LP-014  | Privacy Policy       | LOW      | +80        |
| LP-015  | Terms of Service     | LOW      | +80        |
| LP-016  | Careers              | LOW      | +150       |
| LP-017  | Partners             | LOW      | +120       |
| LP-018  | Press Kit            | LOW      | +100       |

**Standard Subtasks (Each):**

- [ ] Create story file with autodocs
- [ ] Add DarkMode story
- [ ] Add DarkModeJapanese story
- [ ] Add play tests for interactions
- [ ] Add responsive viewport stories

---

## 9.2 Settings Pages (5 Pages)

### SP-001 to SP-005: Settings Pages

| Task ID | Page                   | Priority | Est. Lines |
| ------- | ---------------------- | -------- | ---------- |
| SP-001  | Settings Account       | HIGH     | +200       |
| SP-002  | Settings Appearance    | HIGH     | +180       |
| SP-003  | Settings Billing       | HIGH     | +200       |
| SP-004  | Settings Display       | MEDIUM   | +150       |
| SP-005  | Settings Notifications | MEDIUM   | +180       |

**Standard Subtasks (Each):**

- [ ] Create story file with autodocs
- [ ] Add form validation play tests
- [ ] Add save/submit play tests
- [ ] Add dark mode story
- [ ] Add loading/saving states

---

## 9.3 Error Pages (2 Pages)

### EP-001 to EP-002: Error Pages

| Task ID | Page      | Priority | Est. Lines |
| ------- | --------- | -------- | ---------- |
| EP-001  | Error 404 | HIGH     | +100       |
| EP-002  | Error 500 | HIGH     | +100       |

**Standard Subtasks (Each):**

- [ ] Create story file with autodocs
- [ ] Add dark mode story
- [ ] Add action button tests (go home, retry)
- [ ] Add i18n verification

---

# UPDATED SUMMARY STATISTICS

## Total Tasks by Section

| Section                | Components/Pages | Sub-Tasks | Est. Lines  |
| ---------------------- | ---------------- | --------- | ----------- |
| UI Components          | 58               | 290       | ~29,000     |
| Custom Components      | 27               | 108       | ~8,500      |
| Layout Components      | 10               | 50        | ~4,000      |
| Theme Customizer       | 9                | 36        | ~3,000      |
| Dashboard Pages        | 40               | 200       | ~20,000     |
| Auth Pages             | 5                | 25        | ~2,500      |
| Global Components      | 5                | 25        | ~2,000      |
| **Infrastructure**     |                  |           |             |
| └─ Missing Factories   | 13               | 52        | ~2,500      |
| └─ Missing Handlers    | 16               | 64        | ~3,200      |
| └─ i18n Expansion      | 20               | 60        | ~1,500      |
| └─ JSDoc Documentation | 25               | 25        | ~4,000      |
| └─ Helper Stories      | 4                | 16        | ~800        |
| Landing Pages          | 18               | 72        | ~3,000      |
| Settings Pages         | 5                | 25        | ~900        |
| Error Pages            | 2                | 8         | ~200        |
| **GRAND TOTAL**        | **257**          | **1,056** | **~85,100** |

## Priority Distribution

| Priority | Task Count | Percentage |
| -------- | ---------- | ---------- |
| HIGH     | 650        | 62%        |
| MEDIUM   | 340        | 32%        |
| LOW      | 66         | 6%         |

## Task Type Distribution

| Type                  | Count |
| --------------------- | ----- |
| JSDoc Documentation   | 179   |
| Factory Files         | 58    |
| Handler Files         | 54    |
| Play Tests            | 230   |
| Story Variants        | 200   |
| i18n Expansion        | 60    |
| Dark Mode Stories     | 130   |
| Accessibility Stories | 75    |
| Responsive Stories    | 70    |

---

# EXECUTION WORKFLOW (Updated)

## Phase 1: Foundation (Week 1-2)

- [ ] Complete all JSDoc documentation tasks (UC-_-A, JD-_)
- [ ] Create all missing factory files (MF-001 to MF-013)
- [ ] Create all missing handler files (MH-001 to MH-016)
- [ ] Complete high-priority i18n expansion (I18N-001 to I18N-005)

## Phase 2: Core Stories (Week 3-4)

- [ ] Add play tests to all UI components
- [ ] Add dark mode variants to all stories
- [ ] Add RTL support stories
- [ ] Complete medium-priority i18n (I18N-006 to I18N-012)

## Phase 3: Page Stories (Week 5-6)

- [ ] Create all dashboard page stories (DP-001 to DP-040)
- [ ] Create all settings page stories (SP-001 to SP-005)
- [ ] Create all landing page stories (LP-001 to LP-018)
- [ ] Add page-level play tests

## Phase 4: Polish (Week 7-8)

- [ ] Complete low-priority i18n (I18N-013 to I18N-020)
- [ ] Add accessibility stories
- [ ] Add edge case stories
- [ ] Update helper/internal stories (HS-001 to HS-004)
- [ ] Final verification and testing

## Verification Checklist (Per Component)

```markdown
- [ ] JSDoc complete with @description, @default, @example, @see
- [ ] Factory file exists with:
  - [ ] Type exports
  - [ ] Single item factory
  - [ ] Bulk factory
  - [ ] Matrix factory (for visual testing)
  - [ ] Constants exports
- [ ] Handler file exists with:
  - [ ] Success handlers (200, 201)
  - [ ] Client error handlers (400, 401, 403, 404, 409, 422, 429)
  - [ ] Server error handlers (500, 502, 503, 504)
  - [ ] Special state handlers (loading, networkError)
- [ ] Story file has:
  - [ ] autodocs tag
  - [ ] Playground story
  - [ ] Variants story
  - [ ] Dark mode story
  - [ ] Japanese locale story
  - [ ] Play tests for primary interactions
  - [ ] Accessibility story (keyboard, focus)
  - [ ] RTL support story
- [ ] i18n coverage:
  - [ ] Component namespace in en.ts
  - [ ] Component namespace in ja.ts
  - [ ] All user-facing strings translated
  - [ ] Accessibility labels (_.a11y._)
```

---

# ACCEPTANCE CRITERIA

## Per-Task Acceptance

Each task is considered complete when:

1. ✅ Code changes pass `pnpm typecheck`
2. ✅ Code changes pass `pnpm lint`
3. ✅ Stories render correctly in Storybook
4. ✅ Play tests pass (if applicable)
5. ✅ Dark mode displays correctly
6. ✅ Japanese translations work
7. ✅ No console errors in browser

## Phase Completion Criteria

### Phase 1 Complete When:

- All 154 components have comprehensive JSDoc
- All 13 missing factories created and exported
- All 16 missing handlers created and exported
- High-priority i18n namespaces expanded

### Phase 2 Complete When:

- All 58 UI component stories have play tests
- All stories have dark mode variants
- 100% RTL coverage achieved
- Medium-priority i18n complete

### Phase 3 Complete When:

- All 65 dashboard pages have stories
- All 25 other pages have stories
- Page-level play tests pass

### Phase 4 Complete When:

- All i18n namespaces fully expanded
- All accessibility stories added
- All helper components documented
- Final QA verification passed

---

# SECTION 10: DASHBOARD SUB-COMPONENTS (200+ Components)

## 10.1 Academy Dashboard Components (9 Components)

| Task ID | Component              | File                                            | Priority | Est. Lines |
| ------- | ---------------------- | ----------------------------------------------- | -------- | ---------- |
| DC-001  | ChartMostActivity      | academy/components/chart-most-activity.tsx      | MEDIUM   | +80        |
| DC-002  | CourseProgressByMonth  | academy/components/course-progress-by-month.tsx | MEDIUM   | +80        |
| DC-003  | CoursesList            | academy/components/courses-list.tsx             | HIGH     | +150       |
| DC-004  | LeaderBoardCard        | academy/components/leader-board-card.tsx        | MEDIUM   | +60        |
| DC-005  | LearningPathCard       | academy/components/learning-path-card.tsx       | MEDIUM   | +60        |
| DC-006  | ProgressStatisticsCard | academy/components/progress-statistics-card.tsx | MEDIUM   | +70        |
| DC-007  | StudentSuccessCard     | academy/components/student-success-card.tsx     | MEDIUM   | +80        |
| DC-008  | WelcomeCard            | academy/components/welcome-card.tsx             | LOW      | +50        |

---

## 10.2 AI Chat Components (4 Components)

| Task ID | Component       | File                                             | Priority | Est. Lines |
| ------- | --------------- | ------------------------------------------------ | -------- | ---------- |
| DC-009  | AIChatAppRender | apps/ai-chat/app-render.tsx                      | HIGH     | +200       |
| DC-010  | AIChatInterface | apps/ai-chat-v2/components/ai-chat-interface.tsx | HIGH     | +300       |
| DC-011  | AIChatSidebar   | apps/ai-chat-v2/components/ai-chat-sidebar.tsx   | MEDIUM   | +120       |
| DC-012  | AIUpgradeModal  | apps/ai-chat-v2/components/ai-upgrade-modal.tsx  | MEDIUM   | +100       |

---

## 10.3 AI Image Generator Components (6 Components)

| Task ID | Component          | File                                                        | Priority | Est. Lines |
| ------- | ------------------ | ----------------------------------------------------------- | -------- | ---------- |
| DC-013  | HistorySheet       | apps/ai-image-generator/components/history-sheet.tsx        | MEDIUM   | +80        |
| DC-014  | ImageGallery       | apps/ai-image-generator/components/image-gallery.tsx        | MEDIUM   | +80        |
| DC-015  | ImageGeneratorForm | apps/ai-image-generator/components/image-generator-form.tsx | HIGH     | +150       |
| DC-016  | ImageGenerator     | apps/ai-image-generator/components/image-generator.tsx      | HIGH     | +120       |
| DC-017  | ImageItem          | apps/ai-image-generator/components/image-item.tsx           | MEDIUM   | +80        |

---

## 10.4 API Keys Components (7 Components)

| Task ID | Component                 | File                                          | Priority | Est. Lines |
| ------- | ------------------------- | --------------------------------------------- | -------- | ---------- |
| DC-018  | APICallsCard              | apps/api-keys/api-calls-card.tsx              | LOW      | +40        |
| DC-019  | CreateAPIKeyDialog        | apps/api-keys/create-api-key-dialog.tsx       | HIGH     | +100       |
| DC-020  | APIKeysDatatable          | apps/api-keys/datatable.tsx                   | HIGH     | +200       |
| DC-021  | FailedConversionsCard     | apps/api-keys/failed-conversions-card.tsx     | LOW      | +40        |
| DC-022  | SuccessfulConversionsCard | apps/api-keys/successful-conversions-card.tsx | LOW      | +40        |
| DC-023  | UpgradePlanCard           | apps/api-keys/upgrade-plan-card.tsx           | LOW      | +40        |

---

## 10.5 Calendar Components (13 Components)

| Task ID | Component          | File                                              | Priority | Est. Lines |
| ------- | ------------------ | ------------------------------------------------- | -------- | ---------- |
| DC-024  | AgendaView         | apps/calendar/components/agenda-view.tsx          | HIGH     | +80        |
| DC-025  | CalendarDndContext | apps/calendar/components/calendar-dnd-context.tsx | HIGH     | +200       |
| DC-026  | DayView            | apps/calendar/components/day-view.tsx             | HIGH     | +200       |
| DC-027  | DraggableEvent     | apps/calendar/components/draggable-event.tsx      | HIGH     | +100       |
| DC-028  | DroppableCell      | apps/calendar/components/droppable-cell.tsx       | MEDIUM   | +60        |
| DC-029  | EventCalendarApp   | apps/calendar/components/event-calendar-app.tsx   | HIGH     | +120       |
| DC-030  | EventCalendar      | apps/calendar/components/event-calendar.tsx       | HIGH     | +250       |
| DC-031  | EventDialog        | apps/calendar/components/event-dialog.tsx         | HIGH     | +300       |
| DC-032  | EventItem          | apps/calendar/components/event-item.tsx           | MEDIUM   | +150       |
| DC-033  | EventsPopup        | apps/calendar/components/events-popup.tsx         | MEDIUM   | +100       |
| DC-034  | MonthView          | apps/calendar/components/month-view.tsx           | HIGH     | +200       |
| DC-035  | WeekView           | apps/calendar/components/week-view.tsx            | HIGH     | +250       |

---

## 10.6 Chat App Components (14 Components)

| Task ID | Component            | File                                             | Priority | Est. Lines |
| ------- | -------------------- | ------------------------------------------------ | -------- | ---------- |
| DC-036  | ActionDropdown       | apps/chat/components/action-dropdown.tsx         | MEDIUM   | +50        |
| DC-037  | CallDialog           | apps/chat/components/call-dialog.tsx             | MEDIUM   | +60        |
| DC-038  | ChatBubbles          | apps/chat/components/chat-bubbles.tsx            | HIGH     | +200       |
| DC-039  | ChatContent          | apps/chat/components/chat-content.tsx            | HIGH     | +80        |
| DC-040  | ChatFooter           | apps/chat/components/chat-footer.tsx             | HIGH     | +80        |
| DC-041  | ChatHeader           | apps/chat/components/chat-header.tsx             | HIGH     | +80        |
| DC-042  | ChatListItemDropdown | apps/chat/components/chat-list-item-dropdown.tsx | MEDIUM   | +50        |
| DC-043  | ChatListItem         | apps/chat/components/chat-list-item.tsx          | HIGH     | +80        |
| DC-044  | ChatSidebar          | apps/chat/components/chat-sidebar.tsx            | HIGH     | +80        |
| DC-045  | MediaListItem        | apps/chat/components/media-list-item.tsx         | LOW      | +40        |
| DC-046  | MessageStatusIcon    | apps/chat/components/message-status-icon.tsx     | LOW      | +40        |
| DC-047  | UserDetailSheet      | apps/chat/components/user-detail-sheet.tsx       | MEDIUM   | +150       |
| DC-048  | VideoCallDialog      | apps/chat/components/video-call-dialog.tsx       | MEDIUM   | +60        |

---

## 10.7 File Manager App Components (3 Components)

| Task ID | Component             | File                                                | Priority | Est. Lines |
| ------- | --------------------- | --------------------------------------------------- | -------- | ---------- |
| DC-049  | FileManagerMain       | apps/file-manager/components/file-manager.tsx       | HIGH     | +350       |
| DC-050  | FileUploadDialog      | apps/file-manager/components/file-upload-dialog.tsx | HIGH     | +120       |
| DC-051  | FileManagerPagination | apps/file-manager/components/pagination.tsx         | MEDIUM   | +100       |

---

## 10.8 Kanban App Components (2 Components)

| Task ID | Component   | File                                    | Priority | Est. Lines |
| ------- | ----------- | --------------------------------------- | -------- | ---------- |
| DC-052  | AddAssignee | apps/kanban/components/add-assigne.tsx  | MEDIUM   | +100       |
| DC-053  | KanbanBoard | apps/kanban/components/kanban-board.tsx | HIGH     | +450       |

---

## 10.9 Mail App Components (8 Components)

| Task ID | Component         | File                                         | Priority | Est. Lines |
| ------- | ----------------- | -------------------------------------------- | -------- | ---------- |
| DC-054  | AccountSwitcher   | apps/mail/components/account-switcher.tsx    | MEDIUM   | +60        |
| DC-055  | MailDisplayMobile | apps/mail/components/mail-display-mobile.tsx | HIGH     | +200       |
| DC-056  | MailDisplay       | apps/mail/components/mail-display.tsx        | HIGH     | +180       |
| DC-057  | MailList          | apps/mail/components/mail-list.tsx           | HIGH     | +80        |
| DC-058  | MailMain          | apps/mail/components/mail.tsx                | HIGH     | +100       |
| DC-059  | NavDesktop        | apps/mail/components/nav-desktop.tsx         | MEDIUM   | +80        |
| DC-060  | NavMobile         | apps/mail/components/nav-mobile.tsx          | MEDIUM   | +100       |
| DC-061  | NavMail           | apps/mail/components/nav.tsx                 | MEDIUM   | +80        |

---

## 10.10 Notes App Components (7 Components)

| Task ID | Component       | File                             | Priority | Est. Lines |
| ------- | --------------- | -------------------------------- | -------- | ---------- |
| DC-062  | AddNoteModal    | apps/notes/add-note-modal.tsx    | HIGH     | +150       |
| DC-063  | EditLabelsModal | apps/notes/edit-labels-modal.tsx | MEDIUM   | +100       |
| DC-064  | NoteApp         | apps/notes/note-app.tsx          | HIGH     | +50        |
| DC-065  | NoteContent     | apps/notes/note-content.tsx      | HIGH     | +100       |
| DC-066  | NoteListItem    | apps/notes/note-list-item.tsx    | HIGH     | +80        |
| DC-067  | NoteSidebar     | apps/notes/note-sidebar.tsx      | MEDIUM   | +70        |

---

## 10.11 POS System Components (10 Components)

| Task ID | Component               | File                                                      | Priority | Est. Lines |
| ------- | ----------------------- | --------------------------------------------------------- | -------- | ---------- |
| DC-068  | AddProductDialog        | apps/pos-system/components/add-product-dialog.tsx         | HIGH     | +130       |
| DC-069  | AssignOrderToTable      | apps/pos-system/components/assign-order-to-table.tsx      | MEDIUM   | +90        |
| DC-070  | CartListItem            | apps/pos-system/components/cart-list-item.tsx             | MEDIUM   | +70        |
| DC-071  | CartSheet               | apps/pos-system/components/cart-sheet.tsx                 | MEDIUM   | +90        |
| DC-072  | Cart                    | apps/pos-system/components/cart.tsx                       | HIGH     | +80        |
| DC-073  | ProductCategoryListItem | apps/pos-system/components/product-category-list-item.tsx | LOW      | +50        |
| DC-074  | ProductListItem         | apps/pos-system/components/product-list-item.tsx          | MEDIUM   | +70        |
| DC-075  | POSSystemMenu           | apps/pos-system/pos-system-menu.tsx                       | HIGH     | +130       |
| DC-076  | AddTableDialog          | apps/pos-system/tables/components/add-table-dialog.tsx    | MEDIUM   | +60        |
| DC-077  | TableDetailDialog       | apps/pos-system/tables/components/table-detail-dialog.tsx | HIGH     | +120       |
| DC-078  | TableListItem           | apps/pos-system/tables/components/table-list-item.tsx     | MEDIUM   | +60        |
| DC-079  | TablesRender            | apps/pos-system/tables/tables-render.tsx                  | HIGH     | +100       |

---

## 10.12 Social Media Components (5 Components)

| Task ID | Component          | File                                                  | Priority | Est. Lines |
| ------- | ------------------ | ----------------------------------------------------- | -------- | ---------- |
| DC-080  | AsideRight         | apps/social-media/components/aside-right.tsx          | MEDIUM   | +100       |
| DC-081  | CreatePostDialog   | apps/social-media/components/create-post-dialog.tsx   | HIGH     | +90        |
| DC-082  | PostItem           | apps/social-media/components/post-item.tsx            | HIGH     | +200       |
| DC-083  | SocialMediaSidebar | apps/social-media/components/social-media-sidebar.tsx | MEDIUM   | +120       |
| DC-084  | SocialMediaStories | apps/social-media/components/social-media-stories.tsx | MEDIUM   | +100       |

---

## 10.13 Tasks App Components (9 Components)

| Task ID | Component              | File                                                | Priority | Est. Lines |
| ------- | ---------------------- | --------------------------------------------------- | -------- | ---------- |
| DC-085  | TaskColumns            | apps/tasks/components/columns.tsx                   | HIGH     | +80        |
| DC-086  | DataTableColumnHeader  | apps/tasks/components/data-table-column-header.tsx  | MEDIUM   | +60        |
| DC-087  | DataTableFacetedFilter | apps/tasks/components/data-table-faceted-filter.tsx | HIGH     | +100       |
| DC-088  | DataTablePagination    | apps/tasks/components/data-table-pagination.tsx     | MEDIUM   | +80        |
| DC-089  | DataTableRowActions    | apps/tasks/components/data-table-row-actions.tsx    | MEDIUM   | +60        |
| DC-090  | DataTableToolbar       | apps/tasks/components/data-table-toolbar.tsx        | MEDIUM   | +70        |
| DC-091  | DataTableViewOptions   | apps/tasks/components/data-table-view-options.tsx   | LOW      | +50        |
| DC-092  | DataTable              | apps/tasks/components/data-table.tsx                | HIGH     | +90        |
| DC-093  | TaskUserNav            | apps/tasks/components/user-nav.tsx                  | MEDIUM   | +60        |

---

## 10.14 Todo List App Components (5 Components)

| Task ID | Component       | File                                                | Priority | Est. Lines |
| ------- | --------------- | --------------------------------------------------- | -------- | ---------- |
| DC-094  | AddTodoSheet    | apps/todo-list-app/components/add-todo-sheet.tsx    | HIGH     | +200       |
| DC-095  | StatusTabs      | apps/todo-list-app/components/status-tabs.tsx       | MEDIUM   | +50        |
| DC-096  | TodoDetailSheet | apps/todo-list-app/components/todo-detail-sheet.tsx | HIGH     | +200       |
| DC-097  | TodoItem        | apps/todo-list-app/components/todo-item.tsx         | HIGH     | +180       |
| DC-098  | TodoList        | apps/todo-list-app/components/todo-list.tsx         | HIGH     | +200       |

---

## 10.15 CRM Dashboard Components (9 Components)

| Task ID | Component       | File                               | Priority | Est. Lines |
| ------- | --------------- | ---------------------------------- | -------- | ---------- |
| DC-099  | LeadsBySource   | crm/components/leads-by-source.tsx | HIGH     | +100       |
| DC-100  | Leads           | crm/components/leads.tsx           | HIGH     | +180       |
| DC-101  | RecentTasks     | crm/components/recent-tasks.tsx    | MEDIUM   | +90        |
| DC-102  | SalesPipeline   | crm/components/sales-pipeline.tsx  | HIGH     | +90        |
| DC-103  | TargetCard      | crm/components/target-card.tsx     | MEDIUM   | +80        |
| DC-104  | TotalCustomers  | crm/components/total-customers.tsx | LOW      | +50        |
| DC-105  | TotalDeals      | crm/components/total-deals.tsx     | LOW      | +50        |
| DC-106  | TotalRevenueCRM | crm/components/total-revenue.tsx   | LOW      | +50        |

---

## 10.16 Crypto Dashboard Components (6 Components)

| Task ID | Component              | File                                        | Priority | Est. Lines |
| ------- | ---------------------- | ------------------------------------------- | -------- | ---------- |
| DC-107  | ChartBalanceSummary    | crypto/components/chart-balance-summary.tsx | HIGH     | +100       |
| DC-108  | DigitalWallets         | crypto/components/digital-wallets.tsx       | MEDIUM   | +70        |
| DC-109  | OverviewCard           | crypto/components/overview-card.tsx         | MEDIUM   | +60        |
| DC-110  | RecentActivitiesCrypto | crypto/components/recent-activities.tsx     | MEDIUM   | +90        |
| DC-111  | TradingCard            | crypto/components/trading-card.tsx          | HIGH     | +180       |

---

## 10.17 Default Dashboard Components (8 Components)

| Task ID | Component           | File                                    | Priority | Est. Lines |
| ------- | ------------------- | --------------------------------------- | -------- | ---------- |
| DC-112  | ChatWidget          | default/components/chat-widget.tsx      | HIGH     | +150       |
| DC-113  | ExerciseMinutes     | default/components/exercise-minutes.tsx | MEDIUM   | +100       |
| DC-114  | LatestPayments      | default/components/latest-payments.tsx  | HIGH     | +200       |
| DC-115  | PaymentMethod       | default/components/payment-method.tsx   | MEDIUM   | +140       |
| DC-116  | Subscriptions       | default/components/subscriptions.tsx    | MEDIUM   | +60        |
| DC-117  | ThemeMembers        | default/components/theme-members.tsx    | MEDIUM   | +100       |
| DC-118  | TotalRevenueDefault | default/components/total-revenue.tsx    | MEDIUM   | +70        |

---

## 10.18 Ecommerce Dashboard Components (13 Components)

| Task ID | Component             | File                                           | Priority | Est. Lines |
| ------- | --------------------- | ---------------------------------------------- | -------- | ---------- |
| DC-119  | BestSellingProducts   | ecommerce/components/best-selling-products.tsx | HIGH     | +170       |
| DC-120  | CustomerReviews       | ecommerce/components/customer-reviews.tsx      | MEDIUM   | +120       |
| DC-121  | NewCustomers          | ecommerce/components/new-customers.tsx         | MEDIUM   | +70        |
| DC-122  | RecentOrders          | ecommerce/components/recent-orders.tsx         | HIGH     | +200       |
| DC-123  | ReturnRate            | ecommerce/components/return-rate.tsx           | MEDIUM   | +80        |
| DC-124  | RevenueEcommerce      | ecommerce/components/revenue.tsx               | MEDIUM   | +70        |
| DC-125  | SalesByLocation       | ecommerce/components/sales-by-location.tsx     | MEDIUM   | +70        |
| DC-126  | SalesEcommerce        | ecommerce/components/sales.tsx                 | MEDIUM   | +70        |
| DC-127  | StatCardsEcommerce    | ecommerce/components/stat-cards.tsx            | MEDIUM   | +60        |
| DC-128  | TotalRevenueEcommerce | ecommerce/components/total-revenue.tsx         | MEDIUM   | +80        |
| DC-129  | VisitBySource         | ecommerce/components/visit-by-source.tsx       | MEDIUM   | +80        |
| DC-130  | WelcomeEcommerce      | ecommerce/components/welcome.tsx               | LOW      | +40        |

---

## 10.19 File Manager Dashboard Components (7 Components)

| Task ID | Component            | File                                            | Priority | Est. Lines |
| ------- | -------------------- | ----------------------------------------------- | -------- | ---------- |
| DC-131  | ChartFileTransfer    | file-manager/components/chart-file-transfer.tsx | MEDIUM   | +80        |
| DC-132  | FileUploadDialogDash | file-manager/components/file-upload-dialog.tsx  | HIGH     | +120       |
| DC-133  | FolderListCards      | file-manager/components/folder-list-cards.tsx   | MEDIUM   | +80        |
| DC-134  | StorageStatusCard    | file-manager/components/storage-status-card.tsx | LOW      | +50        |
| DC-135  | SummaryCardsFM       | file-manager/components/summary-cards.tsx       | MEDIUM   | +80        |
| DC-136  | TableRecentFiles     | file-manager/components/table-recent-files.tsx  | HIGH     | +120       |

---

## 10.20 Finance Dashboard Components (7 Components)

| Task ID | Component           | File                                    | Priority | Est. Lines |
| ------- | ------------------- | --------------------------------------- | -------- | ---------- |
| DC-137  | KPICards            | finance/components/kpi-cards.tsx        | HIGH     | +140       |
| DC-138  | MonthlyExpenses     | finance/components/monthly-expenses.tsx | MEDIUM   | +70        |
| DC-139  | MyWallet            | finance/components/my-wallet.tsx        | HIGH     | +160       |
| DC-140  | RevenueFinance      | finance/components/revenue.tsx          | MEDIUM   | +80        |
| DC-141  | SavingGoal          | finance/components/saving-goal.tsx      | LOW      | +50        |
| DC-142  | SummaryFinance      | finance/components/summary.tsx          | MEDIUM   | +100       |
| DC-143  | TransactionsFinance | finance/components/transactions.tsx     | HIGH     | +90        |

---

## 10.21 Hospital Management Components (9 Components)

| Task ID | Component                 | File                                                            | Priority | Est. Lines |
| ------- | ------------------------- | --------------------------------------------------------------- | -------- | ---------- |
| DC-144  | NotesHospital             | hospital-management/components/notes.tsx                        | MEDIUM   | +80        |
| DC-145  | PatientVisitsChart        | hospital-management/components/patient-visits-chart.tsx         | HIGH     | +80        |
| DC-146  | PatientsByDepartmentChart | hospital-management/components/patients-by-department-chart.tsx | MEDIUM   | +60        |
| DC-147  | PatientsWithLastProcedure | hospital-management/components/patients-with-last-procedure.tsx | MEDIUM   | +80        |
| DC-148  | PlannedCalendar           | hospital-management/components/planned-calendar.tsx             | MEDIUM   | +80        |
| DC-149  | ReportsData               | hospital-management/components/reports-data.tsx                 | MEDIUM   | +80        |
| DC-150  | ReportsHospital           | hospital-management/components/reports.tsx                      | HIGH     | +100       |
| DC-151  | SummaryCardsHospital      | hospital-management/components/summary-cards.tsx                | MEDIUM   | +100       |
| DC-152  | UpcomingAppointments      | hospital-management/components/upcoming-appointments.tsx        | HIGH     | +100       |

---

## 10.22 Hotel Dashboard Components (10 Components)

| Task ID | Component             | File                                                | Priority | Est. Lines |
| ------- | --------------------- | --------------------------------------------------- | -------- | ---------- |
| DC-153  | BookingFormSheet      | hotel/bookings/components/booking-form-sheet.tsx    | HIGH     | +200       |
| DC-154  | MeetingRoomSchedule   | hotel/bookings/components/meeting-room-schedule.tsx | HIGH     | +280       |
| DC-155  | BookingList           | hotel/components/booking-list.tsx                   | HIGH     | +200       |
| DC-156  | BookingsCard          | hotel/components/bookings-card.tsx                  | MEDIUM   | +90        |
| DC-157  | CampaignOverview      | hotel/components/campaign-overview.tsx              | MEDIUM   | +120       |
| DC-158  | RecentActivitiesHotel | hotel/components/recent-activities.tsx              | MEDIUM   | +100       |
| DC-159  | ReservationsCard      | hotel/components/reservations-card.tsx              | MEDIUM   | +100       |
| DC-160  | RevenueStatHotel      | hotel/components/revenue-stat.tsx                   | MEDIUM   | +140       |
| DC-161  | StatCardsHotel        | hotel/components/stat-cards.tsx                     | MEDIUM   | +100       |

---

## 10.23 Payment Dashboard Components (4 Components)

| Task ID | Component          | File                                       | Priority | Est. Lines |
| ------- | ------------------ | ------------------------------------------ | -------- | ---------- |
| DC-162  | BalanceOverview    | payment/components/balance-overview.tsx    | MEDIUM   | +60        |
| DC-163  | ExchangeRates      | payment/components/exchange-rates.tsx      | HIGH     | +200       |
| DC-164  | NotificationBanner | payment/components/notification-banner.tsx | LOW      | +50        |
| DC-165  | TransactionHistory | payment/components/transaction-history.tsx | HIGH     | +120       |

---

## 10.24 Project Management Components (10 Components)

| Task ID | Component              | File                                                       | Priority | Est. Lines |
| ------- | ---------------------- | ---------------------------------------------------------- | -------- | ---------- |
| DC-166  | AchievementByYear      | project-management/components/achievement-by-year.tsx      | MEDIUM   | +120       |
| DC-167  | AddReminderDialog      | project-management/components/add-reminder-dialog.tsx      | HIGH     | +120       |
| DC-168  | ChartProjectEfficiency | project-management/components/chart-project-efficiency.tsx | MEDIUM   | +120       |
| DC-169  | ChartProjectOverview   | project-management/components/chart-project-overview.tsx   | MEDIUM   | +120       |
| DC-170  | Reminders              | project-management/components/reminders.tsx                | MEDIUM   | +80        |
| DC-171  | ReportsPM              | project-management/components/reports.tsx                  | HIGH     | +220       |
| DC-172  | SuccessMetrics         | project-management/components/success-metrics.tsx          | MEDIUM   | +80        |
| DC-173  | SummaryCardsPM         | project-management/components/summary-cards.tsx            | MEDIUM   | +70        |
| DC-174  | TableRecentProjects    | project-management/components/table-recent-projects.tsx    | HIGH     | +200       |

---

## 10.25 Sales Dashboard Components (8 Components)

| Task ID | Component                | File                                       | Priority | Est. Lines |
| ------- | ------------------------ | ------------------------------------------ | -------- | ---------- |
| DC-175  | BalanceCard              | sales/components/balance-card.tsx          | LOW      | +40        |
| DC-176  | BestSellingProductsSales | sales/components/best-selling-products.tsx | MEDIUM   | +80        |
| DC-177  | ExpenseCard              | sales/components/expense-card.tsx          | LOW      | +40        |
| DC-178  | IncomeCard               | sales/components/income-card.tsx           | LOW      | +40        |
| DC-179  | RevenueChart             | sales/components/revenue-chart.tsx         | HIGH     | +130       |
| DC-180  | TableOrderStatus         | sales/components/table-order-status.tsx    | HIGH     | +200       |
| DC-181  | TaxCard                  | sales/components/tax-card.tsx              | LOW      | +40        |

---

## 10.26 Website Analytics Components (10 Components)

| Task ID | Component            | File                                                     | Priority | Est. Lines |
| ------- | -------------------- | -------------------------------------------------------- | -------- | ---------- |
| DC-182  | AverageDailySales    | website-analytics/components/average-daily-sales.tsx     | MEDIUM   | +70        |
| DC-183  | EarningReportsCard   | website-analytics/components/earning-reports-card.tsx    | HIGH     | +120       |
| DC-184  | MonthlyCampaignState | website-analytics/components/monthly-campaign-state.tsx  | MEDIUM   | +70        |
| DC-185  | SalesByCountriesCard | website-analytics/components/sales-by-countries-card.tsx | MEDIUM   | +100       |
| DC-186  | SalesOverflowCard    | website-analytics/components/sales-overflow-card.tsx     | LOW      | +50        |
| DC-187  | StatCardsAnalytics   | website-analytics/components/stat-cards.tsx              | MEDIUM   | +70        |
| DC-188  | TicketsCard          | website-analytics/components/tickets-card.tsx            | MEDIUM   | +100       |
| DC-189  | TotalEarningCard     | website-analytics/components/total-earning-card.tsx      | MEDIUM   | +100       |
| DC-190  | WebsiteAnalyticsCard | website-analytics/components/website-analytics-card.tsx  | MEDIUM   | +60        |

---

## 10.27 Fitness Widgets Components (11 Components)

| Task ID | Component         | File                                               | Priority | Est. Lines |
| ------- | ----------------- | -------------------------------------------------- | -------- | ---------- |
| DC-191  | ActiveCard        | widgets/fitness/components/active-card.tsx         | LOW      | +40        |
| DC-192  | BodyWeightCard    | widgets/fitness/components/body-weight-card.tsx    | MEDIUM   | +80        |
| DC-193  | DailyActivityCard | widgets/fitness/components/daily-activity-card.tsx | HIGH     | +100       |
| DC-194  | DistanceCard      | widgets/fitness/components/distance-card.tsx       | LOW      | +50        |
| DC-195  | FriendsCard       | widgets/fitness/components/friends-card.tsx        | LOW      | +50        |
| DC-196  | HeartRateCard     | widgets/fitness/components/heart-rate-card.tsx     | MEDIUM   | +80        |
| DC-197  | HeroCardFitness   | widgets/fitness/components/hero-card.tsx           | LOW      | +40        |
| DC-198  | NutritionCard     | widgets/fitness/components/nutrition-card.tsx      | MEDIUM   | +90        |
| DC-199  | SleepCard         | widgets/fitness/components/sleep-card.tsx          | LOW      | +50        |
| DC-200  | TrackingCard      | widgets/fitness/components/tracking-card.tsx       | LOW      | +50        |
| DC-201  | WorkoutsCard      | widgets/fitness/components/workouts-card.tsx       | MEDIUM   | +70        |

---

# SECTION 11: HOOKS & UTILITIES

## 11.1 Custom Hooks (3 Hooks)

| Task ID | Hook          | File                     | Priority | Est. Lines |
| ------- | ------------- | ------------------------ | -------- | ---------- |
| HK-001  | useFileUpload | hooks/use-file-upload.ts | HIGH     | +200       |
| HK-002  | useMobile     | hooks/use-mobile.ts      | MEDIUM   | +50        |
| HK-003  | useToast      | hooks/use-toast.ts       | HIGH     | +100       |

**Standard Subtasks (Each Hook):**

- [ ] Add comprehensive JSDoc
- [ ] Create story demonstrating usage
- [ ] Add unit tests
- [ ] Add TypeScript examples

---

## 11.2 Calendar Hooks (2 Hooks)

| Task ID | Hook                    | File                                              | Priority | Est. Lines |
| ------- | ----------------------- | ------------------------------------------------- | -------- | ---------- |
| HK-004  | useCurrentTimeIndicator | apps/calendar/hooks/use-current-time-indicator.ts | MEDIUM   | +60        |
| HK-005  | useEventVisibility      | apps/calendar/hooks/use-event-visibility.ts       | MEDIUM   | +80        |

---

## 11.3 Minimal TipTap Hooks (4 Hooks)

| Task ID | Hook             | File                                       | Priority | Est. Lines |
| ------- | ---------------- | ------------------------------------------ | -------- | ---------- |
| HK-006  | useContainerSize | minimal-tiptap/hooks/use-container-size.ts | MEDIUM   | +70        |
| HK-007  | useMinimalTiptap | minimal-tiptap/hooks/use-minimal-tiptap.ts | HIGH     | +150       |
| HK-008  | useTiptapTheme   | minimal-tiptap/hooks/use-theme.ts          | MEDIUM   | +50        |
| HK-009  | useThrottle      | minimal-tiptap/hooks/use-throttle.ts       | MEDIUM   | +70        |

---

## 11.4 Image Extension Hooks (2 Hooks)

| Task ID | Hook            | File                                                       | Priority | Est. Lines |
| ------- | --------------- | ---------------------------------------------------------- | -------- | ---------- |
| HK-010  | useDragResize   | minimal-tiptap/extensions/image/hooks/use-drag-resize.ts   | HIGH     | +120       |
| HK-011  | useImageActions | minimal-tiptap/extensions/image/hooks/use-image-actions.ts | HIGH     | +80        |

---

## 11.5 Utility Libraries (8 Files)

| Task ID | Utility     | File                | Priority | Est. Lines |
| ------- | ----------- | ------------------- | -------- | ---------- |
| UT-001  | Arcjet      | lib/arcjet.ts       | MEDIUM   | +60        |
| UT-002  | ComposeRefs | lib/compose-refs.ts | MEDIUM   | +60        |
| UT-003  | Env         | lib/env.ts          | HIGH     | +70        |
| UT-004  | Fonts       | lib/fonts.ts        | LOW      | +60        |
| UT-005  | GA          | lib/ga.ts           | LOW      | +40        |
| UT-006  | Posthog     | lib/posthog.ts      | MEDIUM   | +60        |
| UT-007  | Themes      | lib/themes.ts       | MEDIUM   | +50        |
| UT-008  | Utils       | lib/utils.ts        | HIGH     | +50        |

---

# SECTION 12: TIPTAP EXTENSIONS (12 Extensions)

| Task ID | Extension         | File                                                    | Priority | Est. Lines |
| ------- | ----------------- | ------------------------------------------------------- | -------- | ---------- |
| TE-001  | CodeBlockLowlight | extensions/code-block-lowlight/code-block-lowlight.ts   | HIGH     | +60        |
| TE-002  | Color             | extensions/color/color.ts                               | MEDIUM   | +50        |
| TE-003  | FileHandler       | extensions/file-handler/index.ts                        | HIGH     | +100       |
| TE-004  | HorizontalRule    | extensions/horizontal-rule/horizontal-rule.ts           | LOW      | +40        |
| TE-005  | Image             | extensions/image/image.ts                               | HIGH     | +200       |
| TE-006  | ImageActions      | extensions/image/components/image-actions.tsx           | HIGH     | +140       |
| TE-007  | ImageOverlay      | extensions/image/components/image-overlay.tsx           | MEDIUM   | +50        |
| TE-008  | ImageViewBlock    | extensions/image/components/image-view-block.tsx        | HIGH     | +220       |
| TE-009  | ResizeHandle      | extensions/image/components/resize-handle.tsx           | MEDIUM   | +50        |
| TE-010  | Link              | extensions/link/link.ts                                 | HIGH     | +100       |
| TE-011  | ResetMarksOnEnter | extensions/reset-marks-on-enter/reset-marks-on-enter.ts | LOW      | +40        |
| TE-012  | Selection         | extensions/selection/selection.ts                       | MEDIUM   | +50        |
| TE-013  | UnsetAllMarks     | extensions/unset-all-marks/unset-all-marks.ts           | LOW      | +40        |

---

# SECTION 13: STORES & STATE MANAGEMENT

| Task ID | Store        | File                        | Priority | Est. Lines |
| ------- | ------------ | --------------------------- | -------- | ---------- |
| ST-001  | useChatStore | apps/chat/use-chat-store.ts | HIGH     | +60        |
| ST-002  | useMailStore | apps/mail/use-mail.ts       | HIGH     | +50        |
| ST-003  | POSStore     | apps/pos-system/store.ts    | HIGH     | +120       |
| ST-004  | TodoStore    | apps/todo-list-app/store.ts | HIGH     | +220       |

---

# FINAL UPDATED SUMMARY

## Grand Total by Section

| Section                          | Items   | Sub-Tasks | Est. Lines   |
| -------------------------------- | ------- | --------- | ------------ |
| 1. UI Components                 | 58      | 290       | ~29,000      |
| 2. Custom Components             | 27      | 108       | ~8,500       |
| 3. Layout Components             | 10      | 50        | ~4,000       |
| 4. Theme Customizer              | 9       | 36        | ~3,000       |
| 5. Dashboard Pages               | 40      | 200       | ~20,000      |
| 6. Auth Pages                    | 5       | 25        | ~2,500       |
| 7. Global Components             | 5       | 25        | ~2,000       |
| 8. Infrastructure                | 78      | 217       | ~12,000      |
| 9. Additional Pages              | 25      | 105       | ~4,100       |
| **10. Dashboard Sub-Components** | **201** | **603**   | **~22,000**  |
| **11. Hooks & Utilities**        | **19**  | **57**    | **~1,800**   |
| **12. TipTap Extensions**        | **13**  | **39**    | **~1,200**   |
| **13. Stores**                   | **4**   | **12**    | **~450**     |
| **GRAND TOTAL**                  | **494** | **1,767** | **~110,550** |

---

_Generated: 2026-02-05_ _Total Components/Pages/Utilities: 494_ _Total
Sub-Tasks: 1,767_ _Estimated Lines: ~110,550_ _Coverage Target: 100% ✅_ _Gap
Analysis: COMPLETE - No missing items_
