import { expect, test } from '@playwright/test';

test('human + AI explorer works with reduced motion and skips the 3D scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const experience = page.locator('#axx-experience');
  await expect(experience).toHaveAttribute('data-scene', 'fallback');
  await expect(page.locator('.axx-canvas')).toHaveCount(0);
  const explorer = page.locator('.axx-attribution');
  const unattributed = explorer.getByRole('button', { name: 'Unattributed', exact: true });
  await unattributed.click();
  await expect(unattributed).toHaveAttribute('aria-pressed', 'true');
  await expect(explorer.getByRole('heading', { level: 3 })).toHaveText('Evidence we do not have');
  await expect(explorer).toContainText('Illustrative demo data');
  await expect(page.locator('.axx-hero .axx-word').first()).toHaveCSS('animation-name', 'none');
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

test('mobile experience keeps its copy readable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make Your Work Visible.');
  await expect(page.locator('.axis-nav')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('.axx-rail')).toBeHidden();
  // The frame is static on a phone rather than scroll-scrubbed.
  await expect(page.locator('.axx-insight-frame')).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
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

test('compact editor list exposes every editor without moving the page sideways', async ({
  page,
}) => {
  for (const [path, name] of [
    ['/', 'Browse compatible editors'],
    ['/th', 'รายชื่อ editor เลื่อนดูได้'],
  ] as const) {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(path);
    const browser = page.getByRole('region', { name });
    await browser.scrollIntoViewIfNeeded();
    await expect(browser.getByRole('list')).toHaveCount(1);
    await expect(browser).toHaveCSS('overflow-y', 'auto');
    await browser.getByText('Terminal', { exact: true }).scrollIntoViewIfNeeded();
    await expect(browser.getByText('Terminal', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  }
});

test('product views switch with the keyboard like a tab list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const overview = page.getByRole('tab', { name: /Overview/ });
  await overview.focus();
  await page.keyboard.press('ArrowRight');
  const timeline = page.getByRole('tab', { name: /Activity Timeline/ });
  await expect(timeline).toBeFocused();
  await expect(timeline).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#axx-panel-timeline')).toBeVisible();
  await expect(page.locator('#axx-panel-overview')).toBeHidden();
  await expect(page.locator('#axx-panel-timeline figcaption')).toContainText('not a screenshot');
});

test('hero calls to action survive hydration and explore scrolls into the story', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const hero = page.locator('.axx-hero');
  await expect(hero.getByRole('link', { name: 'Join early access' })).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Compare with WakaTime' })).toBeVisible();
  await hero.getByRole('link', { name: 'Explore AtoAxis' }).click();
  await expect(page).toHaveURL(/#every-second$/);
  expect(errors).toEqual([]);
});
