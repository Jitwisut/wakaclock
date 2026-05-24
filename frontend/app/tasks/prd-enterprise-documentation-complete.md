# PRD: Enterprise Documentation Complete - Button Pattern Rollout

## Introduction

Upgrade ALL components and pages to match the enterprise-grade Button component
documentation pattern (44K reference implementation). Each component requires
the 5-file documentation triad: Source Component, Stories, Factory, Handlers,
and i18n translations.

**Reference:** `components/ui/button.tsx` (44K) - The gold standard for all
components.

## Goals

- Upgrade every UI component to Button-level documentation quality
- Create comprehensive Storybook stories with play tests, dark mode, i18n
- Establish MSW handlers for all interactive components
- Create Faker-based factories for deterministic test data
- Achieve 100% autodocs coverage with categorized argTypes

## Task Structure

Each task follows this pattern:

- **Source Component:** Add JSDoc, data-\* attributes, ARIA, enterprise features
- **Stories:** Autodocs, play tests, dark mode, Japanese locale, RTL
- **Factory:** Faker-based test data generation
- **Handlers:** MSW API mocking for async scenarios
- **i18n:** Namespace translations in en.ts and ja.ts

---

# PHASE 1: UI COMPONENTS (58 Tasks)

## Section 1.1: Core UI Components

### US-001: Upgrade accordion.tsx to Button Pattern

**Description:** As a developer, I need accordion.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/accordion.tsx` (3.7K → target ~15K)
- `.storybook/stories/components/ui/accordion.stories.tsx`
- `.storybook/stories/_factories/accordion.factory.ts`
- `.storybook/stories/_handlers/accordion.handlers.ts`
- `.storybook/languages/en.ts` (accordion namespace)
- `.storybook/languages/ja.ts` (accordion namespace)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with @description, @default, @see for all props
- [ ] Add data-\* attributes: data-slot, data-state, data-disabled, data-testid
- [ ] Add ARIA attributes: aria-expanded, aria-controls, aria-labelledby
- [ ] Stories include: Playground, Variants, Sizes, DarkMode, Japanese, RTL,
      KeyboardInteraction
- [ ] Play tests verify expand/collapse behavior
- [ ] Factory exports: createFakeAccordionItem, createFakeAccordionItems,
      ACCORDION_TYPES
- [ ] Handlers cover: content loading, async expansion, error states
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`

---

### US-002: Upgrade alert-dialog.tsx to Button Pattern

**Description:** As a developer, I need alert-dialog.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/alert-dialog.tsx` (7.9K → target ~20K)
- `.storybook/stories/components/ui/alert-dialog.stories.tsx`
- `.storybook/stories/_factories/alert-dialog.factory.ts`
- `.storybook/stories/_handlers/alert-dialog.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for AlertDialog, AlertDialogTrigger,
      AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
      AlertDialogTitle, AlertDialogDescription, AlertDialogAction,
      AlertDialogCancel
- [ ] Add data-\* attributes for all sub-components
- [ ] Stories include: Playground, Destructive, Async confirmation, DarkMode,
      Japanese, KeyboardInteraction
- [ ] Play tests verify focus trap, escape key, action/cancel clicks
- [ ] Factory exports: createFakeAlertDialog, createFakeDestructiveDialog
- [ ] Handlers cover: confirm action API, cancel tracking
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-003: Upgrade alert.tsx to Button Pattern

**Description:** As a developer, I need alert.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/alert.tsx` (2.7K → target ~10K)
- `.storybook/stories/components/ui/alert.stories.tsx`
- `.storybook/stories/_factories/alert.factory.ts`
- `.storybook/stories/_handlers/alert.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Alert, AlertTitle, AlertDescription
- [ ] Add variant props: default, destructive, warning, success, info
- [ ] Add data-\* attributes: data-variant, data-slot
- [ ] Stories include: AllVariants, WithIcon, Dismissible, DarkMode, Japanese
- [ ] Factory exports: createFakeAlert, ALERT_VARIANTS, ALERT_ICONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-004: Upgrade aspect-ratio.tsx to Button Pattern

**Description:** As a developer, I need aspect-ratio.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/aspect-ratio.tsx` (817B → target ~3K)
- `.storybook/stories/components/ui/aspect-ratio.stories.tsx`
- `.storybook/stories/_factories/aspect-ratio.factory.ts`
- `.storybook/stories/_handlers/aspect-ratio.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with ratio prop documentation
- [ ] Add data-\* attributes: data-ratio
- [ ] Stories include: Common ratios (16:9, 4:3, 1:1, 21:9), WithImage,
      WithVideo, DarkMode
- [ ] Factory exports: createFakeAspectRatio, COMMON_RATIOS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-005: Upgrade avatar.tsx to Button Pattern

**Description:** As a developer, I need avatar.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/avatar.tsx` (3.5K → target ~12K)
- `.storybook/stories/components/ui/avatar.stories.tsx`
- `.storybook/stories/_factories/avatar.factory.ts`
- `.storybook/stories/_handlers/avatar.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Avatar, AvatarImage, AvatarFallback
- [ ] Add size variants: xs, sm, default, lg, xl
- [ ] Add data-\* attributes: data-size, data-loading, data-error
- [ ] Stories include: Sizes, WithFallback, Group, Loading, DarkMode, Japanese
- [ ] Play tests verify fallback display on image error
- [ ] Factory exports: createFakeAvatar, createFakeAvatarGroup, AVATAR_SIZES
- [ ] Handlers cover: image loading states, error fallback
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-006: Upgrade badge.tsx to Button Pattern

**Description:** As a developer, I need badge.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/badge.tsx` (2.6K → target ~10K)
- `.storybook/stories/components/ui/badge.stories.tsx`
- `.storybook/stories/_factories/badge.factory.ts`
- `.storybook/stories/_handlers/badge.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with variant documentation
- [ ] Add variants: default, secondary, destructive, outline, success, warning
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-variant, data-size
- [ ] Stories include: AllVariants, AllSizes, WithIcon, Removable, DarkMode,
      Japanese
- [ ] Factory exports: createFakeBadge, BADGE_VARIANTS, BADGE_SIZES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-007: Upgrade breadcrumb.tsx to Button Pattern

**Description:** As a developer, I need breadcrumb.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/breadcrumb.tsx` (4.7K → target ~12K)
- `.storybook/stories/components/ui/breadcrumb.stories.tsx`
- `.storybook/stories/_factories/breadcrumb.factory.ts`
- `.storybook/stories/_handlers/breadcrumb.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Breadcrumb, BreadcrumbList, BreadcrumbItem,
      BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis
- [ ] Add data-\* attributes: data-current, data-slot
- [ ] Add ARIA: aria-current="page" for current item
- [ ] Stories include: Default, WithEllipsis, CustomSeparator, DarkMode,
      Japanese, RTL
- [ ] Factory exports: createFakeBreadcrumb, createFakeBreadcrumbPath
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-008: Upgrade button-group.tsx to Button Pattern

**Description:** As a developer, I need button-group.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/button-group.tsx` (3.4K → target ~10K)
- `.storybook/stories/components/ui/button-group.stories.tsx`
- `.storybook/stories/_factories/button-group.factory.ts`
- `.storybook/stories/_handlers/button-group.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for ButtonGroup, ButtonGroupItem
- [ ] Add orientation prop: horizontal, vertical
- [ ] Add data-\* attributes: data-orientation, data-attached
- [ ] Stories include: Horizontal, Vertical, WithIcons, Mixed variants, DarkMode
- [ ] Factory exports: createFakeButtonGroup, BUTTON_GROUP_ORIENTATIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-009: Upgrade calendar.tsx to Button Pattern

**Description:** As a developer, I need calendar.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/calendar.tsx` (17K → target ~30K)
- `.storybook/stories/components/ui/calendar.stories.tsx`
- `.storybook/stories/_factories/calendar.factory.ts`
- `.storybook/stories/_handlers/calendar.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for all calendar props
- [ ] Add data-\* attributes: data-selected, data-today, data-disabled,
      data-outside
- [ ] Add ARIA: aria-selected, aria-disabled, aria-label for navigation
- [ ] Stories include: Single, Range, Multiple, WithDisabledDates, WithEvents,
      DarkMode, Japanese
- [ ] Play tests verify date selection, navigation, keyboard interaction
- [ ] Factory exports: createFakeCalendarDate, createFakeDateRange,
      createFakeCalendarEvents
- [ ] Handlers cover: event fetching, availability checking
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-010: Upgrade card.tsx to Button Pattern

**Description:** As a developer, I need card.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/card.tsx` (4.0K → target ~12K)
- `.storybook/stories/components/ui/card.stories.tsx`
- `.storybook/stories/_factories/card.factory.ts`
- `.storybook/stories/_handlers/card.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Card, CardHeader, CardFooter, CardTitle,
      CardDescription, CardContent
- [ ] Add variant props: default, outline, elevated, ghost
- [ ] Add data-\* attributes: data-variant, data-slot
- [ ] Stories include: AllVariants, WithImage, WithActions, Interactive,
      DarkMode, Japanese
- [ ] Factory exports: createFakeCard, createFakeProductCard, createFakeStatCard
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-011: Upgrade carousel.tsx to Button Pattern

**Description:** As a developer, I need carousel.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/carousel.tsx` (7.7K → target ~18K)
- `.storybook/stories/components/ui/carousel.stories.tsx`
- `.storybook/stories/_factories/carousel.factory.ts`
- `.storybook/stories/_handlers/carousel.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Carousel, CarouselContent, CarouselItem,
      CarouselPrevious, CarouselNext
