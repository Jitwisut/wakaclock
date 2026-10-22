import {
  CloudUploadIcon,
  DownloadIcon,
  FolderGit2Icon,
  HeartPulseIcon,
  KeyboardIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  RadioIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  TrophyIcon,
  UsersIcon,
} from 'lucide-react';

/*
 * The dashboard navigation as data, kept apart from the NavMain component so the hook
 * that filters it (use-visible-nav-items) and the component that renders it can both
 * import it without importing each other.
 */

/** Navigation group containing a title and list of navigation items */
export type NavGroup = {
  /** Navigation items in this group */
  items: NavItem;
  /** Test ID for the group */
  testId?: string;
  /** Group title displayed as section header */
  title: string;
};

/** Array of navigation item objects */
export type NavItem = {
  /** Navigation link URL */
  href: string;
  /** Lucide icon component */
  icon?: LucideIcon;
  /** Shows "Coming" badge when true */
  isComing?: boolean;
  /** Custom badge text to display */
  isDataBadge?: string;
  /** Shows "New" badge when true */
  isNew?: boolean;
  /** Nested navigation items for collapsible menus */
  items?: NavItem;
  /** Opens link in new tab when true */
  newTab?: boolean;
  /** Hide this item unless the server capability matrix marks the feature as available. */
  requiresFeature?: string;
  /**
   * Hide this item unless the server has a transactional store. Goals and leaderboards
   * live in PostgreSQL, and a ClickHouse-only deployment is a supported configuration —
   * listing links that cannot work there reads as a broken product rather than as a
   * feature that install does not include.
   */
  requiresPostgres?: boolean;
  /** Test ID for the item */
  testId?: string;
  /** Display title for the navigation item */
  title: string;
}[];

export const navItems: NavGroup[] = [
  {
    testId: 'nav-main-group-wakaclock',
    title: 'AtoAxis',
    items: [
      { title: 'Overview', href: '/dashboard/wakaclock', icon: LayoutDashboardIcon },
      {
        title: 'Analytics',
        href: '/dashboard/wakaclock/analytics/timeline',
        icon: TrendingUpIcon,
        items: [
          { title: 'Activity Timeline', href: '/dashboard/wakaclock/analytics/timeline' },
          { title: 'Human vs AI', href: '/dashboard/wakaclock/analytics/human-ai' },
          {
            title: 'Projects',
            href: '/dashboard/wakaclock/analytics/projects',
            icon: FolderGit2Icon,
          },
          { title: 'Activity Heatmap', href: '/dashboard/wakaclock/analytics/heatmap' },
          { title: 'Measurement Trust', href: '/dashboard/wakaclock/analytics/trust' },
        ],
      },
      { title: 'Insights', href: '/dashboard/wakaclock/insights', icon: TrendingUpIcon },
      { title: 'AI Stats', href: '/dashboard/wakaclock/ai', icon: SparklesIcon },
      {
        title: 'Teams',
        href: '/dashboard/wakaclock/teams',
        icon: UsersIcon,
        requiresPostgres: true,
      },
      { title: 'Input Activity', href: '/dashboard/wakaclock/keystrokes', icon: KeyboardIcon },
      {
        title: 'Goals',
        href: '/dashboard/wakaclock/goals',
        icon: TargetIcon,
        requiresPostgres: true,
      },
      {
        title: 'Leaderboards',
        href: '/dashboard/wakaclock/leaderboards',
        icon: TrophyIcon,
        requiresPostgres: true,
        requiresFeature: 'private_leaderboards',
      },
      { title: 'Heartbeats', href: '/dashboard/wakaclock/heartbeats', icon: HeartPulseIcon },
      { title: 'Sync status', href: '/dashboard/wakaclock/sync', icon: CloudUploadIcon },
      {
        title: 'Import WakaTime',
        href: '/dashboard/wakaclock/import',
        icon: DownloadIcon,
        requiresPostgres: true,
      },
      { title: 'Presence (prototype)', href: '/dashboard/wakaclock/presence', icon: RadioIcon },
      { title: 'Settings', href: '/dashboard/wakaclock/settings', icon: SlidersHorizontalIcon },
    ],
  },
];
