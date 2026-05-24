/**
 * MinimalTiptap - A minimal rich text editor built on TipTap
 * @module minimal-tiptap
 * @description Exports all components, types, utilities, extensions, and hooks for the MinimalTiptap editor
 */

// Main component export
export * from './minimal-tiptap';

// Types export
export * from './types';

// Utilities export
export * from './utils';

// Extensions export
export * from './extensions';

/**
 * Hook exports
 * @description Custom hooks for MinimalTiptap editor functionality
 */
export { useMinimalTiptapEditor } from './hooks/use-minimal-tiptap';
export type { UseMinimalTiptapEditorProps } from './hooks/use-minimal-tiptap';
export { useContainerSize } from './hooks/use-container-size';
export type { UseContainerSizeReturn } from './hooks/use-container-size';
export { useTheme } from './hooks/use-theme';
export type { UseThemeReturn } from './hooks/use-theme';
export { useThrottle } from './hooks/use-throttle';
export type { UseThrottleOptions, UseThrottleReturn } from './hooks/use-throttle';

/**
 * Component exports
 * @description UI components for MinimalTiptap editor
 */
export { LinkBubbleMenu } from './components/bubble-menu/link-bubble-menu';
export type { LinkBubbleMenuLabels } from './components/bubble-menu/link-bubble-menu';
export { ImageEditBlock } from './components/image/image-edit-block';
export { ImageEditDialog } from './components/image/image-edit-dialog';
export { LinkEditBlock } from './components/link/link-edit-block';
export { LinkEditPopover } from './components/link/link-edit-popover';
export { LinkPopoverBlock } from './components/link/link-popover-block';
export { MeasuredContainer } from './components/measured-container';
export { SectionOne } from './components/section/one';
export { SectionTwo } from './components/section/two';
export type { SectionTwoLabels } from './components/section/two';
export { SectionThree } from './components/section/three';
export { SectionFour } from './components/section/four';
export type { SectionFourLabels } from './components/section/four';
export { SectionFive } from './components/section/five';
export { ShortcutKey } from './components/shortcut-key';
export { Spinner } from './components/spinner';
export { ToolbarButton } from './components/toolbar-button';
export { ToolbarSection } from './components/toolbar-section';
