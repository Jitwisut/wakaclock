import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// RESIZABLE FACTORY
// ============================================================================
// Comprehensive test data factories for the Resizable component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different resizable panel configurations.
// ============================================================================

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const LABEL_EDITOR = i18n.t('factory.resizable.editor', 'Editor');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Panel group direction
 * @description Controls the layout direction of panels
 */
export type ResizableDirection = 'horizontal' | 'vertical';

/**
 * Handle style variant
 * @description Visual style for resize handles
 */
export type ResizableHandleStyle = 'default' | 'hidden' | 'minimal' | 'visible';

/**
 * Panel content type
 * @description The type of content within a panel
 */
export type PanelContentType = 'code' | 'empty' | 'form' | 'list' | 'media' | 'navigation' | 'text';

/**
 * Panel position in layout
 * @description Common panel positions
 */
export type PanelPosition = 'bottom' | 'center' | 'left' | 'right' | 'top';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All direction options
 */
export const RESIZABLE_DIRECTIONS: ResizableDirection[] = ['horizontal', 'vertical'];

/**
 * All handle style options
 */
export const RESIZABLE_HANDLE_STYLES: ResizableHandleStyle[] = [
  'default',
  'visible',
  'minimal',
  'hidden',
];

/**
 * All panel content types
 */
export const PANEL_CONTENT_TYPES: PanelContentType[] = [
  'text',
  'code',
  'list',
  'navigation',
  'form',
  'media',
  'empty',
];

/**
 * All panel positions
 */
export const PANEL_POSITIONS: PanelPosition[] = ['left', 'center', 'right', 'top', 'bottom'];

/**
 * Common default sizes (percentages)
 */
export const DEFAULT_PANEL_SIZES = [20, 25, 30, 33, 50, 66, 70, 75, 80];

/**
 * Common minimum sizes (percentages)
 */
export const MIN_PANEL_SIZES = [10, 15, 20, 25, 30];

/**
 * Common maximum sizes (percentages)
 */
export const MAX_PANEL_SIZES = [50, 60, 70, 80, 90];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Individual panel configuration
 */
export interface FakeResizablePanel {
  /** Whether the panel is collapsible */
  collapsible?: boolean;
  /** Content type */
  contentType?: PanelContentType;
  /** Default size in percentage */
  defaultSize: number;
  /** Unique identifier */
  id: string;
  /** Panel label/title */
  label?: string;
  /** Maximum size in percentage */
  maxSize?: number;
  /** Minimum size in percentage */
  minSize?: number;
  /** Panel position hint */
  position?: PanelPosition;
}

/**
 * Resize handle configuration
 */
export interface FakeResizableHandle {
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Handle ID for testing */
  id: string;
  /** Whether to show grip icon */
  withHandle: boolean;
}

/**
 * Complete panel group configuration
 */
export interface FakeResizablePanelGroup {
  /** Whether auto-save layout is enabled */
  autoSaveId?: string;
  /** Layout direction */
  direction: ResizableDirection;
  /** Resize handles */
  handles: FakeResizableHandle[];
  /** Unique identifier */
  id: string;
  /** Panels in the group */
  panels: FakeResizablePanel[];
}

/**
 * Two-panel layout configuration
 */
export interface FakeTwoPanelLayout extends FakeResizablePanelGroup {
  /** First panel */
  leftPanel: FakeResizablePanel;
  /** Second panel */
  rightPanel: FakeResizablePanel;
}

/**
 * Three-panel layout configuration
 */
export interface FakeThreePanelLayout extends FakeResizablePanelGroup {
  /** Center/main panel */
  centerPanel: FakeResizablePanel;
  /** First panel */
  leftPanel: FakeResizablePanel;
  /** Third panel */
  rightPanel: FakeResizablePanel;
}

/**
 * IDE-style layout with multiple panels
 */