- [ ] Add orientation prop: horizontal, vertical
- [ ] Add autoplay, loop, slidesToShow props
- [ ] Add data-\* attributes: data-active, data-orientation
- [ ] Add ARIA: aria-roledescription="carousel", aria-label for navigation
- [ ] Stories include: Basic, Autoplay, Vertical, Multiple slides, DarkMode,
      Japanese
- [ ] Play tests verify navigation, autoplay, keyboard controls
- [ ] Factory exports: createFakeCarouselSlide, createFakeCarouselImages
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-012: Upgrade chart.tsx to Button Pattern

**Description:** As a developer, I need chart.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/chart.tsx` (13K → target ~25K)
- `.storybook/stories/components/ui/chart.stories.tsx`
- `.storybook/stories/_factories/chart.factory.ts`
- `.storybook/stories/_handlers/chart.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for ChartContainer, ChartTooltip,
      ChartTooltipContent, ChartLegend, ChartLegendContent
- [ ] Add data-\* attributes: data-chart-type, data-loading
- [ ] Stories include: Line, Bar, Area, Pie, Donut, Combined, Loading, DarkMode,
      Japanese
- [ ] Factory exports: createFakeChartData, createFakeTimeSeriesData,
      CHART_COLORS
- [ ] Handlers cover: data fetching, real-time updates
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-013: Upgrade checkbox.tsx to Button Pattern

**Description:** As a developer, I need checkbox.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/checkbox.tsx` (1.8K → target ~8K)
- `.storybook/stories/components/ui/checkbox.stories.tsx`
- `.storybook/stories/_factories/checkbox.factory.ts`
- `.storybook/stories/_handlers/checkbox.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with checked, indeterminate, disabled props
- [ ] Add data-\* attributes: data-state, data-disabled
- [ ] Add ARIA: aria-checked (true/false/mixed)
- [ ] Stories include: Default, Checked, Indeterminate, Disabled, WithLabel,
      Form, DarkMode, Japanese
- [ ] Play tests verify check/uncheck, keyboard interaction
- [ ] Factory exports: createFakeCheckbox, createFakeCheckboxGroup
- [ ] Handlers cover: preference saving, validation
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-014: Upgrade collapsible.tsx to Button Pattern

**Description:** As a developer, I need collapsible.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/collapsible.tsx` (2.1K → target ~8K)
- `.storybook/stories/components/ui/collapsible.stories.tsx`
- `.storybook/stories/_factories/collapsible.factory.ts`
- `.storybook/stories/_handlers/collapsible.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Collapsible, CollapsibleTrigger,
      CollapsibleContent
- [ ] Add data-\* attributes: data-state (open/closed)
- [ ] Add ARIA: aria-expanded, aria-controls
- [ ] Stories include: Default, DefaultOpen, Controlled, Animated, DarkMode,
      Japanese
- [ ] Play tests verify open/close, animation
- [ ] Factory exports: createFakeCollapsible, createFakeCollapsibleSection
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-015: Upgrade command.tsx to Button Pattern

**Description:** As a developer, I need command.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/command.tsx` (7.4K → target ~18K)
- `.storybook/stories/components/ui/command.stories.tsx`
- `.storybook/stories/_factories/command.factory.ts` (CREATE)
- `.storybook/stories/_handlers/command.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Command, CommandInput, CommandList,
      CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut
- [ ] Add data-\* attributes: data-selected, data-disabled, data-slot
- [ ] Add ARIA: role="listbox", aria-selected
- [ ] Stories include: Basic, WithGroups, WithShortcuts, Dialog, Loading,
      DarkMode, Japanese
- [ ] Play tests verify keyboard navigation, selection, filtering
- [ ] Factory exports: createFakeCommand, createFakeCommandGroup,
      createFakeCommandItem
- [ ] Handlers cover: search suggestions, command execution
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-016: Upgrade context-menu.tsx to Button Pattern

**Description:** As a developer, I need context-menu.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/context-menu.tsx` (13K → target ~25K)
- `.storybook/stories/components/ui/context-menu.stories.tsx`
- `.storybook/stories/_factories/context-menu.factory.ts`
- `.storybook/stories/_handlers/context-menu.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for all context-menu sub-components
- [ ] Add data-\* attributes: data-state, data-highlighted, data-disabled
- [ ] Add ARIA: role="menu", aria-labelledby
- [ ] Stories include: Basic, WithSubmenus, WithCheckboxes, WithRadios,
      DarkMode, Japanese
- [ ] Play tests verify right-click trigger, submenu navigation
- [ ] Factory exports: createFakeContextMenu, createFakeContextMenuItem
- [ ] Handlers cover: action execution, dynamic items
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-017: Upgrade dialog.tsx to Button Pattern

**Description:** As a developer, I need dialog.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/dialog.tsx` (7.6K → target ~18K)
- `.storybook/stories/components/ui/dialog.stories.tsx`
- `.storybook/stories/_factories/dialog.factory.ts`
- `.storybook/stories/_handlers/dialog.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Dialog, DialogTrigger, DialogContent,
      DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose
- [ ] Add size variants: sm, default, lg, xl, full
- [ ] Add data-\* attributes: data-state, data-size
- [ ] Add ARIA: aria-modal, aria-labelledby, aria-describedby
- [ ] Stories include: Basic, Sizes, WithForm, Scrollable, NestedDialogs,
      DarkMode, Japanese
- [ ] Play tests verify focus trap, escape close, overlay click
- [ ] Factory exports: createFakeDialog, createFakeFormDialog
- [ ] Handlers cover: form submission, confirmation
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-018: Upgrade drawer.tsx to Button Pattern

**Description:** As a developer, I need drawer.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/drawer.tsx` (7.2K → target ~18K)
- `.storybook/stories/components/ui/drawer.stories.tsx`
- `.storybook/stories/_factories/drawer.factory.ts`
- `.storybook/stories/_handlers/drawer.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Drawer, DrawerTrigger, DrawerContent,
      DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription, DrawerClose
- [ ] Add direction prop: top, right, bottom, left
- [ ] Add data-\* attributes: data-state, data-direction
- [ ] Stories include: AllDirections, WithForm, Nested, Responsive, DarkMode,
      Japanese
- [ ] Play tests verify swipe gestures, snap points
- [ ] Factory exports: createFakeDrawer, DRAWER_DIRECTIONS
- [ ] Handlers cover: content loading, form submission
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-019: Upgrade dropdown-menu.tsx to Button Pattern

**Description:** As a developer, I need dropdown-menu.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/dropdown-menu.tsx` (14K → target ~28K)
- `.storybook/stories/components/ui/dropdown-menu.stories.tsx`
- `.storybook/stories/_factories/menu.factory.ts`
- `.storybook/stories/_handlers/dropdown-menu.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for all dropdown-menu sub-components
- [ ] Add data-\* attributes: data-state, data-highlighted, data-disabled
- [ ] Add ARIA: role="menu", aria-labelledby
- [ ] Stories include: Basic, WithSubmenus, WithCheckboxes, WithRadios,
      WithShortcuts, DarkMode, Japanese
- [ ] Play tests verify keyboard navigation, selection
- [ ] Factory exports: createFakeDropdownMenu, createFakeDropdownItem
- [ ] Handlers cover: action execution, preference saving
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-020: Upgrade empty.tsx to Button Pattern

**Description:** As a developer, I need empty.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/empty.tsx` (4.2K → target ~10K)
- `.storybook/stories/components/ui/empty.stories.tsx`
- `.storybook/stories/_factories/empty.factory.ts`
- `.storybook/stories/_handlers/empty.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Empty, EmptyIcon, EmptyTitle,
      EmptyDescription, EmptyAction
- [ ] Add preset variants: noData, noResults, noAccess, error, success
- [ ] Add data-\* attributes: data-variant
- [ ] Stories include: AllPresets, CustomIcon, WithAction, DarkMode, Japanese
- [ ] Factory exports: createFakeEmptyState, EMPTY_PRESETS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-021: Upgrade field.tsx to Button Pattern

**Description:** As a developer, I need field.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/field.tsx` (9.4K → target ~18K)
- `.storybook/stories/components/ui/field.stories.tsx`
- `.storybook/stories/_factories/field.factory.ts`
- `.storybook/stories/_handlers/field.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Field, FieldLabel, FieldInput,
      FieldDescription, FieldError
- [ ] Add state props: error, success, warning
- [ ] Add data-\* attributes: data-state, data-required, data-disabled
- [ ] Add ARIA: aria-invalid, aria-describedby
- [ ] Stories include: Default, WithError, WithSuccess, Required, Disabled,
      DarkMode, Japanese
- [ ] Play tests verify error message display, focus states
- [ ] Factory exports: createFakeField, createFakeFormField
- [ ] Handlers cover: validation, autocomplete
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-022: Upgrade form.tsx to Button Pattern

**Description:** As a developer, I need form.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/form.tsx` (5.9K → target ~15K)
- `.storybook/stories/components/ui/form.stories.tsx`
- `.storybook/stories/_factories/form.factory.ts`
- `.storybook/stories/_handlers/form.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Form, FormField, FormItem, FormLabel,
      FormControl, FormDescription, FormMessage
- [ ] Add data-\* attributes: data-invalid, data-valid
- [ ] Add ARIA: aria-invalid, aria-describedby
- [ ] Stories include: LoginForm, RegistrationForm, ProfileForm, WithValidation,
      DarkMode, Japanese
- [ ] Play tests verify form submission, validation feedback
- [ ] Factory exports: createFakeFormData, createFakeLoginForm,
      createFakeRegistrationForm
- [ ] Handlers cover: form submission, validation API
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-023: Upgrade hover-card.tsx to Button Pattern

