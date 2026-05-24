// ============================================================================
// FACTORY INDEX - Minimal exports to avoid TypeScript TS2308 conflicts
// ============================================================================
//
// IMPORTANT: Most factory files share exports with each other (e.g., both
// button.factory and form.factory export createFakeLoginForm). This causes
// TypeScript TS2308 errors when using 'export *' from multiple files.
//
// RECOMMENDED: Import directly from specific factory files:
//
//   import { createFakeButton } from './_factories/button.factory';
//   import { createFakeCard } from './_factories/card.factory';
//
// This index exports only a carefully selected subset of factories that
// don't conflict. For full access, use direct imports.
// ============================================================================

// These factories have unique exports that don't conflict with others:
export * from './accordion.factory';
export * from './alert.factory';
export * from './aspect-ratio.factory';
export * from './avatar.factory';
export * from './badge.factory';
export * from './breadcrumb.factory';
export * from './button.factory';
export * from './calendar.factory';
export * from './card.factory';
export * from './carousel.factory';
export * from './chart.factory';
export * from './chat.factory';
export * from './checkbox.factory';
export * from './command.factory';
// Note: count-animation.factory overlaps with card.factory (createFakeDashboardStats)
export * from './dropdown-menu.factory';
export * from './event.factory';
export * from './hover-card.factory';
export * from './kanban.factory';
export * from './kbd.factory';
export * from './minimal-tiptap.factory';
export * from './native-select.factory';
export * from './navigation-menu.factory';
export * from './popover.factory';
export * from './progress.factory';
export * from './reel.factory';
export * from './resizable.factory';
export * from './slider.factory';
export * from './spinner.factory';
export * from './switch.factory';
export * from './table.factory';
export * from './tabs.factory';
export * from './theme.factory';
export * from './tooltip.factory';
export * from './user.factory';

// Faker utilities
export {
  DEFAULT_FAKER_SEED,
  fakerSeedDecorator,
  resetFaker,
  seedFaker,
  withFakerSeed,
} from '../_utils/faker-seed';

// ============================================================================
// EXCLUDED FACTORIES (import directly when needed):
// ============================================================================
// These factories have overlapping exports with those listed above:
//
// - alert-dialog.factory - overlaps with dialog.factory
// - button-group.factory - overlaps with button.factory
// - collapsible.factory - overlaps with accordion.factory, dialog.factory
// - context-menu.factory - overlaps with menu.factory
// - dialog.factory - overlaps with alert-dialog.factory, sonner.factory
// - drawer.factory - overlaps with notification.factory
// - empty.factory - overlaps with feedback.factory
// - feedback.factory - aggregate, use individual factories
// - field.factory - overlaps with form.factory, input.factory
// - form.factory - overlaps with field.factory, label.factory
// - input.factory - overlaps with field.factory, input-group.factory, textarea.factory
// - input-group.factory - overlaps with input.factory
// - input-otp.factory - may have overlaps
// - item.factory - overlaps with layout.factory
// - label.factory - overlaps with form.factory, radio-group.factory, toggle.factory
// - layout.factory - aggregate, use individual factories
// - menu.factory - overlaps with context-menu.factory, sidebar.factory
// - menubar.factory - overlaps with menu.factory
// - misc.factory - aggregate, use individual factories
// - navigation.factory - overlaps with pagination.factory, sidebar.factory
// - notification.factory - overlaps with drawer.factory, toast.factory
// - overlay.factory - aggregate, use individual factories
// - pagination.factory - overlaps with navigation.factory
// - radio-group.factory - overlaps with label.factory
// - scroll-area.factory - overlaps with skeleton.factory
// - search.factory - overlaps with command.factory
// - select.factory - aggregate, use individual factories
// - separator.factory - overlaps with sidebar.factory
// - sheet.factory - overlaps with dialog.factory, sonner.factory
// - sidebar.factory - overlaps with navigation.factory, separator.factory, menu.factory
// - skeleton.factory - overlaps with scroll-area.factory
// - sonner.factory - overlaps with notification.factory
// - textarea.factory - overlaps with input.factory
// - timeline.factory - overlaps with calendar.factory
// - toast.factory - overlaps with notification.factory
// - toggle.factory - overlaps with label.factory
// - toggle-group.factory - overlaps with toggle.factory
