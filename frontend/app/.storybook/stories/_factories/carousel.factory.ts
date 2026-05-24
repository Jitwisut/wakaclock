import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Carousel orientation */
export type CarouselOrientation = 'horizontal' | 'vertical';

/** Carousel size variant */
export type CarouselSize = 'default' | 'full' | 'lg' | 'sm';

/** Carousel alignment */
export type CarouselAlign = 'center' | 'end' | 'start';

/** Carousel content type */
export type CarouselContentType = 'gallery' | 'hero' | 'product' | 'testimonial' | 'thumbnail';

/** Carousel navigation style */
export type CarouselNavStyle = 'arrows' | 'both' | 'dots' | 'none';

/** Interface for fake slide data */
export interface FakeSlide {
  /** Alt text for image */
  alt: string;
  /** Call-to-action text */
  cta?: string;
  /** Slide description */
  description: string;
  /** Unique identifier */
  id: string;
  /** Image URL */
  image: string;
  /** Slide title */
  title: string;
}

/** Interface for product carousel slide */
export interface FakeProductSlide extends FakeSlide {
  /** Product category */
  category: string;
  /** Discount percentage */
  discount?: number;
  /** Original price */
  originalPrice?: number;
  /** Current price */
  price: number;
  /** Product rating */
  rating: number;
}

/** Interface for testimonial carousel slide */
export interface FakeTestimonialSlide {
  /** Avatar URL */
  avatar: string;
  /** Company name */
  company?: string;
  /** Unique identifier */
  id: string;
  /** Job title */
  jobTitle?: string;
  /** Person's name */
  name: string;
  /** Testimonial text */
  quote: string;
  /** Star rating (1-5) */
  rating?: number;
}

/** Interface for hero carousel slide */
export interface FakeHeroSlide extends FakeSlide {
  /** Background color/gradient */
  backgroundColor?: string;
  /** Button text */
  buttonText?: string;
  /** Button URL */
  buttonUrl?: string;
  /** Overlay opacity (0-1) */
  overlayOpacity?: number;
  /** Subtitle text */
  subtitle?: string;
}

/** Interface for gallery carousel slide */
export interface FakeGallerySlide {
  /** Alt text */
  alt: string;
  /** Aspect ratio */
  aspectRatio?: string;
  /** Caption text */
  caption?: string;
  /** Unique identifier */
  id: string;
  /** Full image URL */
  image: string;
  /** Thumbnail URL */
  thumbnail: string;
}

/** Interface for carousel configuration */
export interface FakeCarouselConfig {
  /** Slide alignment */
  align: CarouselAlign;
  /** Auto-scroll enabled */
  autoplay: boolean;
  /** Auto-scroll interval (ms) */
  autoplayInterval?: number;
  /** Enable looping */
  loop: boolean;
  /** Navigation style */
  navStyle: CarouselNavStyle;
  /** Carousel orientation */
  orientation: CarouselOrientation;
  /** Carousel size */
  size: CarouselSize;
  /** Slides visible at once */
  slidesPerView: number;
  /** Slides to scroll at once */
  slidesToScroll: number;
}

// ============ CONSTANTS FOR ITERATION ============

/** All carousel orientation options */
export const CAROUSEL_ORIENTATIONS: CarouselOrientation[] = ['horizontal', 'vertical'];

/** All carousel size options */
export const CAROUSEL_SIZES: CarouselSize[] = ['default', 'full', 'lg', 'sm'];

/** All carousel alignment options */
export const CAROUSEL_ALIGNMENTS: CarouselAlign[] = ['center', 'end', 'start'];

/** All carousel content types */
export const CAROUSEL_CONTENT_TYPES: CarouselContentType[] = [
  'gallery',
  'hero',
  'product',
  'testimonial',
  'thumbnail',
];

/** All carousel navigation styles */
export const CAROUSEL_NAV_STYLES: CarouselNavStyle[] = ['arrows', 'both', 'dots', 'none'];

/** Size-based width classes */
export const CAROUSEL_SIZE_WIDTHS: Record<CarouselSize, string> = {
  default: 'w-[520px]',
  full: 'w-full',
  lg: 'w-[720px]',
  sm: 'w-[320px]',
};