**Description:** As a developer, I need hover-card.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/hover-card.tsx` (2.6K → target ~8K)
- `.storybook/stories/components/ui/hover-card.stories.tsx`
- `.storybook/stories/_factories/hover-card.factory.ts`
- `.storybook/stories/_handlers/hover-card.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for HoverCard, HoverCardTrigger, HoverCardContent
- [ ] Add delay props: openDelay, closeDelay
- [ ] Add data-\* attributes: data-state, data-side, data-align
- [ ] Stories include: UserProfile, Preview, WithImage, CustomDelay, DarkMode,
      Japanese
- [ ] Factory exports: createFakeHoverCard, createFakeUserHoverCard
- [ ] Handlers cover: profile fetching, preview loading
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-024: Upgrade input.tsx to Button Pattern

**Description:** As a developer, I need input.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/input.tsx` (1.4K → target ~8K)
- `.storybook/stories/components/ui/input.stories.tsx`
- `.storybook/stories/_factories/input.factory.ts`
- `.storybook/stories/_handlers/input.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with type, placeholder, disabled props
- [ ] Add size variants: sm, default, lg
- [ ] Add state variants: default, error, success
- [ ] Add data-\* attributes: data-size, data-state
- [ ] Add ARIA: aria-invalid, aria-describedby
- [ ] Stories include: Types (text, email, password, number), Sizes, States,
      WithIcons, DarkMode, Japanese
- [ ] Play tests verify input behavior, validation display
- [ ] Factory exports: createFakeInput, INPUT_TYPES, INPUT_SIZES
- [ ] Handlers cover: validation, debounced search
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-025: Upgrade input-group.tsx to Button Pattern

**Description:** As a developer, I need input-group.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/input-group.tsx` (7.2K → target ~15K)
- `.storybook/stories/components/ui/input-group.stories.tsx`
- `.storybook/stories/_factories/input-group.factory.ts`
- `.storybook/stories/_handlers/input-group.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for InputGroup, InputGroupAddon, InputGroupInput
- [ ] Add addon position: left, right, both
- [ ] Add data-\* attributes: data-addon-position
- [ ] Stories include: WithPrefix, WithSuffix, WithBoth, WithButton, DarkMode,
      Japanese
- [ ] Factory exports: createFakeInputGroup, ADDON_POSITIONS
- [ ] Handlers cover: search, validation
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-026: Upgrade input-otp.tsx to Button Pattern

**Description:** As a developer, I need input-otp.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/input-otp.tsx` (3.8K → target ~12K)
- `.storybook/stories/components/ui/input-otp.stories.tsx`
- `.storybook/stories/_factories/input-otp.factory.ts`
- `.storybook/stories/_handlers/input-otp.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for InputOTP, InputOTPGroup, InputOTPSlot,
      InputOTPSeparator
- [ ] Add length prop: 4, 6, 8
- [ ] Add data-\* attributes: data-state, data-active
- [ ] Add ARIA: aria-label for each slot
- [ ] Stories include: 4-digit, 6-digit, WithSeparator, AutoSubmit, Error,
      DarkMode, Japanese
- [ ] Play tests verify digit entry, paste handling, auto-submit
- [ ] Factory exports: createFakeOTPInput, OTP_LENGTHS
- [ ] Handlers cover: send OTP, verify OTP, resend
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-027: Upgrade item.tsx to Button Pattern

**Description:** As a developer, I need item.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/item.tsx` (7.3K → target ~15K)
- `.storybook/stories/components/ui/item.stories.tsx`
- `.storybook/stories/_factories/item.factory.ts`
- `.storybook/stories/_handlers/item.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Item and sub-components
- [ ] Add variant props as applicable
- [ ] Add data-\* attributes: data-selected, data-disabled
- [ ] Stories include: Basic, Selected, Disabled, WithActions, DarkMode,
      Japanese
- [ ] Factory exports: createFakeItem, createFakeItemList
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-028: Upgrade kanban.tsx to Button Pattern

**Description:** As a developer, I need kanban.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/kanban.tsx` (32K → target ~45K)
- `.storybook/stories/components/ui/kanban.stories.tsx`
- `.storybook/stories/_factories/kanban.factory.ts`
- `.storybook/stories/_handlers/kanban.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Kanban, KanbanBoard, KanbanColumn, KanbanCard,
      KanbanHeader
- [ ] Add data-\* attributes: data-dragging, data-column, data-card-id
- [ ] Add ARIA: aria-grabbed, aria-dropeffect
- [ ] Stories include: Basic, WithDragDrop, MultiColumn, WithFilters, DarkMode,
      Japanese
- [ ] Play tests verify drag and drop, column management
- [ ] Factory exports: createFakeKanbanBoard, createFakeKanbanColumn,
      createFakeKanbanCard
- [ ] Handlers cover: card move, column update, card CRUD
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-029: Upgrade kbd.tsx to Button Pattern

**Description:** As a developer, I need kbd.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/kbd.tsx` (1.4K → target ~5K)
- `.storybook/stories/components/ui/kbd.stories.tsx`
- `.storybook/stories/_factories/kbd.factory.ts`
- `.storybook/stories/_handlers/kbd.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with key combinations
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-size
- [ ] Stories include: SingleKeys, Combinations, ModifierKeys, AllSizes,
      DarkMode, Japanese
- [ ] Factory exports: createFakeKbd, COMMON_SHORTCUTS, MODIFIER_KEYS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-030: Upgrade label.tsx to Button Pattern

**Description:** As a developer, I need label.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/label.tsx` (1.0K → target ~4K)
- `.storybook/stories/components/ui/label.stories.tsx`
- `.storybook/stories/_factories/label.factory.ts`
- `.storybook/stories/_handlers/label.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with htmlFor, required props
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-required, data-disabled
- [ ] Stories include: Basic, Required, Disabled, WithInput, DarkMode, Japanese
- [ ] Factory exports: createFakeLabel, LABEL_SIZES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-031: Upgrade menubar.tsx to Button Pattern

**Description:** As a developer, I need menubar.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/menubar.tsx` (14K → target ~28K)
- `.storybook/stories/components/ui/menubar.stories.tsx`
- `.storybook/stories/_factories/menubar.factory.ts`
- `.storybook/stories/_handlers/menubar.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for all menubar sub-components
- [ ] Add data-\* attributes: data-state, data-highlighted
- [ ] Add ARIA: role="menubar", role="menuitem"
- [ ] Stories include: FileMenu, EditMenu, ViewMenu, FullMenubar, WithShortcuts,
      DarkMode, Japanese
- [ ] Play tests verify keyboard navigation, submenu access
- [ ] Factory exports: createFakeMenubar, createFakeMenubarItem
- [ ] Handlers cover: action execution
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-032: Upgrade native-select.tsx to Button Pattern

**Description:** As a developer, I need native-select.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/native-select.tsx` (3.1K → target ~8K)
- `.storybook/stories/components/ui/native-select.stories.tsx`
- `.storybook/stories/_factories/native-select.factory.ts`
- `.storybook/stories/_handlers/native-select.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with options, placeholder props
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-size, data-state
- [ ] Stories include: Basic, WithPlaceholder, Disabled, WithGroups, DarkMode,
      Japanese
- [ ] Factory exports: createFakeNativeSelect, createFakeSelectOptions
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-033: Upgrade navigation-menu.tsx to Button Pattern

**Description:** As a developer, I need navigation-menu.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/navigation-menu.tsx` (9.7K → target ~20K)
- `.storybook/stories/components/ui/navigation-menu.stories.tsx`
- `.storybook/stories/_factories/navigation-menu.factory.ts`
- `.storybook/stories/_handlers/navigation-menu.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for all navigation-menu sub-components
- [ ] Add orientation prop: horizontal, vertical
- [ ] Add data-\* attributes: data-state, data-active
- [ ] Add ARIA: role="navigation", aria-label
- [ ] Stories include: Horizontal, Vertical, WithDropdowns, WithIndicator,
      DarkMode, Japanese
- [ ] Play tests verify keyboard navigation, hover states
- [ ] Factory exports: createFakeNavigationMenu, createFakeNavItem
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-034: Upgrade pagination.tsx to Button Pattern

**Description:** As a developer, I need pagination.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/pagination.tsx` (5.4K → target ~12K)
- `.storybook/stories/components/ui/pagination.stories.tsx`
- `.storybook/stories/_factories/pagination.factory.ts`
- `.storybook/stories/_handlers/pagination.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Pagination, PaginationContent, PaginationItem,
      PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-active, data-disabled
- [ ] Add ARIA: aria-current="page", aria-label for navigation
- [ ] Stories include: Basic, WithEllipsis, Compact, WithPageSize, DarkMode,
      Japanese
- [ ] Factory exports: createFakePagination, calculatePaginationRange
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-035: Upgrade popover.tsx to Button Pattern

**Description:** As a developer, I need popover.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/popover.tsx` (3.0K → target ~10K)
- `.storybook/stories/components/ui/popover.stories.tsx`
- `.storybook/stories/_factories/popover.factory.ts`
- `.storybook/stories/_handlers/popover.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Popover, PopoverTrigger, PopoverContent,
      PopoverAnchor
- [ ] Add side/align props
- [ ] Add data-\* attributes: data-state, data-side, data-align
- [ ] Stories include: Basic, WithForm, Positioning, Controlled, DarkMode,
      Japanese
- [ ] Factory exports: createFakePopover, POPOVER_SIDES, POPOVER_ALIGNS
- [ ] Handlers cover: content loading, form submission
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-036: Upgrade progress.tsx to Button Pattern

