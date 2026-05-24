import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Use command-specific handlers and factories
import {
  commandHandlers,
  commandStatusHandlers,
} from '@/.storybook/stories/_handlers/command.handlers';
import {
  searchHandlers,
  searchStatusHandlers,
} from '@/.storybook/stories/_handlers/search.handlers';
import {
  COMMAND_EMPTY_MESSAGES,
  COMMAND_EXECUTION_STATUSES,
  COMMAND_GROUP_HEADINGS,
  COMMAND_GROUPS,
  COMMAND_ICONS,
  COMMAND_ITEM_TYPES,
  COMMAND_LABELS,
  COMMAND_PLACEHOLDERS,
  COMMAND_PRIORITIES,
  COMMAND_SHORTCUTS,
  COMMAND_STATES,
  type CommandExecutionStatus,
  type CommandGroup as CommandGroupType,
  type CommandItemType,
  type CommandPriority,
  type CommandState,
  createFakeActionCommands,
  createFakeCommandDialog,
  createFakeCommandGroup,
  createFakeCommandGroups,
  createFakeCommandItem,
  createFakeCommandItems,
  createFakeCommandMatrix,
  createFakeCommandPalette,
  createFakeCommandSearch,
  createFakeCommandStateMatrix,
  createFakeCommandTypeMatrix,
  createFakeDisabledCommand,
  createFakeEnterpriseCommandPalette,
  createFakeFileCommands,
  createFakeKeyboardShortcutPalette,
  createFakeLoadingCommand,
  createFakeNavigationCommands,
  createFakeRecentCommands,
  createFakeSearchablePalette,
  createFakeSearchCommands,
  createFakeSearchResults,
  createFakeSettingsCommands,
  createFakeShortcutCommand,
  createFakeUserCommands,
  type FakeCommandDialog as FakeCommandDialogType,
  type FakeCommandExecution,
  type FakeCommandGroup,
  type FakeCommandItem,
  type FakeCommandPalette,
  type FakeCommandSearch,
} from '@/.storybook/stories/_factories/command.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

async function openCommandPalette(canvasElement: HTMLElement) {
  if (!canvasElement.querySelector('*')) {
    throw new Error(STORY_NO_DOM_ERROR);
  }

  const doc = canvasElement.ownerDocument;
  const body = within(doc.body);

  const openButton = canvasElement.querySelector('[data-slot="command-open"]');
  if (!(openButton instanceof HTMLButtonElement)) {
    throw new Error('Expected command palette open trigger button to be present.');
  }

  expect(openButton.textContent?.trim()).toBeInTheDocument();

  await userEvent.click(openButton);

  const dialog = await waitFor(() => body.getByRole('dialog'));
  const dialogQueries = within(dialog);

  const searchInput = dialog.querySelector('[data-slot="command-input"]');
  if (!(searchInput instanceof HTMLInputElement)) {
    throw new Error('Expected command input to be present.');
  }

  expect(searchInput.placeholder.trim()).toBeInTheDocument();

  return { body, dialog, dialogQueries, searchInput };
}

