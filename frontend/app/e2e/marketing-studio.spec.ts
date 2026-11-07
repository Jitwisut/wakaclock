import { expect, test } from '@playwright/test';

test('human + AI focus works with reduced motion and skips the 3D scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const experience = page.locator('#tx-experience');
  await expect(experience).toHaveAttribute('data-scene', 'fallback');
  await expect(page.locator('.tx-canvas')).toHaveCount(0);
  await expect(page.locator('.tx-still')).toBeVisible();
  const focus = page.getByRole('group', { name: 'Choose which activity to focus on' });
  const unattributed = focus.getByRole('button', { name: 'Unattributed', exact: true });
  await unattributed.click();
  await expect(unattributed).toHaveAttribute('aria-pressed', 'true');
  const card = page.locator('.tx-kinds li[data-kind="unattributed"]');
  await expect(card).toHaveAttribute('data-dim', 'false');
  await expect(card.getByRole('heading', { level: 3 })).toHaveText('Evidence we do not have');
  await expect(page.locator('.tx-hero .tx-line').first()).toHaveCSS('animation-name', 'none');
});

test('tablet navigation and the worked example fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/th');
  await expect(page.getByRole('button', { name: 'เปิดเมนู' })).toBeVisible();
  const example = page.locator('#worked-example');
  await example.scrollIntoViewIfNeeded();
  await expect(example).toBeVisible();
  expect((await example.boundingBox())?.width ?? 1025).toBeLessThanOrEqual(1024);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
});

test('mobile experience keeps its copy readable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your coding time. The whole picture.'
  );
  await expect(page.locator('.tx-hero .tx-lead')).toBeVisible();
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
    // One readable list for assistive tech; the marquee's repeat is aria-hidden.
    const list = page.getByRole('list', { name });
    await expect(list).toHaveCount(1);
    await expect(list.getByText('Terminal', { exact: true })).toHaveCount(1);
    await expect(list.getByRole('listitem')).not.toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  }
});

test('activity focus controls work from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const focus = page.getByRole('group', { name: 'Choose which activity to focus on' });
  const together = focus.getByRole('button', { name: 'Together', exact: true });
  const human = focus.getByRole('button', { name: 'Human', exact: true });
  await expect(together).toHaveAttribute('aria-pressed', 'true');
  await together.focus();
  await page.keyboard.press('Tab');
  await expect(human).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(human).toHaveAttribute('aria-pressed', 'true');
  await expect(together).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.tx-kinds li[data-kind="ai"]')).toHaveAttribute('data-dim', 'true');
});

test('hero calls to action survive hydration and the chapter rail jumps into the story', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const hero = page.locator('.tx-hero');
  await expect(hero.getByRole('link', { name: /Join early access/ })).toHaveAttribute(
    'href',
    '/early-access'
  );
  await expect(hero.getByRole('link', { name: 'Compare with WakaTime' })).toHaveAttribute(
    'href',
    '/wakatime-alternative'
  );
  await page
    .getByRole('navigation', { name: 'Chapters' })
    .getByRole('link', { name: /Heartbeats/ })
    .click();
  await expect(page).toHaveURL(/#tx-c1$/);
  expect(errors).toEqual([]);
});