**Description:** As a developer, I need progress.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/progress.tsx` (1.5K → target ~6K)
- `.storybook/stories/components/ui/progress.stories.tsx`
- `.storybook/stories/_factories/progress.factory.ts`
- `.storybook/stories/_handlers/progress.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with value, max props
- [ ] Add size variants: sm, default, lg
- [ ] Add color variants: default, success, warning, error
- [ ] Add data-\* attributes: data-state, data-value
- [ ] Add ARIA: role="progressbar", aria-valuenow, aria-valuemin, aria-valuemax
- [ ] Stories include: Basic, Animated, WithLabel, Indeterminate, DarkMode,
      Japanese
- [ ] Factory exports: createFakeProgress, PROGRESS_SIZES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-037: Upgrade radio-group.tsx to Button Pattern

**Description:** As a developer, I need radio-group.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/radio-group.tsx` (2.3K → target ~8K)
- `.storybook/stories/components/ui/radio-group.stories.tsx`
- `.storybook/stories/_factories/radio-group.factory.ts`
- `.storybook/stories/_handlers/radio-group.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for RadioGroup, RadioGroupItem
- [ ] Add orientation prop: horizontal, vertical
- [ ] Add data-\* attributes: data-state, data-disabled
- [ ] Add ARIA: role="radiogroup", aria-checked
- [ ] Stories include: Vertical, Horizontal, Disabled, WithCards, DarkMode,
      Japanese
- [ ] Play tests verify selection, keyboard navigation
- [ ] Factory exports: createFakeRadioGroup, createFakeRadioOptions
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-038: Upgrade reel.tsx to Button Pattern

**Description:** As a developer, I need reel.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/reel.tsx` (23K → target ~35K)
- `.storybook/stories/components/ui/reel.stories.tsx`
- `.storybook/stories/_factories/reel.factory.ts`
- `.storybook/stories/_handlers/reel.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for all reel sub-components
- [ ] Add data-\* attributes: data-scroll-position, data-snap
- [ ] Stories include: Horizontal, Vertical, WithSnap, Infinite, DarkMode,
      Japanese
- [ ] Factory exports: createFakeReelItems, REEL_ORIENTATIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-039: Upgrade resizable.tsx to Button Pattern

**Description:** As a developer, I need resizable.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/resizable.tsx` (3.1K → target ~10K)
- `.storybook/stories/components/ui/resizable.stories.tsx`
- `.storybook/stories/_factories/resizable.factory.ts`
- `.storybook/stories/_handlers/resizable.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for ResizablePanelGroup, ResizablePanel,
      ResizableHandle
- [ ] Add direction prop: horizontal, vertical
- [ ] Add data-\* attributes: data-panel-size, data-direction
- [ ] Stories include: Horizontal, Vertical, Nested, WithMinMax, Collapsible,
      DarkMode
- [ ] Factory exports: createFakeResizableLayout, RESIZABLE_DIRECTIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-040: Upgrade scroll-area.tsx to Button Pattern

**Description:** As a developer, I need scroll-area.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/scroll-area.tsx` (2.5K → target ~8K)
- `.storybook/stories/components/ui/scroll-area.stories.tsx`
- `.storybook/stories/_factories/scroll-area.factory.ts`
- `.storybook/stories/_handlers/scroll-area.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for ScrollArea, ScrollBar
- [ ] Add orientation prop: vertical, horizontal, both
- [ ] Add data-\* attributes: data-orientation, data-state
- [ ] Stories include: Vertical, Horizontal, Both, WithCustomScrollbar, DarkMode
- [ ] Factory exports: createFakeScrollContent, SCROLL_ORIENTATIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-041: Upgrade select.tsx to Button Pattern

**Description:** As a developer, I need select.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/select.tsx` (9.6K → target ~20K)
- `.storybook/stories/components/ui/select.stories.tsx`
- `.storybook/stories/_factories/select.factory.ts`
- `.storybook/stories/_handlers/select.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Select, SelectTrigger, SelectContent,
      SelectItem, SelectGroup, SelectLabel, SelectSeparator, SelectValue
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-state, data-disabled, data-placeholder
- [ ] Add ARIA: role="listbox", aria-selected
- [ ] Stories include: Basic, WithGroups, Searchable, Multi, Async, DarkMode,
      Japanese
- [ ] Play tests verify selection, keyboard navigation, search
- [ ] Factory exports: createFakeSelect, createFakeSelectGroups
- [ ] Handlers cover: async options loading
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-042: Upgrade separator.tsx to Button Pattern

**Description:** As a developer, I need separator.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/separator.tsx` (1.1K → target ~4K)
- `.storybook/stories/components/ui/separator.stories.tsx`
- `.storybook/stories/_factories/separator.factory.ts`
- `.storybook/stories/_handlers/separator.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with orientation prop
- [ ] Add decorative prop for accessibility
- [ ] Add data-\* attributes: data-orientation
- [ ] Add ARIA: role="separator" (when not decorative)
- [ ] Stories include: Horizontal, Vertical, WithLabel, Decorative, DarkMode
- [ ] Factory exports: createFakeSeparator, SEPARATOR_ORIENTATIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-043: Upgrade sheet.tsx to Button Pattern

**Description:** As a developer, I need sheet.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/sheet.tsx` (7.2K → target ~18K)
- `.storybook/stories/components/ui/sheet.stories.tsx`
- `.storybook/stories/_factories/sheet.factory.ts`
- `.storybook/stories/_handlers/sheet.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Sheet, SheetTrigger, SheetContent,
      SheetHeader, SheetFooter, SheetTitle, SheetDescription, SheetClose
- [ ] Add side prop: top, right, bottom, left
- [ ] Add size props for each side
- [ ] Add data-\* attributes: data-state, data-side
- [ ] Stories include: AllSides, WithForm, Sizes, WithNavigation, DarkMode,
      Japanese
- [ ] Play tests verify close on escape, overlay click
- [ ] Factory exports: createFakeSheet, SHEET_SIDES
- [ ] Handlers cover: content loading, form submission
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-044: Upgrade sidebar.tsx to Button Pattern

**Description:** As a developer, I need sidebar.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/sidebar.tsx` (30K → target ~45K)
- `.storybook/stories/components/ui/sidebar.stories.tsx`
- `.storybook/stories/_factories/sidebar.factory.ts`
- `.storybook/stories/_handlers/sidebar.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for all sidebar sub-components
- [ ] Add collapsible, variant props
- [ ] Add data-\* attributes: data-state, data-collapsible, data-side
- [ ] Stories include: Default, Collapsible, WithIcons, WithGroups, Mobile,
      DarkMode, Japanese
- [ ] Play tests verify collapse/expand, mobile toggle
- [ ] Factory exports: createFakeSidebar, createFakeSidebarNavigation
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-045: Upgrade skeleton.tsx to Button Pattern

**Description:** As a developer, I need skeleton.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/skeleton.tsx` (685B → target ~3K)
- `.storybook/stories/components/ui/skeleton.stories.tsx`
- `.storybook/stories/_factories/skeleton.factory.ts`
- `.storybook/stories/_handlers/skeleton.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with shape variants
- [ ] Add shape variants: text, circle, rectangle, card
- [ ] Add animation prop: pulse, wave, none
- [ ] Add data-\* attributes: data-shape, data-animation
- [ ] Stories include: Text, Avatar, Card, Table, Form, DarkMode
- [ ] Factory exports: createFakeSkeleton, SKELETON_SHAPES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-046: Upgrade slider.tsx to Button Pattern

**Description:** As a developer, I need slider.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/slider.tsx` (2.8K → target ~10K)
- `.storybook/stories/components/ui/slider.stories.tsx`
- `.storybook/stories/_factories/slider.factory.ts`
- `.storybook/stories/_handlers/slider.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with min, max, step, value props
- [ ] Add orientation prop: horizontal, vertical
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-orientation, data-disabled
- [ ] Add ARIA: role="slider", aria-valuenow, aria-valuemin, aria-valuemax
- [ ] Stories include: Basic, Range, Vertical, WithMarks, WithInput, DarkMode,
      Japanese
- [ ] Play tests verify drag, keyboard interaction
- [ ] Factory exports: createFakeSlider, SLIDER_ORIENTATIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-047: Upgrade sonner.tsx to Button Pattern

**Description:** As a developer, I need sonner.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/sonner.tsx` (1.1K → target ~5K)
- `.storybook/stories/components/ui/sonner.stories.tsx`
- `.storybook/stories/_factories/sonner.factory.ts`
- `.storybook/stories/_handlers/sonner.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Toaster configuration
- [ ] Add position prop options
- [ ] Stories include: AllPositions, AllTypes, WithAction, WithPromise, DarkMode
- [ ] Factory exports: createFakeToast, TOAST_TYPES, TOAST_POSITIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-048: Upgrade spinner.tsx to Button Pattern

**Description:** As a developer, I need spinner.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/spinner.tsx` (703B → target ~3K)
- `.storybook/stories/components/ui/spinner.stories.tsx`
- `.storybook/stories/_factories/spinner.factory.ts`
- `.storybook/stories/_handlers/spinner.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with size, color props
- [ ] Add size variants: xs, sm, default, lg, xl
- [ ] Add data-\* attributes: data-size
- [ ] Add ARIA: role="status", aria-label
- [ ] Stories include: AllSizes, Colors, InButton, FullPage, DarkMode
- [ ] Factory exports: createFakeSpinner, SPINNER_SIZES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-049: Upgrade switch.tsx to Button Pattern

**Description:** As a developer, I need switch.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/switch.tsx` (1.8K → target ~6K)
- `.storybook/stories/components/ui/switch.stories.tsx`
- `.storybook/stories/_factories/switch.factory.ts`
- `.storybook/stories/_handlers/switch.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with checked, onCheckedChange props
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-state, data-disabled
- [ ] Add ARIA: role="switch", aria-checked
- [ ] Stories include: Basic, WithLabel, Disabled, Sizes, Loading, DarkMode,
      Japanese
