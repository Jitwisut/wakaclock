# PRD: Comprehensive Storybook Documentation System

## Introduction

This PRD defines the complete documentation effort for the
`template-frontend-rust` project. Every component and page will receive
enterprise-grade Storybook documentation matching the Button component's 5-file
pattern:

1. **Source Component** - JSDoc, CVA variants, data-\* attributes, ARIA
2. **Storybook Stories** - Interactive demos, play tests, i18n, accessibility
3. **Factory** - Faker-based test data generation
4. **MSW Handlers** - Mock Service Worker API handlers
5. **I18N Translations** - en.ts & ja.ts namespace entries

**Reference:** `docs/button.master.md` - The master template specification

---

## Goals

- 100% Storybook coverage for all 146 component files
- 100% Storybook coverage for all 365 app page files
- Enterprise-grade documentation matching Button component quality
- Full i18n support (English + Japanese)
- Comprehensive accessibility testing
- MSW handlers for all async operations
- Zero gaps, zero missing features, zero forgotten patterns

---

## Scope Summary

| Category          | File Count | Stories Files | Factory Files | Handler Files |
| ----------------- | ---------- | ------------- | ------------- | ------------- |
| UI Primitives     | 50         | 50            | 50            | 50            |
| Custom Components | 45         | 45            | 45            | 45            |
| Layout Components | 12         | 12            | 12            | 12            |
| Theme Customizer  | 9          | 9             | 9             | 9             |
| Root Components   | 5          | 5             | 5             | 5             |
| App Pages         | 117 dirs   | 117           | 50            | 50            |
| **TOTAL**         | **238+**   | **238**       | **171**       | **171**       |

---

# PHASE 1: UI PRIMITIVES (`/components/ui/*.tsx`)

## US-001: Accordion Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
accordion.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/accordion.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/accordion.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/accordion.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/accordion.handlers.ts`
- [ ] Add `accordion.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Variants, Disabled, Keyboard, RTL,
      Japanese
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-002: Alert Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
alert.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/alert.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/alert.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/alert.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/alert.handlers.ts`
- [ ] Add `alert.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Variants (default, destructive, warning,
      success), Icons, Dismissible
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-003: Alert Dialog Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
alert-dialog.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/alert-dialog.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/alert-dialog.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/alert-dialog.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/alert-dialog.handlers.ts`
- [ ] Add `alertDialog.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Destructive, AsyncAction, Keyboard,
      Focus trap
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-004: Aspect Ratio Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
aspect-ratio.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/aspect-ratio.tsx` with JSDoc, data-\* attributes
- [ ] Create `/.storybook/stories/components/ui/aspect-ratio.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/aspect-ratio.factory.ts`
- [ ] Add `aspectRatio.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, 16:9, 4:3, 1:1, Custom ratios, With images
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-005: Avatar Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
avatar.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/avatar.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/avatar.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/avatar.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/avatar.handlers.ts`
- [ ] Add `avatar.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Sizes, Fallback, Loading, Group, Badge
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-006: Badge Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
badge.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/badge.tsx` with JSDoc, data-\* attributes
- [ ] Create `/.storybook/stories/components/ui/badge.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/badge.factory.ts`
- [ ] Add `badge.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Variants, Sizes, WithIcon, Removable,
      Animated
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-007: Breadcrumb Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
breadcrumb.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/breadcrumb.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/breadcrumb.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/breadcrumb.factory.ts`
- [ ] Add `breadcrumb.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithIcons, Collapsed, Custom
      separator, RTL
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-008: Button Group Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
button-group.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/button-group.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/button-group.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/button-group.factory.ts`
- [ ] Add `buttonGroup.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Horizontal, Vertical, Sizes, Mixed variants
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-009: Calendar Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
calendar.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/calendar.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/calendar.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/calendar.factory.ts`
- [ ] Add `calendar.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Single, Range, Multiple, Disabled dates,
      Locales, Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-010: Card Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
