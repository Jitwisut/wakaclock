'use client';

import * as React from 'react';
import { GripVerticalIcon } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '@/lib/utils';

/**
 * ResizablePanelGroup component props
 *
 * @description Props for the resizable panel group container.
 * @see https://github.com/bvaughn/react-resizable-panels
 */
export type ResizablePanelGroupProps = React.ComponentProps<
  typeof ResizablePrimitive.PanelGroup
> & {
  /**
   * Custom test ID for testing
   * @default 'resizable-panel-group'
   */
  testId?: string;
};

/**
 * ResizablePanelGroup component - Container for resizable panels
 *
 * @description
 * A layout component that creates resizable panel sections with
 * draggable dividers. Supports both horizontal and vertical layouts.
 *
 * ## Features
 * - **Bidirectional**: Horizontal or vertical layouts
 * - **Persist State**: Save/restore panel sizes via localStorage
 * - **Collapsible**: Panels can collapse to minimum size
 * - **Keyboard Support**: Arrow keys to resize focused handle
 * - **Nested Groups**: Support for complex layouts
 *
 * ## Use Cases
 * - IDE-style layouts (sidebar, editor, terminal)
 * - Dashboard panels
 * - Split views (email client style)
 * - Resizable navigation panels
 *
 * ## Accessibility
 * - Keyboard resize with arrow keys
 * - Focus visible on resize handles
 * - ARIA role="separator" on handles
 *
 * @example
 * ```tsx
 * // Horizontal layout
 * <ResizablePanelGroup direction="horizontal">
 *   <ResizablePanel defaultSize={25}>
 *     <div className="p-6">Sidebar</div>
 *   </ResizablePanel>
 *   <ResizableHandle />
 *   <ResizablePanel defaultSize={75}>
 *     <div className="p-6">Main Content</div>
 *   </ResizablePanel>
 * </ResizablePanelGroup>
 *
 * // Vertical with handle grip
 * <ResizablePanelGroup direction="vertical">
 *   <ResizablePanel>
 *     <div className="p-6">Top Panel</div>
 *   </ResizablePanel>
 *   <ResizableHandle withHandle />
 *   <ResizablePanel>
 *     <div className="p-6">Bottom Panel</div>
 *   </ResizablePanel>
 * </ResizablePanelGroup>
 *
 * // With persisted sizes
 * <ResizablePanelGroup
 *   direction="horizontal"
 *   autoSaveId="my-layout"
 * >
 *   ...
 * </ResizablePanelGroup>
 * ```
 *
 * @see https://github.com/bvaughn/react-resizable-panels
 */
const ResizablePanelGroup = React.forwardRef<
  React.ComponentRef<typeof ResizablePrimitive.PanelGroup>,
  ResizablePanelGroupProps
>(({ className, testId = 'resizable-panel-group', ...props }, ref) => {
  return (
    <ResizablePrimitive.PanelGroup
      ref={ref}
      data-slot="resizable-panel-group"
      data-testid={testId}
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      {...props}
    />
  );
});
ResizablePanelGroup.displayName = 'ResizablePanelGroup';

/**
 * ResizablePanel component props
 *
 * @description Props for individual resizable panel.
 */
export type ResizablePanelProps = React.ComponentProps<typeof ResizablePrimitive.Panel> & {
  /**
   * Custom test ID for testing
   * @default 'resizable-panel'
   */
  testId?: string;
};

/** ResizablePanel component - individual resizable panel */
const ResizablePanel = React.forwardRef<
  React.ComponentRef<typeof ResizablePrimitive.Panel>,
  ResizablePanelProps
>(({ testId = 'resizable-panel', ...props }, ref) => {
  return (
    <ResizablePrimitive.Panel
      ref={ref}
      data-slot="resizable-panel"
      data-testid={testId}
      {...props}
    />
  );
});
ResizablePanel.displayName = 'ResizablePanel';

/**
 * ResizableHandle component props
 *
 * @description Props for the resize handle between panels.
 */
export type ResizableHandleProps = React.ComponentProps<
  typeof ResizablePrimitive.PanelResizeHandle
> & {
  /** Show grip handle icon */
  withHandle?: boolean;
  /**
   * Custom test ID for testing
   * @default 'resizable-handle'
   */
  testId?: string;
};

/** ResizableHandle component - handle for resizing panels */
function ResizableHandle({
  withHandle,
  className,
  testId = 'resizable-handle',
  ...props
}: ResizableHandleProps) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      data-testid={testId}
      className={cn(
        'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" aria-hidden="true" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
}
ResizableHandle.displayName = 'ResizableHandle';

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