- [ ] Play tests verify toggle, keyboard interaction
- [ ] Factory exports: createFakeSwitch, SWITCH_SIZES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-050: Upgrade table.tsx to Button Pattern

**Description:** As a developer, I need table.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/table.tsx` (4.8K → target ~15K)
- `.storybook/stories/components/ui/table.stories.tsx`
- `.storybook/stories/_factories/table.factory.ts`
- `.storybook/stories/_handlers/table.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Table, TableHeader, TableBody, TableFooter,
      TableRow, TableHead, TableCell, TableCaption
- [ ] Add data-\* attributes: data-state for row selection
- [ ] Add ARIA: proper table semantics
- [ ] Stories include: Basic, Striped, Bordered, Sortable, Selectable,
      Paginated, DarkMode, Japanese
- [ ] Play tests verify sorting, selection
- [ ] Factory exports: createFakeTable, createFakeTableRows
- [ ] Handlers cover: data fetching, sorting, pagination
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-051: Upgrade tabs.tsx to Button Pattern

**Description:** As a developer, I need tabs.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/tabs.tsx` (3.2K → target ~10K)
- `.storybook/stories/components/ui/tabs.stories.tsx`
- `.storybook/stories/_factories/tabs.factory.ts`
- `.storybook/stories/_handlers/tabs.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Tabs, TabsList, TabsTrigger, TabsContent
- [ ] Add orientation prop: horizontal, vertical
- [ ] Add variant props
- [ ] Add data-\* attributes: data-state, data-orientation
- [ ] Add ARIA: role="tablist", role="tab", role="tabpanel"
- [ ] Stories include: Basic, Vertical, WithIcons, Disabled, AsyncContent,
      DarkMode, Japanese
- [ ] Play tests verify tab switching, keyboard navigation
- [ ] Factory exports: createFakeTabs, createFakeTabItems
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-052: Upgrade textarea.tsx to Button Pattern

**Description:** As a developer, I need textarea.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/textarea.tsx` (1.2K → target ~5K)
- `.storybook/stories/components/ui/textarea.stories.tsx`
- `.storybook/stories/_factories/textarea.factory.ts`
- `.storybook/stories/_handlers/textarea.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with rows, maxLength, resize props
- [ ] Add resize variants: none, vertical, horizontal, both
- [ ] Add data-\* attributes: data-state, data-resize
- [ ] Add ARIA: aria-invalid, aria-describedby
- [ ] Stories include: Basic, WithCounter, AutoResize, Disabled, Error,
      DarkMode, Japanese
- [ ] Factory exports: createFakeTextarea, RESIZE_OPTIONS
- [ ] Handlers cover: autosave, validation
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-053: Upgrade timeline.tsx to Button Pattern

**Description:** As a developer, I need timeline.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/timeline.tsx` (8.1K → target ~18K)
- `.storybook/stories/components/ui/timeline.stories.tsx`
- `.storybook/stories/_factories/timeline.factory.ts` (CREATE)
- `.storybook/stories/_handlers/timeline.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for Timeline, TimelineItem, TimelineConnector,
      TimelineContent, TimelineDot, TimelineTime
- [ ] Add orientation prop: vertical, horizontal
- [ ] Add data-\* attributes: data-state, data-orientation
- [ ] Stories include: Vertical, Horizontal, WithIcons, Alternating, Loading,
      DarkMode, Japanese
- [ ] Factory exports: createFakeTimeline, createFakeTimelineItem
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-054: Upgrade toast.tsx to Button Pattern

**Description:** As a developer, I need toast.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/toast.tsx` (6.4K → target ~15K)
- `.storybook/stories/components/ui/toast.stories.tsx`
- `.storybook/stories/_factories/toast.factory.ts` (CREATE)
- `.storybook/stories/_handlers/toast.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for ToastProvider, ToastViewport, Toast,
      ToastAction, ToastClose, ToastTitle, ToastDescription
- [ ] Add variant props: default, destructive, success, warning
- [ ] Add data-\* attributes: data-state, data-variant
- [ ] Add ARIA: role="status", aria-live
- [ ] Stories include: AllVariants, WithAction, WithProgress, Stacked, DarkMode,
      Japanese
- [ ] Factory exports: createFakeToast, TOAST_VARIANTS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-055: Upgrade toggle.tsx to Button Pattern

**Description:** As a developer, I need toggle.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/toggle.tsx` (2.1K → target ~6K)
- `.storybook/stories/components/ui/toggle.stories.tsx`
- `.storybook/stories/_factories/toggle.factory.ts`
- `.storybook/stories/_handlers/toggle.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with pressed, onPressedChange props
- [ ] Add variant props: default, outline
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-state, data-variant, data-size
- [ ] Add ARIA: aria-pressed
- [ ] Stories include: Basic, WithIcon, Variants, Sizes, Disabled, DarkMode,
      Japanese
- [ ] Play tests verify toggle state
- [ ] Factory exports: createFakeToggle, TOGGLE_VARIANTS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-056: Upgrade toggle-group.tsx to Button Pattern

**Description:** As a developer, I need toggle-group.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/toggle-group.tsx` (2.8K → target ~8K)
- `.storybook/stories/components/ui/toggle-group.stories.tsx`
- `.storybook/stories/_factories/toggle-group.factory.ts` (CREATE)
- `.storybook/stories/_handlers/toggle-group.handlers.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for ToggleGroup, ToggleGroupItem
- [ ] Add type prop: single, multiple
- [ ] Add orientation prop: horizontal, vertical
- [ ] Add data-\* attributes: data-state, data-orientation
- [ ] Add ARIA: role="group"
- [ ] Stories include: Single, Multiple, Vertical, WithIcons, Disabled,
      DarkMode, Japanese
- [ ] Factory exports: createFakeToggleGroup, createFakeToggleItems
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-057: Upgrade tooltip.tsx to Button Pattern

**Description:** As a developer, I need tooltip.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/ui/tooltip.tsx` (3.1K → target ~10K)
- `.storybook/stories/components/ui/tooltip.stories.tsx`
- `.storybook/stories/_factories/tooltip.factory.ts`
- `.storybook/stories/_handlers/tooltip.handlers.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for TooltipProvider, Tooltip, TooltipTrigger,
      TooltipContent
- [ ] Add side/align props
- [ ] Add delay props: delayDuration, skipDelayDuration
- [ ] Add data-\* attributes: data-state, data-side
- [ ] Add ARIA: role="tooltip"
- [ ] Stories include: Basic, AllSides, WithShortcut, Controlled, DarkMode,
      Japanese
- [ ] Factory exports: createFakeTooltip, TOOLTIP_SIDES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-058: Button Component Reference Verification

**Description:** As a developer, I need to verify button.tsx remains the gold
standard reference.

**Files:**

- `components/ui/button.tsx` (44K) - REFERENCE ONLY

**Acceptance Criteria:**

- [ ] Verify all enterprise features documented
- [ ] Verify all stories comprehensive
- [ ] Verify factory complete
- [ ] Verify handlers complete
- [ ] Use as template for all other components
- [ ] No changes needed - verification only

---

# PHASE 2: CUSTOM COMPONENTS (10 Tasks)

### US-059: Upgrade count-animation.tsx to Button Pattern

**Description:** As a developer, I need count-animation.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/count-animation.tsx` (1.9K → target ~6K)
- `.storybook/stories/components/custom/count-animation.stories.tsx`
- `.storybook/stories/_factories/count-animation.factory.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with from, to, duration props
- [ ] Add easing variants
- [ ] Add data-\* attributes: data-animating
- [ ] Stories include: Basic, Currency, Percentage, Custom duration, DarkMode
- [ ] Factory exports: createFakeCountAnimation, EASING_FUNCTIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-060: Upgrade minimal-tiptap/minimal-tiptap.tsx to Button Pattern

**Description:** As a developer, I need minimal-tiptap.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/minimal-tiptap/minimal-tiptap.tsx` (4.4K → target ~15K)
- `.storybook/stories/components/custom/minimal-tiptap.stories.tsx`
- `.storybook/stories/_factories/minimal-tiptap.factory.ts`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for all props
- [ ] Add variant props for toolbar configuration
- [ ] Add data-\* attributes: data-editable, data-focused
- [ ] Stories include: Basic, ReadOnly, WithToolbar, WithMentions, DarkMode,
      Japanese
- [ ] Factory exports: createFakeEditorContent, createFakeMentions
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-061: Upgrade prompt/chat-container.tsx to Button Pattern

**Description:** As a developer, I need chat-container.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/prompt/chat-container.tsx` (8.2K → target ~18K)
- `.storybook/stories/components/custom/prompt/chat-container.stories.tsx`
- `.storybook/stories/_factories/prompt.factory.ts` (CREATE)

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for ChatContainer and sub-components
- [ ] Add data-\* attributes: data-loading, data-streaming
- [ ] Stories include: Empty, WithMessages, Streaming, Loading, DarkMode,
      Japanese
- [ ] Factory exports: createFakeChatContainer, createFakeChatHistory
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-062: Upgrade prompt/code-block.tsx to Button Pattern

**Description:** As a developer, I need code-block.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/prompt/code-block.tsx` (3.8K → target ~10K)
- `.storybook/stories/components/custom/prompt/code-block.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with language, showLineNumbers props
- [ ] Add data-\* attributes: data-language, data-copied
- [ ] Stories include: Languages, WithLineNumbers, CopyButton, Highlighting,
      DarkMode
- [ ] Factory exports: createFakeCodeBlock, SUPPORTED_LANGUAGES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-063: Upgrade prompt/input.tsx to Button Pattern

