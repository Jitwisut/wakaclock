import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Aspect ratio preset name */
export type AspectRatioPreset =
  | 'cinematic'
  | 'classicTv'
  | 'photo35mm'
  | 'portrait'
  | 'square'
  | 'ultrawide'
  | 'widescreen';

/** Aspect ratio size variant for layout */
export type AspectRatioSize = 'fullWidth' | 'large' | 'medium' | 'small' | 'thumbnail';

/** Content type that can be displayed in aspect ratio container */
export type AspectRatioContentType = 'embed' | 'gradient' | 'image' | 'placeholder' | 'video';

/** Interface for fake aspect ratio data */
export interface FakeAspectRatio {
  /** Content type */
  contentType: AspectRatioContentType;
  /** Description of the content */
  description: string;
  /** Unique identifier */
  id: string;
  /** Label for display */
  label: string;
  /** Preset name */
  preset: AspectRatioPreset;
  /** Numeric ratio value */
  ratio: number;
  /** Width in pixels (for sizing) */
  width?: number;
}

/** Interface for aspect ratio configuration */
export interface FakeAspectRatioConfig {
  /** Content type */
  contentType: AspectRatioContentType;
  /** Whether to apply border radius */
  rounded: boolean;
  /** Size preset */
  size: AspectRatioSize;
}

// ============ CONSTANTS FOR ITERATION ============

/** All aspect ratio presets */
export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  'cinematic',
  'classicTv',
  'photo35mm',
  'portrait',
  'square',
  'ultrawide',
  'widescreen',
];

/** All aspect ratio sizes */
export const ASPECT_RATIO_SIZES: AspectRatioSize[] = [
  'fullWidth',
  'large',
  'medium',
  'small',
  'thumbnail',
];

/** All content types */
export const ASPECT_RATIO_CONTENT_TYPES: AspectRatioContentType[] = [
  'embed',
  'gradient',
  'image',
  'placeholder',
  'video',
];

/** Preset ratio values */
export const ASPECT_RATIO_VALUES: Record<AspectRatioPreset, number> = {
  cinematic: 2.35, // 21:9 approximation
  classicTv: 4 / 3,
  photo35mm: 3 / 2,
  portrait: 9 / 16,
  square: 1,
  ultrawide: 21 / 9,
  widescreen: 16 / 9,
};

/** Preset labels */
export const ASPECT_RATIO_LABELS: Record<AspectRatioPreset, string> = {
  cinematic: i18n.t('factory.aspectRatio.labelCinematic', '2.35:1 - Cinematic'),
  classicTv: i18n.t('factory.aspectRatio.labelClassicTv', '4:3 - Classic TV'),
  photo35mm: i18n.t('factory.aspectRatio.labelPhoto35mm', '3:2 - 35mm Photo'),
  portrait: i18n.t('factory.aspectRatio.labelPortrait', '9:16 - Portrait'),
  square: i18n.t('factory.aspectRatio.labelSquare', '1:1 - Square'),
  ultrawide: i18n.t('factory.aspectRatio.labelUltrawide', '21:9 - Ultrawide'),
  widescreen: i18n.t('factory.aspectRatio.labelWidescreen', '16:9 - Widescreen'),
};

/** Size width values in pixels */
export const ASPECT_RATIO_SIZE_WIDTHS: Record<AspectRatioSize, 'full' | number> = {
  fullWidth: 'full',
  large: 600,
  medium: 400,
  small: 240,
  thumbnail: 120,
};

