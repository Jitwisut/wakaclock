/**
 * Ping IndexNow after a production build so Bing (and therefore ChatGPT), Yandex,
 * Seznam and Naver recrawl within minutes instead of days.
 *
 * Wired in as `postbuild`, so it runs after every `npm run build`. It is a no-op
 * unless this is a real production build: INDEXNOW_KEY must be set and the resolved
 * site URL must be a public custom domain — not localhost, not a *.netlify.app
 * preview. Every failure is swallowed; IndexNow is best-effort and must never break
 * a deploy.
 *
 * The URL list comes from the sitemap already published on the live site, so this
 * file never needs its own copy of the route inventory. On the very first deploy the
 * live site has no sitemap yet and the script simply skips.
 *
 * Run manually:
 *   INDEXNOW_KEY=... NEXT_PUBLIC_APP_URL=https://atoaxis.com node scripts/indexnow-submit.mjs
 */

const ENDPOINT = 'https://api.indexnow.org/indexnow';

async function main() {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) {
    console.log('[indexnow] skipped: INDEXNOW_KEY is not set');
    return;
  }

  const rawSiteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ''
  ).trim();

  let siteUrl;
  try {
    siteUrl = new URL(rawSiteUrl);
  } catch {
    console.log(
      `[indexnow] skipped: no valid site URL in the environment (${rawSiteUrl || 'unset'})`
    );
    return;
  }

  const { hostname, origin } = siteUrl;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.netlify.app')) {
    console.log(`[indexnow] skipped: ${hostname} is not a public host`);
    return;
  }

  let urlList;
  try {
    const response = await fetch(`${origin}/sitemap.xml`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  } catch (error) {
    console.log(`[indexnow] skipped: could not read the live sitemap (${error.message})`);
    return;
  }

  if (urlList.length === 0) {
    console.log('[indexnow] skipped: the sitemap contained no <loc> entries');
    return;
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: hostname,
        key,
        keyLocation: `${origin}/indexnow-key.txt`,
        urlList,
      }),
    });
    console.log(`[indexnow] submitted ${urlList.length} URLs — HTTP ${response.status}`);
  } catch (error) {
    console.log(`[indexnow] submit failed (${error.message}) — ignored`);
  }
}

await main();
