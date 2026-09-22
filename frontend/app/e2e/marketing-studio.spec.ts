import { expect, test } from '@playwright/test';

test('sample authorship remains usable with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const studio = page.locator('.mkt-studio');
  await studio.getByRole('button', { name: 'Unknown', exact: true }).click();
  await expect(studio.getByRole('status')).toContainText('Unknown 12');
  await expect(studio.locator('.mkt-studio-track')).toHaveCSS('animation-name', 'none');
  await studio.getByRole('button', { name: 'Replay' }).click();
  await expect(studio.getByRole('status')).toContainText('Unknown 12');
});

test('tablet navigation and preview bars fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/th');
  await expect(page.getByRole('button', { name: 'เปิดเมนู' })).toBeVisible();
  const bars = page.locator('#worked-example .mkt-chart-bar');
  await expect(bars).toHaveCount(7);
  expect(
    await bars.evaluateAll((elements) =>
      elements.every((el) => el.getBoundingClientRect().height > 0)
    )
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
});

test('mobile motion stays stable when the browser chrome changes the viewport height', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const hero = page.locator('.axis-hero');
  const stage = page.locator('.axis-hero-stage');
  const initialHeight = (await hero.boundingBox())?.height ?? 0;

  await expect(hero).not.toHaveAttribute('data-pinned', 'true');
  await expect(stage).toHaveCSS('position', 'relative');
  await expect(page.locator('.axis-nav')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('.wakaclock-marquee-track').first()).toHaveCSS(
    'animation-name',
    'none'
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  // Mobile browsers resize only the visual height when their address bar collapses.
  // The hero must keep its document height or the content below it visibly jumps.
  await page.setViewportSize({ width: 390, height: 700 });
  await expect
    .poll(async () => (await hero.boundingBox())?.height ?? 0)
    .toBeCloseTo(initialHeight, 0);
  await expect(hero).not.toHaveAttribute('data-pinned', 'true');
  await expect(stage).toHaveCSS('position', 'relative');
});

test('mobile and tablet content pages avoid scroll-driven 3D work and horizontal overflow', async ({
  page,
}) => {
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/integrations');
    const art = page.locator('.mkt-page-art');

    await expect(art).toBeVisible();
    await expect(art).toHaveCSS('animation-timeline', 'auto');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    expect((await art.boundingBox())?.width ?? viewport.width + 1).toBeLessThanOrEqual(
      viewport.width
    );
  }
});

test('landscape menu scrolls internally and select shows keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.locator('#marketing-mobile-menu');
  await expect(menu).toHaveCSS('overflow-y', 'auto');
  await expect
    .poll(async () => {
      const box = await menu.boundingBox();
      return box ? box.y + box.height : 9999;
    })
    .toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await page.goto('/early-access');
  await page.getByLabel('Email address').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('What are you interested in?')).toBeFocused();
  await expect(page.getByLabel('What are you interested in?')).toHaveCSS('outline-style', 'solid');
});

test('compact editor strip exposes every editor and scrolls without moving the page sideways', async ({
  page,
}) => {
  for (const path of ['/', '/th']) {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(path);
    const wall = page.locator('.axis-editor-wall');
    const browser = wall.getByRole('region');
    await browser.scrollIntoViewIfNeeded();
    await expect(wall.getByRole('list')).toHaveCount(1);
    await expect(wall.getByRole('button')).toHaveCount(0);
    await expect(browser).toHaveCSS('overflow-x', 'auto');
    await expect(browser.getByText('Terminal', { exact: true })).toBeAttached();
    await browser.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => browser.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    // The last item must be reachable, not permanently clipped behind a stopped marquee.
    await browser.getByText('Terminal', { exact: true }).scrollIntoViewIfNeeded();
    const last = await browser.getByText('Terminal', { exact: true }).boundingBox();
    const region = await browser.boundingBox();
    expect(last!.x).toBeGreaterThanOrEqual(region!.x);
    expect(last!.x + last!.width).toBeLessThanOrEqual(region!.x + region!.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  }
});

test('desktop editor playback resumes while its control retains keyboard focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const wall = page.locator('.axis-editor-wall');
  const track = wall.locator('.wakaclock-marquee-track').first();
  await wall.getByRole('button', { name: 'Pause editor strip' }).click();
  await expect(track).toHaveCSS('animation-play-state', 'paused');
  const play = wall.getByRole('button', { name: 'Play editor strip' });
  await play.focus();
  await play.press('Enter');
  await expect(track).toHaveCSS('animation-play-state', 'running');
  await expect(wall.getByRole('button', { name: 'Pause editor strip' })).toBeFocused();
});

test('hero calls to action survive hydration and feature navigation advances the rail', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.locator('.axis-opening').getByRole('link', { name: 'Join early access' })
  ).toBeVisible();
  const rail = page.getByRole('region', { name: 'Explore AtoAxis features' });
  await page.getByRole('button', { name: 'Next features' }).click();
  await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await expect(page.getByRole('button', { name: 'Previous features' })).toBeEnabled();
  expect(errors).toEqual([]);
});