card.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/card.tsx` with JSDoc, data-\* attributes
- [ ] Create `/.storybook/stories/components/ui/card.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/card.factory.ts`
- [ ] Add `card.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithHeader, WithFooter, Interactive,
      Loading
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-011: Carousel Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
carousel.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/carousel.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/carousel.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/carousel.factory.ts`
- [ ] Add `carousel.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Autoplay, Vertical, WithThumbnails,
      Keyboard, Touch
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-012: Chart Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
chart.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/chart.tsx` with JSDoc, data-\* attributes
- [ ] Create `/.storybook/stories/components/ui/chart.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/chart.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/chart.handlers.ts`
- [ ] Add `chart.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Line, Bar, Area, Pie, Responsive, Loading,
      Error
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-013: Checkbox Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
checkbox.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/checkbox.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/checkbox.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/checkbox.factory.ts`
- [ ] Add `checkbox.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Checked, Indeterminate, Disabled,
      WithLabel, Group
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-014: Collapsible Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
collapsible.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/collapsible.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/collapsible.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/collapsible.factory.ts`
- [ ] Add `collapsible.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Controlled, Animated, Nested,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-015: Command Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
command.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/command.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/command.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/command.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/command.handlers.ts`
- [ ] Add `command.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithGroups, Search, Loading, Empty,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-016: Context Menu Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
context-menu.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/context-menu.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/context-menu.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/context-menu.factory.ts`
- [ ] Add `contextMenu.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithSubmenus, WithCheckbox,
      WithRadio, Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-017: Dialog Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
dialog.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/dialog.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/dialog.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/dialog.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/dialog.handlers.ts`
- [ ] Add `dialog.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Sizes, Scrollable, Form, Async,
      FocusTrap, Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-018: Drawer Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
drawer.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/drawer.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/drawer.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/drawer.factory.ts`
- [ ] Add `drawer.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Directions (top, right, bottom, left),
      Nested, Scrollable
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-019: Dropdown Menu Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
dropdown-menu.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/dropdown-menu.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/dropdown-menu.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/dropdown-menu.factory.ts`
- [ ] Add `dropdownMenu.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithIcons, Submenus, Checkbox,
      Radio, Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-020: Empty Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
empty.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/empty.tsx` with JSDoc, data-\* attributes
- [ ] Create `/.storybook/stories/components/ui/empty.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/empty.factory.ts`
- [ ] Add `empty.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithIcon, WithAction, Custom
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-021: Field Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
field.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/field.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/field.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/field.factory.ts`
- [ ] Add `field.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithLabel, WithError, WithHint,
      Required, Disabled
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-022: Form Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
form.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/form.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/form.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/form.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/form.handlers.ts`
- [ ] Add `form.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Validation, Async submit, Error
      states
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-023: Hover Card Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
hover-card.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/hover-card.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/hover-card.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/hover-card.factory.ts`
- [ ] Add `hoverCard.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithImage, Delay, Positioning
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-024: Input Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
input.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/input.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/input.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/input.factory.ts`
- [ ] Add `input.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Types, Sizes, Disabled, Error, WithIcon,
      Password
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-025: Input Group Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
input-group.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/input-group.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/input-group.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/input-group.factory.ts`
- [ ] Add `inputGroup.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, WithPrefix, WithSuffix, WithButton, Combined
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-026: Input OTP Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
input-otp.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/input-otp.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/input-otp.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/input-otp.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/input-otp.handlers.ts`
- [ ] Add `inputOtp.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Lengths, Error, Success, Resend
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-027: Item Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
item.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/item.tsx` with JSDoc, data-\* attributes
- [ ] Create `/.storybook/stories/components/ui/item.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/item.factory.ts`
- [ ] Add `item.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithIcon, WithDescription, Active,
      Disabled
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-028: Kanban Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
kanban.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/kanban.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/kanban.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/kanban.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/kanban.handlers.ts`
- [ ] Add `kanban.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, DragDrop, AddCard, AddColumn,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-029: Kbd Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
kbd.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/kbd.tsx` with JSDoc, data-\* attributes
- [ ] Create `/.storybook/stories/components/ui/kbd.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/kbd.factory.ts`
- [ ] Add `kbd.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Single, Combination, Sizes, Platform-specific
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-030: Label Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
label.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/label.tsx` with JSDoc, data-\* attributes
- [ ] Create `/.storybook/stories/components/ui/label.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/label.factory.ts`
- [ ] Add `label.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Required, WithHint, Disabled
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-031: Menubar Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
menubar.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/menubar.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/menubar.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/menubar.factory.ts`
- [ ] Add `menubar.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithShortcuts, Checkboxes, Radio,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-032: Native Select Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
native-select.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/native-select.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/native-select.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/native-select.factory.ts`
- [ ] Add `nativeSelect.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithGroups, Disabled, Error
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-033: Navigation Menu Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
navigation-menu.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/navigation-menu.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/navigation-menu.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/navigation-menu.factory.ts`
- [ ] Add `navigationMenu.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithDropdowns, Horizontal, Vertical,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-034: Pagination Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
pagination.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/pagination.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/pagination.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/pagination.factory.ts`
- [ ] Add `pagination.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithEllipsis, Sizes, Controlled,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-035: Popover Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
popover.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/popover.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/popover.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/popover.factory.ts`
- [ ] Add `popover.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Positioning, WithForm, Controlled,
      FocusTrap
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-036: Progress Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
progress.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/progress.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/progress.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/progress.factory.ts`
- [ ] Add `progress.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Sizes, Colors, Indeterminate,
      WithLabel
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-037: Radio Group Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
radio-group.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/radio-group.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/radio-group.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/radio-group.factory.ts`
- [ ] Add `radioGroup.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Horizontal, Disabled,
      WithDescription, Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-038: Reel Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
