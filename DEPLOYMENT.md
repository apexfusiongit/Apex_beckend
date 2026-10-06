# Backend deployment

## Existing Cloudflare resources

- Worker: `apex-backend` (`https://apex-backend.admin-apexfusion.workers.dev`)
- Learning D1: `apex-fusion-db` (`071fab92-f25c-4932-a110-11b38579bc38`)
- Signup D1: `apex-fusion-marketing-db` (`e37e59e4-e711-4c16-93d6-a2cb89426853`)
- R2: `apex-fusion-storage`
- Frontend: `https://apex-fusion.admin-apexfusion.workers.dev` (Cloudflare Pages on Workers Assets)

The Worker uses `apex-fusion-db`, which contains the learning platform accounts and course data. The marketing D1 remains intact as a backup/source; its seven signup accounts, profiles, preferences, and eleven activity records were copied into the learning D1. One same-email student account had two distinct password hashes; both are retained so either existing credential continues to work.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.dev.vars.example` to `.dev.vars`; set a unique local `JWT_SECRET`.
3. From `backend/`, run `npm run db:migrate:local`, then `npm run dev:local`.
4. Use `http://localhost:8787/health` and `http://localhost:5173`.

The migration runner defaults to local D1. `npm run db:migrate -- --remote` targets production and must only be run after reviewing the migration and backing up the target database. The additive migration was tested against a schema-only export and applied to production on 2026-10-06. Both pre-migration D1 backups are in `/tmp/apex-fusion-backups-20261006` on the operator machine, with mode `0600`.

## Worker configuration and secrets

`wrangler.toml` binds the existing learning D1 and R2 bucket. Do not create replacements. `CORS_ORIGIN` allows the deployed frontend origin and localhost development.

JWT, admin, AI, and payment credentials are Worker secrets. Do not put secret values in `wrangler.toml`, `.env.example`, or Git. The ₹300 monthly checkout, order verification, subscription activation, payment history/status APIs, and signed idempotent webhook handler are implemented. `PAYMENT_MODE` is set to `test`; production currently has no `PAYMENT_KEY_ID`, so checkout remains disabled until a Razorpay Test Key ID is configured.

## Deployment sequence

1. Back up both D1 databases.
2. Review/apply additive migrations to `apex-fusion-db`.
3. Reconcile signup accounts into the core D1 without overwriting existing same-email credentials.
4. Run `npm run typecheck` and `npm run build`.
5. Set exact production CORS and deploy with `npx wrangler deploy`.
6. Build the frontend with `VITE_API_URL=https://apex-backend.admin-apexfusion.workers.dev` and deploy `dist/`.
7. Verify health, browser CORS, signup/login, role gates, and actual R2 upload/playback.

The frontend is deployed at version `98764abe-2971-42a2-bc5b-8d176a3ab506`; the API is at `2dfdcadb-df18-4eae-8151-9101677737a5`. The auth, role-gated upload, R2 playback, demo/public and paid/subscription checks have passed locally and in production. Video demo access is stored per asset so adding a demo clip cannot expose other clips in its lesson. Payment API auth, role checks, configuration gating, webhook signature rejection, duplicate event handling, and payment activation idempotency have local coverage. Production currently reports checkout disabled. Configure matching `rzp_test_` Key ID/secret plus a test webhook secret, then run a real sandbox payment and replay the webhook to verify it end-to-end. Do not set `PAYMENT_MODE=live` until that passes.
