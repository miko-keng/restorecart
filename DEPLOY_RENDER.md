# Deploy RestoreCart on Render

1. Create a new Node Web Service connected to this repository, branch `main`, root directory blank.
2. Build command: `npm ci --include=dev && npm run build`.
3. Start command: `npm start`. This repository has only the RestoreCart server.
4. Health check path: `/healthz`. Node.js: 24 or newer (the repository includes `.node-version`).
5. Add the required environment settings below. Save, build and deploy.
6. Open the new service URL; `/` redirects to `/restorecart`.

| Variable | Value |
| --- | --- |
| NODE_ENV | production |
| RESTORECART_BASE_URL | New HTTPS service origin, without `/restorecart` or trailing slash |
| RESTORECART_SELLER_EMAIL | Your private hosted seller email |
| RESTORECART_SELLER_PASSWORD | Your private strong hosted password |
| PAYPAL_ENV | sandbox |
| PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET | Your sandbox app credentials |
| PAYPAL_MERCHANT_ID | Optional sandbox merchant check |
| PAYPAL_WEBHOOK_ID | Webhook registered for the new hosted listener |
| GEMINI_API_KEY / GEMINI_MODEL | Your AI Studio key and supported model; default model `gemini-3.5-flash-lite` |

Do not copy `RESTORECART_PORT=4370` from the local example to Render; let Render provide `PORT`. Do not copy the loopback base URL to Render. Configure secrets only in Render Environment, not GitHub. `render.yaml` provides the same settings as a Blueprint; linking the repository as a Web Service does not automatically apply a Blueprint.

## Data storage

The included free-tier Blueprint uses local SQLite in `.data/restorecart.sqlite`. Free service files are ephemeral: accounts, uploads, orders and review progress may disappear after restart/redeploy. Shop backup files do not include orders and are not a full database backup.

For durable demonstrations, use a Render service with a persistent disk mounted at `/var/data` and set `RESTORECART_DB_PATH=/var/data/restorecart.sqlite`. A persistent disk requires a compatible paid plan; this repository does not purchase or provision one. Do not use this prototype for real-money payments.

## PayPal and first sign-in

Register/update the PayPal sandbox webhook URL to `https://YOUR-NEW-SERVICE/api/paypal/webhook` and put that registration's ID in `PAYPAL_WEBHOOK_ID`. The existing event list is documented in RESTORECART_README.md. Changing hosts does not transfer a webhook registration automatically.

The configured hosted seller signs in using `RESTORECART_SELLER_EMAIL` and the private password you set. Register a private buyer through the buyer sign-in page. The public local demo seeder intentionally refuses production. No local database or account records are uploaded to GitHub or transferred to Render by deployment.