reel.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/reel.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/reel.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/reel.factory.ts`
- [ ] Add `reel.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithControls, Autoplay, Touch,
      Responsive
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-039: Resizable Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
resizable.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/resizable.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/resizable.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/resizable.factory.ts`
- [ ] Add `resizable.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Horizontal, Vertical, Nested, WithLimits,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-040: Scroll Area Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
scroll-area.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/scroll-area.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/scroll-area.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/scroll-area.factory.ts`
- [ ] Add `scrollArea.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Vertical, Horizontal, Both, WithShadows,
      Custom scrollbar
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-041: Select Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
select.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/select.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/select.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/select.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/select.handlers.ts`
- [ ] Add `select.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithGroups, Search, Multi, Async,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-042: Separator Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
separator.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/separator.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/separator.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/separator.factory.ts`
- [ ] Add `separator.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Horizontal, Vertical, WithLabel, Decorative
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-043: Sheet Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
sheet.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/sheet.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/sheet.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/sheet.factory.ts`
- [ ] Add `sheet.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Sides (top, right, bottom, left), Sizes,
      WithForm, FocusTrap
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-044: Sidebar Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
sidebar.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/sidebar.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/sidebar.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/sidebar.factory.ts`
- [ ] Add `sidebar.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Collapsed, WithGroups, Mobile,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-045: Skeleton Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
skeleton.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/skeleton.tsx` with JSDoc, data-\* attributes
- [ ] Create `/.storybook/stories/components/ui/skeleton.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/skeleton.factory.ts`
- [ ] Add `skeleton.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Text, Avatar, Card, Table, Custom shapes
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-046: Slider Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
slider.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/slider.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/slider.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/slider.factory.ts`
- [ ] Add `slider.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Range, Steps, Marks, Vertical,
      Disabled, Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-047: Sonner (Toast) Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
sonner.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/sonner.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/sonner.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/sonner.factory.ts`
- [ ] Add `sonner.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Types, Positions, WithAction, Promise, Custom
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-048: Spinner Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
spinner.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/spinner.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/spinner.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/spinner.factory.ts`
- [ ] Add `spinner.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Sizes, Colors, InButton, Overlay
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-049: Switch Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
switch.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/switch.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/switch.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/switch.factory.ts`
- [ ] Add `switch.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Sizes, WithLabel, Disabled, Loading,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-050: Table Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
table.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/table.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/table.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/table.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/table.handlers.ts`
- [ ] Add `table.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Sortable, Selectable, Pagination,
      Loading, Empty
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-051: Tabs Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
tabs.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/tabs.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/tabs.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/tabs.factory.ts`
- [ ] Add `tabs.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Vertical, WithIcons, Disabled,
      Controlled, Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-052: Textarea Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
textarea.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/textarea.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/textarea.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/textarea.factory.ts`
- [ ] Add `textarea.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, AutoResize, CharCount, Disabled,
      Error
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-053: Timeline Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
timeline.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/timeline.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/timeline.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/timeline.factory.ts`
- [ ] Add `timeline.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Horizontal, WithIcons, Alternating,
      Loading
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-054: Toast Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
toast.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/toast.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/toast.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/toast.factory.ts`
- [ ] Add `toast.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Variants, WithAction, WithDescription,
      Dismissible, Stack
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-055: Toggle Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
toggle.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/toggle.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/toggle.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/toggle.factory.ts`
- [ ] Add `toggle.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Sizes, WithIcon, Disabled, Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-056: Toggle Group Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
toggle-group.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/toggle-group.tsx` with JSDoc, data-\* attributes,
      ARIA
- [ ] Create `/.storybook/stories/components/ui/toggle-group.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/toggle-group.factory.ts`
- [ ] Add `toggleGroup.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Single, Multiple, Sizes, WithIcons, Disabled,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-057: Tooltip Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
tooltip.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/tooltip.tsx` with JSDoc, data-\* attributes, ARIA
- [ ] Create `/.storybook/stories/components/ui/tooltip.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/tooltip.factory.ts`
- [ ] Add `tooltip.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Positions, Delay, WithArrow, Rich content,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 2: CUSTOM COMPONENTS (`/components/ui/custom/`)

