# Deploy RestoreCart on Render

1. Create a new Node Web Service connected to this repository, branch `main`, root directory blank.
2. Build command: `npm ci --include=dev && npm run build`.
3. Start command: `npm start`. This repository has only the RestoreCart server.
4. Health check path: `/healthz`. Node.js: 24 or newer (the repository includes `.node-version`).
5. Add the required environment settings below. Save, build and deploy.
6. Open the new service URL; `/` redirects to `/restorecart`.

| Variable                                | Value                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| NODE_ENV                                | production                                                                    |
| RESTORECART_BASE_URL                    | New HTTPS service origin, without `/restorecart` or trailing slash            |
| RESTORECART_SELLER_EMAIL                | Your private hosted seller email                                              |
| RESTORECART_SELLER_PASSWORD             | Your private strong hosted password                                           |
| PAYPAL_ENV                              | sandbox                                                                       |
| PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET | Your sandbox app credentials                                                  |
| PAYPAL_MERCHANT_ID                      | Optional sandbox merchant check                                               |
| PAYPAL_WEBHOOK_ID                       | Webhook registered for the new hosted listener                                |
| GEMINI_API_KEY / GEMINI_MODEL           | Your AI Studio key and supported model; default model `gemini-3.5-flash-lite` |

Do not copy `RESTORECART_PORT=4370` from the local example to Render; let Render provide `PORT`. Do not copy the loopback base URL to Render. Configure secrets only in Render Environment, not GitHub. `render.yaml` provides the same settings as a Blueprint; linking the repository as a Web Service does not automatically apply a Blueprint.

## Data storage

The included free-tier Blueprint uses local SQLite in `.data/restorecart.sqlite`. Free service files are ephemeral: accounts, uploads, orders and review progress may disappear after restart/redeploy. Shop backup files do not include orders and are not a full database backup.

For durable demonstrations, use a Render service with a persistent disk mounted at `/var/data` and set `RESTORECART_DB_PATH=/var/data/restorecart.sqlite`. A persistent disk requires a compatible paid plan; this repository does not purchase or provision one. Do not use this prototype for real-money payments.

## PayPal and first sign-in

Register/update the PayPal sandbox webhook URL to `https://YOUR-NEW-SERVICE/api/paypal/webhook` and put that registration's ID in `PAYPAL_WEBHOOK_ID`. The existing event list is documented in RESTORECART_README.md. Changing hosts does not transfer a webhook registration automatically.

The configured hosted seller signs in using `RESTORECART_SELLER_EMAIL` and the private password you set. Register a private buyer through the buyer sign-in page. The public local demo-account seeder intentionally refuses production; it is no longer required to prepare the hosted demo shop. No local database or account records are uploaded to GitHub or transferred to Render by deployment.

## Prepared shop on the hosted service

On startup, an empty configured seller workspace receives **Sunday Studio Demo** with source files, products awaiting review and saved shop details. If you registered a different seller, click **Load prepared Sunday Studio Demo** after sign-in. The loader creates a copy owned by that account and preserves existing work on repeat use. It does not create public demo credentials or fake payments. Order-status examples appear under Orders → Sample preview and are separate from Actual sandbox orders.

AG Grid Community is available in **Orders → Orders** without a key. The pickup appointment list also works without additional configuration. The optional Bryntum trial timeline is off on Render by default. If your evaluation rights cover the hosted demo, set `VITE_ENABLE_BRYNTUM=true` in Render and choose **Save, rebuild, and deploy**. This is a build-time variable. An AG Studio licence is not an AG Grid Enterprise licence and is not used by this integration.

## Approved fixes and optional connector

Startup now also ensures one **Sunday Studio Sample Shop**, with a stable published `/s/sunday-studio-sample` URL, owned by the configured seller. The separate Sunday Studio Demo draft remains available for review. Existing data is never replenished/reset merely by startup. A lost ephemeral database still loses transactions; this is a resettable sandbox demonstration.

Gemini quotas renew each hour: 12 calls per seller, 60 globally (configurable). No new key is needed. `RESTORECART_TRUST_PROXY_HOPS=0` is the conservative default; verify Render's actual ingress topology before setting an exact trusted hop count. Do not trust all forwarding headers.

WooCommerce remains **Not connected** unless an operator supplies `WOOCOMMERCE_TEST_ORIGINS` and `WOOCOMMERCE_ENCRYPTION_KEY`. Sellers then enter their test store's consumer credentials privately. See [setup, limitations and verification](docs/restorecart/WOOCOMMERCE_TEST_CONNECTOR.md). Do not configure a live merchant store. A push to `main` can trigger Render Auto-Deploy when enabled. Check the deployed commit in Render before testing.

## Free compute with external persistence (new)

The code now supports a remote Turso/libSQL database without a paid Render disk. Configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `RESTORECART_REQUIRE_PERSISTENCE=true` privately. See [external storage setup and migration](docs/restorecart/EXTERNAL_STORAGE.md). Do not claim the hosting storage issue is fixed until the external account is configured and a hosted restart has been checked. The default free demo Blueprint keeps persistence optional; setting the guard to true is an explicit deployment step.
