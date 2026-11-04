# Free external storage and recovery verification

## Verified activation — 4 November 2026

The local rehearsal snapshot was migrated to actual Turso/libSQL without changing the source. All 24 original rows across 16 tables were compared unchanged. Separate application processes retained accounts, example image bytes, controlled payment references, stock movements and recovery journals. Repeated recovery applied zero additional changes. Local development now requires this external database. These controlled payment records are not new PayPal transactions. [Evidence and scope](BACKEND_VERIFICATION_2026_11.md).

Render activation/restart verification is a separate deployment check and must not be inferred from these database tests.

## Current implementation

RestoreCart supports local SQLite for development and a remote Turso/libSQL database for hosted operation. With `TURSO_DATABASE_URL` configured, the app writes accounts, sessions, baskets, catalog/source images, orders, holds, verified payment references, refunds, recovery history, AI caches and encrypted WooCommerce credentials directly to that database. It does not copy an ephemeral file on a timer or fall back to local storage after a failed remote operation.

The official `@libsql/client` runs in a dedicated worker so existing synchronous transaction boundaries remain intact. SQL calls block the main server thread while waiting for the worker; this is a low-volume prototype adapter, not a high-throughput architecture. A slow database can delay all requests. A 30-second timeout closes the adapter and reports an uncertain outcome, never automatically repeats the SQL write. Remote latency, load, service quotas and hosted restart behavior require verification before calling the deployment reliable.

## Setup you must complete

1. Register for a free Turso account at https://turso.tech/. Check current free-plan limits; no paid plan is provisioned by this repository.
2. Create an empty **libSQL-compatible** database and generate a database-scoped token. Obtain its `libsql://…` URL. The adapter uses the libSQL SDK, not a different Turso Cloud native protocol.
3. Enter the URL and token privately in Render Environment as `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Never put the token in chat, GitHub or a `VITE_` variable.
4. Set `RESTORECART_REQUIRE_PERSISTENCE=true`. Missing external configuration will then stop startup instead of allowing a temporary SQLite deployment.
5. Rebuild/redeploy only after migration decisions below. No new Render disk is required. Existing accounts do not move merely by setting environment variables.
6. Check Settings → Data storage. Then verify a seller account, source image, sandbox receipt and recovery record before and after a Render restart. This hosted verification has **not** been performed yet.

## Preserve an existing local database

Migration is an explicit operator action. Stop source writes before the final copy/cutover and keep a private SQLite backup. Do not run two live backends against different databases during cutover.

Read-only inventory (does not connect to a destination):

```sh
npm run restorecart:storage:migrate -- --source=/absolute/path/restorecart.sqlite
```

With external credentials privately configured, copy to an **empty** destination:

```sh
npm run restorecart:storage:migrate -- --source=/absolute/path/restorecart.sqlite --apply
```

The tool takes a consistent read snapshot, copies all RestoreCart tables including blobs and password hashes, verifies row counts inside one write transaction and refuses non-empty destination tables. Source data is never overwritten. A lost ephemeral Render database cannot be recovered by this tool. For a large source, transaction duration/provider limits may require a different bulk migration method; do not assume an unverified upload succeeded.

Keep `WOOCOMMERCE_ENCRYPTION_KEY` unchanged if migrating encrypted connections. Keep all data backups private: unlike a catalog-only shop backup, the database includes accounts, receipts, buyer details and operational history.

## What is verified locally

Actual libSQL client with a local file transport: transactions commit and roll back, accounts and binary uploads survive reopening, captured payment references and stock moves persist, recovery journals survive reopening and repeated reconciliation does not duplicate changes. This is adapter verification, **not evidence of a live Turso deployment**.

WooCommerce uses a controlled automated transport in tests: connection access, preview without writes, unsupported SKUs, stock conflicts, uncertain create/finalize results, lease locking, retries and restart recovery. A real WooCommerce test store is still required. No real credentials or hosted store mutations were used in these tests.
