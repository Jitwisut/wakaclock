/**
 * Folds the visitor's UTM tags into the `source_page` an Early Access signup stores,
 * e.g. `en/join` + `?utm_source=reddit` -> `en/join?utm_source=reddit`. Both
 * validators (signup.ts and the Rust handler) deny unknown fields, so channel
 * attribution has to ride inside `source_page` and respect its 128-byte limit.
 */

const MAX_SOURCE_PAGE_BYTES = 128;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** ASCII letters, digits, `_` and `-` only, lower-cased; anything else is dropped. */
export function utmValue(raw: null | string): string {
  return (raw ?? '').replaceAll(/[^\w-]/g, '').toLowerCase();
}

/**
 * `sourcePage` with `utm_source` (and `utm_campaign` when it fits) from `search`
 * appended. The source is truncated to keep the result within 128 bytes; the
 * campaign is dropped rather than truncated when there is no room for all of it.
 */
export function sourcePageWithCampaign(sourcePage: string, search: string): string {
  const params = new URLSearchParams(search);
  const source = utmValue(params.get('utm_source'));
  const prefix = `${sourcePage}?utm_source=`;
  const room = MAX_SOURCE_PAGE_BYTES - byteLength(prefix);
  if (!source || room <= 0) return sourcePage;

  const withSource = prefix + source.slice(0, room);
  const campaign = utmValue(params.get('utm_campaign'));
  const withCampaign = `${withSource}&utm_campaign=${campaign}`;
  return campaign && byteLength(withCampaign) <= MAX_SOURCE_PAGE_BYTES ? withCampaign : withSource;
}