## US-058: Count Animation Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
count-animation.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/count-animation.tsx` with JSDoc, data-\*
      attributes
- [ ] Create
      `/.storybook/stories/components/ui/custom/count-animation.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/count-animation.factory.ts`
- [ ] Add `countAnimation.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Formats, Durations, Easing, Currency
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-059: Minimal TipTap Editor Documentation

**Description:** As a developer, I want complete Storybook documentation for
minimal-tiptap following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/minimal-tiptap/minimal-tiptap.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/ui/custom/minimal-tiptap.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/minimal-tiptap.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/minimal-tiptap.handlers.ts`
- [ ] Add `minimalTiptap.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Toolbar options, Image upload, Link
      editing
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-060: Prompt Chat Container Documentation

**Description:** As a developer, I want complete Storybook documentation for
prompt/chat-container.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/prompt/chat-container.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/ui/custom/prompt/chat-container.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/chat-container.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/chat-container.handlers.ts`
- [ ] Add `chatContainer.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithMessages, Streaming, Error
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-061: Prompt Code Block Documentation

**Description:** As a developer, I want complete Storybook documentation for
prompt/code-block.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/prompt/code-block.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/ui/custom/prompt/code-block.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/code-block.factory.ts`
- [ ] Add `codeBlock.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Languages, LineNumbers, Copy, Highlight
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-062: Prompt Input Documentation

**Description:** As a developer, I want complete Storybook documentation for
prompt/input.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/prompt/input.tsx` with JSDoc
- [ ] Create `/.storybook/stories/components/ui/custom/prompt/input.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/prompt-input.factory.ts`
- [ ] Add `promptInput.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithAttachments, Disabled, Loading
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-063: Prompt Loader Documentation

**Description:** As a developer, I want complete Storybook documentation for
prompt/loader.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/prompt/loader.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/ui/custom/prompt/loader.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/prompt-loader.factory.ts`
- [ ] Add `promptLoader.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Variants, Sizes, WithText
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-064: Prompt Markdown Documentation

**Description:** As a developer, I want complete Storybook documentation for
prompt/markdown.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/prompt/markdown.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/ui/custom/prompt/markdown.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/prompt-markdown.factory.ts`
- [ ] Add `promptMarkdown.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Headings, Lists, Code, Tables, Links, Images
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-065: Prompt Message Documentation

**Description:** As a developer, I want complete Storybook documentation for
prompt/message.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/prompt/message.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/ui/custom/prompt/message.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/prompt-message.factory.ts`
- [ ] Add `promptMessage.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, User, Assistant, System, Error, WithCode
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-066: Prompt Scroll Button Documentation

**Description:** As a developer, I want complete Storybook documentation for
prompt/scroll-button.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/prompt/scroll-button.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/ui/custom/prompt/scroll-button.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/prompt-scroll-button.factory.ts`
- [ ] Add `promptScrollButton.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Visible, Hidden, Animated
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-067: Prompt Suggestion Documentation

**Description:** As a developer, I want complete Storybook documentation for
prompt/suggestion.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/ui/custom/prompt/suggestion.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/ui/custom/prompt/suggestion.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/prompt-suggestion.factory.ts`
- [ ] Add `promptSuggestion.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Multiple, WithIcons, Disabled
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 3: LAYOUT COMPONENTS (`/components/layout/`)

## US-068: Header Index Documentation

**Description:** As a developer, I want complete Storybook documentation for
layout/header/index.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/layout/header/index.tsx` with JSDoc
- [ ] Create `/.storybook/stories/components/layout/header.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/header.factory.ts`
- [ ] Add `header.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Mobile, WithSearch, WithUser
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-069: Header Notifications Documentation