/** Common slides per view configurations */
export const CAROUSEL_SLIDES_PER_VIEW = [1, 2, 3, 4, 5];

/** Common autoplay intervals (ms) */
export const CAROUSEL_AUTOPLAY_INTERVALS = [2000, 3000, 4000, 5000, 7000];

/** Common slide titles */
export const CAROUSEL_SLIDE_TITLES = [
  i18n.t('factory.carousel.discoverNewFeatures', 'Discover New Features'),
  i18n.t('factory.carousel.exploreOurCollection', 'Explore Our Collection'),
  i18n.t('factory.carousel.limitedTimeOffer', 'Limited Time Offer'),
  i18n.t('factory.carousel.newArrivals', 'New Arrivals'),
  i18n.t('factory.carousel.shopTheLatestTrends', 'Shop the Latest Trends'),
  i18n.t('factory.carousel.specialAnnouncement', 'Special Announcement'),
  i18n.t('factory.carousel.summerSale', 'Summer Sale'),
  i18n.t('factory.carousel.transformYourExperience', 'Transform Your Experience'),
  i18n.t('factory.carousel.welcomeToOurStore', 'Welcome to Our Store'),
  i18n.t('factory.carousel.yearendClearance', 'Year-End Clearance'),
];

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake slide
 * @param overrides - Optional partial overrides
 * @returns A fake slide
 */
export function createFakeSlide(overrides?: Partial<FakeSlide>): FakeSlide {
  const title = overrides?.title ?? faker.helpers.arrayElement(CAROUSEL_SLIDE_TITLES);
  return {
    id: faker.string.uuid(),
    image: faker.image.urlPicsumPhotos({ width: 1200, height: 600 }),
    title,
    description: faker.lorem.paragraph(),
    alt: i18n.t('factory.carousel.imageForTitle', 'Image for {{title}}', { title }),
    cta: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.carousel.learnMore', 'Learn More'),
          i18n.t('factory.carousel.shopNow', 'Shop Now'),
          i18n.t('factory.carousel.getStarted', 'Get Started'),
        ]),
      {
        probability: 0.5,
      }
    ),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake slides
 * @param count - Number of slides to generate
 * @returns Array of fake slides
 */
export function createFakeSlides(count: number): FakeSlide[] {
  return Array.from({ length: count }, () => createFakeSlide());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a product carousel slide
 * @param overrides - Optional overrides
 * @returns A product slide
 */
export function createFakeProductSlide(overrides?: Partial<FakeProductSlide>): FakeProductSlide {
  const originalPrice = faker.number.float({ min: 20, max: 500, fractionDigits: 2 });
  const hasDiscount = faker.datatype.boolean({ probability: 0.4 });
  const discount = hasDiscount ? faker.number.int({ min: 10, max: 50 }) : undefined;
  const price = discount ? originalPrice * (1 - discount / 100) : originalPrice;

  return {
    ...createFakeSlide(),
    title: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    image: faker.image.urlPicsumPhotos({ width: 600, height: 600 }),
    category: faker.commerce.department(),
    price: Number(price.toFixed(2)),
    originalPrice: hasDiscount ? originalPrice : undefined,
    discount,
    rating: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
    ...overrides,
  };
}

/**
 * Creates multiple product slides
 * @param count - Number of slides
 * @returns Array of product slides
 */
export function createFakeProductSlides(count: number): FakeProductSlide[] {
  return Array.from({ length: count }, () => createFakeProductSlide());
}

/**
 * Creates a testimonial slide
 * @param overrides - Optional overrides
 * @returns A testimonial slide
 */
export function createFakeTestimonialSlide(
  overrides?: Partial<FakeTestimonialSlide>
): FakeTestimonialSlide {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    quote: faker.lorem.paragraphs({ min: 1, max: 2 }),
    avatar: faker.image.avatar(),
    jobTitle: faker.person.jobTitle(),
    company: faker.company.name(),
    rating: faker.number.int({ min: 4, max: 5 }),
    ...overrides,
  };
}

