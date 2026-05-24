import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// REEL FACTORY
// ============================================================================
// Comprehensive test data factories for the Reel component (TikTok-style
// video/image carousel). Follows the Button factory pattern with type exports,
// constants, and specialized factories for different reel configurations.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Reel item media type
 * @description The type of media content in the reel
 */
export type ReelMediaType = 'image' | 'video';

/**
 * Reel playback state
 * @description The current playback state
 */
export type ReelPlaybackState = 'buffering' | 'ended' | 'paused' | 'playing';

/**
 * Reel aspect ratio
 * @description Common aspect ratios for reel content
 */
export type ReelAspectRatio = '1:1' | '16:9' | '4:3' | '4:5' | '9:16';

/**
 * Reel content category
 * @description Categories for reel content
 */
export type ReelCategory =
  | 'comedy'
  | 'cooking'
  | 'education'
  | 'entertainment'
  | 'fitness'
  | 'gaming'
  | 'music'
  | 'news'
  | 'sports'
  | 'travel';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All media types
 */
export const REEL_MEDIA_TYPES: ReelMediaType[] = ['video', 'image'];

/**
 * All playback states
 */
export const REEL_PLAYBACK_STATES: ReelPlaybackState[] = [
  'playing',
  'paused',
  'buffering',
  'ended',
];

/**
 * All aspect ratios
 */
export const REEL_ASPECT_RATIOS: ReelAspectRatio[] = ['9:16', '16:9', '4:5', '1:1', '4:3'];

/**
 * All content categories
 */
export const REEL_CATEGORIES: ReelCategory[] = [
  'entertainment',
  'music',
  'comedy',
  'education',
  'fitness',
  'cooking',
  'travel',
  'gaming',
  'sports',
  'news',
];

/**
 * Common reel durations in seconds
 */
export const REEL_DURATIONS = [5, 10, 15, 30, 60];

/**
 * Default accessibility labels
 */
export const DEFAULT_REEL_LABELS = {
  previous: i18n.t('factory.reel.previous', 'Previous'),
  next: i18n.t('factory.reel.next', 'Next'),
  play: i18n.t('factory.reel.play', 'Play'),
  pause: i18n.t('factory.reel.pause', 'Pause'),
  mute: i18n.t('factory.reel.mute', 'Mute'),
  unmute: i18n.t('factory.reel.unmute', 'Unmute'),
};

/**
 * Sample usernames
 */
const USERNAMES = [
  'creative_soul',
  'wanderlust_diaries',
  'fit_life_guru',
  'chef_extraordinaire',
  'tech_explorer',
  'music_vibes',
  'comedy_central',
  'travel_tales',
  'gaming_pro',
  'daily_news',
];

/**
 * Sample titles
 */
const TITLES = [
  i18n.t('factory.reel.checkThisOut', 'Check this out!'),
  i18n.t('factory.reel.waitForIt', 'Wait for it...'),
  i18n.t('factory.reel.youWontBelieveThis', "You won't believe this!"),
  i18n.t('factory.reel.tutorialTime', 'Tutorial time!'),
  i18n.t('factory.reel.dayInMyLife', 'Day in my life'),
  i18n.t('factory.reel.quickTip', 'Quick tip'),
  i18n.t('factory.reel.behindTheScenes', 'Behind the scenes'),
  i18n.t('factory.reel.newRecipeAlert', 'New recipe alert'),
  i18n.t('factory.reel.workoutMotivation', 'Workout motivation'),
  i18n.t('factory.reel.travelVlog', 'Travel vlog'),
];

/**
 * Sample descriptions
 */