**Description:** As a developer, I want complete Storybook documentation for
layout/header/notifications.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/layout/header/notifications.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/layout/header/notifications.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/notifications.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/notifications.handlers.ts`
- [ ] Add `notifications.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Empty, WithItems, Unread, MarkAllRead
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-070: Header Search Documentation

**Description:** As a developer, I want complete Storybook documentation for
layout/header/search.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/layout/header/search.tsx` with JSDoc
- [ ] Create `/.storybook/stories/components/layout/header/search.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/search.factory.ts`
- [ ] Create `/.storybook/stories/_handlers/search.handlers.ts`
- [ ] Add `search.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithResults, Loading, Empty,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-071: Header Theme Switch Documentation

**Description:** As a developer, I want complete Storybook documentation for
layout/header/theme-switch.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/layout/header/theme-switch.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/layout/header/theme-switch.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/theme-switch.factory.ts`
- [ ] Add `themeSwitch.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Light, Dark, System, Animated
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-072: Header User Menu Documentation

**Description:** As a developer, I want complete Storybook documentation for
layout/header/user-menu.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/layout/header/user-menu.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/layout/header/user-menu.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/user-menu.factory.ts`
- [ ] Add `userMenu.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithAvatar, LoggedOut, Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-073: Logo Documentation

**Description:** As a developer, I want complete Storybook documentation for
layout/logo.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/layout/logo.tsx` with JSDoc
- [ ] Create `/.storybook/stories/components/layout/logo.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/logo.factory.ts`
- [ ] Add `logo.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Sizes, WithText, Collapsed
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-074: App Sidebar Documentation

**Description:** As a developer, I want complete Storybook documentation for
layout/sidebar/app-sidebar.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/layout/sidebar/app-sidebar.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/layout/sidebar/app-sidebar.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/app-sidebar.factory.ts`
- [ ] Add `appSidebar.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Collapsed, Mobile, WithGroups
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-075: Nav Main Documentation

**Description:** As a developer, I want complete Storybook documentation for
layout/sidebar/nav-main.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/layout/sidebar/nav-main.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/layout/sidebar/nav-main.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/nav-main.factory.ts`
- [ ] Add `navMain.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithSubitems, Active, Collapsed,
      Keyboard
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-076: Nav User Documentation

**Description:** As a developer, I want complete Storybook documentation for
layout/sidebar/nav-user.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/layout/sidebar/nav-user.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/layout/sidebar/nav-user.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/nav-user.factory.ts`
- [ ] Add `navUser.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithAvatar, Collapsed, WithDropdown
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 4: THEME CUSTOMIZER (`/components/theme-customizer/`)

## US-077: Color Mode Selector Documentation

**Description:** As a developer, I want complete Storybook documentation for
theme-customizer/color-mode-selector.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/theme-customizer/color-mode-selector.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/theme-customizer/color-mode-selector.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/color-mode-selector.factory.ts`
- [ ] Add `colorModeSelector.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Light, Dark, System
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-078: Content Layout Selector Documentation

**Description:** As a developer, I want complete Storybook documentation for
theme-customizer/content-layout-selector.tsx following the Button master
template.

**Acceptance Criteria:**

- [ ] Update `components/theme-customizer/content-layout-selector.tsx` with
      JSDoc
- [ ] Create
      `/.storybook/stories/components/theme-customizer/content-layout-selector.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/content-layout-selector.factory.ts`