/** Common aspect ratio use cases */
export const ASPECT_RATIO_USE_CASES = [
  {
    preset: 'widescreen' as const,
    useCase: i18n.t('factory.aspectRatio.useCaseWidescreen', 'YouTube videos, presentations'),
  },
  {
    preset: 'square' as const,
    useCase: i18n.t('factory.aspectRatio.useCaseSquare', 'Instagram posts, avatars'),
  },
  {
    preset: 'classicTv' as const,
    useCase: i18n.t('factory.aspectRatio.useCaseClassicTv', 'Older TV content, presentations'),
  },
  {
    preset: 'photo35mm' as const,
    useCase: i18n.t(
      'factory.aspectRatio.useCasePhoto35mm',
      'DSLR photos, professional photography'
    ),
  },
  {
    preset: 'ultrawide' as const,
    useCase: i18n.t('factory.aspectRatio.useCaseUltrawide', 'Cinema displays, ultrawide monitors'),
  },
  {
    preset: 'portrait' as const,
    useCase: i18n.t('factory.aspectRatio.useCasePortrait', 'Mobile stories, TikTok, Reels'),
  },
  {
    preset: 'cinematic' as const,
    useCase: i18n.t('factory.aspectRatio.useCaseCinematic', 'Movie trailers, film content'),
  },
];

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake aspect ratio item
 * @param overrides - Optional partial overrides for the generated item
 * @returns A fake aspect ratio item
 */
