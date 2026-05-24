// Master handler exports for MSW integration
// Re-exports all handler modules for easy importing

import { accordionHandlers, accordionStatusHandlers } from './accordion.handlers';
import { alertHandlers, alertStatusHandlers } from './alert.handlers';
import { avatarHandlers, avatarStatusHandlers } from './avatar.handlers';
import { badgeHandlers, badgeStatusHandlers } from './badge.handlers';
import { breadcrumbHandlers, breadcrumbStatusHandlers } from './breadcrumb.handlers';
import { buttonHandlers, buttonStatusHandlers } from './button.handlers';
import { calendarHandlers, calendarStatusHandlers } from './calendar.handlers';
import { cardHandlers, cardStatusHandlers } from './card.handlers';
import { carouselHandlers, carouselStatusHandlers } from './carousel.handlers';
import { chartHandlers, chartStatusHandlers } from './chart.handlers';
import { chatHandlers, chatStatusHandlers } from './chat.handlers';
import { dialogHandlers, dialogStatusHandlers } from './dialog.handlers';
import { eventHandlers, eventStatusHandlers } from './event.handlers';
import { feedbackHandlers, feedbackStatusHandlers } from './feedback.handlers';
import { formHandlers, formStatusHandlers } from './form.handlers';
import { inputHandlers, inputStatusHandlers } from './input.handlers';
import { kanbanHandlers, kanbanStatusHandlers } from './kanban.handlers';
import { layoutHandlers, layoutStatusHandlers } from './layout.handlers';
import { menuHandlers, menuStatusHandlers } from './menu.handlers';
import { miscHandlers, miscStatusHandlers } from './misc.handlers';
import { navigationHandlers, navigationStatusHandlers } from './navigation.handlers';
import { notificationHandlers, notificationStatusHandlers } from './notification.handlers';
import { overlayHandlers, overlayStatusHandlers } from './overlay.handlers';
import { progressHandlers, progressStatusHandlers } from './progress.handlers';
import { searchHandlers, searchStatusHandlers } from './search.handlers';
import { selectHandlers, selectStatusHandlers } from './select.handlers';
import { tableHandlers, tableStatusHandlers } from './table.handlers';
import { tabsHandlers, tabsStatusHandlers } from './tabs.handlers';
import { themeHandlers, themeStatusHandlers } from './theme.handlers';
import { tooltipHandlers, tooltipStatusHandlers } from './tooltip.handlers';
import { userHandlers, userStatusHandlers } from './user.handlers';

// Combined handlers for default MSW setup (all success handlers)
export const allHandlers = [
  ...accordionHandlers,
  ...alertHandlers,
  ...avatarHandlers,
  ...badgeHandlers,
  ...breadcrumbHandlers,
  ...buttonHandlers,
  ...calendarHandlers,
  ...cardHandlers,
  ...carouselHandlers,
  ...chartHandlers,
  ...chatHandlers,
  ...dialogHandlers,
  ...eventHandlers,
  ...feedbackHandlers,
  ...formHandlers,
  ...inputHandlers,
  ...kanbanHandlers,
  ...layoutHandlers,
  ...menuHandlers,
  ...miscHandlers,
  ...navigationHandlers,
  ...notificationHandlers,
  ...overlayHandlers,
  ...progressHandlers,
  ...searchHandlers,
  ...selectHandlers,
  ...tableHandlers,
  ...tabsHandlers,
  ...themeHandlers,
  ...tooltipHandlers,
  ...userHandlers,
];

// Re-export individual handler sets for story-specific use
export {
  accordionHandlers,
  accordionStatusHandlers,
  alertHandlers,
  alertStatusHandlers,
  avatarHandlers,
  avatarStatusHandlers,
  badgeHandlers,
  badgeStatusHandlers,
  breadcrumbHandlers,
  breadcrumbStatusHandlers,
  buttonHandlers,
  buttonStatusHandlers,
  calendarHandlers,
  calendarStatusHandlers,
  cardHandlers,
  cardStatusHandlers,
  carouselHandlers,
  carouselStatusHandlers,
  chartHandlers,
  chartStatusHandlers,
  chatHandlers,
  chatStatusHandlers,
  dialogHandlers,
  dialogStatusHandlers,
  eventHandlers,
  eventStatusHandlers,
  feedbackHandlers,
  feedbackStatusHandlers,
  formHandlers,
  formStatusHandlers,
  inputHandlers,
  inputStatusHandlers,
  kanbanHandlers,
  kanbanStatusHandlers,
  layoutHandlers,
  layoutStatusHandlers,
  menuHandlers,
  menuStatusHandlers,
  miscHandlers,
  miscStatusHandlers,
  navigationHandlers,
  navigationStatusHandlers,
  notificationHandlers,
  notificationStatusHandlers,
  overlayHandlers,
  overlayStatusHandlers,
  progressHandlers,
  progressStatusHandlers,
  searchHandlers,
  searchStatusHandlers,
  selectHandlers,
  selectStatusHandlers,
  tableHandlers,
  tableStatusHandlers,
  tabsHandlers,
  tabsStatusHandlers,
  themeHandlers,
  themeStatusHandlers,
  tooltipHandlers,
  tooltipStatusHandlers,
  userHandlers,
  userStatusHandlers,
};