/**
 * Creates multiple testimonial slides
 * @param count - Number of slides
 * @returns Array of testimonial slides
 */
export function createFakeTestimonialSlides(count: number): FakeTestimonialSlide[] {
  return Array.from({ length: count }, () => createFakeTestimonialSlide());
}

/**
 * Creates a hero carousel slide
 * @param overrides - Optional overrides
 * @returns A hero slide
 */
export function createFakeHeroSlide(overrides?: Partial<FakeHeroSlide>): FakeHeroSlide {
  return {
    ...createFakeSlide(),
    image: faker.image.urlPicsumPhotos({ width: 1920, height: 800 }),
    subtitle: faker.lorem.sentence(),
    buttonText: faker.helpers.arrayElement([
      i18n.t('factory.carousel.shopNow', 'Shop Now'),
      i18n.t('factory.carousel.learnMore', 'Learn More'),
      i18n.t('factory.carousel.getStarted', 'Get Started'),
      i18n.t('factory.carousel.viewCollection', 'View Collection'),
    ]),
    buttonUrl: faker.internet.url(),
    overlayOpacity: faker.number.float({ min: 0.2, max: 0.6, fractionDigits: 1 }),
    backgroundColor: faker.helpers.maybe(() => faker.color.rgb(), { probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates multiple hero slides
 * @param count - Number of slides
 * @returns Array of hero slides
 */
export function createFakeHeroSlides(count: number): FakeHeroSlide[] {
  return Array.from({ length: count }, () => createFakeHeroSlide());
}

/**
 * Creates a gallery carousel slide
 * @param overrides - Optional overrides
 * @returns A gallery slide
 */
export function createFakeGallerySlide(overrides?: Partial<FakeGallerySlide>): FakeGallerySlide {
  const aspectRatios = ['1:1', '4:3', '16:9', '3:2'];

  return {
    id: faker.string.uuid(),
    image: faker.image.urlPicsumPhotos({ width: 1200, height: 800 }),
    thumbnail: faker.image.urlPicsumPhotos({ width: 150, height: 100 }),
    alt: faker.lorem.sentence({ min: 2, max: 5 }),
    caption: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),
    aspectRatio: faker.helpers.arrayElement(aspectRatios),
    ...overrides,
  };
}

/**
 * Creates multiple gallery slides
 * @param count - Number of slides
 * @returns Array of gallery slides
 */
export function createFakeGallerySlides(count: number): FakeGallerySlide[] {
  return Array.from({ length: count }, () => createFakeGallerySlide());
}

/**
 * Creates a basic image carousel (no text overlay)
 * @param count - Number of slides
 * @returns Array of simple image slides
 */
export function createFakeImageSlides(count: number): FakeSlide[] {
  return Array.from({ length: count }, (_, index) => ({
    id: faker.string.uuid(),
    image: faker.image.urlPicsumPhotos({ width: 800, height: 450 }),
    title: i18n.t('factory.carousel.slideTitle', 'Slide {{number}}', { number: index + 1 }),
    description: '',
    alt: i18n.t('factory.carousel.slideAlt', 'Slide {{number}}', { number: index + 1 }),
  }));
}

/**
 * Creates carousel with numbered slides (for demos)
 * @param count - Number of slides
 * @returns Array of numbered slides
 */
export function createFakeNumberedSlides(count: number): FakeSlide[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `slide-${index + 1}`,
    image: '',
    title: `${index + 1}`,
    description: i18n.t('factory.carousel.slideDescription', 'Slide {{current}} of {{total}}', {
      current: index + 1,
      total: count,
    }),
    alt: i18n.t('factory.carousel.slideAlt', 'Slide {{number}}', { number: index + 1 }),
  }));
}

/**
 * Creates a feature showcase carousel
 * @param features - Feature names (or generates random ones)
 * @returns Array of feature slides
 */
