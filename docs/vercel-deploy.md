# Deploying `frontend/app` to Vercel

The Next.js app is not at the repository root — `frontend/app/package.json`
is the real project. Everything below is scoped to that.

## One-time project setup (Vercel dashboard)

These are dashboard settings, not files, so they can't be committed. Set them
once when the project is created (Project → Settings):

1. **Root Directory** → `frontend/app`. Without this Vercel builds from the
   repo root, finds no `package.json`, and fails immediately.
2. **Framework Preset** → Next.js (auto-detected once Root Directory is set;
   also pinned explicitly in [`frontend/app/vercel.json`](../frontend/app/vercel.json)).
3. **Node.js Version** → 20.x, to match [`frontend/app/package.json`](../frontend/app/package.json)'s
   `engines.node` and the same pin Netlify uses (`netlify.toml`'s
   `NODE_VERSION`). Vercel reads `engines.node` automatically; this setting
   only matters if it's ever overridden in the dashboard.
4. **Environment Variables** (Production, and Preview if you want previews to
   render real data) — see the table below. None of these have committed
   values; get them from whoever manages the current Netlify project's env
   vars, or from `.env.example` for the shape of each one.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Production only | The canonical public URL (`https://atoaxis.com`). Preview deployments don't need it — `lib/seo/site.ts` falls back to Vercel's own `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL` so previews still get a valid canonical origin. |
| `NEXT_PUBLIC_WAKACLOCK_API_URL` | yes | Base URL of the Rust API. |
| `INDEXNOW_KEY` | Production only | Enables `scripts/indexnow-submit.mjs` (runs as `postbuild`). Leave unset on Preview — the script also refuses to submit unless `VERCEL_ENV=production` and the resolved host isn't a `*.vercel.app` preview. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_API_KEY` | optional | Analytics. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | optional | |
| `ARCJET_KEY` | optional | Rate limiting / bot protection. |

Everything else in `.env.example` (`DATABASE_URL`, `AUTH_SECRET`,
`OTEL_*`, `SKIP_ENV_VALIDATION`, …) applies the same way it does on Netlify —
nothing about those is provider-specific.

## What's already handled in code

No dashboard step needed for these — they work the moment Root Directory and
the env vars above are set:

- `lib/seo/site.ts`'s `resolveSiteUrl()` recognizes Vercel's `VERCEL_URL` /
  `VERCEL_PROJECT_PRODUCTION_URL` the same way it already recognizes
  Netlify's `URL` / `DEPLOY_PRIME_URL`, so canonical URLs and structured data
  resolve correctly on a fresh preview before `NEXT_PUBLIC_APP_URL` is set.
- `scripts/indexnow-submit.mjs` (the `postbuild` IndexNow ping) skips
  `*.vercel.app` hosts and any deploy where `VERCEL_ENV !== "production"`,
  the same way it already skips `*.netlify.app` and localhost.
- Security headers (`X-Frame-Options`, `Referrer-Policy`, etc.) are declared
  in `next.config.ts`'s `headers()` function, not in a Netlify-specific file,
  so they apply on Vercel unchanged.
- `frontend/app/vercel.json` pins `framework: "nextjs"` explicitly.

## What is unrelated to this app

Ignore `netlify.toml` at the repository root once Vercel is the target — it
only configures the Netlify build and has no Vercel equivalent to keep in
sync. It can stay in the repo (harmless if Netlify is decommissioned later)
or be removed once the migration is confirmed working; that's a separate
decision from getting Vercel running.
