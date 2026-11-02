import { describe, expect, it } from 'vitest';

import { sourcePageWithCampaign, utmValue } from '@/lib/early-access/campaign-source';
import { validateSignup } from '@/lib/early-access/signup';

const bytes = (value: string) => new TextEncoder().encode(value).length;

describe('utmValue', () => {
  it('keeps ASCII letters, digits, _ and - and lower-cases them', () => {
    expect(utmValue('Reddit')).toBe('reddit');
    expect(utmValue('ea_launch-2')).toBe('ea_launch-2');
    expect(utmValue('x.com/<script>')).toBe('xcomscript');
  });

  it('drops non-ASCII rather than folding it into ASCII', () => {
    expect(utmValue('เฟซบุ๊ก🚀')).toBe('');
    // The Kelvin sign lower-cases to an ASCII "k" in JS; it must not survive.
    expect(utmValue('Kelvin')).toBe('elvin');
    expect(utmValue(null)).toBe('');
  });
});

describe('sourcePageWithCampaign', () => {
  it('leaves the source page alone without a usable utm_source', () => {
    expect(sourcePageWithCampaign('en/join', '')).toBe('en/join');
    expect(sourcePageWithCampaign('en/join', '?utm_source=')).toBe('en/join');
    expect(sourcePageWithCampaign('en/join', '?utm_source=%F0%9F%9A%80')).toBe('en/join');
    expect(sourcePageWithCampaign('en/join', '?utm_campaign=ea_launch')).toBe('en/join');
  });

  it('appends the sanitised source, then the campaign, in a fixed order', () => {
    expect(sourcePageWithCampaign('en/join', '?utm_source=x')).toBe('en/join?utm_source=x');
    expect(sourcePageWithCampaign('th/join', '?utm_campaign=EA_Launch&utm_source=Reddit')).toBe(
      'th/join?utm_source=reddit&utm_campaign=ea_launch'
    );
    expect(sourcePageWithCampaign('en/join', '?utm_source=face%62ook&utm_source=x')).toBe(
      'en/join?utm_source=facebook'
    );
  });

  it('truncates an overlong source to exactly 128 bytes and drops a campaign with no room', () => {
    const result = sourcePageWithCampaign(
      'en/join',
      `?utm_source=${'s'.repeat(200)}&utm_campaign=ea_launch`
    );
    expect(result).toBe(`en/join?utm_source=${'s'.repeat(109)}`);
    expect(bytes(result)).toBe(128);

    const tight = sourcePageWithCampaign(
      'en/join',
      `?utm_source=${'s'.repeat(90)}&utm_campaign=ea_launch`
    );
    expect(tight).toBe(`en/join?utm_source=${'s'.repeat(90)}`);
  });

  it('returns the source page unchanged when it already fills the budget', () => {
    const base = 'p'.repeat(120);
    expect(sourcePageWithCampaign(base, '?utm_source=reddit')).toBe(base);
  });

  it('always produces a source_page both validators accept', () => {
    const sourcePage = sourcePageWithCampaign(
      'th/early-access',
      `?utm_source=${'ก'.repeat(80)}${'z'.repeat(300)}&utm_campaign=${'c'.repeat(300)}`
    );
    expect(bytes(sourcePage)).toBeLessThanOrEqual(128);
    expect(
      validateSignup({
        email: 'demo@example.com',
        interest: 'solo',
        locale: 'th',
        source_page: sourcePage,
        consent: true,
      }).ok
    ).toBe(true);
  });
});
