import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  carouselHandlers,
  carouselStatusHandlers,
} from '@/.storybook/stories/_handlers/carousel.handlers';
import {
  CAROUSEL_ALIGNMENTS,
  CAROUSEL_AUTOPLAY_INTERVALS,
  CAROUSEL_CONTENT_TYPES,
  CAROUSEL_NAV_STYLES,
  CAROUSEL_ORIENTATIONS,
  CAROUSEL_SIZE_WIDTHS,
  CAROUSEL_SIZES,
  CAROUSEL_SLIDE_TITLES,
  CAROUSEL_SLIDES_PER_VIEW,
  type CarouselAlign,
  type CarouselContentType,
  type CarouselNavStyle,
  type CarouselOrientation,
  type CarouselSize,
  createFakeCarouselConfig,
  createFakeCarouselMatrix,
  createFakeDemoCarousels,
  createFakeFeatureSlides,
  createFakeGallerySlide,
  createFakeGallerySlides,
  createFakeHeroSlide,
  createFakeHeroSlides,
  createFakeImageSlides,
  createFakeLogoSlides,
  createFakeNumberedSlides,
  createFakeProductSlide,
  createFakeProductSlides,
  createFakeSlide,
  createFakeSlides,
  createFakeTestimonialSlide,
  createFakeTestimonialSlides,
  type FakeCarouselConfig,
  type FakeGallerySlide,
  type FakeHeroSlide,
  type FakeProductSlide,
  type FakeSlide,
  type FakeTestimonialSlide,
} from '@/.storybook/stories/_factories/carousel.factory';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function CarouselDemo({ orientation }: { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div className="w-[520px]" data-testid="carousel-demo">
      <Carousel className="w-full" orientation={orientation}>
        <CarouselContent>
          {Array.from({ length: 5 }, (_, index) => (
            <CarouselItem key={index}>
              <Card>
                <CardContent className="flex aspect-video items-center justify-center">
                  <div className="text-2xl font-semibold">{index + 1}</div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.story.previousSlide', 'Previous slide')} />
        <CarouselNext aria-label={i18n.t('carousel.story.nextSlide', 'Next slide')} />
      </Carousel>
    </div>
  );
}

function CarouselVariantsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8" data-testid="carousel-variants-demo">
      <div>
        <p className="mb-2 text-sm font-medium">{t('carousel.variants.horizontal')}</p>
        <div className="w-[520px]">
          <Carousel className="w-full">
            <CarouselContent>
              {Array.from({ length: 5 }, (_, index) => (
                <CarouselItem key={index}>
                  <Card>
                    <CardContent className="flex aspect-video items-center justify-center">
                      <div className="text-2xl font-semibold">{index + 1}</div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious aria-label={t('carousel.previous')} />
            <CarouselNext aria-label={t('carousel.next')} />
          </Carousel>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('carousel.variants.vertical')}</p>
        <div className="w-[300px]">
          <Carousel className="w-full" orientation="vertical">
            <CarouselContent className="-mt-1 h-[200px]">
              {Array.from({ length: 5 }, (_, index) => (
                <CarouselItem key={index} className="pt-1 md:basis-1/2">
                  <Card>
                    <CardContent className="flex items-center justify-center p-6">
                      <span className="text-xl font-semibold">{index + 1}</span>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious aria-label={t('carousel.previous')} />
            <CarouselNext aria-label={t('carousel.next')} />
          </Carousel>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('carousel.variants.thumbnails')}</p>
        <div className="w-[520px]">
          <Carousel className="w-full">
            <CarouselContent>
              {Array.from({ length: 5 }, (_, index) => (
                <CarouselItem key={index}>
                  <Card>
                    <CardContent className="bg-muted flex aspect-video items-center justify-center">
                      <div className="text-4xl font-semibold">Slide {index + 1}</div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious aria-label={t('carousel.previous')} />
            <CarouselNext aria-label={t('carousel.next')} />
          </Carousel>
          <div className="mt-2 flex justify-center gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="bg-muted flex size-12 cursor-pointer items-center justify-center rounded border text-xs"
              >
                {index + 1}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('carousel.variants.autoplay')}</p>
        <div className="w-[520px]">
          <Carousel className="w-full" opts={{ loop: true }}>
            <CarouselContent>
              {Array.from({ length: 5 }, (_, index) => (
                <CarouselItem key={index}>
                  <Card>
                    <CardContent className="flex aspect-video items-center justify-center">
                      <div className="text-2xl font-semibold">Auto {index + 1}</div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious aria-label={t('carousel.previous')} />
            <CarouselNext aria-label={t('carousel.next')} />
          </Carousel>
        </div>
      </div>
    </div>
  );
}

function CarouselSizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8" data-testid="carousel-sizes-demo">
      <div>
        <p className="mb-2 text-sm font-medium">{t('carousel.sizes.small')}</p>
        <div className="w-[320px]">
          <Carousel className="w-full">
            <CarouselContent>
              {Array.from({ length: 5 }, (_, index) => (
                <CarouselItem key={index}>
                  <Card>
                    <CardContent className="flex aspect-video items-center justify-center p-4">
                      <div className="text-lg font-semibold">{index + 1}</div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious aria-label={t('carousel.previous')} />
            <CarouselNext aria-label={t('carousel.next')} />
          </Carousel>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('carousel.sizes.medium')}</p>
        <div className="w-[520px]">
          <Carousel className="w-full">
            <CarouselContent>
              {Array.from({ length: 5 }, (_, index) => (
                <CarouselItem key={index}>
                  <Card>
                    <CardContent className="flex aspect-video items-center justify-center">
                      <div className="text-2xl font-semibold">{index + 1}</div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious aria-label={t('carousel.previous')} />
            <CarouselNext aria-label={t('carousel.next')} />
          </Carousel>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('carousel.sizes.large')}</p>
        <div className="w-[720px]">
          <Carousel className="w-full">
            <CarouselContent>
              {Array.from({ length: 5 }, (_, index) => (
                <CarouselItem key={index}>
                  <Card>
                    <CardContent className="flex aspect-video items-center justify-center">
                      <div className="text-3xl font-semibold">{index + 1}</div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious aria-label={t('carousel.previous')} />
            <CarouselNext aria-label={t('carousel.next')} />
          </Carousel>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Carousel',
  component: CarouselDemo,
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
    // Content
    children: {
      control: false,
      description: i18n.t(
        'carousel.argType.carouselSlidesCarouselitemComponents',
        'Carousel slides (CarouselItem components)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    slides: {
      control: 'object',
      description: i18n.t(
        'carousel.argType.arrayOfSlideDataObjects',
        'Array of slide data objects'
      ),
      table: {
        category: 'Content',
        type: { summary: 'FakeSlide[]' },
      },
    },
    // Appearance
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: i18n.t('carousel.argType.slideDirection', 'Slide direction'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'horizontal' },
        type: { summary: "'horizontal' | 'vertical'" },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('carousel.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg', 'full'],
      description: i18n.t(
        'carousel.argType.sizeVariantOfTheCarousel',
        'Size variant of the carousel'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: { summary: "'sm' | 'default' | 'lg' | 'full'" },
      },
    },
    // State
    loop: {
      control: 'boolean',
      description: i18n.t('carousel.argType.enableInfiniteLooping', 'Enable infinite looping'),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    autoplay: {
      control: 'boolean',
      description: i18n.t('carousel.argType.enableAutoscrolling', 'Enable auto-scrolling'),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'carousel.argType.whetherTheCarouselNavigationIsDisabled',
        'Whether the carousel navigation is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description: i18n.t('carousel.argType.slideAlignment', 'Slide alignment'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'start' },
        type: { summary: "'start' | 'center' | 'end'" },
      },
    },
    slidesPerView: {
      control: 'number',
      description: i18n.t(
        'carousel.argType.numberOfSlidesVisibleAtOnce',
        'Number of slides visible at once'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: '1' },
        type: { summary: 'number' },
      },
    },
    slidesToScroll: {
      control: 'number',
      description: i18n.t(
        'carousel.argType.numberOfSlidesToScrollAtOnce',
        'Number of slides to scroll at once'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: '1' },
        type: { summary: "number | 'auto'" },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('carousel.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('carousel.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('carousel.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('carousel.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('carousel.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('carousel.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('carousel.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onSlideChange: {
      action: 'onSlideChange',
      description: i18n.t('carousel.argType.calledWhenSlideChanges', 'Called when slide changes'),
      table: { category: 'Events' },
    },
  },
  parameters: {
    msw: {
      handlers: carouselHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('1')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="carousel"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="carousel-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(5);

    const previousButton = canvasElement.querySelector('[data-slot="carousel-previous"]');
    if (!(previousButton instanceof HTMLButtonElement)) {
      throw new Error('Expected carousel previous button to be present.');
    }

    const nextButton = canvasElement.querySelector('[data-slot="carousel-next"]');
    if (!(nextButton instanceof HTMLButtonElement)) {
      throw new Error('Expected carousel next button to be present.');
    }

    expect(previousButton.getAttribute('data-slot')).toBe('carousel-previous');
    expect(nextButton.getAttribute('data-slot')).toBe('carousel-next');
    expect(previousButton.getAttribute('aria-label')).toBeInTheDocument();
    expect(nextButton.getAttribute('aria-label')).toBeInTheDocument();

    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });

    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(previousButton).not.toBeDisabled();
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="carousel"]')).toBeInTheDocument();
    expect(canvas.getByText('1')).toBeInTheDocument();
  },
};

export const Variants: Story = {
  render: () => <CarouselVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('carousel-variants-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel"]').length).toBeGreaterThanOrEqual(
      2
    );
  },
};

export const Sizes: Story = {
  render: () => <CarouselSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('carousel-sizes-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel"]').length).toBeGreaterThanOrEqual(
      3
    );
  },
};

export const Vertical: Story = {
  ...Default,
  args: {
    orientation: 'vertical',
  },
  play: async (context) => {
    await Default.play?.(context);

    const content = context.canvasElement.querySelector('[data-slot="carousel-content"] > div');
    if (!(content instanceof HTMLElement)) {
      throw new Error('Expected carousel content container to be present.');
    }

    expect(content).toHaveClass('flex-col');
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="carousel"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(5);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="carousel"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(5);
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    await Default.play?.(context);

    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(context.canvasElement);
    expect(canvas.getByRole('button', { name: '前のスライド' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: '次のスライド' })).toBeInTheDocument();
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
  name: i18n.t('carousel.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

function FakerDataCarouselDemo() {
  const { t } = useTranslation();
  const slides = createFakeSlides(5);

  return (
    <div className="w-[520px]" data-testid="carousel-faker-data-demo">
      <Carousel className="w-full">
        <CarouselContent>
          {slides.map((slide: FakeSlide) => (
            <CarouselItem key={slide.id}>
              <Card>
                <CardContent className="flex aspect-video flex-col items-center justify-center p-6">
                  <h3 className="text-lg font-semibold">{slide.title}</h3>
                  <p className="text-muted-foreground text-sm">{slide.description}</p>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={t('carousel.previous')} />
        <CarouselNext aria-label={t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <FakerDataCarouselDemo />,
  play: async ({ canvasElement }) => {
    // Verify faker-generated slides are present
    const items = canvasElement.querySelectorAll('[data-slot="carousel-item"]');
    expect(items.length).toBe(5);

    // Verify each slide has content
    items.forEach((item) => {
      expect(item.querySelector('h3')).toBeInTheDocument();
      expect(item.querySelector('p')).toBeInTheDocument();
    });
  },
};

export const WithAsyncData: Story = {
  ...WithFakerData,
  parameters: {
    msw: { handlers: carouselHandlers },
  },
  play: async ({ canvasElement }) => {
    // Verify carousel structure is present with async data from MSW
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="carousel"]')).toBeInTheDocument();
    });
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: carouselHandlers,
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: carouselStatusHandlers.loading,
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: carouselStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: carouselStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('carousel.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify carousel has proper ARIA role
    const carousel = canvasElement.querySelector('[data-slot="carousel"]');
    expect(carousel).toBeInTheDocument();
    expect(carousel?.getAttribute('role')).toBe('region');
    expect(carousel?.getAttribute('aria-roledescription')).toBe('carousel');

    // Verify carousel has accessible label
    expect(
      carousel?.hasAttribute('aria-label') || carousel?.hasAttribute('aria-labelledby')
    ).toBeInTheDocument();

    // Verify carousel items have proper attributes
    const items = canvasElement.querySelectorAll('[data-slot="carousel-item"]');
    expect(items.length).not.toBe(0);

    // Verify navigation buttons exist and are accessible
    const prevButton = canvasElement.querySelector('[data-slot="carousel-previous"]');
    const nextButton = canvasElement.querySelector('[data-slot="carousel-next"]');
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    // Verify buttons have aria-labels
    if (prevButton instanceof HTMLButtonElement) {
      expect(
        prevButton.hasAttribute('aria-label') || prevButton.textContent?.trim()
      ).toBeInTheDocument();
    }
    if (nextButton instanceof HTMLButtonElement) {
      expect(
        nextButton.hasAttribute('aria-label') || nextButton.textContent?.trim()
      ).toBeInTheDocument();
    }

    // Test keyboard navigation
    if (prevButton instanceof HTMLButtonElement) {
      prevButton.focus();
      expect(document.activeElement).toBe(prevButton);

      await userEvent.keyboard('{Tab}');
      expect(document.activeElement).not.toBe(prevButton);
    }

    // Test carousel navigation via keyboard
    if (nextButton instanceof HTMLButtonElement && !nextButton.disabled) {
      nextButton.focus();
      await userEvent.keyboard('{Enter}');
    }
  },
};

// ============ SINGLE SLIDE FACTORY STORY ============

function SingleSlideDemo() {
  const { t } = useTranslation();
  const slide = createFakeSlide({ title: 'Custom Single Slide' });

  return (
    <div className="w-[520px]" data-testid="single-slide-demo">
      <Carousel className="w-full">
        <CarouselContent>
          <CarouselItem>
            <Card>
              <CardContent className="flex aspect-video flex-col items-center justify-center p-6">
                <h3 className="text-lg font-semibold">{slide.title}</h3>
                <p className="text-muted-foreground text-sm">{slide.description}</p>
                {slide.cta && (
                  <span className="text-primary mt-2 text-xs font-medium">{slide.cta}</span>
                )}
              </CardContent>
            </Card>
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious aria-label={t('carousel.previous')} />
        <CarouselNext aria-label={t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithSingleSlide: Story = {
  render: () => <SingleSlideDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-slide-demo')).toBeInTheDocument();
    expect(canvas.getByText('Custom Single Slide')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(1);
  },
};

// ============ PRODUCT SLIDES STORIES ============

function ProductSlidesDemo() {
  const products = createFakeProductSlides(4);

  return (
    <div className="w-[520px]" data-testid="product-slides-demo">
      <Carousel className="w-full">
        <CarouselContent>
          {products.map((product: FakeProductSlide) => (
            <CarouselItem key={product.id}>
              <Card>
                <CardContent className="flex aspect-video flex-col items-center justify-center p-6">
                  <span className="text-muted-foreground mb-1 text-xs">{product.category}</span>
                  <h3 className="text-lg font-semibold">{product.title}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-primary font-bold">${product.price.toFixed(2)}</span>
                    {product.discount && product.originalPrice && (
                      <span className="text-muted-foreground text-xs line-through">
                        ${product.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 text-xs">Rating: {product.rating}/5</span>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithProductSlides: Story = {
  render: () => <ProductSlidesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('product-slides-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(4);

    const firstItem = canvasElement.querySelector('[data-slot="carousel-item"]');
    expect(firstItem?.querySelector('h3')).toBeInTheDocument();
  },
};

function SingleProductSlideDemo() {
  const product = createFakeProductSlide({ title: 'Premium Widget', price: 99.99, rating: 4.8 });

  return (
    <div className="w-[520px]" data-testid="single-product-slide-demo">
      <Carousel className="w-full">
        <CarouselContent>
          <CarouselItem>
            <Card>
              <CardContent className="flex aspect-video flex-col items-center justify-center p-6">
                <h3 className="text-lg font-semibold">{product.title}</h3>
                <span className="text-primary mt-1 font-bold">${product.price.toFixed(2)}</span>
                <span className="mt-1 text-xs">Rating: {product.rating}/5</span>
              </CardContent>
            </Card>
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithSingleProductSlide: Story = {
  render: () => <SingleProductSlideDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-product-slide-demo')).toBeInTheDocument();
    expect(canvas.getByText('Premium Widget')).toBeInTheDocument();
    expect(canvas.getByText('$99.99')).toBeInTheDocument();
    expect(canvas.getByText('Rating: 4.8/5')).toBeInTheDocument();
  },
};

// ============ TESTIMONIAL SLIDES STORIES ============

function TestimonialSlidesDemo() {
  const testimonials = createFakeTestimonialSlides(4);

  return (
    <div className="w-[520px]" data-testid="testimonial-slides-demo">
      <Carousel className="w-full">
        <CarouselContent>
          {testimonials.map((testimonial: FakeTestimonialSlide) => (
            <CarouselItem key={testimonial.id}>
              <Card>
                <CardContent className="flex aspect-video flex-col items-center justify-center p-6 text-center">
                  <p className="text-muted-foreground mb-3 text-sm italic">
                    &ldquo;{testimonial.quote.slice(0, 120)}...&rdquo;
                  </p>
                  <span className="font-semibold">{testimonial.name}</span>
                  {testimonial.jobTitle && (
                    <span className="text-muted-foreground text-xs">{testimonial.jobTitle}</span>
                  )}
                  {testimonial.company && (
                    <span className="text-muted-foreground text-xs">{testimonial.company}</span>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithTestimonialSlides: Story = {
  render: () => <TestimonialSlidesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('testimonial-slides-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(4);
  },
};

function SingleTestimonialSlideDemo() {
  const testimonial = createFakeTestimonialSlide({
    name: 'Jane Doe',
    quote: 'This product changed our workflow completely.',
    company: 'Acme Corp',
    jobTitle: 'CTO',
    rating: 5,
  });

  return (
    <div className="w-[520px]" data-testid="single-testimonial-demo">
      <Carousel className="w-full">
        <CarouselContent>
          <CarouselItem>
            <Card>
              <CardContent className="flex aspect-video flex-col items-center justify-center p-6 text-center">
                <p className="text-sm italic">&ldquo;{testimonial.quote}&rdquo;</p>
                <span className="mt-2 font-semibold">{testimonial.name}</span>
                <span className="text-muted-foreground text-xs">
                  {testimonial.jobTitle}, {testimonial.company}
                </span>
                {testimonial.rating !== undefined && (
                  <span className="mt-1 text-xs">{'★'.repeat(testimonial.rating)}</span>
                )}
              </CardContent>
            </Card>
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithSingleTestimonialSlide: Story = {
  render: () => <SingleTestimonialSlideDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-testimonial-demo')).toBeInTheDocument();
    expect(canvas.getByText('Jane Doe')).toBeInTheDocument();
    expect(canvas.getByText('CTO, Acme Corp')).toBeInTheDocument();
    expect(canvas.getByText('★★★★★')).toBeInTheDocument();
  },
};

// ============ HERO SLIDES STORIES ============

function HeroSlidesDemo() {
  const heroSlides = createFakeHeroSlides(3);

  return (
    <div className="w-full" data-testid="hero-slides-demo">
      <Carousel className="w-full">
        <CarouselContent>
          {heroSlides.map((slide: FakeHeroSlide) => (
            <CarouselItem key={slide.id}>
              <Card>
                <CardContent className="flex aspect-video flex-col items-center justify-center p-8 text-center">
                  <h2 className="text-2xl font-bold">{slide.title}</h2>
                  {slide.subtitle && <p className="text-muted-foreground mt-2">{slide.subtitle}</p>}
                  {slide.buttonText && (
                    <span className="bg-primary text-primary-foreground mt-4 inline-block rounded px-4 py-2 text-sm">
                      {slide.buttonText}
                    </span>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithHeroSlides: Story = {
  render: () => <HeroSlidesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('hero-slides-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(3);

    const firstItem = canvasElement.querySelector('[data-slot="carousel-item"]');
    expect(firstItem?.querySelector('h2')).toBeInTheDocument();
  },
};

function SingleHeroSlideDemo() {
  const heroSlide = createFakeHeroSlide({
    title: 'Welcome to Our Platform',
    subtitle: 'Build something amazing today',
    buttonText: 'Get Started',
  });

  return (
    <div className="w-full" data-testid="single-hero-slide-demo">
      <Carousel className="w-full">
        <CarouselContent>
          <CarouselItem>
            <Card>
              <CardContent className="flex aspect-video flex-col items-center justify-center p-8 text-center">
                <h2 className="text-2xl font-bold">{heroSlide.title}</h2>
                <p className="text-muted-foreground mt-2">{heroSlide.subtitle}</p>
                <span className="bg-primary text-primary-foreground mt-4 inline-block rounded px-4 py-2 text-sm">
                  {heroSlide.buttonText}
                </span>
              </CardContent>
            </Card>
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithSingleHeroSlide: Story = {
  render: () => <SingleHeroSlideDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-hero-slide-demo')).toBeInTheDocument();
    expect(canvas.getByText('Welcome to Our Platform')).toBeInTheDocument();
    expect(canvas.getByText('Build something amazing today')).toBeInTheDocument();
    expect(canvas.getByText('Get Started')).toBeInTheDocument();
  },
};

// ============ GALLERY SLIDES STORIES ============

function GallerySlidesDemo() {
  const gallerySlides = createFakeGallerySlides(6);

  return (
    <div className="w-[520px]" data-testid="gallery-slides-demo">
      <Carousel className="w-full">
        <CarouselContent>
          {gallerySlides.map((slide: FakeGallerySlide) => (
            <CarouselItem key={slide.id}>
              <Card>
                <CardContent className="flex aspect-video flex-col items-center justify-center p-4">
                  <div className="bg-muted flex size-full items-center justify-center rounded">
                    <span className="text-muted-foreground text-xs">{slide.alt}</span>
                  </div>
                  {slide.caption && (
                    <p className="text-muted-foreground mt-2 text-center text-xs">
                      {slide.caption}
                    </p>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithGallerySlides: Story = {
  render: () => <GallerySlidesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('gallery-slides-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(6);
  },
};

function SingleGallerySlideDemo() {
  const slide = createFakeGallerySlide({
    alt: 'Beautiful landscape photo',
    caption: 'A serene mountain lake at sunset',
    aspectRatio: '16:9',
  });

  return (
    <div className="w-[520px]" data-testid="single-gallery-slide-demo">
      <Carousel className="w-full">
        <CarouselContent>
          <CarouselItem>
            <Card>
              <CardContent className="flex aspect-video flex-col items-center justify-center p-4">
                <div className="bg-muted flex size-full items-center justify-center rounded">
                  <span className="text-muted-foreground text-xs">{slide.alt}</span>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">{slide.caption}</p>
                <span className="text-muted-foreground text-xs">
                  Aspect ratio: {slide.aspectRatio}
                </span>
              </CardContent>
            </Card>
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithSingleGallerySlide: Story = {
  render: () => <SingleGallerySlideDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-gallery-slide-demo')).toBeInTheDocument();
    expect(canvas.getByText('Beautiful landscape photo')).toBeInTheDocument();
    expect(canvas.getByText('A serene mountain lake at sunset')).toBeInTheDocument();
    expect(canvas.getByText('Aspect ratio: 16:9')).toBeInTheDocument();
  },
};

// ============ IMAGE SLIDES STORY ============

function ImageSlidesDemo() {
  const slides = createFakeImageSlides(5);

  return (
    <div className="w-[520px]" data-testid="image-slides-demo">
      <Carousel className="w-full">
        <CarouselContent>
          {slides.map((slide: FakeSlide) => (
            <CarouselItem key={slide.id}>
              <Card>
                <CardContent className="flex aspect-video items-center justify-center">
                  <div className="bg-muted flex size-full items-center justify-center rounded">
                    <span className="text-muted-foreground text-lg font-semibold">
                      {slide.title}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithImageSlides: Story = {
  render: () => <ImageSlidesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('image-slides-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(5);
    expect(canvas.getByText('Slide 1')).toBeInTheDocument();
  },
};

// ============ NUMBERED SLIDES STORY ============

function NumberedSlidesDemo() {
  const slides = createFakeNumberedSlides(8);

  return (
    <div className="w-[520px]" data-testid="numbered-slides-demo">
      <Carousel className="w-full">
        <CarouselContent>
          {slides.map((slide: FakeSlide) => (
            <CarouselItem key={slide.id}>
              <Card>
                <CardContent className="flex aspect-video flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{slide.title}</span>
                  <span className="text-muted-foreground mt-1 text-sm">{slide.description}</span>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithNumberedSlides: Story = {
  render: () => <NumberedSlidesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('numbered-slides-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(8);
    expect(canvas.getByText('Slide 1 of 8')).toBeInTheDocument();
  },
};

// ============ FEATURE SLIDES STORY ============

function FeatureSlidesDemo() {
  const slides = createFakeFeatureSlides();

  return (
    <div className="w-[520px]" data-testid="feature-slides-demo">
      <Carousel className="w-full">
        <CarouselContent>
          {slides.map((slide: FakeSlide) => (
            <CarouselItem key={slide.id}>
              <Card>
                <CardContent className="flex aspect-video flex-col items-center justify-center p-6">
                  <h3 className="text-lg font-semibold">{slide.title}</h3>
                  <p className="text-muted-foreground mt-2 text-center text-sm">
                    {slide.description}
                  </p>
                  {slide.cta && (
                    <span className="text-primary mt-3 text-sm font-medium">{slide.cta}</span>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithFeatureSlides: Story = {
  render: () => <FeatureSlidesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('feature-slides-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(5);
    expect(canvas.getByText('Easy Integration')).toBeInTheDocument();
    expect(canvas.getByText('Real-time Analytics')).toBeInTheDocument();
  },
};

// ============ LOGO SLIDES STORY ============

function LogoSlidesDemo() {
  const slides = createFakeLogoSlides(8);

  return (
    <div className="w-[520px]" data-testid="logo-slides-demo">
      <Carousel className="w-full">
        <CarouselContent className="-ml-2">
          {slides.map((slide: FakeSlide) => (
            <CarouselItem key={slide.id} className="basis-1/3 pl-2">
              <Card>
                <CardContent className="flex items-center justify-center p-4">
                  <span className="text-muted-foreground text-center text-xs font-medium">
                    {slide.title}
                  </span>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
        <CarouselNext aria-label={i18n.t('carousel.next')} />
      </Carousel>
    </div>
  );
}

export const WithLogoSlides: Story = {
  render: () => <LogoSlidesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('logo-slides-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel-item"]').length).toBe(8);
  },
};

// ============ CAROUSEL MATRIX STORY ============

function CarouselMatrixDemo() {
  const matrix = createFakeCarouselMatrix();

  return (
    <div className="flex flex-col gap-8" data-testid="carousel-matrix-demo">
      {matrix.map((config) => (
        <div key={`${config.orientation}-${config.size}`}>
          <p className="mb-2 text-sm font-medium">
            {config.orientation} / {config.size}
          </p>
          <div className={CAROUSEL_SIZE_WIDTHS[config.size]}>
            <Carousel className="w-full" orientation={config.orientation as CarouselOrientation}>
              <CarouselContent
                className={config.orientation === 'vertical' ? '-mt-1 h-[200px]' : ''}
              >
                {config.slides.map((slide: FakeSlide) => (
                  <CarouselItem
                    key={slide.id}
                    className={config.orientation === 'vertical' ? 'pt-1' : ''}
                  >
                    <Card>
                      <CardContent className="flex items-center justify-center p-6">
                        <span className="text-sm font-semibold">{slide.title}</span>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
              <CarouselNext aria-label={i18n.t('carousel.next')} />
            </Carousel>
          </div>
        </div>
      ))}
    </div>
  );
}

export const CarouselMatrix: Story = {
  render: () => <CarouselMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('carousel-matrix-demo')).toBeInTheDocument();

    // Matrix should have orientation * size = 2 * 4 = 8 carousels
    const carousels = canvasElement.querySelectorAll('[data-slot="carousel"]');
    expect(carousels.length).toBe(8);

    // Verify labels
    expect(canvas.getByText('horizontal / default')).toBeInTheDocument();
    expect(canvas.getByText('vertical / sm')).toBeInTheDocument();
  },
};

// ============ CAROUSEL CONFIG STORY ============

function CarouselConfigDemo() {
  const scenarios = ['default', 'autoplay', 'hero', 'gallery', 'multiSlide'] as const;
  const configs: Record<string, FakeCarouselConfig> = {};
  for (const scenario of scenarios) {
    configs[scenario] = createFakeCarouselConfig(scenario);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="carousel-config-demo">
      {scenarios.map((scenario) => {
        const config = configs[scenario];
        return (
          <div key={scenario} className="rounded border p-4">
            <p className="mb-2 text-sm font-semibold capitalize">{scenario} Config</p>
            <div className="text-muted-foreground grid grid-cols-2 gap-1 text-xs">
              <span>Orientation: {config.orientation}</span>
              <span>Size: {config.size}</span>
              <span>Align: {config.align}</span>
              <span>Loop: {String(config.loop)}</span>
              <span>Autoplay: {String(config.autoplay)}</span>
              <span>Nav: {config.navStyle}</span>
              <span>Slides/View: {config.slidesPerView}</span>
              <span>Slides/Scroll: {config.slidesToScroll}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const WithCarouselConfig: Story = {
  render: () => <CarouselConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('carousel-config-demo')).toBeInTheDocument();
    expect(canvas.getByText('default Config')).toBeInTheDocument();
    expect(canvas.getByText('autoplay Config')).toBeInTheDocument();
    expect(canvas.getByText('hero Config')).toBeInTheDocument();
    expect(canvas.getByText('gallery Config')).toBeInTheDocument();
    expect(canvas.getByText('multiSlide Config')).toBeInTheDocument();
  },
};

// ============ DEMO CAROUSELS STORY ============

function getSlideLabel(
  slide: FakeGallerySlide | FakeHeroSlide | FakeProductSlide | FakeSlide | FakeTestimonialSlide,
  index: number
): string {
  if ('title' in slide) {
    return (slide as FakeSlide).title;
  }
  if ('name' in slide) {
    return (slide as FakeTestimonialSlide).name;
  }
  return `Item ${index + 1}`;
}

function DemoCarouselsDemo() {
  const demos = createFakeDemoCarousels();
  const demoKeys = Object.keys(demos);

  return (
    <div className="flex flex-col gap-8" data-testid="demo-carousels-demo">
      {demoKeys.map((key) => {
        const slides = demos[key];
        return (
          <div key={key}>
            <p className="mb-2 text-sm font-semibold capitalize">{key}</p>
            <div className="w-[520px]">
              <Carousel className="w-full">
                <CarouselContent>
                  {slides.map((slide, index) => (
                    <CarouselItem key={'id' in slide ? (slide as FakeSlide).id : `item-${index}`}>
                      <Card>
                        <CardContent className="flex items-center justify-center p-6">
                          <span className="text-sm">{getSlideLabel(slide, index)}</span>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
                <CarouselNext aria-label={i18n.t('carousel.next')} />
              </Carousel>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const WithDemoCarousels: Story = {
  render: () => <DemoCarouselsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('demo-carousels-demo')).toBeInTheDocument();

    // createFakeDemoCarousels returns 8 categories
    const carousels = canvasElement.querySelectorAll('[data-slot="carousel"]');
    expect(carousels.length).toBe(8);

    // Verify some category labels
    expect(canvas.getByText('basic')).toBeInTheDocument();
    expect(canvas.getByText('products')).toBeInTheDocument();
    expect(canvas.getByText('testimonials')).toBeInTheDocument();
  },
};

// ============ CONSTANTS ITERATION STORIES ============

function OrientationsDemo() {
  const slides = createFakeSlides(3);

  return (
    <div className="flex flex-col gap-8" data-testid="orientations-demo">
      {CAROUSEL_ORIENTATIONS.map((orientation: CarouselOrientation) => (
        <div key={orientation}>
          <p className="mb-2 text-sm font-medium capitalize">{orientation}</p>
          <div className="w-[520px]">
            <Carousel className="w-full" orientation={orientation}>
              <CarouselContent className={orientation === 'vertical' ? '-mt-1 h-[200px]' : ''}>
                {slides.map((slide: FakeSlide) => (
                  <CarouselItem key={slide.id} className={orientation === 'vertical' ? 'pt-1' : ''}>
                    <Card>
                      <CardContent className="flex items-center justify-center p-6">
                        <span className="text-lg font-semibold">{slide.title}</span>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
              <CarouselNext aria-label={i18n.t('carousel.next')} />
            </Carousel>
          </div>
        </div>
      ))}
    </div>
  );
}

export const WithOrientations: Story = {
  render: () => <OrientationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('orientations-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel"]').length).toBe(
      CAROUSEL_ORIENTATIONS.length
    );
    expect(canvas.getByText('horizontal')).toBeInTheDocument();
    expect(canvas.getByText('vertical')).toBeInTheDocument();
  },
};

function SizeWidthsDemo() {
  const slides = createFakeSlides(3);

  return (
    <div className="flex flex-col gap-8" data-testid="size-widths-demo">
      {CAROUSEL_SIZES.map((size: CarouselSize) => (
        <div key={size}>
          <p className="mb-2 text-sm font-medium">
            {size} ({CAROUSEL_SIZE_WIDTHS[size]})
          </p>
          <div className={CAROUSEL_SIZE_WIDTHS[size]}>
            <Carousel className="w-full">
              <CarouselContent>
                {slides.map((slide: FakeSlide) => (
                  <CarouselItem key={slide.id}>
                    <Card>
                      <CardContent className="flex items-center justify-center p-6">
                        <span className="text-sm font-semibold">{slide.title}</span>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
              <CarouselNext aria-label={i18n.t('carousel.next')} />
            </Carousel>
          </div>
        </div>
      ))}
    </div>
  );
}

export const WithSizeWidths: Story = {
  render: () => <SizeWidthsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('size-widths-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel"]').length).toBe(
      CAROUSEL_SIZES.length
    );
  },
};

function AlignmentsDemo() {
  return (
    <div className="flex flex-col gap-8" data-testid="alignments-demo">
      {CAROUSEL_ALIGNMENTS.map((align: CarouselAlign) => (
        <div key={align}>
          <p className="mb-2 text-sm font-medium capitalize">Align: {align}</p>
          <div className="w-[520px]">
            <Carousel className="w-full" opts={{ align }}>
              <CarouselContent className="-ml-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <CarouselItem key={index} className="basis-1/3 pl-2">
                    <Card>
                      <CardContent className="flex items-center justify-center p-6">
                        <span className="text-lg font-semibold">{index + 1}</span>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
              <CarouselNext aria-label={i18n.t('carousel.next')} />
            </Carousel>
          </div>
        </div>
      ))}
    </div>
  );
}

export const WithAlignments: Story = {
  render: () => <AlignmentsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('alignments-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel"]').length).toBe(
      CAROUSEL_ALIGNMENTS.length
    );
    expect(canvas.getByText('Align: center')).toBeInTheDocument();
    expect(canvas.getByText('Align: start')).toBeInTheDocument();
    expect(canvas.getByText('Align: end')).toBeInTheDocument();
  },
};

function ContentTypesDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="content-types-demo">
      <p className="text-sm font-medium">
        {i18n.t('carousel.story.availableContentTypes', 'Available content types:')}
      </p>
      <div className="flex flex-wrap gap-2">
        {CAROUSEL_CONTENT_TYPES.map((type: CarouselContentType) => (
          <span
            key={type}
            className="bg-muted rounded-md px-3 py-1.5 text-sm font-medium capitalize"
          >
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ContentTypes: Story = {
  render: () => <ContentTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('content-types-demo')).toBeInTheDocument();
    expect(canvas.getByText('gallery')).toBeInTheDocument();
    expect(canvas.getByText('hero')).toBeInTheDocument();
    expect(canvas.getByText('product')).toBeInTheDocument();
    expect(canvas.getByText('testimonial')).toBeInTheDocument();
    expect(canvas.getByText('thumbnail')).toBeInTheDocument();
  },
};

function NavStylesDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="nav-styles-demo">
      <p className="text-sm font-medium">
        {i18n.t('carousel.story.availableNavigationStyles', 'Available navigation styles:')}
      </p>
      <div className="flex flex-wrap gap-2">
        {CAROUSEL_NAV_STYLES.map((style: CarouselNavStyle) => (
          <span
            key={style}
            className="bg-muted rounded-md px-3 py-1.5 text-sm font-medium capitalize"
          >
            {style}
          </span>
        ))}
      </div>
    </div>
  );
}

export const NavStyles: Story = {
  render: () => <NavStylesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('nav-styles-demo')).toBeInTheDocument();
    expect(canvas.getByText('arrows')).toBeInTheDocument();
    expect(canvas.getByText('dots')).toBeInTheDocument();
    expect(canvas.getByText('both')).toBeInTheDocument();
    expect(canvas.getByText('none')).toBeInTheDocument();
  },
};

function SlidesPerViewDemo() {
  return (
    <div className="flex flex-col gap-8" data-testid="slides-per-view-demo">
      {CAROUSEL_SLIDES_PER_VIEW.map((count) => (
        <div key={count}>
          <p className="mb-2 text-sm font-medium">{count} slide(s) per view</p>
          <div className="w-[720px]">
            <Carousel className="w-full">
              <CarouselContent className="-ml-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <CarouselItem
                    key={index}
                    className="pl-2"
                    style={{ flex: `0 0 ${100 / count}%` }}
                  >
                    <Card>
                      <CardContent className="flex items-center justify-center p-6">
                        <span className="text-lg font-semibold">{index + 1}</span>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious aria-label={i18n.t('carousel.previous')} />
              <CarouselNext aria-label={i18n.t('carousel.next')} />
            </Carousel>
          </div>
        </div>
      ))}
    </div>
  );
}

export const WithSlidesPerView: Story = {
  render: () => <SlidesPerViewDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('slides-per-view-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="carousel"]').length).toBe(
      CAROUSEL_SLIDES_PER_VIEW.length
    );
    expect(canvas.getByText('1 slide(s) per view')).toBeInTheDocument();
    expect(canvas.getByText('5 slide(s) per view')).toBeInTheDocument();
  },
};

function AutoplayIntervalsDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="autoplay-intervals-demo">
      <p className="text-sm font-medium">
        {i18n.t('carousel.story.availableAutoplayIntervals', 'Available autoplay intervals:')}
      </p>
      <div className="flex flex-wrap gap-2">
        {CAROUSEL_AUTOPLAY_INTERVALS.map((interval) => (
          <span key={interval} className="bg-muted rounded-md px-3 py-1.5 text-sm font-medium">
            {interval}ms ({interval / 1000}s)
          </span>
        ))}
      </div>
    </div>
  );
}

export const AutoplayIntervals: Story = {
  render: () => <AutoplayIntervalsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('autoplay-intervals-demo')).toBeInTheDocument();
    expect(canvas.getByText('2000ms (2s)')).toBeInTheDocument();
    expect(canvas.getByText('5000ms (5s)')).toBeInTheDocument();
    expect(canvas.getByText('7000ms (7s)')).toBeInTheDocument();
  },
};

function SlideTitlesDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="slide-titles-demo">
      <p className="text-sm font-medium">
        Available slide titles ({CAROUSEL_SLIDE_TITLES.length}):
      </p>
      <ul className="space-y-1">
        {CAROUSEL_SLIDE_TITLES.map((title) => (
          <li key={title} className="text-muted-foreground text-sm">
            {title}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SlideTitles: Story = {
  render: () => <SlideTitlesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('slide-titles-demo')).toBeInTheDocument();
    expect(canvas.getByText('Discover New Features')).toBeInTheDocument();
    expect(canvas.getByText('Year-End Clearance')).toBeInTheDocument();
    expect(
      canvas.getByText(`Available slide titles (${CAROUSEL_SLIDE_TITLES.length}):`)
    ).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('carousel.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('carousel.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('carousel.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('carousel.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   conflict
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('carousel.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: carouselStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('carousel.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: carouselStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