**Description:** As a developer, I need prompt input.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/prompt/input.tsx` (6.6K → target ~15K)
- `.storybook/stories/components/custom/prompt/input.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for prompt input props
- [ ] Add data-\* attributes: data-submitting, data-multiline
- [ ] Stories include: Basic, Multiline, WithAttachments, Disabled, DarkMode,
      Japanese
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-064: Upgrade prompt/loader.tsx to Button Pattern

**Description:** As a developer, I need prompt loader.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/prompt/loader.tsx` (17K → target ~25K)
- `.storybook/stories/components/custom/prompt/loader.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for all loader variants
- [ ] Add data-\* attributes: data-variant
- [ ] Stories include: Dots, Spinner, Skeleton, Typing, DarkMode
- [ ] Factory exports: createFakeLoader, LOADER_VARIANTS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-065: Upgrade prompt/markdown.tsx to Button Pattern

**Description:** As a developer, I need prompt markdown.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/prompt/markdown.tsx` (3.4K → target ~8K)
- `.storybook/stories/components/custom/prompt/markdown.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for markdown rendering options
- [ ] Add data-\* attributes: data-sanitized
- [ ] Stories include: BasicFormatting, CodeBlocks, Tables, Lists, DarkMode
- [ ] Factory exports: createFakeMarkdown, MARKDOWN_SAMPLES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-066: Upgrade prompt/message.tsx to Button Pattern

**Description:** As a developer, I need prompt message.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/prompt/message.tsx` (4.7K → target ~12K)
- `.storybook/stories/components/custom/prompt/message.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for message props
- [ ] Add role variants: user, assistant, system
- [ ] Add data-\* attributes: data-role, data-streaming
- [ ] Stories include: UserMessage, AssistantMessage, WithCode, Streaming,
      DarkMode, Japanese
- [ ] Factory exports: createFakeMessage, MESSAGE_ROLES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-067: Upgrade prompt/scroll-button.tsx to Button Pattern

**Description:** As a developer, I need prompt scroll-button.tsx upgraded to
match button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/prompt/scroll-button.tsx` (3.1K → target ~6K)
- `.storybook/stories/components/custom/prompt/scroll-button.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc
- [ ] Add data-\* attributes: data-visible
- [ ] Stories include: Hidden, Visible, WithNewMessage, DarkMode
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-068: Upgrade prompt/suggestion.tsx to Button Pattern

**Description:** As a developer, I need prompt suggestion.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/ui/custom/prompt/suggestion.tsx` (3.6K → target ~8K)
- `.storybook/stories/components/custom/prompt/suggestion.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for suggestion props
- [ ] Add data-\* attributes: data-selected
- [ ] Stories include: Single, Multiple, Categorized, Keyboard navigation,
      DarkMode, Japanese
- [ ] Factory exports: createFakeSuggestion, createFakeSuggestionList
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 3: ROOT COMPONENTS (5 Tasks)

### US-069: Upgrade active-theme.tsx to Button Pattern

**Description:** As a developer, I need active-theme.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/active-theme.tsx` (4.3K → target ~10K)
- `.storybook/stories/components/custom/active-theme.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for theme provider
- [ ] Add data-\* attributes: data-theme
- [ ] Stories include: LightTheme, DarkTheme, SystemTheme, CustomTheme
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-070: Upgrade CardActionMenus.tsx to Button Pattern

**Description:** As a developer, I need CardActionMenus.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/CardActionMenus.tsx` (2.2K → target ~6K)
- `.storybook/stories/components/custom/card-action-menus.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for card action menus
- [ ] Add data-\* attributes: data-open
- [ ] Stories include: Basic, WithDividers, WithIcons, DarkMode
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-071: Upgrade custom-date-range-picker.tsx to Button Pattern

**Description:** As a developer, I need custom-date-range-picker.tsx upgraded to
match button.tsx enterprise documentation quality.

**Files:**

- `components/custom-date-range-picker.tsx` (9.9K → target ~20K)
- `.storybook/stories/components/custom/date-range-picker.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for date range picker
- [ ] Add data-\* attributes: data-selecting, data-range-start, data-range-end
- [ ] Stories include: Basic, Presets, Controlled, WithMinMax, DarkMode,
      Japanese
- [ ] Factory exports: createFakeDateRange, DATE_PRESETS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-072: Upgrade date-time-picker.tsx to Button Pattern

**Description:** As a developer, I need date-time-picker.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/date-time-picker.tsx` (5.6K → target ~12K)
- `.storybook/stories/components/custom/date-time-picker.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for date-time picker
- [ ] Add data-\* attributes: data-selected
- [ ] Stories include: DateOnly, TimeOnly, DateTime, WithTimezone, DarkMode,
      Japanese
- [ ] Factory exports: createFakeDateTime, TIMEZONE_OPTIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-073: Upgrade icon.tsx to Button Pattern

**Description:** As a developer, I need icon.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/icon.tsx` (1.2K → target ~4K)
- `.storybook/stories/components/custom/icon.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for icon component
- [ ] Add size variants: xs, sm, default, lg, xl
- [ ] Add data-\* attributes: data-size
- [ ] Stories include: AllSizes, AllIcons (grid), WithColor, Animated, DarkMode
- [ ] Factory exports: createFakeIcon, ICON_NAMES, ICON_SIZES
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 4: LAYOUT COMPONENTS (9 Tasks)

### US-074: Upgrade layout/header/index.tsx to Button Pattern

**Description:** As a developer, I need header index.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/layout/header/index.tsx` (2.6K → target ~8K)
- `.storybook/stories/components/layout/header/site-header.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for SiteHeader
- [ ] Add data-\* attributes: data-sticky, data-transparent
- [ ] Stories include: Default, Sticky, Transparent, Mobile, DarkMode
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-075: Upgrade layout/header/notifications.tsx to Button Pattern

**Description:** As a developer, I need notifications.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/layout/header/notifications.tsx` (5.7K → target ~12K)
- `.storybook/stories/components/layout/header/notifications.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for NotificationBell and list
- [ ] Add data-\* attributes: data-unread-count
- [ ] Stories include: NoNotifications, WithNotifications, UnreadBadge,
      DarkMode, Japanese
- [ ] Factory exports: createFakeNotification, createFakeNotificationList
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-076: Upgrade layout/header/search.tsx to Button Pattern

**Description:** As a developer, I need header search.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/layout/header/search.tsx` (4.5K → target ~10K)
- `.storybook/stories/components/layout/header/search.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for HeaderSearch
- [ ] Add data-\* attributes: data-searching, data-has-results
- [ ] Stories include: Empty, WithResults, NoResults, Loading, DarkMode,
      Japanese
- [ ] Factory exports: createFakeSearchResult, createFakeSearchResults
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-077: Upgrade layout/header/theme-switch.tsx to Button Pattern

**Description:** As a developer, I need theme-switch.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/layout/header/theme-switch.tsx` (1.7K → target ~5K)
- `.storybook/stories/components/layout/header/theme-switch.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for ThemeSwitch
- [ ] Add data-\* attributes: data-theme
- [ ] Stories include: Light, Dark, System, Animated, DarkMode
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-078: Upgrade layout/header/user-menu.tsx to Button Pattern

**Description:** As a developer, I need user-menu.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/layout/header/user-menu.tsx` (5.5K → target ~12K)
- `.storybook/stories/components/layout/header/user-menu.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for UserMenu
- [ ] Add data-\* attributes: data-open
- [ ] Stories include: LoggedIn, LoggedOut, WithAvatar, WithStatus, DarkMode,
      Japanese
- [ ] Factory exports: createFakeUserMenu, createFakeUserProfile
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-079: Upgrade layout/logo.tsx to Button Pattern

**Description:** As a developer, I need logo.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/layout/logo.tsx` (810B → target ~3K)
- `.storybook/stories/components/layout/logo.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc with size, variant props
- [ ] Add size variants: sm, default, lg
- [ ] Add data-\* attributes: data-size
- [ ] Stories include: AllSizes, WithText, IconOnly, DarkMode
- [ ] Factory exports: createFakeLogo, LOGO_SIZES
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-080: Upgrade layout/sidebar/app-sidebar.tsx to Button Pattern

**Description:** As a developer, I need app-sidebar.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/layout/sidebar/app-sidebar.tsx` (7.2K → target ~15K)
- `.storybook/stories/components/layout/sidebar/app-sidebar.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for AppSidebar
- [ ] Add data-\* attributes: data-collapsed, data-mobile
- [ ] Stories include: Expanded, Collapsed, Mobile, WithUser, DarkMode, Japanese
- [ ] Factory exports: createFakeAppSidebar, createFakeSidebarConfig
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-081: Upgrade layout/sidebar/nav-main.tsx to Button Pattern

**Description:** As a developer, I need nav-main.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/layout/sidebar/nav-main.tsx` (17K → target ~25K)
- `.storybook/stories/components/layout/sidebar/nav-main.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for NavMain
- [ ] Add data-\* attributes: data-active, data-expanded
- [ ] Stories include: Basic, WithSubmenus, WithIcons, WithBadges, DarkMode,
      Japanese
- [ ] Factory exports: createFakeNavMain, createFakeNavItems
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-082: Upgrade layout/sidebar/nav-user.tsx to Button Pattern

**Description:** As a developer, I need nav-user.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/layout/sidebar/nav-user.tsx` (4.7K → target ~10K)
- `.storybook/stories/components/layout/sidebar/nav-user.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for NavUser
- [ ] Add data-\* attributes: data-open
- [ ] Stories include: LoggedIn, WithStatus, Collapsed, DarkMode, Japanese
- [ ] Factory exports: createFakeNavUser, USER_STATUSES
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 5: THEME CUSTOMIZER (8 Tasks)

### US-083: Upgrade theme-customizer/color-mode-selector.tsx to Button Pattern

**Description:** As a developer, I need color-mode-selector.tsx upgraded to
match button.tsx enterprise documentation quality.

**Files:**

- `components/theme-customizer/color-mode-selector.tsx` (2.4K → target ~6K)
- `.storybook/stories/components/theme-customizer/color-mode-selector.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc
- [ ] Add data-\* attributes: data-mode
- [ ] Stories include: Light, Dark, System, DarkMode
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-084: Upgrade theme-customizer/content-layout-selector.tsx to Button Pattern