- [ ] Add `contentLayoutSelector.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Wide, Narrow, Compact
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-079: Theme Panel Documentation

**Description:** As a developer, I want complete Storybook documentation for
theme-customizer/panel.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/theme-customizer/panel.tsx` with JSDoc
- [ ] Create `/.storybook/stories/components/theme-customizer/panel.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/theme-panel.factory.ts`
- [ ] Add `themePanel.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Open, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-080: Preset Selector Documentation

**Description:** As a developer, I want complete Storybook documentation for
theme-customizer/preset-selector.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/theme-customizer/preset-selector.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/theme-customizer/preset-selector.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/preset-selector.factory.ts`
- [ ] Add `presetSelector.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, AllPresets, Selected, Hover
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-081: Radius Selector Documentation

**Description:** As a developer, I want complete Storybook documentation for
theme-customizer/radius-selector.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/theme-customizer/radius-selector.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/theme-customizer/radius-selector.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/radius-selector.factory.ts`
- [ ] Add `radiusSelector.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, AllRadii, Selected, Preview
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-082: Reset Theme Documentation

**Description:** As a developer, I want complete Storybook documentation for
theme-customizer/reset-theme.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/theme-customizer/reset-theme.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/theme-customizer/reset-theme.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/reset-theme.factory.ts`
- [ ] Add `resetTheme.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, Confirm, Success
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-083: Scale Selector Documentation

**Description:** As a developer, I want complete Storybook documentation for
theme-customizer/scale-selector.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/theme-customizer/scale-selector.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/theme-customizer/scale-selector.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/scale-selector.factory.ts`
- [ ] Add `scaleSelector.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, AllScales, Selected, Preview
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-084: Sidebar Mode Selector Documentation

**Description:** As a developer, I want complete Storybook documentation for
theme-customizer/sidebar-mode-selector.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/theme-customizer/sidebar-mode-selector.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/theme-customizer/sidebar-mode-selector.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/sidebar-mode-selector.factory.ts`
- [ ] Add `sidebarModeSelector.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Expanded, Collapsed, Floating
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 5: ROOT COMPONENTS

## US-085: Active Theme Documentation

**Description:** As a developer, I want complete Storybook documentation for
active-theme.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/active-theme.tsx` with JSDoc
- [ ] Create `/.storybook/stories/components/active-theme.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/active-theme.factory.ts`
- [ ] Add `activeTheme.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, AllThemes, Switching
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-086: Card Action Menus Documentation

**Description:** As a developer, I want complete Storybook documentation for
CardActionMenus.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/CardActionMenus.tsx` with JSDoc
- [ ] Create `/.storybook/stories/components/card-action-menus.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/card-action-menus.factory.ts`
- [ ] Add `cardActionMenus.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithCustomActions, Disabled
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-087: Custom Date Range Picker Documentation

**Description:** As a developer, I want complete Storybook documentation for
custom-date-range-picker.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/custom-date-range-picker.tsx` with JSDoc
- [ ] Create
      `/.storybook/stories/components/custom-date-range-picker.stories.tsx`
- [ ] Create
      `/.storybook/stories/_factories/custom-date-range-picker.factory.ts`
- [ ] Add `customDateRangePicker.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, Default, WithPresets, Disabled, Locales
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-088: Date Time Picker Documentation

**Description:** As a developer, I want complete Storybook documentation for
date-time-picker.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/date-time-picker.tsx` with JSDoc
- [ ] Create `/.storybook/stories/components/date-time-picker.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/date-time-picker.factory.ts`
- [ ] Add `dateTimePicker.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, DateOnly, TimeOnly, Both, Disabled, Locales
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-089: Icon Component Documentation

**Description:** As a developer, I want complete Storybook documentation for
icon.tsx following the Button master template.

**Acceptance Criteria:**

- [ ] Update `components/icon.tsx` with JSDoc
- [ ] Create `/.storybook/stories/components/icon.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/icon.factory.ts`
- [ ] Add `icon.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Playground, AllIcons, Sizes, Colors, Spinning
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 6: APP PAGES - DASHBOARDS

## US-090: Academy Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/academy page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/academy.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/academy-page.factory.ts`
- [ ] Add `pages.academy.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-091: CRM Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/crm page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/crm.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/crm-page.factory.ts`
- [ ] Add `pages.crm.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-092: Crypto Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/crypto page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/crypto.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/crypto-page.factory.ts`
- [ ] Add `pages.crypto.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-093: Default Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/default page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/default.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/default-page.factory.ts`
- [ ] Add `pages.default.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-094: Ecommerce Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/ecommerce page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/ecommerce.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/ecommerce-page.factory.ts`
- [ ] Add `pages.ecommerce.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-095: File Manager Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/file-manager page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/file-manager.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/file-manager-page.factory.ts`
- [ ] Add `pages.fileManager.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-096: Finance Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/finance page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/finance.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/finance-page.factory.ts`
- [ ] Add `pages.finance.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-097: Hospital Management Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/hospital-management page.

**Acceptance Criteria:**

- [ ] Create
      `/.storybook/stories/pages/dashboard/hospital-management.stories.tsx`
- [ ] Create
      `/.storybook/stories/_factories/hospital-management-page.factory.ts`
- [ ] Add `pages.hospitalManagement.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-098: Hotel Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/hotel page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/hotel.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/hotel-page.factory.ts`
- [ ] Add `pages.hotel.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-099: Logistics Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/logistics page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/logistics.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/logistics-page.factory.ts`
- [ ] Add `pages.logistics.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

