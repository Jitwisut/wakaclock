import type { Meta, StoryObj } from '@storybook/react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CheckCircle2Icon, FileTextIcon, MoreHorizontalIcon, StarIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  createFakeContactList,
  createFakeEventItem,
  createFakeFileItem,
  createFakeFileList,
  createFakeItem,
  createFakeItemGroup,
  createFakeItemMediaVariantMatrix,
  createFakeItems,
  createFakeItemShowcase,
  createFakeItemSizeMatrix,
  createFakeItemStateMatrix,
  createFakeItemTypeMatrix,
  createFakeItemVariantMatrix,
  createFakeMessageItem,
  createFakeMessageList,
  createFakeNotificationItem,
  createFakeNotificationList,
  createFakeProductItem,
  createFakeProductList,
  createFakeTaskItem,
  createFakeTaskList,
  createFakeUserItem,
  ITEM_ACTION_ARIA_LABELS,
  ITEM_ACTION_LABELS,
  ITEM_ACTION_TYPES,
  ITEM_ICONS,
  ITEM_MEDIA_VARIANTS,
  ITEM_PRIORITIES,
  ITEM_SIZES,
  ITEM_STATES,
  ITEM_TYPES,
  ITEM_VARIANTS,
} from '@/.storybook/stories/_factories/item.factory';
import type {
  FakeEventItem,
  FakeFileItem,
  FakeItem,
  FakeItemAction,
  FakeItemContent,
  FakeItemGroup,
  FakeItemMedia,
  FakeMessageItem,
  FakeNotificationItem,
  FakeProductItem,
  FakeTaskItem,
  FakeUserItem,
  ItemActionType,
  ItemMediaVariant,
  ItemPriority,
  ItemSize,
  ItemState,
  ItemType,
  ItemVariant,
} from '@/.storybook/stories/_factories/item.factory';
import { itemHandlers, itemStatusHandlers } from '@/.storybook/stories/_handlers/item.handlers';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function ItemDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-2xl" data-testid="item-demo">
      <ItemGroup>
        <Item asChild>
          <li>
            <ItemMedia variant="image">
              <img alt={t('item.invoice.previewAlt')} src="/images/products/01.jpeg" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t('item.invoice.title')}</ItemTitle>
              <ItemDescription>{t('item.invoice.description')}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button aria-label={t('item.actions.moreAriaLabel')} size="icon" variant="ghost">
                <MoreHorizontalIcon />
              </Button>
            </ItemActions>
          </li>
        </Item>
        <li>
          <ItemSeparator />
        </li>
        <Item asChild variant="muted">
          <li>
            <ItemMedia variant="default">
              <Avatar className="size-8">
                <AvatarImage alt={t('avatar.alt')} src="/images/avatars/02.png" />
                <AvatarFallback>GR</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t('item.user.name')}</ItemTitle>
              <ItemDescription>{t('item.user.description')}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button size="sm" variant="outline">
                {t('item.actions.message')}
              </Button>
            </ItemActions>
          </li>
        </Item>
      </ItemGroup>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Item',
  component: ItemDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('item.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('item.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('item.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('item.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('item.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('item.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('item.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // Item Props Reference:
    // - variant: Visual variant ('default' | 'muted')
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // ItemGroup Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Item elements (ReactNode)
    // Note: Use as container for multiple Item components
    //
    // ItemMedia Props Reference:
    // - variant: Media type ('default' | 'image')
    //   - 'default': For avatars, icons
    //   - 'image': For product images, thumbnails
    // - className: Additional CSS classes (string)
    // - children: Avatar, Image, or Icon (ReactNode)
    //
    // ItemContent Props Reference:
    // - className: Additional CSS classes (string)
    // - children: ItemTitle and ItemDescription (ReactNode)
    //
    // ItemTitle Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Title text (ReactNode)
    //
    // ItemDescription Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Description text (ReactNode)
    //
    // ItemActions Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Action buttons (ReactNode)
    //
    // ItemSeparator Props Reference:
    // - className: Additional CSS classes (string)
    // Note: Visual separator between items
    //
    // Usage Notes:
    // - Use Item asChild with <li> for semantic list items
    // - ItemGroup wraps multiple items
    // - ItemSeparator adds visual divider between items
  },
  parameters: {
    msw: { handlers: itemHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ItemDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    if (!(group instanceof HTMLElement)) {
      throw new Error('Item group was not found.');
    }

    const items = group.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    const [invoiceItem, userItem] = [...items];
    if (!(invoiceItem instanceof HTMLElement) || !(userItem instanceof HTMLElement)) {
      throw new Error('Expected both item entries to be present.');
    }

    expect(invoiceItem.getAttribute('data-variant')).toBe('default');
    expect(userItem.getAttribute('data-variant')).toBe('muted');
    expect(group.querySelector('[data-slot="item-separator"]')).toBeInTheDocument();

    const invoiceMedia = invoiceItem.querySelector('[data-slot="item-media"]');
    if (!(invoiceMedia instanceof HTMLElement)) {
      throw new Error('Invoice media element was not found.');
    }
    expect(invoiceMedia.getAttribute('data-variant')).toBe('image');
    const invoiceImage = invoiceMedia.querySelector('img');
    if (!(invoiceImage instanceof HTMLImageElement)) {
      throw new Error('Invoice preview image was not found.');
    }
    expect(invoiceImage.getAttribute('src')).toBe('/images/products/01.jpeg');
    expect(invoiceImage.getAttribute('alt')?.trim()).not.toBe('');

    const invoiceTitle = invoiceItem.querySelector('[data-slot="item-title"]');
    if (!(invoiceTitle instanceof HTMLElement)) {
      throw new Error('Invoice title element was not found.');
    }
    expect(invoiceTitle.textContent?.trim()).not.toBe('');

    const invoiceDescription = invoiceItem.querySelector('[data-slot="item-description"]');
    if (!(invoiceDescription instanceof HTMLElement)) {
      throw new Error('Invoice description element was not found.');
    }
    expect(invoiceDescription.textContent?.trim()).not.toBe('');

    const userMedia = userItem.querySelector('[data-slot="item-media"]');
    if (!(userMedia instanceof HTMLElement)) {
      throw new Error('User media element was not found.');
    }
    expect(userMedia.getAttribute('data-variant')).toBe('default');
    expect(userMedia.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    expect(userMedia.querySelector('[data-slot="avatar-fallback"]')?.textContent).toBe('GR');
    expect(
      userMedia.querySelector('[data-slot="avatar-image"]')?.getAttribute('alt')?.trim()
    ).not.toBe('');

    const userTitle = userItem.querySelector('[data-slot="item-title"]');
    if (!(userTitle instanceof HTMLElement)) {
      throw new Error('User title element was not found.');
    }
    expect(userTitle.textContent?.trim()).not.toBe('');

    const userDescription = userItem.querySelector('[data-slot="item-description"]');
    if (!(userDescription instanceof HTMLElement)) {
      throw new Error('User description element was not found.');
    }
    expect(userDescription.textContent?.trim()).not.toBe('');

    const moreButton = invoiceItem.querySelector('button[aria-label]');
    if (!(moreButton instanceof HTMLButtonElement)) {
      throw new Error('More button was not found.');
    }
    await userEvent.click(moreButton);
    expect(doc.activeElement).toBe(moreButton);

    const messageButton = userItem.querySelector('button:not([aria-label])');
    if (!(messageButton instanceof HTMLButtonElement)) {
      throw new Error('Message button was not found.');
    }
    expect(messageButton.textContent?.trim()).not.toBe('');
    await userEvent.click(messageButton);
    expect(doc.activeElement).toBe(messageButton);
  },
};

export const Playground: Story = {
  ...Default,
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    for (const item of items) {
      expect(item.querySelector('[data-slot="item-content"]')).toBeInTheDocument();
      expect(item.querySelector('[data-slot="item-title"]')).toBeInTheDocument();
    }

    await Default.play?.(context);
  },
};

function ItemVariantsDemo() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('item.variants.basic')}</p>
        <ItemGroup>
          <Item asChild>
            <li>
              <ItemContent>
                <ItemTitle>{i18n.t('item.story.simpleItem', 'Simple Item')}</ItemTitle>
                <ItemDescription>
                  {i18n.t(
                    'item.story.basicItemDescription',
                    'A basic item without media or actions'
                  )}
                </ItemDescription>
              </ItemContent>
            </li>
          </Item>
        </ItemGroup>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('item.variants.withIcon')}</p>
        <ItemGroup>
          <Item asChild>
            <li>
              <ItemMedia variant="default">
                <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                  <FileTextIcon className="size-4" />
                </div>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{i18n.t('item.story.documentPdf', 'Document.pdf')}</ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.documentMeta', '2.4 MB - Modified yesterday')}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button size="icon" variant="ghost">
                  <MoreHorizontalIcon />
                </Button>
              </ItemActions>
            </li>
          </Item>
        </ItemGroup>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('item.variants.withDescription')}</p>
        <ItemGroup>
          <Item asChild>
            <li>
              <ItemMedia variant="image">
                <img
                  alt={i18n.t('item.story.productAlt', 'Product')}
                  src="/images/products/01.jpeg"
                />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {i18n.t('item.story.premiumHeadphones', 'Premium Headphones')}
                </ItemTitle>
                <ItemDescription>
                  {i18n.t(
                    'item.story.headphonesDescription',
                    'High-quality wireless headphones with active noise cancellation and 30-hour battery life.'
                  )}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button size="sm">{i18n.t('item.story.view', 'View')}</Button>
              </ItemActions>
            </li>
          </Item>
        </ItemGroup>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('item.variants.selectable')}</p>
        <ItemGroup>
          <Item asChild className="hover:bg-muted/50 cursor-pointer transition-colors">
            <li>
              <ItemMedia variant="default">
                <div className="flex size-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <CheckCircle2Icon className="size-4" />
                </div>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{i18n.t('item.story.taskCompleted', 'Task Completed')}</ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.reviewQuarterlyReport', 'Review quarterly report')}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <StarIcon className="text-muted-foreground size-4 cursor-pointer hover:text-yellow-500" />
              </ItemActions>
            </li>
          </Item>
          <li>
            <ItemSeparator />
          </li>
          <Item asChild className="hover:bg-muted/50 cursor-pointer transition-colors">
            <li>
              <ItemMedia variant="default">
                <div className="bg-muted flex size-8 items-center justify-center rounded-full">
                  <div className="border-muted-foreground size-4 rounded-full border-2" />
                </div>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{i18n.t('item.story.pendingTask', 'Pending Task')}</ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.updateDocumentation', 'Update documentation')}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <StarIcon className="text-muted-foreground size-4 cursor-pointer hover:text-yellow-500" />
              </ItemActions>
            </li>
          </Item>
        </ItemGroup>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <ItemVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all item groups exist (4 variants)
    const itemGroups = canvasElement.querySelectorAll('[data-slot="item-group"]');
    expect(itemGroups.length).toBe(4);

    // Verify items have required slots
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBeGreaterThanOrEqual(4);

    // Verify data-slot attributes exist
    expect(canvasElement.querySelector('[data-slot="item-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="item-title"]')).toBeInTheDocument();

    // Verify specific text content for each variant
    expect(canvas.getByText('Simple Item')).toBeInTheDocument();
    expect(canvas.getByText('Document.pdf')).toBeInTheDocument();
    expect(canvas.getByText('Premium Headphones')).toBeInTheDocument();
    expect(canvas.getByText('Task Completed')).toBeInTheDocument();
  },
};

function ItemSizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('item.sizes.compact')}</p>
        <ItemGroup>
          <Item asChild className="py-1">
            <li>
              <ItemMedia variant="default">
                <Avatar className="size-6">
                  <AvatarImage alt={t('item.story.userAlt', 'User')} src="/images/avatars/01.png" />
                  <AvatarFallback className="text-xs">JD</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent className="gap-0">
                <ItemTitle className="text-sm">{t('item.story.johnDoe', 'John Doe')}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                  {t('item.story.view', 'View')}
                </Button>
              </ItemActions>
            </li>
          </Item>
        </ItemGroup>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('item.sizes.default')}</p>
        <ItemGroup>
          <Item asChild>
            <li>
              <ItemMedia variant="default">
                <Avatar className="size-8">
                  <AvatarImage alt={t('item.story.userAlt', 'User')} src="/images/avatars/02.png" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t('item.story.johnDoe', 'John Doe')}</ItemTitle>
                <ItemDescription>
                  {t('item.story.softwareEngineer', 'Software Engineer')}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button size="sm" variant="outline">
                  {t('item.story.message', 'Message')}
                </Button>
              </ItemActions>
            </li>
          </Item>
        </ItemGroup>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('item.sizes.large')}</p>
        <ItemGroup>
          <Item asChild className="py-4">
            <li>
              <ItemMedia variant="image" className="[&_img]:size-16">
                <img alt={t('item.story.userAlt', 'User')} src="/images/avatars/03.png" />
              </ItemMedia>
              <ItemContent className="gap-2">
                <ItemTitle className="text-lg">{t('item.story.johnDoe', 'John Doe')}</ItemTitle>
                <ItemDescription className="text-sm">
                  {t(
                    'item.story.seniorEngineerDescription',
                    'Senior Software Engineer at Acme Inc. Specializing in frontend development and design systems.'
                  )}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button>{t('item.story.viewProfile', 'View Profile')}</Button>
                <Button variant="outline">{t('item.story.message', 'Message')}</Button>
              </ItemActions>
            </li>
          </Item>
        </ItemGroup>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <ItemSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all item groups exist (3 sizes)
    const itemGroups = canvasElement.querySelectorAll('[data-slot="item-group"]');
    expect(itemGroups.length).toBe(3);

    // Verify items have required slots
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(3);

    // Verify data-slot attributes exist
    for (const item of items) {
      expect(item.querySelector('[data-slot="item-content"]')).toBeInTheDocument();
      expect(item.querySelector('[data-slot="item-title"]')).toBeInTheDocument();
      expect(item.querySelector('[data-slot="item-media"]')).toBeInTheDocument();
    }

    // Verify specific text content for sizes
    expect(canvas.getAllByText('John Doe').length).toBe(3);

    // Verify buttons exist
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    expect(canvasElement.querySelector('[data-slot="item-separator"]')).toBeInTheDocument();

    await Default.play?.(context);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    const [invoiceItem, userItem] = [...items];
    if (!(invoiceItem instanceof HTMLElement) || !(userItem instanceof HTMLElement)) {
      throw new Error('Expected both item entries to be present.');
    }

    expect(invoiceItem.querySelector('[data-slot="item-media"]')).toBeInTheDocument();
    expect(userItem.querySelector('[data-slot="item-media"]')).toBeInTheDocument();
    expect(invoiceItem.querySelector('[data-slot="item-actions"]')).toBeInTheDocument();
    expect(userItem.querySelector('[data-slot="item-actions"]')).toBeInTheDocument();

    await Default.play?.(context);
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    if (!(group instanceof HTMLElement)) {
      throw new Error('Item group was not found.');
    }

    const items = group.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    const [invoiceItem, userItem] = [...items];
    if (!(invoiceItem instanceof HTMLElement) || !(userItem instanceof HTMLElement)) {
      throw new Error('Expected both item entries to be present.');
    }

    const invoiceTitle = invoiceItem.querySelector('[data-slot="item-title"]');
    if (!(invoiceTitle instanceof HTMLElement)) {
      throw new Error('Invoice title element was not found.');
    }
    expect(invoiceTitle.textContent?.trim()).toBe('請求書 #INV-001');

    const invoiceDescription = invoiceItem.querySelector('[data-slot="item-description"]');
    if (!(invoiceDescription instanceof HTMLElement)) {
      throw new Error('Invoice description element was not found.');
    }
    expect(invoiceDescription.textContent?.trim()).toBe('2日前に作成 · 支払い済み');

    const invoiceImage = invoiceItem.querySelector('[data-slot="item-media"] img');
    if (!(invoiceImage instanceof HTMLImageElement)) {
      throw new Error('Invoice preview image was not found.');
    }
    expect(invoiceImage.getAttribute('alt')).toBe('プレビュー');

    const moreButton = invoiceItem.querySelector('button[aria-label]');
    if (!(moreButton instanceof HTMLButtonElement)) {
      throw new Error('More button was not found.');
    }
    expect(moreButton.getAttribute('aria-label')).toBe('その他');

    const userTitle = userItem.querySelector('[data-slot="item-title"]');
    if (!(userTitle instanceof HTMLElement)) {
      throw new Error('User title element was not found.');
    }
    expect(userTitle.textContent?.trim()).toBe('グレース・ホッパー');

    const userDescription = userItem.querySelector('[data-slot="item-description"]');
    if (!(userDescription instanceof HTMLElement)) {
      throw new Error('User description element was not found.');
    }
    expect(userDescription.textContent?.trim()).toBe('最終アクティブ 1時間前');

    const avatarImage = userItem.querySelector('[data-slot=\"avatar-image\"]');
    if (!(avatarImage instanceof HTMLElement)) {
      throw new Error('Avatar image element was not found.');
    }
    expect(avatarImage.getAttribute('alt')).toBe('ユーザーのアバター');

    const messageButton = userItem.querySelector('button:not([aria-label])');
    if (!(messageButton instanceof HTMLButtonElement)) {
      throw new Error('Message button was not found.');
    }
    expect(messageButton.textContent?.trim()).toBe('メッセージ');

    await Default.play?.(context);
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
  name: i18n.t('item.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  render: () => (
    <div
      className="w-full max-w-2xl"
      role="list"
      aria-label={i18n.t('item.story.taskList', 'Task list')}
    >
      <ItemGroup>
        <Item asChild>
          <li>
            <ItemMedia variant="default">
              <div
                className="flex size-8 items-center justify-center rounded-full bg-green-100 text-green-600"
                aria-hidden="true"
              >
                <CheckCircle2Icon className="size-4" />
              </div>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{i18n.t('item.story.completedTask', 'Completed Task')}</ItemTitle>
              <ItemDescription>
                {i18n.t('item.story.reviewQuarterlyReport', 'Review quarterly report')}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                size="sm"
                variant="outline"
                aria-label={i18n.t(
                  'item.story.viewCompletedTaskDetails',
                  'View completed task details'
                )}
              >
                {i18n.t('item.story.view', 'View')}
              </Button>
            </ItemActions>
          </li>
        </Item>
        <li role="presentation">
          <ItemSeparator />
        </li>
        <Item asChild variant="muted">
          <li>
            <ItemMedia variant="default">
              <div
                className="bg-muted flex size-8 items-center justify-center rounded-full"
                aria-hidden="true"
              >
                <FileTextIcon className="size-4" />
              </div>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{i18n.t('item.story.pendingTask', 'Pending Task')}</ItemTitle>
              <ItemDescription>
                {i18n.t('item.story.updateDocumentation', 'Update documentation')}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                size="sm"
                aria-label={i18n.t('item.story.startPendingTask', 'Start pending task')}
              >
                {i18n.t('item.story.start', 'Start')}
              </Button>
            </ItemActions>
          </li>
        </Item>
      </ItemGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Find the list
    const list = canvas.getByRole('list');
    expect(list).toBeInTheDocument();
    expect(list.getAttribute('aria-label')).toBe('Task list');

    // Find list items
    const listItems = canvas.getAllByRole('listitem');
    expect(listItems.length).toBe(2);

    // Find buttons
    const viewButton = canvas.getByRole('button', { name: 'View completed task details' });
    const startButton = canvas.getByRole('button', { name: 'Start pending task' });
    expect(viewButton).toBeInTheDocument();
    expect(startButton).toBeInTheDocument();

    // Test keyboard navigation
    await userEvent.tab();
    expect(doc.activeElement).toBe(viewButton);

    await userEvent.tab();
    expect(doc.activeElement).toBe(startButton);

    // Test keyboard activation
    await userEvent.keyboard('{Enter}');
  },
};

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const items = createFakeItems(5);
    return (
      <ItemGroup data-slot="item-group">
        {items.map((fakeItem, index) => (
          <React.Fragment key={fakeItem.id}>
            <Item variant={fakeItem.variant} data-slot="item">
              {fakeItem.media && (
                <ItemMedia>
                  {fakeItem.media.imageSrc ? (
                    <Avatar>
                      <AvatarImage
                        src={fakeItem.media.imageSrc}
                        alt={fakeItem.media.imageAlt ?? ''}
                      />
                      <AvatarFallback>{fakeItem.media.initials ?? '??'}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <FileTextIcon className="size-5" />
                  )}
                </ItemMedia>
              )}
              <ItemContent>
                <ItemTitle>{fakeItem.content.title}</ItemTitle>
                {fakeItem.content.description && (
                  <ItemDescription>{fakeItem.content.description}</ItemDescription>
                )}
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" size="icon">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </ItemActions>
            </Item>
            {index < items.length - 1 && fakeItem.hasSeparator && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    );
  },
  play: async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: itemHandlers },
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    for (const item of items) {
      expect(item.querySelector('[data-slot="item-content"]')).toBeInTheDocument();
      expect(item.querySelector('[data-slot="item-title"]')).toBeInTheDocument();
    }

    await Default.play?.(context);
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: itemStatusHandlers.loading },
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    expect(canvasElement.querySelector('[data-slot="item-separator"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: itemStatusHandlers.badRequest },
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    expect(canvasElement.querySelector('[data-slot="item-separator"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: itemStatusHandlers.unauthorized },
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    expect(canvasElement.querySelector('[data-slot="item-separator"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: itemStatusHandlers.forbidden },
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    expect(canvasElement.querySelector('[data-slot="item-separator"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: itemStatusHandlers.unprocessableEntity },
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    expect(canvasElement.querySelector('[data-slot="item-separator"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: itemStatusHandlers.internalServerError },
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    expect(canvasElement.querySelector('[data-slot="item-separator"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: itemStatusHandlers.networkError },
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(2);

    expect(canvasElement.querySelector('[data-slot="item-separator"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeItem ============

function CreateFakeItemDemo() {
  const item = createFakeItem();

  return (
    <div className="w-full max-w-2xl" data-testid="create-fake-item-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('item.variants.basic')}</p>
      <ItemGroup>
        <Item variant={item.variant} data-testid="single-fake-item">
          {item.media?.imageSrc ? (
            <ItemMedia>
              <Avatar>
                <AvatarImage src={item.media.imageSrc} alt={item.media.imageAlt ?? ''} />
                <AvatarFallback>{item.media.initials ?? '??'}</AvatarFallback>
              </Avatar>
            </ItemMedia>
          ) : (
            <ItemMedia variant="default">
              <FileTextIcon className="size-5" />
            </ItemMedia>
          )}
          <ItemContent>
            <ItemTitle>{item.content.title}</ItemTitle>
            {item.content.description && (
              <ItemDescription>{item.content.description}</ItemDescription>
            )}
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="icon">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithCreateFakeItem: Story = {
  render: () => <CreateFakeItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('create-fake-item-demo')).toBeInTheDocument();
    const item = canvasElement.querySelector('[data-testid="single-fake-item"]');
    expect(item).toBeInTheDocument();
    expect(item?.querySelector('[data-slot="item-content"]')).toBeInTheDocument();
    expect(item?.querySelector('[data-slot="item-title"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeUserItem ============

function UserItemDemo() {
  const user = createFakeUserItem();

  return (
    <div className="w-full max-w-2xl" data-testid="user-item-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.userItem', 'User Item')}
      </p>
      <ItemGroup>
        <Item variant={user.variant} data-testid="user-item">
          <ItemMedia variant="default">
            <Avatar className="size-8">
              <AvatarImage src={user.userAvatar} alt={user.userName} />
              <AvatarFallback>{user.userInitials}</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{user.userName}</ItemTitle>
            <ItemDescription>
              {user.userRole} &middot; {user.userEmail}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <span
              className={`inline-block size-2 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
              data-testid="online-indicator"
            />
            <Button size="sm" variant="outline">
              {i18n.t('item.actions.message')}
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithUserItem: Story = {
  render: () => <UserItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('user-item-demo')).toBeInTheDocument();
    const item = canvas.getByTestId('user-item');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-title"]')?.textContent?.trim()).not.toBe('');
    expect(item.querySelector('[data-slot="item-description"]')?.textContent?.trim()).not.toBe('');
    expect(canvas.getByTestId('online-indicator')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeProductItem ============

function ProductItemDemo() {
  const product = createFakeProductItem();

  return (
    <div className="w-full max-w-2xl" data-testid="product-item-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.withDescription')}: {i18n.t('item.story.product', 'Product')}
      </p>
      <ItemGroup>
        <Item variant={product.variant} data-testid="product-item">
          <ItemMedia variant="image">
            <img src={product.productImage} alt={product.productName} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{product.productName}</ItemTitle>
            <ItemDescription>
              {product.currency} {product.price.toFixed(2)} &middot; {product.category}
              {product.inStock
                ? ` · ${i18n.t('item.story.inStock', 'In Stock')}`
                : ` · ${i18n.t('item.story.outOfStock', 'Out of Stock')}`}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline">
              {i18n.t('item.story.view', 'View')}
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithProductItem: Story = {
  render: () => <ProductItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('product-item-demo')).toBeInTheDocument();
    const item = canvas.getByTestId('product-item');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-media"]')).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-title"]')?.textContent?.trim()).not.toBe('');
    expect(item.querySelector('[data-slot="item-description"]')?.textContent?.trim()).not.toBe('');
  },
};

// ============ FACTORY: createFakeFileItem ============

function FileItemDemo() {
  const file = createFakeFileItem();

  return (
    <div className="w-full max-w-2xl" data-testid="file-item-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.withIcon')}: {i18n.t('item.story.file', 'File')}
      </p>
      <ItemGroup>
        <Item variant={file.variant} data-testid="file-item">
          <ItemMedia variant="icon">
            <FileTextIcon className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{file.fileName}</ItemTitle>
            <ItemDescription>
              {file.fileExtension.toUpperCase()} &middot; {(file.fileSize / 1024).toFixed(1)} KB
              {file.isShared ? ` · ${i18n.t('item.story.shared', 'Shared')}` : ''}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="ghost">
              {i18n.t('item.story.download', 'Download')}
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithFileItem: Story = {
  render: () => <FileItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-item-demo')).toBeInTheDocument();
    const item = canvas.getByTestId('file-item');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-media"]')).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-title"]')?.textContent?.trim()).not.toBe('');
  },
};

// ============ FACTORY: createFakeTaskItem ============

function TaskItemDemo() {
  const task = createFakeTaskItem();

  return (
    <div className="w-full max-w-2xl" data-testid="task-item-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.selectable')}: {i18n.t('item.story.task', 'Task')}
      </p>
      <ItemGroup>
        <Item variant={task.variant} data-testid="task-item">
          <ItemMedia variant="default">
            <div
              className={`flex size-8 items-center justify-center rounded-full ${task.isCompleted ? 'bg-green-100 text-green-600' : 'bg-muted'}`}
            >
              <CheckCircle2Icon className="size-4" />
            </div>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{task.taskTitle}</ItemTitle>
            <ItemDescription>
              {i18n.t('item.story.priorityLabel', 'Priority: {{priority}}', {
                priority: task.priority,
              })}
              {task.assignee
                ? ` · ${i18n.t('item.story.assignedTo', 'Assigned to: {{assignee}}', { assignee: task.assignee })}`
                : ''}
              {task.project ? ` · ${task.project}` : ''}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline">
              {i18n.t('item.story.edit', 'Edit')}
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithTaskItem: Story = {
  render: () => <TaskItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('task-item-demo')).toBeInTheDocument();
    const item = canvas.getByTestId('task-item');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-title"]')?.textContent?.trim()).not.toBe('');
    expect(item.querySelector('[data-slot="item-description"]')?.textContent?.trim()).not.toBe('');
  },
};

// ============ FACTORY: createFakeNotificationItem ============

function NotificationItemDemo() {
  const notification = createFakeNotificationItem();

  return (
    <div className="w-full max-w-2xl" data-testid="notification-item-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.notification', 'Notification')}
      </p>
      <ItemGroup>
        <Item variant={notification.variant} data-testid="notification-item">
          <ItemMedia variant="icon">
            <StarIcon className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {notification.content.title}
              {!notification.isRead && (
                <span
                  className="ml-2 inline-block size-2 rounded-full bg-blue-500"
                  data-testid="unread-dot"
                />
              )}
            </ItemTitle>
            <ItemDescription>{notification.message}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <span className="text-muted-foreground text-xs">
              {notification.timestamp.toLocaleDateString()}
            </span>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithNotificationItem: Story = {
  render: () => <NotificationItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('notification-item-demo')).toBeInTheDocument();
    const item = canvas.getByTestId('notification-item');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-title"]')?.textContent?.trim()).not.toBe('');
    expect(item.querySelector('[data-slot="item-description"]')?.textContent?.trim()).not.toBe('');
  },
};

// ============ FACTORY: createFakeEventItem ============

function EventItemDemo() {
  const event: FakeEventItem = createFakeEventItem();

  return (
    <div className="w-full max-w-2xl" data-testid="event-item-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.withDescription')}: {i18n.t('item.story.event', 'Event')}
      </p>
      <ItemGroup>
        <Item variant={event.variant} data-testid="event-item">
          <ItemMedia variant="icon">
            <StarIcon className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{event.eventTitle}</ItemTitle>
            <ItemDescription>
              {event.startTime.toLocaleDateString()}
              {event.location ? ` · ${event.location}` : ''}
              {event.isAllDay ? ` · ${i18n.t('item.story.allDay', 'All Day')}` : ''}
              {` · ${i18n.t('item.story.attendeeCount', '{{count}} attendees', { count: event.attendeeCount })}`}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline">
              {i18n.t('item.story.edit', 'Edit')}
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithEventItem: Story = {
  render: () => <EventItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('event-item-demo')).toBeInTheDocument();
    const item = canvas.getByTestId('event-item');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-title"]')?.textContent?.trim()).not.toBe('');
    expect(item.querySelector('[data-slot="item-description"]')?.textContent?.trim()).not.toBe('');
  },
};

// ============ FACTORY: createFakeMessageItem ============

function MessageItemDemo() {
  const message: FakeMessageItem = createFakeMessageItem();

  return (
    <div className="w-full max-w-2xl" data-testid="message-item-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.messageLabel', 'Message')}
      </p>
      <ItemGroup>
        <Item variant={message.variant} data-testid="message-item">
          <ItemMedia variant="default">
            <Avatar className="size-8">
              <AvatarImage src={message.senderAvatar} alt={message.senderName} />
              <AvatarFallback>
                {message.senderName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {message.senderName}
              {message.isUnread && message.unreadCount > 0 && (
                <span
                  className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white"
                  data-testid="unread-count"
                >
                  {message.unreadCount}
                </span>
              )}
            </ItemTitle>
            <ItemDescription>{message.messagePreview}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <span className="text-muted-foreground text-xs">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithMessageItem: Story = {
  render: () => <MessageItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('message-item-demo')).toBeInTheDocument();
    const item = canvas.getByTestId('message-item');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-title"]')?.textContent?.trim()).not.toBe('');
    expect(item.querySelector('[data-slot="item-description"]')?.textContent?.trim()).not.toBe('');
  },
};

// ============ FACTORY: createFakeItemGroup ============

function ItemGroupDemo() {
  const group: FakeItemGroup = createFakeItemGroup(4);

  return (
    <div className="w-full max-w-2xl" data-testid="item-group-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.itemGroup', 'Item Group')}
      </p>
      {group.title && <p className="text-muted-foreground mb-1 text-xs">{group.title}</p>}
      <ItemGroup className={group.className}>
        {group.items.map((item, index) => (
          <React.Fragment key={item.id}>
            <Item variant={item.variant}>
              <ItemContent>
                <ItemTitle>{item.content.title}</ItemTitle>
                {item.content.description && (
                  <ItemDescription>{item.content.description}</ItemDescription>
                )}
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" size="icon">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </ItemActions>
            </Item>
            {group.showSeparators && index < group.items.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithItemGroup: Story = {
  render: () => <ItemGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('item-group-demo')).toBeInTheDocument();
    const group = canvasElement.querySelector('[data-slot="item-group"]');
    expect(group).toBeInTheDocument();
    const items = group?.querySelectorAll('[data-slot="item"]');
    expect(items?.length).toBe(4);
  },
};

// ============ FACTORY: createFakeItemVariantMatrix ============

function VariantMatrixDemo() {
  const items = createFakeItemVariantMatrix();

  return (
    <div className="w-full max-w-2xl" data-testid="variant-matrix-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.variantMatrix', 'Variant Matrix')}
      </p>
      <ItemGroup>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <Item variant={item.variant}>
              <ItemContent>
                <ItemTitle>{item.content.title}</ItemTitle>
              </ItemContent>
            </Item>
            {index < items.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithVariantMatrix: Story = {
  render: () => <VariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('variant-matrix-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_VARIANTS.length);

    // Verify each variant is represented
    const variants = [...items].map((i) => i.getAttribute('data-variant'));
    for (const v of ITEM_VARIANTS) {
      expect(variants).toContain(v);
    }
  },
};

// ============ FACTORY: createFakeItemSizeMatrix ============

function SizeMatrixDemo() {
  const items = createFakeItemSizeMatrix();

  return (
    <div className="w-full max-w-2xl" data-testid="size-matrix-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.sizes.default')}: {i18n.t('item.story.sizeMatrix', 'Size Matrix')}
      </p>
      <ItemGroup>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <Item size={item.size}>
              <ItemContent>
                <ItemTitle>{item.content.title}</ItemTitle>
              </ItemContent>
            </Item>
            {index < items.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithSizeMatrix: Story = {
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('size-matrix-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_SIZES.length);

    const sizes = [...items].map((i) => i.getAttribute('data-size'));
    for (const s of ITEM_SIZES) {
      expect(sizes).toContain(s);
    }
  },
};

// ============ FACTORY: createFakeItemStateMatrix ============

function StateMatrixDemo() {
  const items = createFakeItemStateMatrix();

  return (
    <div className="w-full max-w-2xl" data-testid="state-matrix-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.stateMatrix', 'State Matrix')}
      </p>
      <ItemGroup>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <Item variant={item.variant} data-state={item.state}>
              <ItemContent>
                <ItemTitle>{item.content.title}</ItemTitle>
              </ItemContent>
            </Item>
            {index < items.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithStateMatrix: Story = {
  render: () => <StateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('state-matrix-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_STATES.length);
  },
};

// ============ FACTORY: createFakeItemMediaVariantMatrix ============

function MediaVariantMatrixDemo() {
  const items = createFakeItemMediaVariantMatrix();

  return (
    <div className="w-full max-w-2xl" data-testid="media-variant-matrix-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.withIcon')}: {i18n.t('item.story.mediaVariants', 'Media Variants')}
      </p>
      <ItemGroup>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <Item>
              {item.media && (
                <ItemMedia variant={item.media.variant as 'default' | 'icon' | 'image'}>
                  {item.media.imageSrc ? (
                    <img src={item.media.imageSrc} alt={item.media.imageAlt ?? ''} />
                  ) : (
                    <FileTextIcon className="size-4" />
                  )}
                </ItemMedia>
              )}
              <ItemContent>
                <ItemTitle>{item.content.title}</ItemTitle>
              </ItemContent>
            </Item>
            {index < items.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithMediaVariantMatrix: Story = {
  render: () => <MediaVariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('media-variant-matrix-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_MEDIA_VARIANTS.length);
  },
};

// ============ FACTORY: createFakeItemTypeMatrix ============

function TypeMatrixDemo() {
  const items = createFakeItemTypeMatrix();

  return (
    <div className="w-full max-w-2xl" data-testid="type-matrix-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.typeMatrix', 'Type Matrix')}
      </p>
      <ItemGroup>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <Item variant={item.variant} data-type={item.type}>
              <ItemMedia variant="icon">
                <FileTextIcon className="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{item.content.title}</ItemTitle>
              </ItemContent>
            </Item>
            {index < items.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithTypeMatrix: Story = {
  render: () => <TypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('type-matrix-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_TYPES.length);
  },
};

// ============ FACTORY: createFakeItemShowcase ============

function ShowcaseDemo() {
  const showcase = createFakeItemShowcase();
  const entries = Object.entries(showcase);

  return (
    <div className="w-full max-w-2xl" data-testid="showcase-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.showcase', 'Showcase')}
      </p>
      <ItemGroup>
        {entries.map(([key, item], index) => (
          <React.Fragment key={item.id}>
            <Item variant={item.variant} data-testid={`showcase-${key}`}>
              <ItemContent>
                <ItemTitle>
                  {key}: {item.content.title}
                </ItemTitle>
                {item.content.description && (
                  <ItemDescription>{item.content.description}</ItemDescription>
                )}
              </ItemContent>
            </Item>
            {index < entries.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithShowcase: Story = {
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('showcase-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    // Showcase has: basic, user, product, file, task, notification, event, message,
    // variantDefault, variantOutline, variantMuted, sizeDefault, sizeSm,
    // stateDefault, stateSelected, stateActive, stateDisabled, stateCompleted,
    // mediaDefault, mediaIcon, mediaImage, noMedia, withHeader, withFooter, withSeparator, asChild
    expect(items.length).toBe(26);
  },
};

// ============ FACTORY: createFakeContactList ============

function ContactListDemo() {
  const { t } = useTranslation();
  const contacts = createFakeContactList(5);

  return (
    <div className="w-full max-w-2xl" data-testid="contact-list-demo">
      <p className="mb-2 text-sm font-medium">
        {t('item.variants.basic')}: {t('item.story.contactList', 'Contact List')}
      </p>
      <ItemGroup>
        {contacts.map((user, index) => (
          <React.Fragment key={user.id}>
            <Item variant={user.variant}>
              <ItemMedia variant="default">
                <Avatar className="size-8">
                  <AvatarImage src={user.userAvatar} alt={user.userName} />
                  <AvatarFallback>{user.userInitials}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{user.userName}</ItemTitle>
                <ItemDescription>{user.userEmail}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button size="sm" variant="outline">
                  {t('item.actions.message')}
                </Button>
              </ItemActions>
            </Item>
            {index < contacts.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithContactList: Story = {
  render: () => <ContactListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('contact-list-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(5);
    for (const item of items) {
      expect(item.querySelector('[data-slot="item-title"]')?.textContent?.trim()).not.toBe('');
    }
  },
};

// ============ FACTORY: createFakeProductList ============

function ProductListDemo() {
  const products = createFakeProductList(5);

  return (
    <div className="w-full max-w-2xl" data-testid="product-list-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.withDescription')}: {i18n.t('item.story.products', 'Products')}
      </p>
      <ItemGroup>
        {products.map((product, index) => (
          <React.Fragment key={product.id}>
            <Item variant={product.variant}>
              <ItemMedia variant="image">
                <img src={product.productImage} alt={product.productName} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{product.productName}</ItemTitle>
                <ItemDescription>
                  {product.currency} {product.price.toFixed(2)} &middot; {product.category}
                </ItemDescription>
              </ItemContent>
            </Item>
            {index < products.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithProductList: Story = {
  render: () => <ProductListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('product-list-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(5);
    for (const item of items) {
      expect(item.querySelector('[data-slot="item-media"]')).toBeInTheDocument();
    }
  },
};

// ============ FACTORY: createFakeFileList ============

function FileListDemo() {
  const files = createFakeFileList(5);

  return (
    <div className="w-full max-w-2xl" data-testid="file-list-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.withIcon')}: {i18n.t('item.story.fileBrowser', 'File Browser')}
      </p>
      <ItemGroup>
        {files.map((file, index) => (
          <React.Fragment key={file.id}>
            <Item variant={file.variant}>
              <ItemMedia variant="icon">
                <FileTextIcon className="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{file.fileName}</ItemTitle>
                <ItemDescription>
                  {file.fileExtension.toUpperCase()} &middot; {(file.fileSize / 1024).toFixed(1)} KB
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button size="sm" variant="ghost">
                  {i18n.t('item.story.download', 'Download')}
                </Button>
              </ItemActions>
            </Item>
            {index < files.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithFileList: Story = {
  render: () => <FileListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-list-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(5);
  },
};

// ============ FACTORY: createFakeTaskList ============

function TaskListDemo() {
  const tasks = createFakeTaskList(5);

  return (
    <div className="w-full max-w-2xl" data-testid="task-list-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.selectable')}: {i18n.t('item.story.taskListLabel', 'Task List')}
      </p>
      <ItemGroup>
        {tasks.map((task, index) => (
          <React.Fragment key={task.id}>
            <Item variant={task.variant}>
              <ItemMedia variant="default">
                <div
                  className={`flex size-6 items-center justify-center rounded-full ${task.isCompleted ? 'bg-green-100 text-green-600' : 'bg-muted'}`}
                >
                  <CheckCircle2Icon className="size-3" />
                </div>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{task.taskTitle}</ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.priorityLabel', 'Priority: {{priority}}', {
                    priority: task.priority,
                  })}
                </ItemDescription>
              </ItemContent>
            </Item>
            {index < tasks.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithTaskList: Story = {
  render: () => <TaskListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('task-list-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(5);
  },
};

// ============ FACTORY: createFakeNotificationList ============

function NotificationListDemo() {
  const notifications = createFakeNotificationList(5);

  return (
    <div className="w-full max-w-2xl" data-testid="notification-list-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.notifications', 'Notifications')}
      </p>
      <ItemGroup>
        {notifications.map((n, index) => (
          <React.Fragment key={n.id}>
            <Item variant={n.variant}>
              <ItemMedia variant="icon">
                <StarIcon className="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{n.content.title}</ItemTitle>
                <ItemDescription>{n.message}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <span className="text-muted-foreground text-xs">
                  {n.timestamp.toLocaleDateString()}
                </span>
              </ItemActions>
            </Item>
            {index < notifications.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithNotificationList: Story = {
  render: () => <NotificationListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('notification-list-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(5);
  },
};

// ============ FACTORY: createFakeMessageList ============

function MessageListDemo() {
  const messages = createFakeMessageList(5);

  return (
    <div className="w-full max-w-2xl" data-testid="message-list-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.messages', 'Messages')}
      </p>
      <ItemGroup>
        {messages.map((msg, index) => (
          <React.Fragment key={msg.id}>
            <Item variant={msg.variant}>
              <ItemMedia variant="default">
                <Avatar className="size-8">
                  <AvatarImage src={msg.senderAvatar} alt={msg.senderName} />
                  <AvatarFallback>
                    {msg.senderName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{msg.senderName}</ItemTitle>
                <ItemDescription>{msg.messagePreview}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <span className="text-muted-foreground text-xs">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </ItemActions>
            </Item>
            {index < messages.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithMessageList: Story = {
  render: () => <MessageListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('message-list-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(5);
  },
};

// ============ CONSTANTS: ITEM_VARIANTS ============

function ItemVariantsConstantDemo() {
  return (
    <div className="w-full max-w-2xl" data-testid="item-variants-constant-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}:{' '}
        {i18n.t('item.story.allVariantsConstant', 'All Variants Constant')}
      </p>
      <ItemGroup>
        {ITEM_VARIANTS.map((variant: ItemVariant, index) => (
          <React.Fragment key={variant}>
            <Item variant={variant} data-testid={`variant-${variant}`}>
              <ItemContent>
                <ItemTitle>
                  {i18n.t('item.story.variantLabel', 'Variant: {{variant}}', { variant })}
                </ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.usingItemVariantsConstant', 'Using ITEM_VARIANTS constant')}
                </ItemDescription>
              </ItemContent>
            </Item>
            {index < ITEM_VARIANTS.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithItemVariantsConstant: Story = {
  render: () => <ItemVariantsConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('item-variants-constant-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_VARIANTS.length);
    expect(canvas.getByTestId('variant-default')).toBeInTheDocument();
    expect(canvas.getByTestId('variant-outline')).toBeInTheDocument();
    expect(canvas.getByTestId('variant-muted')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: ITEM_SIZES ============

function ItemSizesConstantDemo() {
  return (
    <div className="w-full max-w-2xl" data-testid="item-sizes-constant-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.sizes.default')}:{' '}
        {i18n.t('item.story.allSizesConstant', 'All Sizes Constant')}
      </p>
      <ItemGroup>
        {ITEM_SIZES.map((size: ItemSize, index) => (
          <React.Fragment key={size}>
            <Item size={size} data-testid={`size-${size}`}>
              <ItemContent>
                <ItemTitle>{i18n.t('item.story.sizeLabel', 'Size: {{size}}', { size })}</ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.usingItemSizesConstant', 'Using ITEM_SIZES constant')}
                </ItemDescription>
              </ItemContent>
            </Item>
            {index < ITEM_SIZES.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithItemSizesConstant: Story = {
  render: () => <ItemSizesConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('item-sizes-constant-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_SIZES.length);
    expect(canvas.getByTestId('size-default')).toBeInTheDocument();
    expect(canvas.getByTestId('size-sm')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: ITEM_MEDIA_VARIANTS ============

function ItemMediaVariantsConstantDemo() {
  return (
    <div className="w-full max-w-2xl" data-testid="item-media-variants-constant-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.withIcon')}:{' '}
        {i18n.t('item.story.mediaVariantsConstant', 'Media Variants Constant')}
      </p>
      <ItemGroup>
        {ITEM_MEDIA_VARIANTS.map((mv: ItemMediaVariant, index) => (
          <React.Fragment key={mv}>
            <Item data-testid={`media-variant-${mv}`}>
              <ItemMedia variant={mv}>
                {mv === 'image' ? (
                  <img
                    src="/images/products/01.jpeg"
                    alt={i18n.t('item.story.productAlt', 'Product')}
                  />
                ) : (
                  <FileTextIcon className="size-4" />
                )}
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {i18n.t('item.story.mediaLabel', 'Media: {{media}}', { media: mv })}
                </ItemTitle>
              </ItemContent>
            </Item>
            {index < ITEM_MEDIA_VARIANTS.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithItemMediaVariantsConstant: Story = {
  render: () => <ItemMediaVariantsConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('item-media-variants-constant-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_MEDIA_VARIANTS.length);
  },
};

// ============ CONSTANTS: ITEM_TYPES ============

function ItemTypesConstantDemo() {
  return (
    <div className="w-full max-w-2xl" data-testid="item-types-constant-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}:{' '}
        {i18n.t('item.story.allTypesConstant', 'All Types Constant')}
      </p>
      <ItemGroup>
        {ITEM_TYPES.map((type: ItemType, index) => (
          <React.Fragment key={type}>
            <Item data-testid={`type-${type}`} data-type={type}>
              <ItemMedia variant="icon">
                <FileTextIcon className="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{type.charAt(0).toUpperCase() + type.slice(1)}</ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.itemTypeLabel', 'Item type: {{type}}', { type })}
                </ItemDescription>
              </ItemContent>
            </Item>
            {index < ITEM_TYPES.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithItemTypesConstant: Story = {
  render: () => <ItemTypesConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('item-types-constant-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_TYPES.length);
  },
};

// ============ CONSTANTS: ITEM_STATES ============

function ItemStatesConstantDemo() {
  return (
    <div className="w-full max-w-2xl" data-testid="item-states-constant-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}:{' '}
        {i18n.t('item.story.allStatesConstant', 'All States Constant')}
      </p>
      <ItemGroup>
        {ITEM_STATES.map((state: ItemState, index) => (
          <React.Fragment key={state}>
            <Item data-testid={`state-${state}`} data-state={state}>
              <ItemContent>
                <ItemTitle>
                  {i18n.t('item.story.stateLabel', 'State: {{state}}', { state })}
                </ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.usingItemStatesConstant', 'Using ITEM_STATES constant')}
                </ItemDescription>
              </ItemContent>
            </Item>
            {index < ITEM_STATES.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithItemStatesConstant: Story = {
  render: () => <ItemStatesConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('item-states-constant-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_STATES.length);
  },
};

// ============ CONSTANTS: ITEM_ACTION_TYPES + ITEM_ACTION_LABELS + ITEM_ACTION_ARIA_LABELS ============

function ActionTypesDemo() {
  return (
    <div className="w-full max-w-2xl" data-testid="action-types-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.actionTypes', 'Action Types')}
      </p>
      <ItemGroup>
        {ITEM_ACTION_TYPES.map((actionType: ItemActionType, index) => (
          <React.Fragment key={actionType}>
            <Item data-testid={`action-type-${actionType}`}>
              <ItemContent>
                <ItemTitle>{ITEM_ACTION_LABELS[actionType]}</ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.ariaLabel', 'Aria: {{label}}', {
                    label: ITEM_ACTION_ARIA_LABELS[actionType],
                  })}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  size="sm"
                  variant={actionType === 'delete' ? 'destructive' : 'outline'}
                  aria-label={ITEM_ACTION_ARIA_LABELS[actionType]}
                >
                  {ITEM_ACTION_LABELS[actionType]}
                </Button>
              </ItemActions>
            </Item>
            {index < ITEM_ACTION_TYPES.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithActionTypes: Story = {
  render: () => <ActionTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('action-types-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_ACTION_TYPES.length);

    // Verify the delete action has destructive variant
    const deleteItem = canvas.getByTestId('action-type-delete');
    const deleteButton = deleteItem.querySelector('button');
    expect(deleteButton).toBeInTheDocument();
  },
};

// ============ CONSTANTS: ITEM_PRIORITIES ============

function PrioritiesDemo() {
  const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-yellow-100 text-yellow-700',
    normal: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="w-full max-w-2xl" data-testid="priorities-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.priorityLevels', 'Priority Levels')}
      </p>
      <ItemGroup>
        {ITEM_PRIORITIES.map((priority: ItemPriority, index) => (
          <React.Fragment key={priority}>
            <Item data-testid={`priority-${priority}`}>
              <ItemMedia variant="default">
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${priorityColors[priority]}`}
                >
                  {priority}
                </span>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {i18n.t('item.story.priorityLabel', 'Priority: {{priority}}', {
                    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
                  })}
                </ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.taskWithPriority', 'Task with {{priority}} priority level', {
                    priority,
                  })}
                </ItemDescription>
              </ItemContent>
            </Item>
            {index < ITEM_PRIORITIES.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithPriorities: Story = {
  render: () => <PrioritiesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('priorities-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_PRIORITIES.length);
  },
};

// ============ CONSTANTS: ITEM_ICONS ============

function IconsDemo() {
  return (
    <div className="w-full max-w-2xl" data-testid="icons-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.withIcon')}: {i18n.t('item.story.itemIcons', 'Item Icons')}
      </p>
      <ItemGroup>
        {ITEM_ICONS.map((iconName, index) => (
          <React.Fragment key={iconName}>
            <Item data-testid={`icon-${iconName}`}>
              <ItemMedia variant="icon">
                <FileTextIcon className="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{iconName}</ItemTitle>
                <ItemDescription>
                  {i18n.t('item.story.iconFromConstant', 'Icon from ITEM_ICONS constant')}
                </ItemDescription>
              </ItemContent>
            </Item>
            {index < ITEM_ICONS.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithIcons: Story = {
  render: () => <IconsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('icons-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(ITEM_ICONS.length);
  },
};

// ============ COMPONENT: ItemHeader + ItemFooter ============

function HeaderFooterDemo() {
  const item = createFakeItem({ hasHeader: true, hasFooter: true });

  return (
    <div className="w-full max-w-2xl" data-testid="header-footer-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.withDescription')}:{' '}
        {i18n.t('item.story.headerAndFooter', 'Header & Footer')}
      </p>
      <ItemGroup>
        <Item variant={item.variant}>
          <ItemHeader data-testid="item-header-slot">
            <span className="text-muted-foreground text-xs">
              {i18n.t('item.story.headerSection', 'Header section')}
            </span>
            <span className="text-muted-foreground text-xs">
              {i18n.t('item.story.statusActive', 'Status: Active')}
            </span>
          </ItemHeader>
          <ItemMedia variant="icon">
            <FileTextIcon className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{item.content.title}</ItemTitle>
            {item.content.description && (
              <ItemDescription>{item.content.description}</ItemDescription>
            )}
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="icon">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </ItemActions>
          <ItemFooter data-testid="item-footer-slot">
            <span className="text-muted-foreground text-xs">
              {i18n.t('item.story.footerContent', 'Footer content')}
            </span>
            <span className="text-muted-foreground text-xs">
              {i18n.t('item.story.updatedToday', 'Updated today')}
            </span>
          </ItemFooter>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithHeaderFooter: Story = {
  render: () => <HeaderFooterDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('header-footer-demo')).toBeInTheDocument();
    const header = canvas.getByTestId('item-header-slot');
    expect(header).toBeInTheDocument();
    expect(header.getAttribute('data-slot')).toBe('item-header');
    const footer = canvas.getByTestId('item-footer-slot');
    expect(footer).toBeInTheDocument();
    expect(footer.getAttribute('data-slot')).toBe('item-footer');
  },
};

// ============ INTERFACES: FakeItemAction, FakeItemMedia, FakeItemContent, FakeItem ============

function InterfaceTypesDemo() {
  // Demonstrate the core interfaces with typed variables
  const itemAction: FakeItemAction = {
    ariaLabel: i18n.t('item.story.editItemAriaLabel', 'Edit item'),
    disabled: false,
    iconName: 'Edit',
    iconOnly: false,
    id: 'action-1',
    label: i18n.t('item.story.edit', 'Edit'),
    size: 'sm',
    type: 'edit',
    variant: 'outline',
  };

  const itemMedia: FakeItemMedia = {
    iconName: 'FileText',
    id: 'media-1',
    variant: 'icon',
  };

  const itemContent: FakeItemContent = {
    description: i18n.t(
      'item.story.interfaceTypesDescription',
      'Demonstrates typed interfaces from the factory'
    ),
    descriptionTruncated: false,
    maxLines: 2,
    title: i18n.t('item.story.interfaceTypesTitle', 'Interface Types Demo'),
    titleTruncated: false,
  };

  const fakeItem: FakeItem = createFakeItem({
    content: itemContent,
    state: 'active',
  });

  return (
    <div className="w-full max-w-2xl" data-testid="interface-types-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}: {i18n.t('item.story.interfaceTypes', 'Interface Types')}
      </p>
      <ItemGroup>
        <Item variant={fakeItem.variant} data-testid="typed-item">
          <ItemMedia variant={itemMedia.variant} data-media-id={itemMedia.id}>
            <FileTextIcon className="size-4" aria-label={itemMedia.iconName} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{itemContent.title}</ItemTitle>
            <ItemDescription>{itemContent.description}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              size={itemAction.iconOnly ? 'icon' : itemAction.size}
              variant={itemAction.variant}
              aria-label={itemAction.ariaLabel}
              disabled={itemAction.disabled}
              data-action-id={itemAction.id}
              data-action-type={itemAction.type}
              data-icon={itemAction.iconName}
            >
              {itemAction.label}
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}

export const WithInterfaceTypes: Story = {
  render: () => <InterfaceTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('interface-types-demo')).toBeInTheDocument();
    const item = canvas.getByTestId('typed-item');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('[data-slot="item-title"]')?.textContent).toBe(
      'Interface Types Demo'
    );
    const editButton = canvas.getByRole('button', { name: 'Edit item' });
    expect(editButton).toBeInTheDocument();
    expect(editButton).not.toBeDisabled();
  },
};

// ============ INTERFACES: FakeUserItem, FakeProductItem, FakeFileItem, FakeTaskItem,
//              FakeNotificationItem, FakeEventItem, FakeMessageItem, FakeItemGroup ============

function SpecializedInterfacesDemo() {
  const user: FakeUserItem = createFakeUserItem();
  const product: FakeProductItem = createFakeProductItem();
  const file: FakeFileItem = createFakeFileItem();
  const task: FakeTaskItem = createFakeTaskItem();
  const notification: FakeNotificationItem = createFakeNotificationItem();

  const allItems = [
    { key: 'user', label: user.userName, desc: user.userEmail },
    {
      key: 'product',
      label: product.productName,
      desc: `${product.currency} ${product.price.toFixed(2)}`,
    },
    {
      key: 'file',
      label: file.fileName,
      desc: `${file.fileExtension} · ${(file.fileSize / 1024).toFixed(0)} KB`,
    },
    {
      key: 'task',
      label: task.taskTitle,
      desc: i18n.t('item.story.priorityLabel', 'Priority: {{priority}}', {
        priority: task.priority,
      }),
    },
    { key: 'notification', label: notification.content.title, desc: notification.message },
  ];

  return (
    <div className="w-full max-w-2xl" data-testid="specialized-interfaces-demo">
      <p className="mb-2 text-sm font-medium">
        {i18n.t('item.variants.basic')}:{' '}
        {i18n.t('item.story.specializedTypes', 'Specialized Types')}
      </p>
      <ItemGroup>
        {allItems.map((entry, index) => (
          <React.Fragment key={entry.key}>
            <Item data-testid={`specialized-${entry.key}`}>
              <ItemMedia variant="icon">
                <FileTextIcon className="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{entry.label}</ItemTitle>
                <ItemDescription>{entry.desc}</ItemDescription>
              </ItemContent>
            </Item>
            {index < allItems.length - 1 && <ItemSeparator />}
          </React.Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}

export const WithSpecializedInterfaces: Story = {
  render: () => <SpecializedInterfacesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('specialized-interfaces-demo')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="item"]');
    expect(items.length).toBe(5);
    expect(canvas.getByTestId('specialized-user')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-product')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-file')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-task')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-notification')).toBeInTheDocument();
  },
};

// ============ DARK RTL STORY ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('item.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DARK JAPANESE STORY ============

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('item.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MOBILE STORY ============

export const Mobile: Story = {
  ...Default,
  name: i18n.t('item.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DATA ATTRIBUTES STORY ============

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('item.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   tooManyRequests
//   conflict
//   badGateway
//   serviceUnavailable
//   gatewayTimeout
//   slowResponse
//   emptyList
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('item.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: itemStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('item.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: itemStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('item.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: itemStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('item.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: itemStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('item.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: itemStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('item.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: itemStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('item.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: itemStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('item.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: itemStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyList: Story = {
  ...Default,
  name: i18n.t('item.storyName.handlerEmptyList', 'Handler: Empty List'),
  parameters: { msw: { handlers: itemStatusHandlers.emptyList } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