export interface FakeIDELayout {
  /** Bottom panel (terminal/output) */
  bottomPanel?: FakeResizablePanel;
  /** ID */
  id: string;
  /** Left panel (explorer) */
  leftPanel: FakeResizablePanel;
  /** Main content panel */
  mainPanel: FakeResizablePanel;
  /** Right panel (properties) */
  rightPanel?: FakeResizablePanel;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensure panel sizes sum to 100
 */
function normalizeSizes(sizes: number[]): number[] {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total === 100) return sizes;
  const factor = 100 / total;
  return sizes.map((size) => Math.round(size * factor));
}

/**
 * Get content type label
 */
function getLabelForContentType(contentType: PanelContentType): string {
  if (contentType === 'navigation') return i18n.t('factory.resizable.sidebar', 'Sidebar');
  if (contentType === 'code') return LABEL_EDITOR;
  if (contentType === 'list') return i18n.t('factory.resizable.explorer', 'Explorer');
  if (contentType === 'text') return i18n.t('factory.resizable.content', 'Content');
  if (contentType === 'form') return i18n.t('factory.resizable.properties', 'Properties');
  if (contentType === 'media') return i18n.t('factory.resizable.preview', 'Preview');
  return i18n.t('factory.resizable.panel', 'Panel');
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake resizable panel
 * @param overrides - Optional property overrides
 * @returns A fake resizable panel configuration
 */
export function createFakeResizablePanel(
  overrides?: Partial<FakeResizablePanel>
): FakeResizablePanel {
  const contentType = overrides?.contentType ?? faker.helpers.arrayElement(PANEL_CONTENT_TYPES);

  return {
    id: faker.string.uuid(),
    defaultSize: faker.helpers.arrayElement(DEFAULT_PANEL_SIZES),
    minSize: faker.helpers.maybe(() => faker.helpers.arrayElement(MIN_PANEL_SIZES), {
      probability: 0.5,
    }),
    maxSize: faker.helpers.maybe(() => faker.helpers.arrayElement(MAX_PANEL_SIZES), {
      probability: 0.3,
    }),
    collapsible: faker.datatype.boolean({ probability: 0.3 }),
    contentType,
    label: faker.helpers.maybe(() => overrides?.label ?? getLabelForContentType(contentType), {
      probability: 0.7,
    }),
    position: faker.helpers.arrayElement(PANEL_POSITIONS),
    ...overrides,
  };
}

/**
 * Creates multiple fake resizable panels
 * @param count - Number of panels to create
 * @param overrides - Optional property overrides
 * @returns Array of fake panel configurations
 */
export function createFakeResizablePanels(
  count: number,
  overrides?: Partial<FakeResizablePanel>
): FakeResizablePanel[] {
  // Distribute sizes evenly
  const baseSize = Math.floor(100 / count);
  const sizes = normalizeSizes(Array.from({ length: count }, () => baseSize));

  return Array.from({ length: count }, (_, index) =>
    createFakeResizablePanel({
      defaultSize: sizes[index],
      ...overrides,
    })
  );
}

/**
 * Creates a fake resize handle
 * @param overrides - Optional property overrides
 * @returns A fake resize handle configuration
 */
export function createFakeResizableHandle(
  overrides?: Partial<FakeResizableHandle>
): FakeResizableHandle {
  return {
    id: faker.string.uuid(),
    withHandle: faker.datatype.boolean({ probability: 0.7 }),
    ariaLabel: i18n.t('factory.resizable.resizePanels', 'Resize panels'),
    ...overrides,
  };
}

/**
 * Creates a complete fake panel group
 * @param panelCount - Number of panels
 * @param overrides - Optional property overrides
 * @returns A fake panel group configuration
 */
export function createFakeResizablePanelGroup(
  panelCount: number = 2,
  overrides?: Partial<FakeResizablePanelGroup>
): FakeResizablePanelGroup {
  const panels = overrides?.panels ?? createFakeResizablePanels(panelCount);
  const handleCount = panels.length - 1;

  return {
    id: faker.string.uuid(),
    direction: faker.helpers.arrayElement(RESIZABLE_DIRECTIONS),
    panels,
    handles: Array.from({ length: handleCount }, () => createFakeResizableHandle()),
    autoSaveId: faker.helpers.maybe(() => faker.lorem.slug(2), { probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake panel groups
 * @param count - Number of groups to create
 * @param panelsPerGroup - Panels per group
 * @param overrides - Optional property overrides
 * @returns Array of fake panel group configurations
 */
export function createFakeResizablePanelGroups(
  count: number,
  panelsPerGroup: number = 2,
  overrides?: Partial<FakeResizablePanelGroup>
): FakeResizablePanelGroup[] {
  return Array.from({ length: count }, () =>
    createFakeResizablePanelGroup(panelsPerGroup, overrides)
  );
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a horizontal two-panel layout (sidebar + content)
 * @param sidebarSize - Sidebar size percentage
 * @returns A two-panel horizontal layout
 */
export function createFakeTwoPanelHorizontal(sidebarSize: number = 25): FakeTwoPanelLayout {
  const leftPanel = createFakeResizablePanel({
    defaultSize: sidebarSize,
    minSize: 15,
    maxSize: 40,
    contentType: 'navigation',
    label: i18n.t('factory.resizable.sidebar', 'Sidebar'),
    position: 'left',
    collapsible: true,
  });

  const rightPanel = createFakeResizablePanel({
    defaultSize: 100 - sidebarSize,
    minSize: 50,
    contentType: 'text',
    label: i18n.t('factory.resizable.mainContent', 'Main Content'),
    position: 'center',
  });

  const group = createFakeResizablePanelGroup(2, {
    direction: 'horizontal',
    panels: [leftPanel, rightPanel],
  });

  return {
    ...group,
    leftPanel,
    rightPanel,
  };
}

/**
 * Creates a vertical two-panel layout (content + footer)
 * @param topSize - Top panel size percentage
 * @returns A two-panel vertical layout
 */
export function createFakeTwoPanelVertical(topSize: number = 70): FakeTwoPanelLayout {
  const leftPanel = createFakeResizablePanel({
    defaultSize: topSize,
    minSize: 30,
    contentType: 'code',
    label: LABEL_EDITOR,
    position: 'top',
  });

  const rightPanel = createFakeResizablePanel({
    defaultSize: 100 - topSize,
    minSize: 20,
    maxSize: 50,
    contentType: 'text',
    label: i18n.t('factory.resizable.terminal', 'Terminal'),
    position: 'bottom',
    collapsible: true,
  });

  const group = createFakeResizablePanelGroup(2, {
    direction: 'vertical',
    panels: [leftPanel, rightPanel],
  });

  return {
    ...group,
    leftPanel,
    rightPanel,
  };
}

/**
 * Creates a three-panel horizontal layout
 * @returns A three-panel horizontal layout
 */
export function createFakeThreePanelHorizontal(): FakeThreePanelLayout {
  const leftPanel = createFakeResizablePanel({
    defaultSize: 20,
    minSize: 15,
    maxSize: 30,
    contentType: 'navigation',
    label: i18n.t('factory.resizable.explorer', 'Explorer'),
    position: 'left',
    collapsible: true,
  });

  const centerPanel = createFakeResizablePanel({
    defaultSize: 60,
    minSize: 40,
    contentType: 'code',
    label: LABEL_EDITOR,
    position: 'center',
  });

  const rightPanel = createFakeResizablePanel({
    defaultSize: 20,
    minSize: 15,
    maxSize: 30,
    contentType: 'form',
    label: i18n.t('factory.resizable.properties', 'Properties'),
    position: 'right',
    collapsible: true,
  });

  const group = createFakeResizablePanelGroup(3, {
    direction: 'horizontal',
    panels: [leftPanel, centerPanel, rightPanel],
  });

  return {
    ...group,
    leftPanel,
    centerPanel,
    rightPanel,
  };
}

/**
 * Creates an IDE-style layout
 * @returns An IDE-style multi-panel layout
 */
export function createFakeIDELayout(): FakeIDELayout {
  return {
    id: faker.string.uuid(),
    leftPanel: createFakeResizablePanel({
      defaultSize: 20,
      minSize: 15,
      maxSize: 35,
      contentType: 'list',
      label: i18n.t('factory.resizable.explorer', 'Explorer'),
      collapsible: true,
    }),
    mainPanel: createFakeResizablePanel({
      defaultSize: 60,
      minSize: 40,
      contentType: 'code',
      label: LABEL_EDITOR,
    }),
    rightPanel: createFakeResizablePanel({
      defaultSize: 20,
      minSize: 15,
      maxSize: 35,
      contentType: 'form',
      label: i18n.t('factory.resizable.inspector', 'Inspector'),
      collapsible: true,
    }),
    bottomPanel: createFakeResizablePanel({
      defaultSize: 25,
      minSize: 15,
      maxSize: 50,
      contentType: 'text',
      label: i18n.t('factory.resizable.terminal', 'Terminal'),
      collapsible: true,
    }),
  };
}

/**
 * Creates a mail app style layout (list + preview)
 * @returns A mail app layout
 */
export function createFakeMailLayout(): FakeTwoPanelLayout {
  const leftPanel = createFakeResizablePanel({
    defaultSize: 35,
    minSize: 25,
    maxSize: 50,
    contentType: 'list',
    label: i18n.t('factory.resizable.mailList', 'Mail List'),
    position: 'left',
  });

  const rightPanel = createFakeResizablePanel({
    defaultSize: 65,
    minSize: 40,
    contentType: 'text',
    label: i18n.t('factory.resizable.messagePreview', 'Message Preview'),
    position: 'right',
  });

  const group = createFakeResizablePanelGroup(2, {
    direction: 'horizontal',
    panels: [leftPanel, rightPanel],
    handles: [createFakeResizableHandle({ withHandle: true })],
  });

  return {
    ...group,
    leftPanel,
    rightPanel,
  };
}

/**
 * Creates a dashboard layout with multiple panels
 * @returns A dashboard-style layout
 */
export function createFakeDashboardLayout(): FakeResizablePanelGroup {
  return createFakeResizablePanelGroup(3, {
    direction: 'horizontal',
    panels: [
      createFakeResizablePanel({
        defaultSize: 33,
        contentType: 'list',
        label: i18n.t('factory.resizable.metrics', 'Metrics'),
      }),
      createFakeResizablePanel({
        defaultSize: 34,
        contentType: 'media',
        label: i18n.t('factory.resizable.charts', 'Charts'),
      }),
      createFakeResizablePanel({
        defaultSize: 33,
        contentType: 'list',
        label: i18n.t('factory.resizable.activity', 'Activity'),
      }),
    ],
  });
}

/**
 * Creates panels with handles hidden
 * @returns A panel group with hidden handles
 */
export function createFakeHiddenHandleLayout(): FakeResizablePanelGroup {
  return createFakeResizablePanelGroup(2, {
    handles: [createFakeResizableHandle({ withHandle: false })],
  });
}

/**
 * Creates panels with visible grip handles
 * @returns A panel group with visible grip handles
 */
export function createFakeVisibleHandleLayout(): FakeResizablePanelGroup {
  const group = createFakeResizablePanelGroup(3);
  group.handles = group.handles.map((h) => ({ ...h, withHandle: true }));
  return group;
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of panel groups across directions
 * @returns Grid of panel groups for each direction
 */
export function createResizableDirectionMatrix(): FakeResizablePanelGroup[] {
  return RESIZABLE_DIRECTIONS.map((direction) => createFakeResizablePanelGroup(2, { direction }));
}

/**
 * Creates a matrix of different panel counts
 * @returns Grid of panel groups with different panel counts
 */
export function createResizablePanelCountMatrix(): FakeResizablePanelGroup[] {
  return [2, 3, 4].map((count) => createFakeResizablePanelGroup(count));
}

/**
 * Creates a matrix of handle styles
 * @returns Grid of panel groups with different handle styles
 */
export function createResizableHandleStyleMatrix(): FakeResizablePanelGroup[] {
  return [
    createFakeResizablePanelGroup(2, {
      handles: [createFakeResizableHandle({ withHandle: true })],
    }),
    createFakeResizablePanelGroup(2, {
      handles: [createFakeResizableHandle({ withHandle: false })],
    }),
  ];
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all resizable configurations
 * @returns Array of resizable configs for showcase
 */
export function createResizableShowcase(): Array<{
  description: string;
  layout: FakeIDELayout | FakeResizablePanelGroup;
  name: string;
}> {
  return [
    {
      name: i18n.t('factory.resizable.twoPanelHorizontal', 'Two Panel Horizontal'),
      description: i18n.t(
        'factory.resizable.classicSidebarAndContentLayout',
        'Classic sidebar and content layout'
      ),
      layout: createFakeTwoPanelHorizontal(),
    },
    {
      name: i18n.t('factory.resizable.twoPanelVertical', 'Two Panel Vertical'),
      description: i18n.t(
        'factory.resizable.editorAndTerminalLayout',
        'Editor and terminal layout'
      ),
      layout: createFakeTwoPanelVertical(),
    },
    {
      name: i18n.t('factory.resizable.threePanel', 'Three Panel'),
      description: i18n.t(
        'factory.resizable.explorerEditorAndProperties',
        'Explorer, editor, and properties'
      ),
      layout: createFakeThreePanelHorizontal(),
    },
    {
      name: i18n.t('factory.resizable.ideLayout', 'IDE Layout'),
      description: i18n.t(
        'factory.resizable.fullIdestyleMultipanelLayout',
        'Full IDE-style multi-panel layout'
      ),
      layout: createFakeIDELayout(),
    },
    {
      name: i18n.t('factory.resizable.mailLayout', 'Mail Layout'),
      description: i18n.t(
        'factory.resizable.emailListAndPreviewLayout',
        'Email list and preview layout'
      ),
      layout: createFakeMailLayout(),
    },
    {
      name: i18n.t('factory.resizable.dashboard', 'Dashboard'),
      description: i18n.t(
        'factory.resizable.threecolumnDashboardLayout',
        'Three-column dashboard layout'
      ),
      layout: createFakeDashboardLayout(),
    },
    {
      name: i18n.t('factory.resizable.hiddenHandles', 'Hidden Handles'),
      description: i18n.t(
        'factory.resizable.panelsWithInvisibleResizeHandles',
        'Panels with invisible resize handles'
      ),
      layout: createFakeHiddenHandleLayout(),
    },
    {
      name: i18n.t('factory.resizable.visibleHandles', 'Visible Handles'),
      description: i18n.t(
        'factory.resizable.panelsWithVisibleGripHandles',
        'Panels with visible grip handles'
      ),
      layout: createFakeVisibleHandleLayout(),
    },
  ];
}

/**
 * Creates a complete test data set for resizable testing
 * @returns Comprehensive test data
 */
export function createResizableTestData(): {
  directionMatrix: FakeResizablePanelGroup[];
  handles: FakeResizableHandle[];
  handleStyleMatrix: FakeResizablePanelGroup[];
  ideLayout: FakeIDELayout;
  mailLayout: FakeTwoPanelLayout;
  panelCountMatrix: FakeResizablePanelGroup[];
  panelGroups: FakeResizablePanelGroup[];
  panels: FakeResizablePanel[];
  showcase: Array<{
    description: string;
    layout: FakeIDELayout | FakeResizablePanelGroup;
    name: string;
  }>;
  threePanelLayout: FakeThreePanelLayout;
  twoPanelHorizontal: FakeTwoPanelLayout;
  twoPanelVertical: FakeTwoPanelLayout;
} {
  return {
    panels: createFakeResizablePanels(5),
    handles: Array.from({ length: 4 }, () => createFakeResizableHandle()),
    panelGroups: createFakeResizablePanelGroups(3),
    twoPanelHorizontal: createFakeTwoPanelHorizontal(),
    twoPanelVertical: createFakeTwoPanelVertical(),
    threePanelLayout: createFakeThreePanelHorizontal(),
    ideLayout: createFakeIDELayout(),
    mailLayout: createFakeMailLayout(),
    directionMatrix: createResizableDirectionMatrix(),
    panelCountMatrix: createResizablePanelCountMatrix(),
    handleStyleMatrix: createResizableHandleStyleMatrix(),
    showcase: createResizableShowcase(),
  };
}
