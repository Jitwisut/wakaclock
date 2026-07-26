import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();

const username = `browsertest_${Date.now()}`;
const password = 'browsertestpassword123';

const log = (msg) => console.log(`[verify] ${msg}`);

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`[browser console error] ${msg.text()}`);
});
page.on('pageerror', (err) => console.log(`[browser page error] ${err}`));

await page.goto('http://localhost:3000/dashboard/wakaclock', { waitUntil: 'networkidle' });
log(`loaded, title: ${await page.title()}`);

// Should show the AuthPanel since no session yet
const hasLoginTab = await page.getByRole('tab', { name: 'Log in' }).isVisible().catch(() => false);
log(`AuthPanel visible (Log in tab found): ${hasLoginTab}`);
if (!hasLoginTab) {
  await page.screenshot({ path: '/tmp/wakaclock-1-no-login.png' });
  throw new Error('AuthPanel not shown when logged out');
}

// Switch to Register tab
await page.getByRole('tab', { name: 'Register' }).click();
await page.locator('#register-username').fill(username);
await page.locator('#register-password').fill(password);
await page.getByRole('button', { name: 'Create account' }).click();

await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/wakaclock-2-after-register.png' });

// Header should now show the username
const headerHasUsername = await page.getByText(username, { exact: false }).first().isVisible().catch(() => false);
log(`Header shows username after register: ${headerHasUsername}`);

// Dashboard content (StatTile) should now render instead of AuthPanel
const stillShowsAuthPanel = await page.getByRole('tab', { name: 'Log in' }).isVisible().catch(() => false);
log(`AuthPanel still visible after register (should be false): ${stillShowsAuthPanel}`);

// Go to Settings -> API key tab, generate a key
await page.goto('http://localhost:3000/dashboard/wakaclock/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/wakaclock-3-settings.png' });

const generateBtn = page.getByRole('button', { name: /Generate key/i });
await generateBtn.click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Generate' }).click(); // confirm dialog
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/wakaclock-4-key-generated.png' });

const keyInput = page.locator('input[readonly]');
const keyValue = await keyInput.inputValue().catch(() => null);
log(`Generated API key visible in UI: ${keyValue ? keyValue.slice(0, 10) + '...' : 'NONE'}`);

// Reload page - session should persist via localStorage, key should NOT be shown again (not fetchable)
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const stillLoggedInAfterReload = !(await page.getByRole('tab', { name: 'Log in' }).isVisible().catch(() => false));
log(`Still logged in after page reload (session persisted via localStorage): ${stillLoggedInAfterReload}`);
await page.screenshot({ path: '/tmp/wakaclock-5-after-reload.png' });

await browser.close();
log('done');