**Description:** As a developer, I need content-layout-selector.tsx upgraded to
match button.tsx enterprise documentation quality.

**Files:**

- `components/theme-customizer/content-layout-selector.tsx` (2.5K → target ~6K)
- `.storybook/stories/components/theme-customizer/content-layout-selector.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc
- [ ] Add data-\* attributes: data-layout
- [ ] Stories include: AllLayouts, Interactive, DarkMode
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-085: Upgrade theme-customizer/panel.tsx to Button Pattern

**Description:** As a developer, I need panel.tsx upgraded to match button.tsx
enterprise documentation quality.

**Files:**

- `components/theme-customizer/panel.tsx` (3.1K → target ~8K)
- `.storybook/stories/components/theme-customizer/panel.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for ThemeCustomizerPanel
- [ ] Add data-\* attributes: data-open
- [ ] Stories include: Open, Closed, FullFeatured, DarkMode
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-086: Upgrade theme-customizer/preset-selector.tsx to Button Pattern

**Description:** As a developer, I need preset-selector.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/theme-customizer/preset-selector.tsx` (2.6K → target ~6K)
- `.storybook/stories/components/theme-customizer/preset-selector.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc
- [ ] Add data-\* attributes: data-preset
- [ ] Stories include: AllPresets, Interactive, DarkMode
- [ ] Factory exports: THEME_PRESETS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-087: Upgrade theme-customizer/radius-selector.tsx to Button Pattern

**Description:** As a developer, I need radius-selector.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/theme-customizer/radius-selector.tsx` (3.6K → target ~8K)
- `.storybook/stories/components/theme-customizer/radius-selector.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc
- [ ] Add data-\* attributes: data-radius
- [ ] Stories include: AllRadii, Interactive, Preview, DarkMode
- [ ] Factory exports: RADIUS_OPTIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-088: Upgrade theme-customizer/reset-theme.tsx to Button Pattern

**Description:** As a developer, I need reset-theme.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/theme-customizer/reset-theme.tsx` (1.3K → target ~4K)
- `.storybook/stories/components/theme-customizer/reset-theme.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc
- [ ] Add confirmation prop
- [ ] Stories include: Default, WithConfirmation, DarkMode
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-089: Upgrade theme-customizer/scale-selector.tsx to Button Pattern

**Description:** As a developer, I need scale-selector.tsx upgraded to match
button.tsx enterprise documentation quality.

**Files:**

- `components/theme-customizer/scale-selector.tsx` (2.9K → target ~6K)
- `.storybook/stories/components/theme-customizer/scale-selector.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc
- [ ] Add data-\* attributes: data-scale
- [ ] Stories include: AllScales, Interactive, Preview, DarkMode
- [ ] Factory exports: SCALE_OPTIONS
- [ ] Typecheck passes
- [ ] Lint passes

---

### US-090: Upgrade theme-customizer/sidebar-mode-selector.tsx to Button Pattern

**Description:** As a developer, I need sidebar-mode-selector.tsx upgraded to
match button.tsx enterprise documentation quality.

**Files:**

- `components/theme-customizer/sidebar-mode-selector.tsx` (2.4K → target ~6K)
- `.storybook/stories/components/theme-customizer/sidebar-mode-selector.stories.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc
- [ ] Add data-\* attributes: data-mode
- [ ] Stories include: AllModes, Interactive, DarkMode
- [ ] Factory exports: SIDEBAR_MODES
- [ ] Typecheck passes
- [ ] Lint passes

---

# PHASE 6: DASHBOARD PAGES (66 Tasks)

## Section 6.1: Main Dashboards (15 Pages)

### US-091: Dashboard Default Page

**Page:** `app/dashboard/(auth)/default/page.tsx`

**Acceptance Criteria:**

- [ ] Add comprehensive JSDoc for page component
- [ ] Stories for: Default, Loading, Error, Empty, DarkMode, Japanese
- [ ] Factory for page-specific data
- [ ] Typecheck passes

---

### US-092: Dashboard Academy Page

**Page:** `app/dashboard/(auth)/academy/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, Empty, DarkMode, Japanese
- [ ] Factory for academy data
- [ ] Typecheck passes

---

### US-093: Dashboard CRM Page

**Page:** `app/dashboard/(auth)/crm/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, Empty, DarkMode, Japanese
- [ ] Factory for CRM data (leads, deals, customers)
- [ ] Typecheck passes

---

### US-094: Dashboard Crypto Page

**Page:** `app/dashboard/(auth)/crypto/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for crypto data (wallets, transactions)
- [ ] Typecheck passes

---

### US-095: Dashboard E-commerce Page

**Page:** `app/dashboard/(auth)/ecommerce/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for e-commerce data (orders, products, revenue)
- [ ] Typecheck passes

---

### US-096: Dashboard Finance Page

**Page:** `app/dashboard/(auth)/finance/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for finance data (transactions, budget)
- [ ] Typecheck passes

---

### US-097: Dashboard File Manager Page

**Page:** `app/dashboard/(auth)/file-manager/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, Empty, DarkMode, Japanese
- [ ] Factory for file data
- [ ] Typecheck passes

---

### US-098: Dashboard Hospital Management Page

**Page:** `app/dashboard/(auth)/hospital-management/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for hospital data (patients, appointments)
- [ ] Typecheck passes

---

### US-099: Dashboard Hotel Page

**Page:** `app/dashboard/(auth)/hotel/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for hotel data (bookings, rooms)
- [ ] Typecheck passes

---

### US-100: Dashboard Hotel Bookings Page

**Page:** `app/dashboard/(auth)/hotel/bookings/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, Empty, DarkMode, Japanese
- [ ] Factory for booking data
- [ ] Typecheck passes

---

### US-101: Dashboard Logistics Page

**Page:** `app/dashboard/(auth)/logistics/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for logistics data
- [ ] Typecheck passes

---

### US-102: Dashboard Payment Page

**Page:** `app/dashboard/(auth)/payment/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for payment data
- [ ] Typecheck passes

---

### US-103: Dashboard Payment Transactions Page

**Page:** `app/dashboard/(auth)/payment/transactions/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, Empty, DarkMode, Japanese
- [ ] Factory for transaction data
- [ ] Typecheck passes

---

### US-104: Dashboard Project List Page

**Page:** `app/dashboard/(auth)/project-list/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, Empty, DarkMode, Japanese
- [ ] Factory for project data
- [ ] Typecheck passes

---

### US-105: Dashboard Project Management Page

**Page:** `app/dashboard/(auth)/project-management/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for project management data
- [ ] Typecheck passes

---

### US-106: Dashboard Sales Page

**Page:** `app/dashboard/(auth)/sales/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for sales data
- [ ] Typecheck passes

---

### US-107: Dashboard Website Analytics Page

**Page:** `app/dashboard/(auth)/website-analytics/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Loading, Error, DarkMode, Japanese
- [ ] Factory for analytics data
- [ ] Typecheck passes

---

## Section 6.2: Apps Pages (18 Pages)

### US-108: AI Chat Page

**Page:** `app/dashboard/(auth)/apps/ai-chat/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Empty, WithMessages, Streaming, DarkMode, Japanese
- [ ] Factory for chat messages
- [ ] Typecheck passes

---

### US-109: AI Chat V2 Page

**Page:** `app/dashboard/(auth)/apps/ai-chat-v2/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Empty, WithHistory, NewChat, DarkMode, Japanese
- [ ] Factory for chat data
- [ ] Typecheck passes

---

### US-110: AI Image Generator Page

**Page:** `app/dashboard/(auth)/apps/ai-image-generator/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Generating, WithResults, DarkMode, Japanese
- [ ] Factory for image generation data
- [ ] Typecheck passes

---

### US-111: API Keys Page

**Page:** `app/dashboard/(auth)/apps/api-keys/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoKeys, WithKeys, Creating, DarkMode, Japanese
- [ ] Factory for API key data
- [ ] Typecheck passes

---

### US-112: Calendar Page

**Page:** `app/dashboard/(auth)/apps/calendar/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Month, Week, Day, WithEvents, DarkMode, Japanese
- [ ] Factory for calendar events
- [ ] Typecheck passes

---

### US-113: Chat Page

**Page:** `app/dashboard/(auth)/apps/chat/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoChats, WithChats, ActiveChat, DarkMode, Japanese
- [ ] Factory for chat data
- [ ] Typecheck passes

---

### US-114: Courses Page

**Page:** `app/dashboard/(auth)/apps/courses/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoCourses, WithCourses, InProgress, DarkMode, Japanese
- [ ] Factory for course data
- [ ] Typecheck passes

---

### US-115: File Manager App Page

**Page:** `app/dashboard/(auth)/apps/file-manager/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Empty, WithFiles, Uploading, DarkMode, Japanese
- [ ] Factory for file data
- [ ] Typecheck passes

---

### US-116: Kanban Page

**Page:** `app/dashboard/(auth)/apps/kanban/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Empty, WithCards, Dragging, DarkMode, Japanese
- [ ] Factory for kanban data
- [ ] Typecheck passes

---

### US-117: Mail Page

**Page:** `app/dashboard/(auth)/apps/mail/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Inbox, Sent, Drafts, Reading, DarkMode, Japanese
- [ ] Factory for mail data
- [ ] Typecheck passes