export function createFakeFeatureSlides(features?: string[]): FakeSlide[] {
  const defaultFeatures = [
    i18n.t('factory.carousel.easyIntegration', 'Easy Integration'),
    i18n.t('factory.carousel.realtimeAnalytics', 'Real-time Analytics'),
    i18n.t('factory.carousel.secureByDefault', 'Secure by Default'),
    i18n.t('factory.carousel.scalableArchitecture', 'Scalable Architecture'),
    i18n.t('factory.carousel.twentyFourSevenSupport', '24/7 Support'),
  ];

  const featureList = features ?? defaultFeatures;

  return featureList.map((feature, index) => ({
    id: `feature-${index}`,
    image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
    title: feature,
    description: faker.lorem.paragraph(),
    alt: i18n.t('factory.carousel.featureAlt', 'Feature: {{feature}}', { feature }),
    cta: i18n.t('factory.carousel.learnMore', 'Learn More'),
  }));
}

/**
 * Creates a brand logo carousel
 * @param count - Number of logos
 * @returns Array of logo slides
 */
export function createFakeLogoSlides(count: number): FakeSlide[] {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    image: faker.image.urlPicsumPhotos({ width: 200, height: 100 }),
    title: faker.company.name(),
    description: '',
    alt: i18n.t('factory.carousel.companyLogo', '{{company}} logo', {
      company: faker.company.name(),
    }),
  }));
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of carousels for visual regression testing
 * across orientation and size combinations
 * @returns Array of carousel configurations
 */
export function createFakeCarouselMatrix(): Array<{
  orientation: CarouselOrientation;
  size: CarouselSize;
  slides: FakeSlide[];
}> {
  const matrix: Array<{
    orientation: CarouselOrientation;
    size: CarouselSize;
    slides: FakeSlide[];
  }> = [];

  for (const orientation of CAROUSEL_ORIENTATIONS) {
    for (const size of CAROUSEL_SIZES) {
      matrix.push({
        orientation,
        size,
        slides: createFakeSlides(3),
      });
    }
  }

  return matrix;
}

/**
 * Creates carousel configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Carousel configuration
 */
export function createFakeCarouselConfig(
  scenario: 'autoplay' | 'default' | 'gallery' | 'hero' | 'multiSlide' = 'default'
): FakeCarouselConfig {
  const configs: Record<string, FakeCarouselConfig> = {
    autoplay: {
      orientation: 'horizontal',
      size: 'default',
      align: 'start',
      loop: true,
      autoplay: true,
      autoplayInterval: 4000,
      slidesPerView: 1,
      slidesToScroll: 1,
      navStyle: 'dots',
    },
    default: {
      orientation: 'horizontal',
      size: 'default',
      align: 'start',
      loop: false,
      autoplay: false,
      slidesPerView: 1,
      slidesToScroll: 1,
      navStyle: 'arrows',
    },
    gallery: {
      orientation: 'horizontal',
      size: 'lg',
      align: 'center',
      loop: true,
      autoplay: false,
      slidesPerView: 1,
      slidesToScroll: 1,
      navStyle: 'both',
    },
    hero: {
      orientation: 'horizontal',
      size: 'full',
      align: 'start',
      loop: true,
      autoplay: true,
      autoplayInterval: 5000,
      slidesPerView: 1,
      slidesToScroll: 1,
      navStyle: 'dots',
    },
    multiSlide: {
      orientation: 'horizontal',
      size: 'lg',
      align: 'start',
      loop: false,
      autoplay: false,
      slidesPerView: 3,
      slidesToScroll: 1,
      navStyle: 'arrows',
    },
  };

  return configs[scenario];
}

/**
 * Creates a set of demo carousels for showcase
 * @returns Object with different carousel types and their slides
 */
export function createFakeDemoCarousels(): Record<
  string,
  FakeGallerySlide[] | FakeHeroSlide[] | FakeProductSlide[] | FakeSlide[] | FakeTestimonialSlide[]
> {
  return {
    basic: createFakeSlides(5),
    features: createFakeFeatureSlides(),
    gallery: createFakeGallerySlides(8),
    hero: createFakeHeroSlides(3),
    logos: createFakeLogoSlides(10),
    numbered: createFakeNumberedSlides(5),
    products: createFakeProductSlides(6),
    testimonials: createFakeTestimonialSlides(4),
  };
}