## US-100: Payment Dashboard Page Documentation

**Description:** As a developer, I want complete Storybook documentation for
dashboard/payment page.

**Acceptance Criteria:**

- [ ] Create `/.storybook/stories/pages/dashboard/payment.stories.tsx`
- [ ] Create `/.storybook/stories/_factories/payment-page.factory.ts`
- [ ] Add `pages.payment.*` namespace entries to `en.ts` and `ja.ts`
- [ ] Include stories: Default, Loading, Empty, Mobile
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 7: APP PAGES - APPS (US-101 to US-120)

## US-101: AI Chat App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/ai-chat`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-102: AI Chat V2 App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/ai-chat-v2`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-103: AI Image Generator App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/ai-image-generator`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-104: API Keys App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/api-keys`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-105: Calendar App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/calendar`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-106: Chat App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/chat`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-107: Courses App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/courses`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-108: File Manager App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/file-manager`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-109: Kanban App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/kanban`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-110: Mail App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/mail`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-111: Notes App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/notes`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-112: POS System App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/pos-system`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-113: Social Media App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/social-media`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-114: Tasks App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/tasks`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-115: Text to Speech App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/text-to-speech`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

## US-116: Todo List App Page Documentation

**Acceptance Criteria:**

- [ ] Create stories for `dashboard/(auth)/apps/todo-list-app`
- [ ] Factory + handlers + i18n
- [ ] Typecheck + lint passes

---

# PHASE 8: APP PAGES - GENERAL PAGES (US-117 to US-140)

## US-117 to US-140: General Pages Documentation

Each of the following pages needs complete documentation:

- Empty States (01, 02, 03)
- Error pages (403, 404, 500)
- Onboarding Flow
- Orders (list + detail)
- Pricing (column, single, table)
- Products (list, detail, create)
- Profile
- Settings (all tabs)
- User Profile
- Users
- Project List
- Project Management
- Sales
- Website Analytics
- Widgets (analytics, ecommerce, fitness)

**Acceptance Criteria per page:**

- [ ] Create stories file
- [ ] Create factory file
- [ ] Create handlers file (if async)
- [ ] Add i18n entries
- [ ] Typecheck + lint passes

---

# PHASE 9: GUEST PAGES (US-141 to US-150)

## US-141: Login V1 Page Documentation

## US-142: Login V2 Page Documentation

## US-143: Register V1 Page Documentation

## US-144: Register V2 Page Documentation

## US-145: Forgot Password Page Documentation

## US-146: 404 Error Page Documentation

## US-147: 500 Error Page Documentation

---

## Functional Requirements

- FR-1: Every component must have JSDoc documentation with `@description`,
  `@default`, `@see`
- FR-2: Every component must have `data-slot`, `data-variant`, `data-size`
  attributes
- FR-3: Every interactive component must have ARIA attributes for accessibility
- FR-4: Every component must have a corresponding `.stories.tsx` file
- FR-5: Every component must have a corresponding `.factory.ts` file
- FR-6: Components with async operations must have `.handlers.ts` files
- FR-7: Every component must have i18n entries in both `en.ts` and `ja.ts`
- FR-8: All stories must include Playground, Default, and variant-specific
  stories
- FR-9: All stories must include accessibility tests (keyboard navigation, focus
  management)
- FR-10: All stories must pass typecheck and lint

---

## Non-Goals (Out of Scope)

- No changes to component functionality (documentation only)
- No new components creation
- No refactoring of existing code structure
- No changes to build configuration
- No deployment changes

---

## Technical Considerations

- Reference `docs/button.master.md` for all patterns
- Use existing Button component files as the gold standard
- Maintain consistent file naming conventions
- Follow ESLint rules (no nested ternaries - use helper functions)
- Ensure MSW handlers use `createApiError` and `HTTP_STATUS` from
  `_utils/http-status`

---

## Success Metrics

- 100% of 146 component files have complete Storybook documentation
- 100% of app pages have Storybook stories
- 0 lint errors
- 0 typecheck errors
- All i18n keys present in both en.ts and ja.ts
- All accessibility stories pass

---

## Open Questions

None - comprehensive scope defined.
