/**
 * /indexnow-key.txt — serves the IndexNow verification key.
 *
 * IndexNow lets participating search engines receive a notification that URLs changed.
 * It does not control Google indexing or guarantee a ranking or AI citation. A submission
 * for a host is accepted only when the key file named by `keyLocation` returns the same
 * key, proving that the submitter controls the site.
 *
 * The key is not secret in the usual sense (it is published here by design), but it is
 * read from the environment rather than committed so it can be rotated without a code
 * change and is simply absent on forks and preview deploys that have no business
 * submitting. The submitter is `scripts/indexnow-submit.mjs`, run after deployment.
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