export function createFakeAspectRatio(overrides?: Partial<FakeAspectRatio>): FakeAspectRatio {
  const preset = faker.helpers.arrayElement(ASPECT_RATIO_PRESETS);

  return {
    id: faker.string.uuid(),
    preset,
    ratio: ASPECT_RATIO_VALUES[preset],
    label: ASPECT_RATIO_LABELS[preset],
    description:
      ASPECT_RATIO_USE_CASES.find((u) => u.preset === preset)?.useCase ??
      i18n.t('factory.aspectRatio.generalMediaContent', 'General media content'),
    contentType: faker.helpers.arrayElement(ASPECT_RATIO_CONTENT_TYPES),
    width: faker.helpers.maybe(() => faker.helpers.arrayElement([120, 240, 400, 600, 800]), {
      probability: 0.7,
    }),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake aspect ratio items
 * @param count - Number of items to generate
 * @returns Array of fake aspect ratio items
 */
export function createFakeAspectRatios(count: number): FakeAspectRatio[] {
  return Array.from({ length: count }, () => createFakeAspectRatio());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a widescreen (16:9) aspect ratio item
 * @returns A widescreen aspect ratio item
 */
export function createFakeWidescreenAspectRatio(): FakeAspectRatio {
  return createFakeAspectRatio({
    preset: 'widescreen',
    ratio: ASPECT_RATIO_VALUES.widescreen,
    label: ASPECT_RATIO_LABELS.widescreen,
    description: i18n.t(
      'factory.aspectRatio.standardWidescreenFormatForVideos',
      'Standard widescreen format for videos and presentations'
    ),
  });
}

/**
 * Creates a square (1:1) aspect ratio item
 * @returns A square aspect ratio item
 */
export function createFakeSquareAspectRatio(): FakeAspectRatio {
  return createFakeAspectRatio({
    preset: 'square',
    ratio: ASPECT_RATIO_VALUES.square,
    label: ASPECT_RATIO_LABELS.square,
    description: i18n.t(
      'factory.aspectRatio.perfectForAvatarsInstagramPosts',
      'Perfect for avatars, Instagram posts, and album covers'
    ),
  });
}

/**
 * Creates a portrait (9:16) aspect ratio item
 * @returns A portrait aspect ratio item
 */
export function createFakePortraitAspectRatio(): FakeAspectRatio {
  return createFakeAspectRatio({
    preset: 'portrait',
    ratio: ASPECT_RATIO_VALUES.portrait,
    label: ASPECT_RATIO_LABELS.portrait,
    description: i18n.t(
      'factory.aspectRatio.idealForMobileStoriesTiktok',
      'Ideal for mobile stories, TikTok, and Instagram Reels'
    ),
  });
}

/**
 * Creates an ultrawide (21:9) aspect ratio item
 * @returns An ultrawide aspect ratio item
 */
export function createFakeUltrawideAspectRatio(): FakeAspectRatio {
  return createFakeAspectRatio({
    preset: 'ultrawide',
    ratio: ASPECT_RATIO_VALUES.ultrawide,
    label: ASPECT_RATIO_LABELS.ultrawide,
    description: i18n.t(
      'factory.aspectRatio.greatForCinematicContentAnd',
      'Great for cinematic content and ultrawide displays'
    ),
  });
}

/**
 * Creates aspect ratio items for all presets
 * @returns Array with one item for each preset
 */
export function createFakeAspectRatiosByPreset(): FakeAspectRatio[] {
  return ASPECT_RATIO_PRESETS.map((preset) => ({
    id: `preset-${preset}`,
    preset,
    ratio: ASPECT_RATIO_VALUES[preset],
    label: ASPECT_RATIO_LABELS[preset],
    description:
      ASPECT_RATIO_USE_CASES.find((u) => u.preset === preset)?.useCase ??
      i18n.t('factory.aspectRatio.mediaContent', 'Media content'),
    contentType: 'placeholder' as AspectRatioContentType,
  }));
}

/**
 * Creates an image gallery with various aspect ratios
 * @param count - Number of images to generate
 * @returns Array of image aspect ratio items
 */
export function createFakeImageGallery(count = 6): FakeAspectRatio[] {
  return Array.from({ length: count }, (_, i) => {
    const presets: AspectRatioPreset[] = ['widescreen', 'square', 'photo35mm', 'portrait'];
    const preset = presets[i % presets.length];

    return {
      id: `gallery-${String(i + 1)}`,
      preset,
      ratio: ASPECT_RATIO_VALUES[preset],
      label: i18n.t('factory.aspectRatio.imageLabel', 'Image {{number}}', {
        number: String(i + 1),
      }),
      description: faker.lorem.sentence(),
      contentType: 'image' as AspectRatioContentType,
      width: faker.helpers.arrayElement([240, 300, 400]),
    };
  });
}

/**
 * Creates a video player aspect ratio
 * @param preset - Optional preset (defaults to widescreen)
 * @returns A video aspect ratio item
 */
export function createFakeVideoAspectRatio(
  preset: AspectRatioPreset = 'widescreen'
): FakeAspectRatio {
  return createFakeAspectRatio({
    preset,
    ratio: ASPECT_RATIO_VALUES[preset],
    label: i18n.t('factory.aspectRatio.videoPlayer', 'Video Player'),
    description: i18n.t('factory.aspectRatio.videoContentContainer', 'Video content container'),
    contentType: 'video',
    width: 640,
  });
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of aspect ratios for visual regression testing
 * across all preset and size combinations
 * @returns 2D array of aspect ratios [preset][size]
 */
export function createFakeAspectRatioMatrix(): FakeAspectRatio[][] {
  return ASPECT_RATIO_PRESETS.map((preset) =>
    ASPECT_RATIO_SIZES.map((size) => {
      const width = ASPECT_RATIO_SIZE_WIDTHS[size];
      return {
        id: `${preset}-${size}`,
        preset,
        ratio: ASPECT_RATIO_VALUES[preset],
        label: i18n.t('factory.aspectRatio.labelWithSize', '{{label}} - {{size}}', {
          label: ASPECT_RATIO_LABELS[preset],
          size,
        }),
        description: i18n.t(
          'factory.aspectRatio.presetSizeDescription',
          'A {{preset}} aspect ratio at {{size}} size.',
          { preset, size }
        ),
        contentType: 'placeholder' as AspectRatioContentType,
        width: width === 'full' ? undefined : width,
      };
    })
  );
}

/**
 * Creates aspect ratio configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Aspect ratio configuration
 */
export function createFakeAspectRatioConfig(
  scenario: 'default' | 'image' | 'rounded' | 'video' = 'default'
): FakeAspectRatioConfig {
  const configs: Record<string, FakeAspectRatioConfig> = {
    default: {
      size: 'medium',
      contentType: 'placeholder',
      rounded: false,
    },
    image: {
      size: 'medium',
      contentType: 'image',
      rounded: true,
    },
    video: {
      size: 'large',
      contentType: 'video',
      rounded: true,
    },
    rounded: {
      size: 'medium',
      contentType: 'placeholder',
      rounded: true,
    },
  };

  return configs[scenario];
}