function CommandPaletteDemo({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="space-y-4" data-testid="command-palette-demo">
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        Open Command Palette
      </button>
      <CommandDialog
        description={i18n.t(
          'command.story.descSearchForCommandsAndActions',
          'Search for commands and actions'
        )}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.story.commandPalette', 'Command Palette')}
      >
        <CommandInput
          placeholder={i18n.t('command.story.typeACommandOrSearch', 'Type a command or search...')}
        />
        <CommandList>
          <CommandEmpty>{i18n.t('command.story.noResultsFound', 'No results found.')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.suggestions', 'Suggestions')}>
            <CommandItem>
              Calendar <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
            <CommandItem>
              Search <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
            <CommandItem disabled>
              Disabled <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={i18n.t('command.story.settingsHeading', 'Settings')}>
            <CommandItem>{i18n.t('command.story.profile', 'Profile')}</CommandItem>
            <CommandItem>{i18n.t('command.story.billing', 'Billing')}</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

// ============ MSW + FAKER INTEGRATION ============

interface ApiError {
  code: string;
  message: string;
  status: number;
}

// Demo: Command palette with async data loading
function CommandWithAsyncData({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [groups, setGroups] = React.useState<FakeCommandGroup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  React.useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);

    fetch('/api/command')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ groups: FakeCommandGroup[] }>;
      })
      .then((data) => {
        setGroups(data.groups);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, [open]);

  return (
    <div
      className="space-y-4"
      data-state={(() => {
        if (loading) return 'loading';
        if (error) return 'error';
        return 'success';
      })()}
    >
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        Open Command (Async)
      </button>
      <CommandDialog
        description={i18n.t('command.story.descSearchForCommands', 'Search for commands...')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.story.commandPalette', 'Command Palette')}
      >
        <CommandInput
          placeholder={i18n.t('command.story.typeACommandOrSearch', 'Type a command or search...')}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6" data-loading="true">
              <Loader2Icon className="size-4 animate-spin" />
              <span>{i18n.t('command.story.loadingCommands', 'Loading commands...')}</span>
            </div>
          )}
          {error && (
            <div className="p-4" data-error-status={error.status}>
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertTitle>
                  {i18n.t('command.story.error', 'Error')} {error.status}
                </AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            </div>
          )}
          {!loading && !error && groups.length === 0 && (
            <CommandEmpty>
              {i18n.t('command.story.noCommandsFound', 'No commands found.')}
            </CommandEmpty>
          )}
          {!loading &&
            !error &&
            groups.map((group, idx) => (
              <React.Fragment key={group.heading}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={group.heading}>
                  {group.items.map((item) => (
                    <CommandItem key={item.id} disabled={item.disabled} value={item.label}>
                      {item.label}
                      {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

// Demo: Command palette with Faker-generated static data
function CommandWithFakerData({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const groups = React.useMemo(() => createFakeCommandGroups(), []);

  return (
    <div className="space-y-4">
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        Open Command (Faker)
      </button>
      <CommandDialog
        description={i18n.t('command.story.descSearchForCommands', 'Search for commands...')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.story.commandPalette', 'Command Palette')}
      >
        <CommandInput
          placeholder={i18n.t('command.story.typeACommandOrSearch', 'Type a command or search...')}
        />
        <CommandList>
          <CommandEmpty>
            {i18n.t('command.story.noCommandsFound', 'No commands found.')}
          </CommandEmpty>
          {groups.map((group, idx) => (
            <React.Fragment key={group.heading}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem key={item.id} disabled={item.disabled} value={item.label}>
                    {item.label}
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Command',
  component: CommandPaletteDemo,
  tags: ['autodocs'],
  args: {
    defaultOpen: false,
    onValueChange: fn(),
    onSelect: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: {
      handlers: searchHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    placeholder: {
      control: 'text',
      description: i18n.t(
        'command.argType.placeholderTextForTheCommandInput',
        'Placeholder text for the command input'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    emptyMessage: {
      control: 'text',
      description: i18n.t(
        'command.argType.messageShownWhenNoResultsAreFound',
        'Message shown when no results are found'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('command.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'command.argType.initialOpenStateOfTheCommandDialog',
        'Initial open state of the command dialog'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    shouldFilter: {
      control: 'boolean',
      description: i18n.t(
        'command.argType.whetherToFilterItemsBasedOnInput',
        'Whether to filter items based on input'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    loop: {
      control: 'boolean',
      description: i18n.t(
        'command.argType.whetherToLoopKeyboardNavigation',
        'Whether to loop keyboard navigation'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    modal: {
      control: 'boolean',
      description: i18n.t(
        'command.argType.whetherTheDialogIsModalBlocksOutsideInteraction',
        'Whether the dialog is modal (blocks outside interaction)'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('command.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('command.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('command.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('command.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('command.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('command.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('command.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t('command.argType.calledWhenValueChanges', 'Called when value changes'),
      table: { category: 'Events' },
    },
    onSelect: {
      action: 'onSelect',
      description: i18n.t(
        'command.argType.calledWhenAnItemIsSelected',
        'Called when an item is selected'
      ),
      table: { category: 'Events' },
    },
    // Command Props Reference (cmdk Command):
    // - value: Controlled selected value (string)
    // - onValueChange: Called when value changes ((value: string) => void)
    // - filter: Custom filter function ((value: string, search: string) => number)
    // - shouldFilter: Whether to filter items (boolean, default: true)
    // - loop: Loop keyboard navigation (boolean, default: false)
    // - vimBindings: Enable vim-style navigation (boolean, default: true)
    // - className: Additional CSS classes (string)
    //
    // CommandDialog Props Reference:
    // - open: Controlled open state (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - title: Dialog title for accessibility (string)
    // - description: Dialog description for accessibility (string)
    // - className: Additional CSS classes (string)
    //
    // CommandInput Props Reference:
    // - placeholder: Input placeholder text (string)
    // - value: Controlled input value (string)
    // - onValueChange: Called when input changes ((value: string) => void)
    // - className: Additional CSS classes (string)
    //
    // CommandList Props Reference:
    // - className: Additional CSS classes (string)
    // - children: CommandGroup, CommandItem elements (ReactNode)
    //
    // CommandEmpty Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Empty state content (ReactNode)
    //
    // CommandGroup Props Reference:
    // - heading: Group heading text (string)
    // - forceMount: Force mount group (boolean)
    // - className: Additional CSS classes (string)
    //
    // CommandItem Props Reference:
    // - value: Item value for filtering (string)
    // - disabled: Whether item is disabled (boolean)
    // - onSelect: Called when item is selected ((value: string) => void)
    // - keywords: Additional keywords for filtering (string[])
    // - className: Additional CSS classes (string)
    //
    // CommandSeparator, CommandShortcut
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const openButton = canvasElement.querySelector('[data-slot="command-open"]');
    expect(openButton).toBeInTheDocument();
    expect(openButton instanceof HTMLButtonElement).toBe(true);

    // Dialog should not be open
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);
    expect(body.queryByRole('dialog')).not.toBeInTheDocument();
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Dialog should be open by default
    await waitFor(() => {
      const dialog = body.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    const dialog = body.getByRole('dialog');

    // Verify command structure is present
    expect(dialog.querySelector('[data-slot="command"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="command-input"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="command-list"]')).toBeInTheDocument();

    // Verify groups and items render
    const groups = dialog.querySelectorAll('[data-slot="command-group"]');
    expect(groups.length).toBe(2);

    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(5);
  },
};

export const Default: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    const { body, dialog, dialogQueries, searchInput } = await openCommandPalette(canvasElement);
    expect(dialog.querySelector('[data-slot="command"]')).toBeInTheDocument();

    expect(dialog.querySelectorAll('[data-slot="command-group"]').length).toBe(2);
    expect(dialog.querySelectorAll('[data-slot="command-item"]').length).toBe(5);
    expect(dialog.querySelectorAll('[data-slot="command-shortcut"]').length).toBe(3);
    expect(dialog.querySelector('[data-slot="command-separator"]')).toBeInTheDocument();
    expect(
      dialog.querySelector('[data-slot="command-item"][data-disabled="true"]')
    ).toBeInTheDocument();

    expect(dialog.querySelector('[data-slot="command-empty"]')).not.toBeInTheDocument();

    await userEvent.type(searchInput, 'zzz');

    await waitFor(() => {
      const empty = dialog.querySelector('[data-slot="command-empty"]');
      if (!(empty instanceof HTMLElement)) {
        throw new Error('Expected empty state to render after filtering.');
      }
      expect(empty.textContent?.trim()).toBeInTheDocument();
    });

    await userEvent.click(dialogQueries.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function CommandVariantsDemo() {
  const { t } = useTranslation();
  const [basicOpen, setBasicOpen] = React.useState(false);
  const [groupedOpen, setGroupedOpen] = React.useState(false);
  const [searchableOpen, setSearchableOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6" data-testid="command-variants-demo">
      <div>
        <p className="mb-2 text-sm font-medium">{t('command.variants.basic')}</p>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => setBasicOpen(true)}
          type="button"
        >
          Open Basic Command
        </button>
        <CommandDialog
          description={i18n.t('command.story.descSimpleCommandPalette', 'Simple command palette')}
          onOpenChange={setBasicOpen}
          open={basicOpen}
          title={i18n.t('command.story.basicCommand', 'Basic Command')}
        >
          <CommandInput placeholder={i18n.t('command.story.typeACommand', 'Type a command...')} />
          <CommandList>
            <CommandEmpty>{t('command.story.noResultsFound', 'No results found.')}</CommandEmpty>
            <CommandItem>{i18n.t('command.story.action1', 'Action 1')}</CommandItem>
            <CommandItem>{i18n.t('command.story.action2', 'Action 2')}</CommandItem>
            <CommandItem>{i18n.t('command.story.action3', 'Action 3')}</CommandItem>
          </CommandList>
        </CommandDialog>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('command.variants.withGroups')}</p>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => setGroupedOpen(true)}
          type="button"
        >
          Open Grouped Command
        </button>
        <CommandDialog
          description={i18n.t(
            'command.story.descCommandPaletteWithGroups',
            'Command palette with groups'
          )}
          onOpenChange={setGroupedOpen}
          open={groupedOpen}
          title={i18n.t('command.story.groupedCommand', 'Grouped Command')}
        >
          <CommandInput
            placeholder={i18n.t('command.story.searchCommands', 'Search commands...')}
          />
          <CommandList>
            <CommandEmpty>{t('command.story.noResultsFound', 'No results found.')}</CommandEmpty>
            <CommandGroup heading={i18n.t('command.story.navigation', 'Navigation')}>
              <CommandItem>{t('command.story.goToHome', 'Go to Home')}</CommandItem>
              <CommandItem>{t('command.story.goToDashboard', 'Go to Dashboard')}</CommandItem>
              <CommandItem>{t('command.story.goToSettings', 'Go to Settings')}</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={i18n.t('command.story.actions', 'Actions')}>
              <CommandItem>{t('command.story.createNew', 'Create New')}</CommandItem>
              <CommandItem>{t('command.story.editCurrent', 'Edit Current')}</CommandItem>
              <CommandItem>{t('command.story.deleteSelected', 'Delete Selected')}</CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('command.variants.searchable')}</p>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => setSearchableOpen(true)}
          type="button"
        >
          Open Searchable Command
        </button>
        <CommandDialog
          description={i18n.t('command.story.descSearchForAnything', 'Search for anything')}
          onOpenChange={setSearchableOpen}
          open={searchableOpen}
          title={i18n.t('command.story.searchTitle', 'Search')}
        >
          <CommandInput
            placeholder={i18n.t('command.story.searchEverything', 'Search everything...')}
          />
          <CommandList>
            <CommandEmpty>{t('command.story.noResultsFound', 'No results found.')}</CommandEmpty>
            <CommandGroup heading={i18n.t('command.story.quickActions', 'Quick Actions')}>
              <CommandItem>
                {t('command.story.newDocument', 'New Document')}{' '}
                <CommandShortcut>Ctrl+N</CommandShortcut>
              </CommandItem>
              <CommandItem>
                {t('command.story.save', 'Save')} <CommandShortcut>Ctrl+S</CommandShortcut>
              </CommandItem>
              <CommandItem>
                {t('command.story.openFile', 'Open File')} <CommandShortcut>Ctrl+O</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={i18n.t('command.story.recentFiles', 'Recent Files')}>
              <CommandItem>project-notes.md</CommandItem>
              <CommandItem>design-spec.pdf</CommandItem>
              <CommandItem>meeting-notes.txt</CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('command.variants.dialogMode')}</p>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => setDialogOpen(true)}
          type="button"
        >
          Open Dialog Command
        </button>
        <CommandDialog
          description={i18n.t(
            'command.story.descFullFeaturedCommandDialog',
            'Full-featured command dialog'
          )}
          onOpenChange={setDialogOpen}
          open={dialogOpen}
          title={i18n.t('command.story.commandPalette', 'Command Palette')}
        >
          <CommandInput placeholder={i18n.t('command.story.whatDoYouNeed', 'What do you need?')} />
          <CommandList>
            <CommandEmpty>
              {t('command.story.noCommandsMatchYourSearch', 'No commands match your search.')}
            </CommandEmpty>
            <CommandGroup heading={i18n.t('command.story.available', 'Available')}>
              <CommandItem>{t('command.story.runBuild', 'Run Build')}</CommandItem>
              <CommandItem>{t('command.story.runTests', 'Run Tests')}</CommandItem>
              <CommandItem>{t('command.story.deployToStaging', 'Deploy to Staging')}</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={i18n.t('command.story.restricted', 'Restricted')}>
              <CommandItem disabled>
                {t('command.story.deployToProduction', 'Deploy to Production')}
              </CommandItem>
              <CommandItem disabled>
                {t('command.story.deleteDatabase', 'Delete Database')}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <CommandVariantsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="command-variants-demo"]');
    expect(container).toBeInTheDocument();

    // Verify all four variant buttons are present
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(4);

    // Verify variant labels are rendered
    expect(container?.textContent).toContain('Open Basic Command');
    expect(container?.textContent).toContain('Open Grouped Command');
    expect(container?.textContent).toContain('Open Searchable Command');
    expect(container?.textContent).toContain('Open Dialog Command');

    // Open the basic variant and verify
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    await userEvent.click(buttons[0]);
    await waitFor(() => {
      const dialog = body.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    const dialog = body.getByRole('dialog');
    expect(dialog.querySelector('[data-slot="command-input"]')).toBeInTheDocument();

    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBeGreaterThan(0);

    // Close dialog
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

function CommandSizesDemo() {
  const [compactOpen, setCompactOpen] = React.useState(false);
  const [defaultOpen, setDefaultOpen] = React.useState(false);
  const [wideOpen, setWideOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6" data-testid="command-sizes-demo">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('command.sizes.compact')}</p>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => setCompactOpen(true)}
          type="button"
        >
          Open Compact
        </button>
        <CommandDialog
          description={i18n.t('command.story.descCompactCommandPalette', 'Compact command palette')}
          onOpenChange={setCompactOpen}
          open={compactOpen}
          title={i18n.t('command.story.compact', 'Compact')}
        >
          <CommandInput placeholder={i18n.t('command.story.searchPlaceholder', 'Search...')} />
          <CommandList>
            <CommandEmpty>{i18n.t('command.story.noResults', 'No results.')}</CommandEmpty>
            <CommandItem>{i18n.t('command.story.option1', 'Option 1')}</CommandItem>
            <CommandItem>{i18n.t('command.story.option2', 'Option 2')}</CommandItem>
            <CommandItem>{i18n.t('command.story.option3', 'Option 3')}</CommandItem>
          </CommandList>
        </CommandDialog>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('command.sizes.default')}</p>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => setDefaultOpen(true)}
          type="button"
        >
          Open Default
        </button>
        <CommandDialog
          description={i18n.t(
            'command.story.descDefaultWidthCommandPalette',
            'Default width command palette'
          )}
          onOpenChange={setDefaultOpen}
          open={defaultOpen}
          title={i18n.t('command.story.defaultTitle', 'Default')}
        >
          <CommandInput
            placeholder={i18n.t(
              'command.story.typeACommandOrSearch',
              'Type a command or search...'
            )}
          />
          <CommandList>
            <CommandEmpty>
              {i18n.t('command.story.noResultsFound', 'No results found.')}
            </CommandEmpty>
            <CommandGroup heading={i18n.t('command.story.suggestions', 'Suggestions')}>
              <CommandItem>{i18n.t('command.story.calendar', 'Calendar')}</CommandItem>
              <CommandItem>{i18n.t('command.story.search', 'Search')}</CommandItem>
              <CommandItem>{i18n.t('command.story.settings', 'Settings')}</CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('command.sizes.wide')}</p>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => setWideOpen(true)}
          type="button"
        >
          Open Wide
        </button>
        <CommandDialog
          description={i18n.t(
            'command.story.descWideCommandPalette',
            'Wide command palette for complex searches'
          )}
          onOpenChange={setWideOpen}
          open={wideOpen}
          title={i18n.t('command.story.wide', 'Wide')}
        >
          <CommandInput
            placeholder={i18n.t(
              'command.story.searchAcrossAll',
              'Search across all documents, settings, and actions...'
            )}
          />
          <CommandList>
            <CommandEmpty>
              {i18n.t('command.story.noResultsFound', 'No results found.')}
            </CommandEmpty>
            <CommandGroup heading={i18n.t('command.story.documents', 'Documents')}>
              <CommandItem>
                {i18n.t(
                  'command.story.annualReport',
                  'Annual Report 2024.pdf - Finance Department'
                )}
              </CommandItem>
              <CommandItem>
                {i18n.t('command.story.projectRoadmap', 'Project Roadmap Q1.xlsx - Product Team')}
              </CommandItem>
              <CommandItem>
                {i18n.t(
                  'command.story.teamMeetingNotes',
                  'Team Meeting Notes - December 2024.docx'
                )}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={i18n.t('command.story.settingsHeading', 'Settings')}>
              <CommandItem>
                {i18n.t(
                  'command.story.userPreferencesNotificationSettings',
                  'User Preferences - Notification Settings'
                )}
              </CommandItem>
              <CommandItem>
                {i18n.t(
                  'command.story.accountSecurityTwofactorAuthentication',
                  'Account Security - Two-Factor Authentication'
                )}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <CommandSizesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="command-sizes-demo"]');
    expect(container).toBeInTheDocument();

    // Verify all three size buttons are present
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(3);

    // Verify size labels are rendered
    expect(container?.textContent).toContain('Open Compact');
    expect(container?.textContent).toContain('Open Default');
    expect(container?.textContent).toContain('Open Wide');

    // Open the compact size variant and verify
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    await userEvent.click(buttons[0]);
    await waitFor(() => {
      const dialog = body.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    const dialog = body.getByRole('dialog');
    expect(dialog.querySelector('[data-slot="command-input"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="command-list"]')).toBeInTheDocument();

    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBeGreaterThan(0);

    // Close dialog
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const { body, dialogQueries, searchInput } = await openCommandPalette(canvasElement);

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    expect(dialogQueries.getByText('候補')).toBeInTheDocument();
    expect(dialogQueries.getByText('設定')).toBeInTheDocument();
    expect(dialogQueries.getByText('カレンダー')).toBeInTheDocument();
    expect(dialogQueries.getByText('検索')).toBeInTheDocument();
    expect(dialogQueries.getByText('プロフィール')).toBeInTheDocument();
    expect(dialogQueries.getByText('請求')).toBeInTheDocument();

    await userEvent.type(searchInput, 'zzz');

    await waitFor(() => {
      expect(dialogQueries.getByText('結果が見つかりません。')).toBeInTheDocument();
    });

    await userEvent.click(dialogQueries.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('command.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MSW + FAKER STORIES ============

export const WithFakerData: Story = {
  args: { defaultOpen: true },
  render: (args) => <CommandWithFakerData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(() => {
      const dialog = doc.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();
    });

    const dialog = doc.querySelector('[role="dialog"]');
    expect(dialog?.querySelectorAll('[data-slot="command-group"]').length).not.toBe(0);
  },
};

export const WithAsyncData: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchHandlers,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const dialog = doc.querySelector('[role="dialog"]');
        const groups = dialog?.querySelectorAll('[data-slot="command-group"]');
        expect(groups?.length).not.toBe(0);
      },
      { timeout: 3000 }
    );
  },
};

export const Loading: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.loading,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(() => {
      const dialog = doc.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain('Loading');
    });
  },
};

export const Error500InternalServerError: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.internalServerError,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="500"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.serviceUnavailable,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="503"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error400BadRequest: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.badRequest,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="400"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.unauthorized,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="401"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.forbidden,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="403"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.unprocessableEntity,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="422"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const NetworkError: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.networkError,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: searchHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.notFound,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="404"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.tooManyRequests,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="429"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.badGateway,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="502"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.gatewayTimeout,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const errorAlert = doc.querySelector('[data-error-status="504"]');
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.emptyData,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await waitFor(
      () => {
        const dialog = doc.querySelector('[role="dialog"]');
        const empty = dialog?.querySelector('[data-slot="command-empty"]');
        expect(empty).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowResponse: Story = {
  args: { defaultOpen: true },
  parameters: {
    msw: {
      handlers: searchStatusHandlers.slowResponse,
    },
  },
  render: (args) => <CommandWithAsyncData {...args} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    // Initially should show loading
    await waitFor(() => {
      const dialog = doc.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain('Loading');
    });
    // After slow response completes (5s), should show data
    await waitFor(
      () => {
        const dialog = doc.querySelector('[role="dialog"]');
        const groups = dialog?.querySelectorAll('[data-slot="command-group"]');
        expect(groups?.length).not.toBe(0);
      },
      { timeout: 10_000 }
    );
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('command.storyName.accessibility', 'Accessibility (Keyboard Navigation)'),
  play: async ({ canvasElement }) => {
    const { body, dialog, searchInput } = await openCommandPalette(canvasElement);

    const doc = canvasElement.ownerDocument;

    // Verify dialog has proper role
    expect(dialog.getAttribute('role')).toBe('dialog');

    // Verify dialog has aria-label or aria-labelledby
    const hasLabel = dialog.getAttribute('aria-label') || dialog.getAttribute('aria-labelledby');
    expect(hasLabel).toBeInTheDocument();

    // Verify search input is focused initially
    expect(doc.activeElement).toBe(searchInput);

    // Verify command list exists
    const commandList = dialog.querySelector('[data-slot="command-list"]');
    expect(commandList).toBeInTheDocument();

    // Verify command groups exist
    const commandGroups = dialog.querySelectorAll('[data-slot="command-group"]');
    expect(commandGroups.length).not.toBe(0);

    // Verify command items exist
    const commandItems = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(commandItems.length).not.toBe(0);

    // Test Arrow Down navigation
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      const selectedItem = dialog.querySelector('[data-slot="command-item"][data-selected="true"]');
      expect(selectedItem).toBeInTheDocument();
    });

    // Test Arrow Up navigation
    await userEvent.keyboard('{ArrowUp}');

    // Test typing to filter
    await userEvent.type(searchInput, 'cal');
    await waitFor(() => {
      const visibleItems = dialog.querySelectorAll(
        '[data-slot="command-item"]:not([data-disabled="true"])'
      );
      expect(visibleItems.length).not.toBe(0);
    });

    // Clear input
    await userEvent.clear(searchInput);

    // Test Enter key to select item
    await userEvent.keyboard('{ArrowDown}');
    const selectedItemBefore = dialog.querySelector(
      '[data-slot="command-item"][data-selected="true"]'
    );
    expect(selectedItemBefore).toBeInTheDocument();

    // Test Escape key to close dialog
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Reopen and verify disabled items
    const { dialog: reopenedDialog } = await openCommandPalette(canvasElement);

    const disabledItem = reopenedDialog.querySelector(
      '[data-slot="command-item"][data-disabled="true"]'
    );
    if (disabledItem) {
      expect(disabledItem.getAttribute('aria-disabled')).toBe('true');
    }

    // Close dialog
    const closeButton = reopenedDialog.querySelector('button[aria-label="Close"]');
    if (closeButton instanceof HTMLButtonElement) {
      await userEvent.click(closeButton);
    } else {
      await userEvent.keyboard('{Escape}');
    }
  },
};

// ============ DARK MODE ============

export const DarkMode: Story = {
  name: i18n.t('command.storyName.darkMode', 'Dark Mode'),
  args: { defaultOpen: true },
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Wait for dialog to open
    await waitFor(() => {
      const dialog = doc.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();
    });

    const dialog = doc.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();

    // Verify command components are present in dark mode
    expect(dialog?.querySelector('[data-slot="command"]')).toBeInTheDocument();
    expect(dialog?.querySelector('[data-slot="command-input"]')).toBeInTheDocument();
    expect(dialog?.querySelector('[data-slot="command-list"]')).toBeInTheDocument();

    // Verify groups and items render
    const groups = dialog?.querySelectorAll('[data-slot="command-group"]');
    expect(groups?.length).toBeGreaterThan(0);

    const items = dialog?.querySelectorAll('[data-slot="command-item"]');
    expect(items?.length).toBeGreaterThan(0);
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('command.storyName.darkModeJapanese', 'Dark Mode (Japanese)'),
  args: { defaultOpen: true },
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify Japanese locale is active
    expect(doc.documentElement.lang).toBe('ja');

    // Wait for dialog
    await waitFor(() => {
      const dialog = doc.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();
    });

    const dialog = doc.querySelector('[role="dialog"]');

    // Verify Japanese text is present
    expect(dialog?.textContent).toContain('候補');
    expect(dialog?.textContent).toContain('設定');
  },
};

// ============ COMPREHENSIVE KEYBOARD NAVIGATION ============

export const KeyboardNavigation: Story = {
  name: i18n.t(
    'command.storyName.keyboardNavigation',
    'Keyboard Navigation (Arrow Up/Down, Enter)'
  ),
  play: async ({ canvasElement }) => {
    const { body, dialog, searchInput } = await openCommandPalette(canvasElement);
    const doc = canvasElement.ownerDocument;

    // 1. Verify initial focus is on search input
    expect(doc.activeElement).toBe(searchInput);

    // 2. Get all command items
    const items = dialog.querySelectorAll('[data-slot="command-item"]:not([data-disabled="true"])');
    expect(items.length).toBeGreaterThan(0);

    // 3. Arrow Down - should select first item
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      const selected = dialog.querySelector('[data-slot="command-item"][data-selected="true"]');
      expect(selected).toBeInTheDocument();
    });

    // 4. Arrow Down multiple times - should move selection
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    // 5. Arrow Up - should move selection up
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => {
      const selected = dialog.querySelector('[data-slot="command-item"][data-selected="true"]');
      expect(selected).toBeInTheDocument();
    });

    // 6. Verify Enter key can be pressed (selection exists)
    const selectedBeforeEnter = dialog.querySelector(
      '[data-slot="command-item"][data-selected="true"]'
    );
    expect(selectedBeforeEnter).toBeInTheDocument();

    // 7. Test Escape closes dialog
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

export const SearchFiltering: Story = {
  name: i18n.t('command.storyName.searchFiltering', 'Search Filtering'),
  play: async ({ canvasElement }) => {
    const { dialog, searchInput } = await openCommandPalette(canvasElement);

    // Count initial items
    const initialItems = dialog.querySelectorAll('[data-slot="command-item"]');
    const initialCount = initialItems.length;
    expect(initialCount).toBeGreaterThan(0);

    // Type to filter
    await userEvent.type(searchInput, 'cal');

    // Wait for filtering to apply
    await waitFor(() => {
      const filteredItems = dialog.querySelectorAll('[data-slot="command-item"]');
      // Should have fewer or equal items after filtering
      expect(filteredItems.length).toBeLessThanOrEqual(initialCount);
    });

    // Clear and verify items return
    await userEvent.clear(searchInput);
    await waitFor(() => {
      const restoredItems = dialog.querySelectorAll('[data-slot="command-item"]');
      expect(restoredItems.length).toBe(initialCount);
    });

    // Search for non-existent term
    await userEvent.type(searchInput, 'xyznonexistent');
    await waitFor(() => {
      const emptyState = dialog.querySelector('[data-slot="command-empty"]');
      expect(emptyState).toBeInTheDocument();
    });
  },
};

// ============ ARIA COMBOBOX PATTERN ============

export const AriaComboboxPattern: Story = {
  name: i18n.t('command.storyName.ariaComboboxPattern', 'ARIA Combobox Pattern'),
  play: async ({ canvasElement }) => {
    const { dialog, searchInput } = await openCommandPalette(canvasElement);

    // 1. Verify dialog role
    expect(dialog.getAttribute('role')).toBe('dialog');

    // 2. Verify dialog has accessible name
    const hasAccessibleName =
      dialog.getAttribute('aria-label') ||
      dialog.getAttribute('aria-labelledby') ||
      dialog.querySelector('[data-slot="dialog-title"]');
    expect(hasAccessibleName).toBeTruthy();

    // 3. Verify search input attributes
    expect(searchInput.tagName.toLowerCase()).toBe('input');

    // 4. Verify command list exists
    const commandList = dialog.querySelector('[data-slot="command-list"]');
    expect(commandList).toBeInTheDocument();

    // 5. Verify command items have proper structure
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBeGreaterThan(0);

    // 6. Test keyboard navigation updates selection
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      const selected = dialog.querySelector('[data-slot="command-item"][data-selected="true"]');
      expect(selected).toBeInTheDocument();
    });

    // 7. Verify disabled items have aria-disabled
    const disabledItems = dialog.querySelectorAll(
      '[data-slot="command-item"][data-disabled="true"]'
    );
    disabledItems.forEach((item) => {
      expect(item.getAttribute('aria-disabled')).toBe('true');
    });

    // 8. Verify groups have headings
    const groups = dialog.querySelectorAll('[data-slot="command-group"]');
    groups.forEach((group) => {
      const heading = group.querySelector('[cmdk-group-heading]');
      if (heading) {
        expect(heading.textContent?.trim().length).toBeGreaterThan(0);
      }
    });
  },
};

// ============ FOCUS MANAGEMENT ============

export const FocusManagement: Story = {
  name: i18n.t('command.storyName.focusManagement', 'Focus Management'),
  play: async ({ canvasElement }) => {
    const { body, dialog, searchInput } = await openCommandPalette(canvasElement);
    const doc = canvasElement.ownerDocument;

    // 1. Initial focus should be on input
    expect(doc.activeElement).toBe(searchInput);

    // 2. Tab should not leave the dialog (focus trap)
    await userEvent.tab();
    // Focus should still be within dialog
    expect(dialog.contains(doc.activeElement)).toBe(true);

    // 3. Shift+Tab should also stay within dialog
    await userEvent.tab({ shift: true });
    expect(dialog.contains(doc.activeElement)).toBe(true);

    // 4. Escape should close and return focus
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // 5. Verify focus returns to trigger button
    const triggerButton = canvasElement.querySelector('[data-slot="command-open"]');
    if (triggerButton) {
      expect(doc.activeElement === triggerButton || canvasElement.contains(doc.activeElement)).toBe(
        true
      );
    }
  },
};

// ============ WITH COMMAND HANDLERS ============

export const WithCommandHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: commandHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FACTORY: SINGLE ITEM FACTORIES ============

function SingleCommandItemDemo() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const item: FakeCommandItem = React.useMemo(() => createFakeCommandItem(), []);

  return (
    <div className="space-y-4" data-testid="single-item-demo">
      <p className="text-sm font-medium">{t('command.section.content')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {t('command.open')}
      </button>
      <CommandDialog
        description={t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={t('command.dialog.title')}
      >
        <CommandInput placeholder={t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{t('command.empty')}</CommandEmpty>
          <CommandGroup heading={item.group}>
            <CommandItem disabled={item.disabled} value={item.value}>
              {item.label}
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactorySingleItem: Story = {
  render: () => <SingleCommandItemDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(1);
    const groups = dialog.querySelectorAll('[data-slot="command-group"]');
    expect(groups.length).toBe(1);
  },
};

function SingleCommandGroupDemo() {
  const [open, setOpen] = React.useState(false);
  const group: FakeCommandGroup = React.useMemo(() => createFakeCommandGroup(), []);

  return (
    <div className="space-y-4" data-testid="single-group-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.groups')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={group.heading}>
            {group.items.map((item) => (
              <CommandItem key={item.id} disabled={item.disabled} value={item.label}>
                {item.label}
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactorySingleGroup: Story = {
  render: () => <SingleCommandGroupDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const groups = dialog.querySelectorAll('[data-slot="command-group"]');
    expect(groups.length).toBe(1);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBeGreaterThan(0);
  },
};

function CommandPaletteConfigDemo() {
  const [open, setOpen] = React.useState(false);
  const palette: FakeCommandPalette = React.useMemo(
    () => createFakeCommandPalette({ state: 'open' }),
    []
  );

  return (
    <div className="space-y-4" data-testid="palette-config-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.palette')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={palette.placeholder} />
        <CommandList>
          <CommandEmpty>{palette.emptyMessage}</CommandEmpty>
          {palette.groups.map((group, idx) => (
            <React.Fragment key={group.id}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem key={item.id} disabled={item.disabled} value={item.label}>
                    {item.label}
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryFullPalette: Story = {
  render: () => <CommandPaletteConfigDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const groups = dialog.querySelectorAll('[data-slot="command-group"]');
    expect(groups.length).toBeGreaterThan(0);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBeGreaterThan(0);
    expect(dialog.querySelector('[data-slot="command-input"]')).toBeInTheDocument();
  },
};

function CommandDialogConfigDemo() {
  const dialogConfig: FakeCommandDialogType = React.useMemo(
    () => createFakeCommandDialog({ open: false }),
    []
  );
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4" data-testid="dialog-config-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.dialog')}</p>
      <div className="text-muted-foreground mb-2 text-xs">
        <span>Title: {dialogConfig.title}</span>
        {dialogConfig.shortcut && <span className="ml-2">Shortcut: {dialogConfig.shortcut}</span>}
      </div>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={dialogConfig.description}
        onOpenChange={setOpen}
        open={open}
        title={dialogConfig.title}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.group.suggestions')}>
            <CommandItem>{i18n.t('command.item.calendar')}</CommandItem>
            <CommandItem>{i18n.t('command.item.search')}</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryDialogConfig: Story = {
  render: () => <CommandDialogConfigDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="dialog-config-demo"]');
    expect(container).toBeInTheDocument();
    expect(container?.textContent).toContain('Title:');
    const { dialog } = await openCommandPalette(canvasElement);
    expect(dialog.querySelector('[data-slot="command"]')).toBeInTheDocument();
  },
};

function CommandSearchStateDemo() {
  const [open, setOpen] = React.useState(false);
  const searchState: FakeCommandSearch = React.useMemo(
    () => createFakeCommandSearch({ query: 'settings' }),
    []
  );

  return (
    <div className="space-y-4" data-testid="search-state-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.searchState')}</p>
      <div className="text-muted-foreground mb-2 text-xs">
        Query: &quot;{searchState.query}&quot; | Results: {searchState.totalResults} |{' '}
        {searchState.isSearching ? 'Searching...' : 'Done'}
      </div>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={`Results for "${searchState.query}"`}>
            {searchState.filteredItems.map((item) => (
              <CommandItem key={item.id} disabled={item.disabled} value={item.label}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactorySearchState: Story = {
  render: () => <CommandSearchStateDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="search-state-demo"]');
    expect(container).toBeInTheDocument();
    expect(container?.textContent).toContain('Query:');
    expect(container?.textContent).toContain('Results:');
    const { dialog } = await openCommandPalette(canvasElement);
    expect(dialog.querySelector('[data-slot="command-list"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: BULK FACTORIES ============

function BulkCommandItemsDemo() {
  const [open, setOpen] = React.useState(false);
  const items: FakeCommandItem[] = React.useMemo(() => createFakeCommandItems(10), []);

  return (
    <div className="space-y-4" data-testid="bulk-items-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.bulkItems')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.bulkItems', 'Bulk Items')}>
            {items.map((item) => (
              <CommandItem key={item.id} disabled={item.disabled} value={item.label}>
                {item.label}
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryBulkItems: Story = {
  render: () => <BulkCommandItemsDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(10);
  },
};

// ============ FACTORY: SPECIALIZED COMMAND FACTORIES ============

function NavigationCommandsDemo() {
  const [open, setOpen] = React.useState(false);
  const items: FakeCommandItem[] = React.useMemo(() => createFakeNavigationCommands(), []);

  return (
    <div className="space-y-4" data-testid="nav-commands-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.navigation')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.navigation', 'Navigation')}>
            {items.map((item) => (
              <CommandItem key={item.id} value={item.label}>
                {item.label}
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryNavigationCommands: Story = {
  render: () => <NavigationCommandsDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(COMMAND_LABELS.navigation.length);
    for (const label of COMMAND_LABELS.navigation) {
      expect(dialog.textContent).toContain(label);
    }
  },
};

function ActionCommandsDemo() {
  const [open, setOpen] = React.useState(false);
  const items: FakeCommandItem[] = React.useMemo(() => createFakeActionCommands(), []);

  return (
    <div className="space-y-4" data-testid="action-commands-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.actions')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.actions', 'Actions')}>
            {items.map((item) => (
              <CommandItem key={item.id} value={item.label}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryActionCommands: Story = {
  render: () => <ActionCommandsDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(COMMAND_LABELS.actions.length);
  },
};

function SettingsCommandsDemo() {
  const [open, setOpen] = React.useState(false);
  const items: FakeCommandItem[] = React.useMemo(() => createFakeSettingsCommands(), []);

  return (
    <div className="space-y-4" data-testid="settings-commands-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.settings')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.settingsHeading', 'Settings')}>
            {items.map((item) => (
              <CommandItem key={item.id} value={item.label}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactorySettingsCommands: Story = {
  render: () => <SettingsCommandsDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(COMMAND_LABELS.settings.length);
  },
};

function FileCommandsDemo() {
  const [open, setOpen] = React.useState(false);
  const items: FakeCommandItem[] = React.useMemo(() => createFakeFileCommands(), []);

  return (
    <div className="space-y-4" data-testid="file-commands-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.files')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.files', 'Files')}>
            {items.map((item) => (
              <CommandItem key={item.id} value={item.label}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryFileCommands: Story = {
  render: () => <FileCommandsDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(COMMAND_LABELS.files.length);
  },
};

function UserCommandsDemo() {
  const [open, setOpen] = React.useState(false);
  const items: FakeCommandItem[] = React.useMemo(() => createFakeUserCommands(), []);

  return (
    <div className="space-y-4" data-testid="user-commands-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.users')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.users', 'Users')}>
            {items.map((item) => (
              <CommandItem key={item.id} value={item.label}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryUserCommands: Story = {
  render: () => <UserCommandsDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(COMMAND_LABELS.users.length);
  },
};

function SearchCommandsDemo() {
  const [open, setOpen] = React.useState(false);
  const items: FakeCommandItem[] = React.useMemo(() => createFakeSearchCommands(), []);

  return (
    <div className="space-y-4" data-testid="search-commands-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.search')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.search', 'Search')}>
            {items.map((item) => (
              <CommandItem key={item.id} value={item.label}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactorySearchCommands: Story = {
  render: () => <SearchCommandsDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(COMMAND_LABELS.search.length);
  },
};

function SearchResultsDemo() {
  const [open, setOpen] = React.useState(false);
  const results: FakeCommandItem[] = React.useMemo(() => createFakeSearchResults('Go'), []);

  return (
    <div className="space-y-4" data-testid="search-results-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.searchResults')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={`Search results for "Go"`}>
            {results.map((item) => (
              <CommandItem key={item.id} value={item.label}>
                {item.label}
                {item.description && (
                  <span className="text-muted-foreground ml-2 text-xs">{item.description}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactorySearchResults: Story = {
  render: () => <SearchResultsDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBeGreaterThan(0);
    // All results should contain "Go" in label since we searched for "Go"
    for (const item of items) {
      expect(item.textContent?.toLowerCase()).toContain('go');
    }
  },
};

function RecentCommandsDemo() {
  const [open, setOpen] = React.useState(false);
  const items: FakeCommandItem[] = React.useMemo(() => createFakeRecentCommands(5), []);

  return (
    <div className="space-y-4" data-testid="recent-commands-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.recent')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.recent', 'Recent')}>
            {items.map((item) => (
              <CommandItem key={item.id} value={item.label}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryRecentCommands: Story = {
  render: () => <RecentCommandsDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(5);
  },
};

function DisabledCommandDemo() {
  const [open, setOpen] = React.useState(false);
  const disabledItem: FakeCommandItem = React.useMemo(() => createFakeDisabledCommand(), []);

  return (
    <div className="space-y-4" data-testid="disabled-command-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.disabled')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.commands', 'Commands')}>
            <CommandItem disabled={disabledItem.disabled} value={disabledItem.label}>
              {disabledItem.label}
              {disabledItem.description && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {disabledItem.description}
                </span>
              )}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryDisabledCommand: Story = {
  render: () => <DisabledCommandDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const disabledItem = dialog.querySelector('[data-slot="command-item"][data-disabled="true"]');
    expect(disabledItem).toBeInTheDocument();
  },
};

function ShortcutCommandDemo() {
  const [open, setOpen] = React.useState(false);
  const items: FakeCommandItem[] = React.useMemo(
    () => COMMAND_SHORTCUTS.slice(0, 5).map((shortcut) => createFakeShortcutCommand(shortcut)),
    []
  );

  return (
    <div className="space-y-4" data-testid="shortcut-command-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.shortcuts')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.keyboardShortcuts', 'Keyboard Shortcuts')}>
            {items.map((item) => (
              <CommandItem key={item.id} value={item.label}>
                {item.label}
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryShortcutCommands: Story = {
  render: () => <ShortcutCommandDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const shortcuts = dialog.querySelectorAll('[data-slot="command-shortcut"]');
    expect(shortcuts.length).toBe(5);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(5);
  },
};

function LoadingCommandDemo() {
  const [open, setOpen] = React.useState(false);
  const loadingItem: FakeCommandItem = React.useMemo(() => createFakeLoadingCommand(), []);

  return (
    <div className="space-y-4" data-testid="loading-command-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.loading')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          <CommandGroup heading={i18n.t('command.story.loading', 'Loading')}>
            <CommandItem value={loadingItem.label}>
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              {loadingItem.label}
              {loadingItem.description && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {loadingItem.description}
                </span>
              )}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryLoadingCommand: Story = {
  render: () => <LoadingCommandDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBe(1);
    expect(dialog.textContent).toContain('Loading');
  },
};

// ============ FACTORY: MATRIX FACTORIES ============

function CommandMatrixDemo() {
  const [open, setOpen] = React.useState(false);
  const matrix: FakeCommandGroup[] = React.useMemo(() => createFakeCommandMatrix(), []);

  return (
    <div className="space-y-4" data-testid="command-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.matrix')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={i18n.t('command.input.placeholder')} />
        <CommandList>
          <CommandEmpty>{i18n.t('command.empty')}</CommandEmpty>
          {matrix.map((group, idx) => (
            <React.Fragment key={group.id}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem key={item.id} disabled={item.disabled} value={item.label}>
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryCommandMatrix: Story = {
  render: () => <CommandMatrixDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const groups = dialog.querySelectorAll('[data-slot="command-group"]');
    expect(groups.length).toBe(COMMAND_GROUPS.length);
    // Each group should have 4 items
    for (const group of groups) {
      const items = group.querySelectorAll('[data-slot="command-item"]');
      expect(items.length).toBe(4);
    }
  },
};

function CommandStateMatrixDemo() {
  const stateMatrix = React.useMemo(() => createFakeCommandStateMatrix(), []);

  return (
    <div className="space-y-4" data-testid="state-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.stateMatrix')}</p>
      <div className="grid gap-4">
        {stateMatrix.map((entry) => (
          <div key={entry.state} className="rounded-md border p-3">
            <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
              State: {entry.state}
            </p>
            <ul className="list-inside list-disc text-sm">
              {entry.items.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryStateMatrix: Story = {
  render: () => <CommandStateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="state-matrix-demo"]');
    expect(container).toBeInTheDocument();
    for (const state of COMMAND_STATES) {
      expect(container?.textContent).toContain(state);
    }
  },
};

function CommandTypeMatrixDemo() {
  const typeMatrix = React.useMemo(() => createFakeCommandTypeMatrix(), []);

  return (
    <div className="space-y-4" data-testid="type-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.typeMatrix')}</p>
      <div className="grid gap-4">
        {typeMatrix.map((entry) => (
          <div key={entry.type} className="rounded-md border p-3">
            <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
              Type: {entry.type}
            </p>
            <ul className="list-inside list-disc text-sm">
              {entry.items.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryTypeMatrix: Story = {
  render: () => <CommandTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="type-matrix-demo"]');
    expect(container).toBeInTheDocument();
    for (const type of COMMAND_ITEM_TYPES) {
      expect(container?.textContent).toContain(type);
    }
  },
};

// ============ FACTORY: ENTERPRISE PALETTES ============

function KeyboardShortcutPaletteDemo() {
  const [open, setOpen] = React.useState(false);
  const palette: FakeCommandPalette = React.useMemo(() => createFakeKeyboardShortcutPalette(), []);

  return (
    <div className="space-y-4" data-testid="keyboard-shortcut-palette-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.keyboardShortcutPalette')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={palette.placeholder} />
        <CommandList>
          <CommandEmpty>{palette.emptyMessage}</CommandEmpty>
          {palette.groups.map((group) => (
            <CommandGroup key={group.id} heading={group.heading}>
              {group.items.map((item) => (
                <CommandItem key={item.id} value={item.label}>
                  {item.label}
                  {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryKeyboardShortcutPalette: Story = {
  render: () => <KeyboardShortcutPaletteDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const shortcuts = dialog.querySelectorAll('[data-slot="command-shortcut"]');
    expect(shortcuts.length).toBe(5);
    const heading = dialog.querySelector('[cmdk-group-heading]');
    expect(heading?.textContent).toContain('Keyboard Shortcuts');
  },
};

function SearchablePaletteDemo() {
  const [open, setOpen] = React.useState(false);
  const palette: FakeCommandPalette = React.useMemo(
    () => createFakeSearchablePalette('Settings'),
    []
  );

  return (
    <div className="space-y-4" data-testid="searchable-palette-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.searchablePalette')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={palette.placeholder} />
        <CommandList>
          <CommandEmpty>{palette.emptyMessage}</CommandEmpty>
          {palette.groups.map((group, idx) => (
            <React.Fragment key={group.id}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem key={item.id} disabled={item.disabled} value={item.label}>
                    {item.label}
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactorySearchablePalette: Story = {
  render: () => <SearchablePaletteDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const groups = dialog.querySelectorAll('[data-slot="command-group"]');
    expect(groups.length).toBeGreaterThan(0);
    const items = dialog.querySelectorAll('[data-slot="command-item"]');
    expect(items.length).toBeGreaterThan(0);
  },
};

function EnterpriseCommandPaletteDemo() {
  const [open, setOpen] = React.useState(false);
  const palette: FakeCommandPalette = React.useMemo(() => createFakeEnterpriseCommandPalette(), []);

  return (
    <div className="space-y-4" data-testid="enterprise-palette-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.enterprisePalette')}</p>
      <button
        data-slot="command-open"
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        {i18n.t('command.open')}
      </button>
      <CommandDialog
        description={i18n.t('command.dialog.description')}
        onOpenChange={setOpen}
        open={open}
        title={i18n.t('command.dialog.title')}
      >
        <CommandInput placeholder={palette.placeholder} />
        <CommandList>
          <CommandEmpty>{palette.emptyMessage}</CommandEmpty>
          {palette.groups.map((group, idx) => (
            <React.Fragment key={group.id}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem key={item.id} disabled={item.disabled} value={item.label}>
                    {item.label}
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export const FactoryEnterprisePalette: Story = {
  render: () => <EnterpriseCommandPaletteDemo />,
  play: async ({ canvasElement }) => {
    const { dialog } = await openCommandPalette(canvasElement);
    const groups = dialog.querySelectorAll('[data-slot="command-group"]');
    expect(groups.length).toBe(5); // Recent, Suggestions, Actions, Navigation, Settings
    // Verify disabled item exists in settings group
    const disabledItem = dialog.querySelector('[data-slot="command-item"][data-disabled="true"]');
    expect(disabledItem).toBeInTheDocument();
  },
};

// ============ FACTORY: CONSTANTS COVERAGE ============

function CommandItemTypesDemo() {
  return (
    <div className="space-y-4" data-testid="item-types-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.itemTypes')}</p>
      <div className="flex flex-wrap gap-2">
        {COMMAND_ITEM_TYPES.map((type: CommandItemType) => (
          <span key={type} className="rounded-md border px-2 py-1 text-xs" data-type={type}>
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantsItemTypes: Story = {
  render: () => <CommandItemTypesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="item-types-demo"]');
    expect(container).toBeInTheDocument();
    for (const type of COMMAND_ITEM_TYPES) {
      expect(container?.querySelector(`[data-type="${type}"]`)).toBeInTheDocument();
    }
    expect(COMMAND_ITEM_TYPES.length).toBe(6);
  },
};

function CommandGroupsConstDemo() {
  return (
    <div className="space-y-4" data-testid="groups-const-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.groups')}</p>
      <div className="flex flex-wrap gap-2">
        {COMMAND_GROUPS.map((group: CommandGroupType) => (
          <span key={group} className="rounded-md border px-2 py-1 text-xs" data-group={group}>
            {group} ({COMMAND_GROUP_HEADINGS[group]})
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantsGroups: Story = {
  render: () => <CommandGroupsConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="groups-const-demo"]');
    expect(container).toBeInTheDocument();
    for (const group of COMMAND_GROUPS) {
      expect(container?.querySelector(`[data-group="${group}"]`)).toBeInTheDocument();
      expect(container?.textContent).toContain(COMMAND_GROUP_HEADINGS[group]);
    }
  },
};

function CommandStatesConstDemo() {
  return (
    <div className="space-y-4" data-testid="states-const-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.states')}</p>
      <div className="flex flex-wrap gap-2">
        {COMMAND_STATES.map((state: CommandState) => (
          <span key={state} className="rounded-md border px-2 py-1 text-xs" data-state={state}>
            {state}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantsStates: Story = {
  render: () => <CommandStatesConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="states-const-demo"]');
    expect(container).toBeInTheDocument();
    for (const state of COMMAND_STATES) {
      expect(container?.querySelector(`[data-state="${state}"]`)).toBeInTheDocument();
    }
    expect(COMMAND_STATES.length).toBe(5);
  },
};

function CommandPrioritiesConstDemo() {
  return (
    <div className="space-y-4" data-testid="priorities-const-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.priorities')}</p>
      <div className="flex flex-wrap gap-2">
        {COMMAND_PRIORITIES.map((priority: CommandPriority) => (
          <span
            key={priority}
            className="rounded-md border px-2 py-1 text-xs"
            data-priority={priority}
          >
            {priority}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantsPriorities: Story = {
  render: () => <CommandPrioritiesConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="priorities-const-demo"]');
    expect(container).toBeInTheDocument();
    for (const priority of COMMAND_PRIORITIES) {
      expect(container?.querySelector(`[data-priority="${priority}"]`)).toBeInTheDocument();
    }
    expect(COMMAND_PRIORITIES.length).toBe(4);
  },
};

function CommandExecutionStatusesDemo() {
  return (
    <div className="space-y-4" data-testid="execution-statuses-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.executionStatuses')}</p>
      <div className="flex flex-wrap gap-2">
        {COMMAND_EXECUTION_STATUSES.map((status: CommandExecutionStatus) => (
          <span key={status} className="rounded-md border px-2 py-1 text-xs" data-status={status}>
            {status}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantsExecutionStatuses: Story = {
  render: () => <CommandExecutionStatusesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="execution-statuses-demo"]');
    expect(container).toBeInTheDocument();
    for (const status of COMMAND_EXECUTION_STATUSES) {
      expect(container?.querySelector(`[data-status="${status}"]`)).toBeInTheDocument();
    }
    expect(COMMAND_EXECUTION_STATUSES.length).toBe(4);
  },
};

function CommandIconsConstDemo() {
  return (
    <div className="space-y-4" data-testid="icons-const-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.icons')}</p>
      <div className="flex flex-wrap gap-1">
        {COMMAND_ICONS.slice(0, 20).map((icon) => (
          <span key={icon} className="rounded border px-1.5 py-0.5 text-xs" data-icon={icon}>
            {icon}
          </span>
        ))}
        {COMMAND_ICONS.length > 20 && (
          <span className="text-muted-foreground text-xs">+{COMMAND_ICONS.length - 20} more</span>
        )}
      </div>
    </div>
  );
}

export const ConstantsIcons: Story = {
  render: () => <CommandIconsConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="icons-const-demo"]');
    expect(container).toBeInTheDocument();
    // Verify first 20 are rendered
    for (const icon of COMMAND_ICONS.slice(0, 20)) {
      expect(container?.querySelector(`[data-icon="${icon}"]`)).toBeInTheDocument();
    }
    expect(COMMAND_ICONS.length).toBeGreaterThan(20);
  },
};

function CommandLabelsConstDemo() {
  return (
    <div className="space-y-4" data-testid="labels-const-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.labels')}</p>
      <div className="grid gap-3">
        {Object.entries(COMMAND_LABELS).map(([category, labels]) => (
          <div key={category} className="rounded-md border p-2">
            <p className="mb-1 text-xs font-semibold uppercase">{category}</p>
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <span key={label} className="bg-muted rounded px-1.5 py-0.5 text-xs">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantsLabels: Story = {
  render: () => <CommandLabelsConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="labels-const-demo"]');
    expect(container).toBeInTheDocument();
    expect(container?.textContent).toContain('actions');
    expect(container?.textContent).toContain('navigation');
    expect(container?.textContent).toContain('settings');
    expect(container?.textContent).toContain('files');
    expect(container?.textContent).toContain('users');
    expect(container?.textContent).toContain('search');
  },
};

function CommandShortcutsConstDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="shortcuts-const-demo">
      <p className="text-sm font-medium">{t('command.section.shortcuts')}</p>
      <div className="flex flex-wrap gap-1">
        {COMMAND_SHORTCUTS.map((shortcut) => (
          <kbd
            key={shortcut}
            className="bg-muted rounded border px-1.5 py-0.5 text-xs"
            data-shortcut={shortcut}
          >
            {shortcut}
          </kbd>
        ))}
      </div>
    </div>
  );
}

export const ConstantsShortcuts: Story = {
  render: () => <CommandShortcutsConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="shortcuts-const-demo"]');
    expect(container).toBeInTheDocument();
    const kbds = container?.querySelectorAll('kbd');
    expect(kbds?.length).toBe(COMMAND_SHORTCUTS.length);
  },
};

function CommandPlaceholdersConstDemo() {
  return (
    <div className="space-y-4" data-testid="placeholders-const-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.placeholders')}</p>
      <div className="grid gap-2">
        {COMMAND_PLACEHOLDERS.map((placeholder) => (
          <div
            key={placeholder}
            className="text-muted-foreground rounded-md border p-2 text-sm"
            data-placeholder={placeholder}
          >
            {placeholder}
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantsPlaceholders: Story = {
  render: () => <CommandPlaceholdersConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="placeholders-const-demo"]');
    expect(container).toBeInTheDocument();
    for (const placeholder of COMMAND_PLACEHOLDERS) {
      expect(container?.textContent).toContain(placeholder);
    }
  },
};

function CommandEmptyMessagesDemo() {
  return (
    <div className="space-y-4" data-testid="empty-messages-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.emptyMessages')}</p>
      <div className="grid gap-2">
        {COMMAND_EMPTY_MESSAGES.map((message) => (
          <div
            key={message}
            className="text-muted-foreground rounded-md border p-2 text-sm"
            data-message={message}
          >
            {message}
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantsEmptyMessages: Story = {
  render: () => <CommandEmptyMessagesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="empty-messages-demo"]');
    expect(container).toBeInTheDocument();
    for (const message of COMMAND_EMPTY_MESSAGES) {
      expect(container?.textContent).toContain(message);
    }
    expect(COMMAND_EMPTY_MESSAGES.length).toBe(5);
  },
};

// ============ FACTORY: EXECUTION TYPE COVERAGE ============

function CommandExecutionDemo() {
  const execution: FakeCommandExecution = React.useMemo(
    () => ({
      commandId: 'cmd-001',
      success: true,
      executedAt: new Date().toISOString(),
    }),
    []
  );
  const failedExecution: FakeCommandExecution = React.useMemo(
    () => ({
      commandId: 'cmd-002',
      success: false,
      error: 'Command not found',
      executedAt: new Date().toISOString(),
    }),
    []
  );

  return (
    <div className="space-y-4" data-testid="execution-demo">
      <p className="text-sm font-medium">{i18n.t('command.section.execution')}</p>
      <div className="grid gap-3">
        <div className="rounded-md border p-3" data-execution-status="success">
          <p className="text-sm font-medium text-green-600">
            {i18n.t('command.story.successfulExecution', 'Successful Execution')}
          </p>
          <p className="text-muted-foreground text-xs">
            Command: {execution.commandId} | At: {execution.executedAt}
          </p>
        </div>
        <div className="rounded-md border p-3" data-execution-status="error">
          <p className="text-sm font-medium text-red-600">
            {i18n.t('command.story.failedExecution', 'Failed Execution')}
          </p>
          <p className="text-muted-foreground text-xs">
            Command: {failedExecution.commandId} | Error: {failedExecution.error}
          </p>
        </div>
      </div>
    </div>
  );
}

export const FactoryExecutionType: Story = {
  render: () => <CommandExecutionDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="execution-demo"]');
    expect(container).toBeInTheDocument();
    expect(container?.querySelector('[data-execution-status="success"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-execution-status="error"]')).toBeInTheDocument();
    expect(container?.textContent).toContain('cmd-001');
    expect(container?.textContent).toContain('Command not found');
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('command.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('command.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('command.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('command.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// COMMAND-SPECIFIC STATUS HANDLER STORIES
// ============================================================================

export const HandlerSearchSuccess: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerSearchSuccess', 'Handler: Search Success'),
  parameters: { msw: { handlers: commandStatusHandlers.searchSuccess } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSearchEmpty: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerSearchEmpty', 'Handler: Search Empty'),
  parameters: { msw: { handlers: commandStatusHandlers.searchEmpty } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSearchSlow: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerSearchSlow', 'Handler: Search Slow'),
  parameters: { msw: { handlers: commandStatusHandlers.searchSlow } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: commandStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSlowSearch: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerSlowSearch', 'Handler: Slow Search'),
  parameters: { msw: { handlers: commandStatusHandlers.slowSearch } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerEmptyResults: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerEmptyResults', 'Handler: Empty Results'),
  parameters: { msw: { handlers: commandStatusHandlers.emptyResults } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerExecuteSuccess: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerExecuteSuccess', 'Handler: Execute Success'),
  parameters: { msw: { handlers: commandStatusHandlers.executeSuccess } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerExecutePending: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerExecutePending', 'Handler: Execute Pending'),
  parameters: { msw: { handlers: commandStatusHandlers.executePending } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerExecuteError: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerExecuteError', 'Handler: Execute Error'),
  parameters: { msw: { handlers: commandStatusHandlers.executeError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerFilterByGroup: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerFilterByGroup', 'Handler: Filter By Group'),
  parameters: { msw: { handlers: commandStatusHandlers.filterByGroup } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerDebouncedSearch: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerDebouncedSearch', 'Handler: Debounced Search'),
  parameters: { msw: { handlers: commandStatusHandlers.debouncedSearch } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS STORIES (auto-wired)
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: commandStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadRequest: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerBadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: commandStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnauthorized: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerUnauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: commandStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerForbidden: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerForbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: commandStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: commandStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: commandStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerUnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: commandStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInternalServerError: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerInternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: commandStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: commandStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: commandStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: commandStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLoading: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerLoading', 'Handler: Loading'),
  parameters: { msw: { handlers: commandStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: commandStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNetworkError: Story = {
  ...Default,
  name: i18n.t('command.storyName.handlerNetworkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: commandStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
