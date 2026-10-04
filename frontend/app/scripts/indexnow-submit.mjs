/**
 * Notify IndexNow after a production deployment so participating search engines can
 * discover changed URLs. IndexNow does not control Google indexing or guarantee
 * visibility in ChatGPT; a successful response only confirms receipt.
 *
 * Run explicitly after the public deployment is live. It is a no-op unless this is
 * a real production deployment: INDEXNOW_KEY must be set, the resolved
 * site URL must be a public custom domain — not localhost, not a *.netlify.app or
 * *.vercel.app preview — and, on Vercel, VERCEL_ENV (when present) must say
 * "production" rather than "preview". Failures are reported so a deployment
 * workflow can retry them.
 *
 * The URL list comes from the sitemap already published on the live site, so this
 * file never needs its own copy of the route inventory. On the very first deploy the
 * live site has no sitemap yet and the script simply skips.
 *
 * Run manually:
 *   INDEXNOW_KEY=... NEXT_PUBLIC_APP_URL=https://www.atoaxis.com node scripts/indexnow-submit.mjs
 */

const ENDPOINT = 'https://api.indexnow.org/indexnow';

async function main() {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) {
    console.log('[indexnow] skipped: INDEXNOW_KEY is not set');
    return;
  }

  // Vercel's own URL variables carry a bare host with no protocol.
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();

  const rawSiteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    (vercelHost && `https://${vercelHost}`) ||
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

  // VERCEL_ENV is the authoritative signal on Vercel: a preview deployment can be
  // aliased to a custom domain, which the hostname check below would otherwise miss.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    console.log(`[indexnow] skipped: VERCEL_ENV is "${process.env.VERCEL_ENV}", not production`);
    return;
  }

  const { hostname, origin } = siteUrl;
  if (siteUrl.protocol !== 'https:') {
    console.error(`[indexnow] failed: the public site URL must use HTTPS (${siteUrl.href})`);
    process.exitCode = 1;
    return;
  }
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.netlify.app') ||
    hostname.endsWith('.vercel.app')
  ) {
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

  try {
    const keyResponse = await fetch(`${origin}/indexnow-key.txt`);
    const deployedKey = (await keyResponse.text()).trim();
    if (!keyResponse.ok || deployedKey !== key) {
      throw new Error(`key verification returned HTTP ${keyResponse.status}`);
    }
  } catch (error) {
    console.error(`[indexnow] failed: deployed key verification failed (${error.message})`);
    process.exitCode = 1;
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
    if (!response.ok) {
      console.error(`[indexnow] failed: submission returned HTTP ${response.status}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[indexnow] submitted ${urlList.length} URLs — HTTP ${response.status}`);
  } catch (error) {
    console.error(`[indexnow] failed: submission request error (${error.message})`);
    process.exitCode = 1;
  }
}

await main();