const DESCRIPTIONS = [
  i18n.t('factory.reel.dropALikeIfYou', 'Drop a like if you agree! #viral #fyp'),
  i18n.t('factory.reel.followForMoreContentLike', 'Follow for more content like this!'),
  i18n.t('factory.reel.tagSomeoneWhoNeedsTo', 'Tag someone who needs to see this'),
  i18n.t('factory.reel.saveThisForLater', 'Save this for later!'),
  i18n.t('factory.reel.whatDoYouThinkComment', 'What do you think? Comment below!'),
  i18n.t('factory.reel.part2ComingSoon', 'Part 2 coming soon...'),
  i18n.t('factory.reel.linkInBioForMore', 'Link in bio for more'),
  i18n.t('factory.reel.shareWithYourFriends', 'Share with your friends!'),
  i18n.t('factory.reel.dontMissOutOnThis', "Don't miss out on this!"),
  i18n.t('factory.reel.storyTimeInTheComments', 'Story time in the comments!'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Reel item data (matches component's ReelItem type)
 */
export interface FakeReelItem {
  /** Alt text for accessibility */
  alt?: string;
  /** User avatar URL */
  avatar: string;
  /** Item description/caption */
  description?: string;
  /** Duration in seconds */
  duration: number;
  /** Unique identifier */
  id: number | string;
  /** Whether the item has been viewed */
  isRead: boolean;
  /** Media source URL */
  src: string;
  /** Item title */
  title?: string;
  /** Media type */
  type: ReelMediaType;
  /** Username of creator */
  username: string;
}

/**
 * Extended reel item with engagement metrics
 */
export interface FakeReelItemWithMetrics extends FakeReelItem {
  /** Number of comments */
  commentCount: number;
  /** Whether current user has liked */
  isLiked: boolean;
  /** Whether current user has saved */
  isSaved: boolean;
  /** Number of likes */
  likeCount: number;
  /** Number of saves/bookmarks */
  saveCount: number;
  /** Number of shares */
  shareCount: number;
  /** Number of views */
  viewCount: number;
}

/**
 * Reel accessibility labels
 */
export interface FakeReelLabels {
  /** Mute button label */
  mute: string;
  /** Next button label */
  next: string;
  /** Pause button label */
  pause: string;
  /** Play button label */
  play: string;
  /** Previous button label */
  previous: string;
  /** Unmute button label */
  unmute: string;
}

/**
 * Complete reel configuration
 */
export interface FakeReel {
  /** Whether to autoplay */
  autoPlay: boolean;
  /** Current item index */
  currentIndex: number;
  /** Unique identifier */
  id: string;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Whether currently playing */
  isPlaying: boolean;
  /** Reel items/slides */
  items: FakeReelItem[];
  /** Accessibility labels */
  labels: FakeReelLabels;
  /** Current progress (0-100) */
  progress: number;
}

/**
 * Reel user/creator info
 */
export interface FakeReelUser {
  /** User avatar URL */
  avatar: string;
  /** Follower count */
  followers: number;
  /** User ID */
  id: string;
  /** Whether current user follows them */
  isFollowing: boolean;
  /** Whether account is verified */
  isVerified: boolean;
  /** Display name */
  name: string;
  /** Username handle */
  username: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get placeholder video URL
 */
function getPlaceholderVideoUrl(): string {
  // Using sample video placeholders
  const videos = [
    'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
    'https://www.w3schools.com/html/mov_bbb.mp4',
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  ];
  return faker.helpers.arrayElement(videos);
}

/**
 * Get placeholder image URL
 */
function getPlaceholderImageUrl(): string {
  return faker.image.urlPicsumPhotos({ width: 1080, height: 1920 });
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake reel item
 * @param overrides - Optional property overrides
 * @returns A fake reel item
 */
export function createFakeReelItem(overrides?: Partial<FakeReelItem>): FakeReelItem {
  const type = overrides?.type ?? faker.helpers.arrayElement(REEL_MEDIA_TYPES);
  const isVideo = type === 'video';

  return {
    id: faker.string.uuid(),
    type,
    username: faker.helpers.arrayElement(USERNAMES),
    avatar: faker.image.avatar(),
    src: isVideo ? getPlaceholderVideoUrl() : getPlaceholderImageUrl(),
    duration: faker.helpers.arrayElement(REEL_DURATIONS),
    alt: i18n.t('factory.reel.contentBy', '{{type}} content by {{name}}', {
      type:
        type === 'video'
          ? i18n.t('factory.reel.video', 'Video')
          : i18n.t('factory.reel.image', 'Image'),
      name: faker.person.firstName(),
    }),
    title: faker.helpers.maybe(() => faker.helpers.arrayElement(TITLES), { probability: 0.7 }),
    description: faker.helpers.maybe(() => faker.helpers.arrayElement(DESCRIPTIONS), {
      probability: 0.8,
    }),
    isRead: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake reel items
 * @param count - Number of items to create
 * @param overrides - Optional property overrides
 * @returns Array of fake reel items
 */
export function createFakeReelItems(
  count: number,
  overrides?: Partial<FakeReelItem>
): FakeReelItem[] {
  return Array.from({ length: count }, () => createFakeReelItem(overrides));
}

/**
 * Creates a fake reel item with engagement metrics
 * @param overrides - Optional property overrides
 * @returns A fake reel item with metrics
 */
export function createFakeReelItemWithMetrics(
  overrides?: Partial<FakeReelItemWithMetrics>
): FakeReelItemWithMetrics {
  const baseItem = createFakeReelItem(overrides);

  return {
    ...baseItem,
    viewCount: faker.number.int({ min: 1000, max: 10_000_000 }),
    likeCount: faker.number.int({ min: 100, max: 500_000 }),
    commentCount: faker.number.int({ min: 10, max: 50_000 }),
    shareCount: faker.number.int({ min: 5, max: 10_000 }),
    saveCount: faker.number.int({ min: 10, max: 20_000 }),
    isLiked: faker.datatype.boolean({ probability: 0.2 }),
    isSaved: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates fake accessibility labels
 * @param overrides - Optional property overrides
 * @returns Fake reel labels
 */
export function createFakeReelLabels(overrides?: Partial<FakeReelLabels>): FakeReelLabels {
  return {
    ...DEFAULT_REEL_LABELS,
    ...overrides,
  };
}

/**
 * Creates a fake reel user/creator
 * @param overrides - Optional property overrides
 * @returns A fake reel user
 */
export function createFakeReelUser(overrides?: Partial<FakeReelUser>): FakeReelUser {
  return {
    id: faker.string.uuid(),
    username: faker.helpers.arrayElement(USERNAMES),
    name: faker.person.fullName(),
    avatar: faker.image.avatar(),
    followers: faker.number.int({ min: 1000, max: 10_000_000 }),
    isVerified: faker.datatype.boolean({ probability: 0.2 }),
    isFollowing: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates a complete fake reel configuration
 * @param itemCount - Number of reel items
 * @param overrides - Optional property overrides
 * @returns A fake reel configuration
 */
export function createFakeReel(itemCount: number = 5, overrides?: Partial<FakeReel>): FakeReel {
  const items = overrides?.items ?? createFakeReelItems(itemCount);

  return {
    id: faker.string.uuid(),
    items,
    currentIndex: 0,
    isPlaying: true,
    isMuted: true,
    autoPlay: true,
    progress: 0,
    labels: createFakeReelLabels(),
    ...overrides,
  };
}

/**
 * Creates multiple fake reel configurations
 * @param count - Number of reels to create
 * @param itemsPerReel - Items per reel
 * @param overrides - Optional property overrides
 * @returns Array of fake reel configurations
 */
export function createFakeReels(
  count: number,
  itemsPerReel: number = 5,
  overrides?: Partial<FakeReel>
): FakeReel[] {
  return Array.from({ length: count }, () => createFakeReel(itemsPerReel, overrides));
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a video-only reel
 * @param itemCount - Number of video items
 * @returns A video-only reel configuration
 */
export function createFakeVideoReel(itemCount: number = 5): FakeReel {
  return createFakeReel(itemCount, {
    items: createFakeReelItems(itemCount, { type: 'video' }),
  });
}

/**
 * Creates an image-only reel (stories style)
 * @param itemCount - Number of image items
 * @returns An image-only reel configuration
 */
export function createFakeImageReel(itemCount: number = 5): FakeReel {
  return createFakeReel(itemCount, {
    items: createFakeReelItems(itemCount, { type: 'image' }),
  });
}

/**
 * Creates a reel in playing state
 * @returns A reel that is currently playing
 */
export function createFakePlayingReel(): FakeReel {
  return createFakeReel(5, {
    isPlaying: true,
    progress: faker.number.int({ min: 10, max: 80 }),
  });
}

/**
 * Creates a reel in paused state
 * @returns A paused reel configuration
 */
export function createFakePausedReel(): FakeReel {
  return createFakeReel(5, {
    isPlaying: false,
    progress: faker.number.int({ min: 20, max: 60 }),
  });
}

/**
 * Creates a reel with sound enabled
 * @returns A reel with audio unmuted
 */
export function createFakeUnmutedReel(): FakeReel {
  return createFakeReel(5, {
    isMuted: false,
  });
}

/**
 * Creates a reel at a specific index
 * @param index - The index to set
 * @param totalItems - Total number of items
 * @returns A reel at the specified index
 */
export function createFakeReelAtIndex(index: number, totalItems: number = 5): FakeReel {
  return createFakeReel(totalItems, {
    currentIndex: Math.min(index, totalItems - 1),
  });
}

/**
 * Creates a reel with all items read
 * @param itemCount - Number of items
 * @returns A reel with all viewed items
 */
export function createFakeAllReadReel(itemCount: number = 5): FakeReel {
  return createFakeReel(itemCount, {
    items: createFakeReelItems(itemCount, { isRead: true }),
  });
}

/**
 * Creates a reel with unread items
 * @param itemCount - Number of items
 * @returns A reel with unread items
 */
export function createFakeUnreadReel(itemCount: number = 5): FakeReel {
  return createFakeReel(itemCount, {
    items: createFakeReelItems(itemCount, { isRead: false }),
    currentIndex: 0,
  });
}

/**
 * Creates a single item reel
 * @returns A reel with only one item
 */
export function createFakeSingleItemReel(): FakeReel {
  return createFakeReel(1);
}

/**
 * Creates a reel with short durations
 * @param itemCount - Number of items
 * @returns A reel with short duration items
 */
export function createFakeShortDurationReel(itemCount: number = 5): FakeReel {
  return createFakeReel(itemCount, {
    items: createFakeReelItems(itemCount, { duration: 5 }),
  });
}

/**
 * Creates a reel with long durations
 * @param itemCount - Number of items
 * @returns A reel with long duration items
 */
export function createFakeLongDurationReel(itemCount: number = 5): FakeReel {
  return createFakeReel(itemCount, {
    items: createFakeReelItems(itemCount, { duration: 60 }),
  });
}

/**
 * Creates a user's story reel (from a single creator)
 * @param username - Creator username
 * @param itemCount - Number of stories
 * @returns A story reel from one user
 */
export function createFakeUserStoryReel(
  username: string = 'creative_soul',
  itemCount: number = 5
): FakeReel {
  const avatar = faker.image.avatar();
  return createFakeReel(itemCount, {
    items: createFakeReelItems(itemCount, {
      username,
      avatar,
      type: 'image',
      duration: 5,
    }),
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of reels across media types
 * @returns Grid of reels for each media type
 */
export function createReelMediaTypeMatrix(): FakeReel[] {
  return REEL_MEDIA_TYPES.map((type) =>
    createFakeReel(3, {
      items: createFakeReelItems(3, { type }),
    })
  );
}

/**
 * Creates a matrix of reels across playback states
 * @returns Grid of reels for each playback state
 */
export function createReelPlaybackStateMatrix(): FakeReel[] {
  return [
    createFakeReel(3, { isPlaying: true, progress: 50 }),
    createFakeReel(3, { isPlaying: false, progress: 50 }),
    createFakeReel(3, { isPlaying: true, progress: 0 }),
    createFakeReel(3, { isPlaying: false, progress: 100 }),
  ];
}

/**
 * Creates a matrix of reels across durations
 * @returns Grid of reels for each duration
 */
export function createReelDurationMatrix(): FakeReel[] {
  return REEL_DURATIONS.map((duration) =>
    createFakeReel(3, {
      items: createFakeReelItems(3, { duration }),
    })
  );
}

/**
 * Creates a matrix of items across different indices
 * @param totalItems - Total number of items
 * @returns Grid of reels at different indices
 */
export function createReelIndexMatrix(totalItems: number = 5): FakeReel[] {
  return Array.from({ length: totalItems }, (_, index) => createFakeReelAtIndex(index, totalItems));
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all reel configurations
 * @returns Array of reel configs for showcase
 */
export function createReelShowcase(): Array<{
  description: string;
  name: string;
  reel: FakeReel;
}> {
  return [
    {
      name: i18n.t('factory.reel.default', 'Default'),
      description: i18n.t(
        'factory.reel.standardReelWithMixedMedia',
        'Standard reel with mixed media'
      ),
      reel: createFakeReel(5),
    },
    {
      name: i18n.t('factory.reel.videoOnly', 'Video Only'),
      description: i18n.t('factory.reel.reelWithOnlyVideoContent', 'Reel with only video content'),
      reel: createFakeVideoReel(5),
    },
    {
      name: i18n.t('factory.reel.storiesImages', 'Stories (Images)'),
      description: i18n.t(
        'factory.reel.imagebasedStoriesStyleReel',
        'Image-based stories style reel'
      ),
      reel: createFakeImageReel(5),
    },
    {
      name: i18n.t('factory.reel.playing', 'Playing'),
      description: i18n.t('factory.reel.reelInPlayingState', 'Reel in playing state'),
      reel: createFakePlayingReel(),
    },
    {
      name: i18n.t('factory.reel.paused', 'Paused'),
      description: i18n.t('factory.reel.reelInPausedState', 'Reel in paused state'),
      reel: createFakePausedReel(),
    },
    {
      name: i18n.t('factory.reel.unmuted', 'Unmuted'),
      description: i18n.t('factory.reel.reelWithAudioEnabled', 'Reel with audio enabled'),
      reel: createFakeUnmutedReel(),
    },
    {
      name: i18n.t('factory.reel.singleItem', 'Single Item'),
      description: i18n.t('factory.reel.reelWithOnlyOneItem', 'Reel with only one item'),
      reel: createFakeSingleItemReel(),
    },
    {
      name: i18n.t('factory.reel.shortDuration', 'Short Duration'),
      description: i18n.t('factory.reel.reelWith5secondItems', 'Reel with 5-second items'),
      reel: createFakeShortDurationReel(),
    },
    {
      name: i18n.t('factory.reel.longDuration', 'Long Duration'),
      description: i18n.t('factory.reel.reelWith60secondItems', 'Reel with 60-second items'),
      reel: createFakeLongDurationReel(),
    },
    {
      name: i18n.t('factory.reel.userStory', 'User Story'),
      description: i18n.t(
        'factory.reel.storyReelFromSingleCreator',
        'Story reel from single creator'
      ),
      reel: createFakeUserStoryReel(),
    },
  ];
}

/**
 * Creates a complete test data set for reel testing
 * @returns Comprehensive test data
 */
export function createReelTestData(): {
  durationMatrix: FakeReel[];
  indexMatrix: FakeReel[];
  items: FakeReelItem[];
  itemsWithMetrics: FakeReelItemWithMetrics[];
  mediaTypeMatrix: FakeReel[];
  playbackStateMatrix: FakeReel[];
  reels: FakeReel[];
  showcase: Array<{ description: string; name: string; reel: FakeReel }>;
  users: FakeReelUser[];
} {
  return {
    items: createFakeReelItems(10),
    itemsWithMetrics: Array.from({ length: 5 }, () => createFakeReelItemWithMetrics()),
    users: Array.from({ length: 5 }, () => createFakeReelUser()),
    reels: createFakeReels(5),
    mediaTypeMatrix: createReelMediaTypeMatrix(),
    playbackStateMatrix: createReelPlaybackStateMatrix(),
    durationMatrix: createReelDurationMatrix(),
    indexMatrix: createReelIndexMatrix(5),
    showcase: createReelShowcase(),
  };
}