---

### US-118: Notes Page

**Page:** `app/dashboard/(auth)/apps/notes/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoNotes, WithNotes, Editing, DarkMode, Japanese
- [ ] Factory for notes data
- [ ] Typecheck passes

---

### US-119: POS System Page

**Page:** `app/dashboard/(auth)/apps/pos-system/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: EmptyCart, WithItems, Checkout, DarkMode, Japanese
- [ ] Factory for POS data
- [ ] Typecheck passes

---

### US-120: POS Tables Page

**Page:** `app/dashboard/(auth)/apps/pos-system/tables/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: AllAvailable, SomeOccupied, DarkMode, Japanese
- [ ] Factory for table data
- [ ] Typecheck passes

---

### US-121: Social Media Page

**Page:** `app/dashboard/(auth)/apps/social-media/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Feed, Profile, Creating, DarkMode, Japanese
- [ ] Factory for social media data
- [ ] Typecheck passes

---

### US-122: Tasks Page

**Page:** `app/dashboard/(auth)/apps/tasks/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoTasks, WithTasks, Filtering, DarkMode, Japanese
- [ ] Factory for task data
- [ ] Typecheck passes

---

### US-123: Text to Speech Page

**Page:** `app/dashboard/(auth)/apps/text-to-speech/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Empty, WithText, Playing, DarkMode, Japanese
- [ ] Factory for TTS data
- [ ] Typecheck passes

---

### US-124: Todo List Page

**Page:** `app/dashboard/(auth)/apps/todo-list-app/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoTodos, WithTodos, Completed, DarkMode, Japanese
- [ ] Factory for todo data
- [ ] Typecheck passes

---

## Section 6.3: Pages Section (24 Pages)

### US-125: Empty States 01 Page

**Page:** `app/dashboard/(auth)/pages/empty-states/01/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode
- [ ] Typecheck passes

---

### US-126: Empty States 02 Page

**Page:** `app/dashboard/(auth)/pages/empty-states/02/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode
- [ ] Typecheck passes

---

### US-127: Empty States 03 Page

**Page:** `app/dashboard/(auth)/pages/empty-states/03/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode
- [ ] Typecheck passes

---

### US-128: Error 403 Page

**Page:** `app/dashboard/(auth)/pages/error/403/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-129: Onboarding Flow Page

**Page:** `app/dashboard/(auth)/pages/onboarding-flow/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Step1, Step2, Step3, Complete, DarkMode, Japanese
- [ ] Factory for onboarding data
- [ ] Typecheck passes

---

### US-130: Orders List Page

**Page:** `app/dashboard/(auth)/pages/orders/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoOrders, WithOrders, Filtering, DarkMode, Japanese
- [ ] Factory for order data
- [ ] Typecheck passes

---

### US-131: Order Detail Page

**Page:** `app/dashboard/(auth)/pages/orders/[id]/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Pending, Processing, Shipped, Delivered, DarkMode, Japanese
- [ ] Factory for order detail data
- [ ] Typecheck passes

---

### US-132: Pricing Column Page

**Page:** `app/dashboard/(auth)/pages/pricing/column/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Highlighted, DarkMode, Japanese
- [ ] Factory for pricing data
- [ ] Typecheck passes

---

### US-133: Pricing Single Page

**Page:** `app/dashboard/(auth)/pages/pricing/single/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-134: Pricing Table Page

**Page:** `app/dashboard/(auth)/pages/pricing/table/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Comparison, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-135: Products List Page

**Page:** `app/dashboard/(auth)/pages/products/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoProducts, WithProducts, Grid, List, DarkMode, Japanese
- [ ] Factory for product data
- [ ] Typecheck passes

---

### US-136: Product Detail Page

**Page:** `app/dashboard/(auth)/pages/products/[id]/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, WithReviews, OutOfStock, DarkMode, Japanese
- [ ] Factory for product detail data
- [ ] Typecheck passes

---

### US-137: Product Create Page

**Page:** `app/dashboard/(auth)/pages/products/create/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Empty, Filling, Validation, DarkMode, Japanese
- [ ] Factory for product form data
- [ ] Typecheck passes

---

### US-138: Profile Page

**Page:** `app/dashboard/(auth)/pages/profile/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Editing, DarkMode, Japanese
- [ ] Factory for profile data
- [ ] Typecheck passes

---

### US-139: Settings Main Page

**Page:** `app/dashboard/(auth)/pages/settings/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-140: Settings Account Page

**Page:** `app/dashboard/(auth)/pages/settings/account/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Editing, DarkMode, Japanese
- [ ] Factory for account data
- [ ] Typecheck passes

---

### US-141: Settings Appearance Page

**Page:** `app/dashboard/(auth)/pages/settings/appearance/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode
- [ ] Typecheck passes

---

### US-142: Settings Billing Page

**Page:** `app/dashboard/(auth)/pages/settings/billing/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoPlan, WithPlan, DarkMode, Japanese
- [ ] Factory for billing data
- [ ] Typecheck passes

---

### US-143: Settings Display Page

**Page:** `app/dashboard/(auth)/pages/settings/display/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode
- [ ] Typecheck passes

---

### US-144: Settings Notifications Page

**Page:** `app/dashboard/(auth)/pages/settings/notifications/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode, Japanese
- [ ] Factory for notification settings
- [ ] Typecheck passes

---

### US-145: User Profile Page

**Page:** `app/dashboard/(auth)/pages/user-profile/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode, Japanese
- [ ] Factory for user profile data
- [ ] Typecheck passes

---

### US-146: Users List Page

**Page:** `app/dashboard/(auth)/pages/users/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: NoUsers, WithUsers, Filtering, DarkMode, Japanese
- [ ] Factory for users data
- [ ] Typecheck passes

---

## Section 6.4: Widget Pages (3 Pages)

### US-147: Widgets Analytics Page

**Page:** `app/dashboard/(auth)/widgets/analytics/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode
- [ ] Typecheck passes

---

### US-148: Widgets E-commerce Page

**Page:** `app/dashboard/(auth)/widgets/ecommerce/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode
- [ ] Typecheck passes

---

### US-149: Widgets Fitness Page

**Page:** `app/dashboard/(auth)/widgets/fitness/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, WithData, DarkMode
- [ ] Factory for fitness data
- [ ] Typecheck passes

---

## Section 6.5: Guest Pages (7 Pages)

### US-150: Forgot Password Page

**Page:** `app/dashboard/(guest)/forgot-password/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Submitting, Success, Error, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-151: Login V1 Page

**Page:** `app/dashboard/(guest)/login/v1/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Submitting, Error, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-152: Login V2 Page

**Page:** `app/dashboard/(guest)/login/v2/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Submitting, Error, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-153: Register V1 Page

**Page:** `app/dashboard/(guest)/register/v1/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Submitting, Validation, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-154: Register V2 Page

**Page:** `app/dashboard/(guest)/register/v2/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, Submitting, Validation, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-155: Error 404 Page

**Page:** `app/dashboard/(guest)/pages/error/404/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode, Japanese
- [ ] Typecheck passes

---

### US-156: Error 500 Page

**Page:** `app/dashboard/(guest)/pages/error/500/page.tsx`

**Acceptance Criteria:**

- [ ] Stories for: Default, DarkMode, Japanese
- [ ] Typecheck passes

---

# SUMMARY

## Total Tasks: 156

| Phase     | Category          | Tasks   |
| --------- | ----------------- | ------- |
| 1         | UI Components     | 58      |
| 2         | Custom Components | 10      |
| 3         | Root Components   | 5       |
| 4         | Layout Components | 9       |
| 5         | Theme Customizer  | 8       |
| 6         | Dashboard Pages   | 66      |
| **TOTAL** |                   | **156** |

## Files Per Task (Average)

- Source component: 1 file (improvement)
- Stories: 1 file (improvement/creation)
- Factory: 1 file (improvement/creation)
- Handlers: 1 file (improvement/creation)
- i18n: 2 files (en.ts + ja.ts additions)

**Total estimated file touches: ~780 files**

## Acceptance Criteria Summary

Every task MUST:

1. ✅ Add comprehensive JSDoc documentation
2. ✅ Add data-\* attributes for testing
3. ✅ Add ARIA attributes for accessibility
4. ✅ Create/improve Storybook stories
5. ✅ Include DarkMode story variant
6. ✅ Include Japanese locale story
7. ✅ Pass `pnpm typecheck`
8. ✅ Pass `pnpm lint`

## Verification Command

After each task:

```bash
pnpm typecheck && pnpm lint && pnpm storybook --smoke-test
```

---

## Non-Goals

- No new component creation (only upgrade existing)
- No breaking API changes
- No new dependencies unless absolutely required
- No changes to core business logic
- Pages do not require full 5-file triad (component + stories sufficient)

## Technical Considerations

- Use existing button.tsx as reference for all patterns
- Maintain backwards compatibility
- All factories use deterministic faker seeds
- All handlers follow HTTP status pattern from `_utils/http-status.ts`
- i18n keys follow namespace pattern: `{component}.{key}`

## Success Metrics

- 100% components have comprehensive JSDoc
- 100% components have DarkMode stories
- 100% components have Japanese locale support
- 100% components pass typecheck
- 100% components pass lint
- Zero regression in existing functionality

## Open Questions

- Should we create a shared hook for common patterns (useDataAttributes,
  useAriaProps)?
- Should we establish a lint rule to enforce JSDoc on all exports?
- Should we add visual regression testing after upgrade?
