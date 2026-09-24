import type { SiteLocale } from '@/lib/seo/site';

import type { ProductView } from './experience-copy';

export interface ProductShot {
  alt: Record<SiteLocale, string>;
  height: number;
  /** Path under /public. Crop to the content area; no names, emails or avatars. */
  src: string;
  width: number;
}

/**
 * Real product screenshots, one slot per view.
 *
 * While a slot is `null` the showcase renders an HTML illustration of that view, captioned
 * as an illustration with demo data — never as a screenshot. Dropping a real, cropped
 * screenshot into /public and filling the slot swaps it in with the "Product screenshot"
 * caption; nothing else needs to change.
 */
export const PRODUCT_SHOTS: Record<ProductView, null | ProductShot> = {
  overview: null,
  timeline: null,
  projects: null,
  'human-ai': null,
};
