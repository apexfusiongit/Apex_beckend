# Environment and secrets

## Frontend

Set `VITE_API_URL` to `http://localhost:8787` for local development and to `https://apex-backend.admin-apexfusion.workers.dev` for the deployed Worker. The deployed site is `https://apex-fusion.admin-apexfusion.workers.dev`. This value is public and may be compiled into the frontend. Do not put secrets in Vite variables.

## Worker variables

| Name | Kind | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | Plain text | Runtime environment label. |
| `CORS_ORIGIN` | Plain text | Comma-separated exact browser origins. Use localhost locally and the configured site origin in production. |
| `JWT_SECRET` | Secret | HMAC key used to sign and verify session JWTs. |
| `ADMIN_EMAIL` | Secret | Existing administrative provisioning configuration. |
| `ADMIN_PASSWORD` | Secret | Existing administrative provisioning configuration. |
| `AI_API_KEY` | Secret | AI provider credential. |
| `PAYMENT_KEY_ID` | Secret | Razorpay key ID; missing from the current production Worker configuration. |
| `PAYMENT_SECRET` | Secret | Razorpay sandbox/live secret. |
| `PAYMENT_WEBHOOK_SECRET` | Secret | Razorpay webhook signature secret. |
| `PAYMENT_MODE` | Plain text | `test` by default. Only `rzp_test_` keys are accepted in test mode; change to `live` only for an intentional production payment launch. |

Set payment credentials with `npx wrangler secret put PAYMENT_KEY_ID`, `npx wrangler secret put PAYMENT_SECRET`, and `npx wrangler secret put PAYMENT_WEBHOOK_SECRET`. Configure a Razorpay webhook to `/api/payments/webhook` and copy its secret into `PAYMENT_WEBHOOK_SECRET`. Never commit secret values. `.dev.vars.example` contains safe local placeholders; copy it to the ignored `.dev.vars` file for local work.

## Bindings

The Worker uses D1 binding `DB` for `apex-fusion-db` and R2 binding `STORAGE` for `apex-fusion-storage`. These are existing resources. The separate `apex-fusion-marketing-db` remains intact as the source/backup; its seven accounts and signup records have been copied to the core D1.
