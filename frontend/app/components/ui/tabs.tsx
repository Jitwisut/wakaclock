'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

/**
 * Tabs component props
 *
 * @description Props for the Tabs container component.
 * @see https://www.radix-ui.com/primitives/docs/components/tabs
 */
export type TabsProps = React.ComponentProps<typeof TabsPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'tabs'
   */
  testId?: string;
};

/**
 * Tabs component - Tabbed content container
 *
 * @description
 * A tabbed interface for organizing content into selectable panels.
 * Only one panel is visible at a time.
 *
 * ## Features
 * - **Single Selection**: One active tab at a time
 * - **Keyboard Navigation**: Arrow keys between tabs
 * - **Automatic Activation**: Tab activates on focus (optional)
 * - **Controlled/Uncontrolled**: Both modes supported
 * - **Lazy Loading**: Content renders only when tab is active
 *
 * ## Use Cases
 * - Settings pages with categories
 * - Product details (description, reviews, specs)
 * - Dashboard views
 * - Form wizards with step indicators
 *
 * ## Accessibility
 * - `role="tablist"`, `role="tab"`, `role="tabpanel"`
 * - Arrow key navigation between tabs
 * - Tab/Shift+Tab to move in/out of tab list
 * - `aria-selected` on active tab
 *
 * @example
 * ```tsx
 * // Basic tabs
 * <Tabs defaultValue="account">
 *   <TabsList>
 *     <TabsTrigger value="account">Account</TabsTrigger>
 *     <TabsTrigger value="password">Password</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="account">
 *     Account settings...
 *   </TabsContent>
 *   <TabsContent value="password">
 *     Password settings...
 *   </TabsContent>
 * </Tabs>
 *
 * // Controlled tabs
 * const [tab, setTab] = React.useState("account");
 * <Tabs value={tab} onValueChange={setTab}>
 *   ...
 * </Tabs>
 *
 * // With icons
 * <TabsTrigger value="music">
 *   <MusicIcon className="mr-2 size-4" />
 *   Music
 * </TabsTrigger>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/tabs
 */
const Tabs = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.Root>, TabsProps>(
  ({ className, testId = 'tabs', ...props }, ref) => {
    return (
      <TabsPrimitive.Root
        ref={ref}
        data-slot="tabs"
        data-testid={testId}
        className={cn('flex flex-col gap-2', className)}
        {...props}
      />
    );
  }
);
Tabs.displayName = 'Tabs';

/** TabsList component props */
export type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List>;

/** TabsList component - container for tab triggers */
const TabsList = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsPrimitive.List
        ref={ref}
        data-slot="tabs-list"
        data-testid="tabs-list"
        className={cn(
          'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
          className
        )}
        {...props}
      />
    );
  }
);
TabsList.displayName = 'TabsList';

/** TabsTrigger component props */
export type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger>;

/** TabsTrigger component - individual tab button */
const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-slot="tabs-trigger"
      data-testid="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/50 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = 'TabsTrigger';

/** TabsContent component props */
export type TabsContentProps = React.ComponentProps<typeof TabsPrimitive.Content>;

/** TabsContent component - content for a tab panel */
const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.Content
      ref={ref}
      data-slot="tabs-content"
      data-testid="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