// Re-export everything from individual files
export * from './accordion.handlers';
export * from './active-theme.handlers';
export * from './alert.handlers';
export * from './alert-dialog.handlers';
export * from './app-sidebar.handlers';
export * from './apps-ai-chat.handlers';
export * from './apps-calendar.handlers';
export * from './apps-chat.handlers';
export * from './apps-courses.handlers';
export * from './apps-file-manager.handlers';
export * from './apps-kanban.handlers';
export * from './apps-mail.handlers';
export * from './apps-misc.handlers';
export * from './apps-notes.handlers';
export * from './apps-tasks.handlers';
export * from './aspect-ratio.handlers';
export * from './auth.handlers';
export * from './avatar.handlers';
export * from './badge.handlers';
export * from './breadcrumb.handlers';
export * from './button.handlers';
export * from './button-group.handlers';
export * from './calendar.handlers';
export * from './card.handlers';
export * from './card-action-menus.handlers';
export * from './carousel.handlers';
export * from './chart.handlers';
export * from './chat.handlers';
export * from './chat-container.handlers';
export * from './checkbox.handlers';
export * from './code-block.handlers';
export * from './collapsible.handlers';
export * from './color-mode-selector.handlers';
export * from './command.handlers';
export * from './content-layout-selector.handlers';
export * from './context-menu.handlers';
export * from './count-animation.handlers';
export * from './custom-date-range-picker.handlers';
export * from './dashboard-academy.handlers';
export * from './dashboard-analytics.handlers';
export * from './dashboard-crm.handlers';
export * from './dashboard-crypto.handlers';
export * from './dashboard-default.handlers';
export * from './dashboard-ecommerce.handlers';
export * from './dashboard-file-manager.handlers';
export * from './dashboard-finance.handlers';
export * from './dashboard-hospital.handlers';
export * from './dashboard-hotel.handlers';
export * from './dashboard-logistics.handlers';
export * from './dashboard-payment.handlers';
export * from './dashboard-project.handlers';
export * from './dashboard-sales.handlers';
export * from './dashboard-widgets.handlers';
export * from './date-time-picker.handlers';
export * from './dialog.handlers';
export * from './drawer.handlers';
export * from './dropdown-menu.handlers';
export * from './empty.handlers';
export * from './error.handlers';
export * from './event.handlers';
export * from './export-button.handlers';
export * from './feedback.handlers';
export * from './field.handlers';
export * from './form.handlers';
export * from './hover-card.handlers';
export * from './icon.handlers';
export * from './input.handlers';
export * from './input-group.handlers';
export * from './input-otp.handlers';
export * from './item.handlers';
export * from './kanban.handlers';
export * from './kbd.handlers';
export * from './label.handlers';
export * from './layout.handlers';
export * from './logo.handlers';
export * from './menu.handlers';
export * from './menubar.handlers';
export * from './minimal-tiptap.handlers';
export * from './misc.handlers';
export * from './native-select.handlers';
export * from './nav-main.handlers';
export * from './nav-user.handlers';
export * from './navigation.handlers';
export * from './navigation-menu.handlers';
export * from './notification.handlers';
export * from './overlay.handlers';
export * from './pagination.handlers';
export * from './panel.handlers';
export * from './popover.handlers';
export * from './preset-selector.handlers';
export * from './pricing.handlers';
export * from './progress.handlers';
export * from './prompt-input.handlers';
export * from './prompt-loader.handlers';
export * from './prompt-markdown.handlers';
export * from './prompt-message.handlers';
export * from './prompt-scroll-button.handlers';
export * from './prompt-suggestion.handlers';
export * from './radio-group.handlers';
export * from './radius-selector.handlers';
export * from './reel.handlers';
export * from './reset-theme.handlers';
export * from './resizable.handlers';
export * from './scale-selector.handlers';
export * from './scroll-area.handlers';
export * from './search.handlers';
export * from './select.handlers';
export * from './separator.handlers';
export * from './settings.handlers';
export * from './sheet.handlers';
export * from './sidebar.handlers';
export * from './sidebar-mode-selector.handlers';
export * from './site-header.handlers';
export * from './skeleton.handlers';
export * from './slider.handlers';
export * from './sonner.handlers';
export * from './spinner.handlers';
export * from './switch.handlers';
export * from './table.handlers';
export * from './tabs.handlers';
export * from './textarea.handlers';
export * from './theme.handlers';
export * from './theme-switch.handlers';
export * from './timeline.handlers';
export * from './toast.handlers';
export * from './toggle.handlers';
export * from './toggle-group.handlers';
export * from './tooltip.handlers';
export * from './user.handlers';
export * from './user-menu.handlers';
