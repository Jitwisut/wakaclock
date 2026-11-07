import { expect, test } from '@playwright/test';

test('human + AI focus works with reduced motion and skips the 3D scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const experience = page.locator('#tx-experience');
  await expect(experience).toHaveAttribute('data-scene', 'fallback');
  await expect(page.locator('.tx-canvas canvas')).toHaveCount(0);
  await expect(page.locator('.tx-loader')).toHaveText('Showing the still version of the scene');
  const controls = page.getByRole('group', { name: 'Choose which activity to focus on' });
  const unattributed = controls.getByRole('button', { name: 'Unattributed', exact: true });
  await unattributed.click();
  await expect(unattributed).toHaveAttribute('aria-pressed', 'true');
  const kind = (name: string) => page.locator(`.tx-kinds > li[data-kind="${name}"]`);
  await expect(kind('unattributed')).toHaveAttribute('data-dim', 'false');
  await expect(kind('unattributed').locator('h3')).toHaveText('Evidence we do not have');
  await expect(kind('human')).toHaveAttribute('data-dim', 'true');
  await expect(page.locator('.tx-badge')).toHaveText('Illustrative demo data');
  await expect(page.locator('.tx-hero .tx-line').first()).toHaveCSS('animation-name', 'none');
});

test('tablet navigation and the worked example fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/th');
  await expect(page.getByRole('button', { name: 'เปิดเมนู' })).toBeVisible();
  const example = page.locator('#worked-example');
  await example.scrollIntoViewIfNeeded();
  await expect(example.getByRole('heading', { level: 3 })).toBeVisible();
  const box = await example.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  expect((box?.x ?? 0) + (box?.width ?? 1025)).toBeLessThanOrEqual(1024);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
});

test('mobile experience keeps its copy readable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your coding time. The whole picture.'
  );
  await expect(page.locator('.axis-nav')).toHaveCSS('backdrop-filter', 'none');
  // The chapter rail is a desktop affordance; a phone reads the chapters in order.
  await expect(page.locator('.tx-rail')).toBeHidden();
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
    ['/', 'Editors compatible through the WakaTime plugin protocol'],
    ['/th', 'Editor ที่เข้ากันได้ผ่าน WakaTime protocol'],
  ] as const) {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(path);
    // The marquee repeats its track for the loop; only the first copy is in the a11y tree.
    // It never settles while it moves, so it is read rather than scrolled to.
    const list = page.getByRole('list', { name });
    await expect(list).toHaveCount(1);
    await expect(list.getByRole('listitem').filter({ hasText: /^Terminal$/ })).toHaveCount(1);
    await expect(page.locator('.tx-marquee')).toHaveCSS('overflow-x', 'hidden');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  }
});

test('activity focus is a keyboard-operable toggle group', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const controls = page.getByRole('group', { name: 'Choose which activity to focus on' });
  const together = controls.getByRole('button', { name: 'Together', exact: true });
  const human = controls.getByRole('button', { name: 'Human', exact: true });
  await together.focus();
  await page.keyboard.press('Tab');
  await expect(human).toBeFocused();
  await page.keyboard.press('Space');
  await expect(human).toHaveAttribute('aria-pressed', 'true');
  await expect(together).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Shift+Tab');
  await expect(together).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(together).toHaveAttribute('aria-pressed', 'true');
  await expect(human).toHaveAttribute('aria-pressed', 'false');
});

test('hero calls to action survive hydration and lead to their pages', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const hero = page.locator('.tx-hero');
  await expect(hero.getByRole('link', { name: 'Join early access' })).toHaveAttribute(
    'href',
    '/early-access'
  );
  const compare = hero.getByRole('link', { name: 'Compare with WakaTime' });
  await expect(compare).toBeVisible();
  await compare.click();
  await expect(page).toHaveURL(/\/wakatime-alternative$/);
  expect(errors).toEqual([]);
});
