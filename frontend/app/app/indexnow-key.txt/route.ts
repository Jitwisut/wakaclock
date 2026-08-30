/**
 * /indexnow-key.txt — serves the IndexNow verification key.
 *
 * IndexNow lets the site tell Bing (and therefore ChatGPT), Yandex, Seznam and Naver
 * that URLs changed, so they recrawl within minutes instead of days. A submission for a
 * host is only accepted when the key file named by the request's `keyLocation` returns
 * the same key — it is the proof that whoever submits also controls the site.
 *
 * The key is not secret in the usual sense (it is published here by design), but it is
 * read from the environment rather than committed so it can be rotated without a code
 * change and is simply absent on forks and preview deploys that have no business
 * submitting. The submitter is `scripts/indexnow-submit.mjs`, run as `postbuild`.
 */

export const dynamic = 'force-static';

export function GET(): Response {
  const key = process.env.INDEXNOW_KEY?.trim();

  if (!key) {
    return new Response('IndexNow key is not configured.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(key, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
