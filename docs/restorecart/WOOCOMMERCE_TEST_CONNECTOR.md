# Optional WooCommerce test-store return

The connector is implemented but **live WooCommerce recovery is not verified** until an actual test store is connected and exercised. Without credentials, the app says **WooCommerce — Not connected**. Existing sales reports and local Original Store JSON v1 recovery continue working independently.

## Setup, when you have a test store

1. Use a dedicated HTTPS WooCommerce test store, never a live merchant shop. Do not buy a service just for this connector. Create simple USD products with unique matching SKUs, explicit managed stock, and no unexpected taxes/shipping. The sample uses MUG-BLU, MUG-RED, TOTE-NAT with stock 8, 5, 4.
2. Create WooCommerce REST API read/write consumer credentials for that test store. See [official authentication instructions](https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication). You must have appropriate authority to create these credentials; this implementation creates no external account or agreement.
3. Deployment setup, once for all sellers: set a server-only `WOOCOMMERCE_ENCRYPTION_KEY` of 32 random bytes represented by 64 hex characters. There is no per-store allowlist or operator approval. The previous `WOOCOMMERCE_TEST_ORIGINS` variable is no longer used. Generate privately with `node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"` and put it directly into local environment/Render, not GitHub or chat. Preserve the same key while retaining this database; changing it requires reconnecting.
4. Seller opens **Settings → Connections → WooCommerce → Connect store**, enters the test-store origin, consumer key and secret, confirms test-only use, then **Connect**. The check reads products/orders. Successful connection does not claim write permission or validate custom stock hooks.
5. Resolve all RestoreCart payments/refunds and stop new orders. Pause other sales/stock edits on the destination during a return.
6. **Compare WooCommerce return**. Review external sale amounts and matched product quantities. Missing/ambiguous SKUs, variations, unmanaged stock, refunded sales, changed records and uncertain outcomes block unsafe writes.
7. Confirm the destination is paused, then **Confirm return to test store**. Recompare: zero new orders and existing references should be reported. Inspect actual WooCommerce order amounts and stock as part of live validation.

## Technical contract

Uses official `/wp-json/wc/v3/products` and `/orders` resources with HTTPS Basic authentication. Credentials are stored only on the server, AES-256-GCM encrypted in SQLite; public/UI responses never echo them. Public root-domain HTTPS URLs on port 443 only; raw/numeric IP aliases, embedded credentials, paths, queries, fragments, escapes and local domain forms are rejected before DNS. Every request validates all returned addresses, rejects private/special-use ranges and pins an accepted address while retaining the original TLS hostname. Redirects are rejected. The full 20-second deadline includes DNS and response reading; a delayed DNS result cannot send a late request. Responses are capped at 8 MB, outbound requests at four concurrent requests per process, and connection attempts at ten per seller per ten minutes across that seller's shops (retained in the database). Credential inputs are bounded to 128 characters. This is a tested application-layer safeguard, not a penetration-test certification or a production security guarantee. No browser-to-WooCommerce secret requests are made.

A captured sale is matched by a `restorecart_capture` metadata reference. Create an externally paid **pending** order with `set_paid:false`, no payment gateway, original USD line totals and original capture reference. Validate the returned order, then transition it to **on-hold** or **completed** (collected) so WooCommerce's standard one-time stock reduction handles inventory. The connector never issues an absolute stock overwrite or invokes a payment/refund gateway. Custom WooCommerce plugins/hooks may change stock behavior: the connector checks resulting stock and stops on a mismatch.

A SQLite journal records creation/finalization before external writes. A per-destination lease prevents simultaneous local applies and is renewed on requests. After a lost creation response, scan for the reference before resuming; if no result is discoverable, stop for operator inspection rather than repeating a POST. After a lost stock/status response, verify the existing order and final combined stock before marking done. Partial completion needs a new comparison. Repeated application does not blindly repeat uncertain writes.

## Current limits (intentional)

- Supports simple, managed-stock, USD products. Variations and automatic refund/restock export are blocked, not guessed. Local JSON recovery still handles its supported refund deltas.
- Scans at most 2,000 destination orders to prove reference lookup is complete. Larger stores require a stronger indexed destination adapter.
- Remote WooCommerce writes are not a distributed atomic transaction with SQLite. Pausing concurrent destination changes is required. Failures can leave a pending order requiring inspection. Never reset/delete the local journal to force a retry.
- No automatic customer account matching, shipping, emails, tax reconstruction, gateway refunds, live merchant use or independent merchant onboarding is claimed. A configured WooCommerce store may still trigger its own status hooks/notifications.
- The local journal is lost if temporary Render storage disappears. Destination metadata is an additional duplicate check, not a replacement for durable operations storage. An active destination reference without a local journal is blocked for inspection.
- Lease expiry after an interrupted process can delay a retry by up to 30 minutes. Inspect before forcing any recovery.

## Acceptance cases before claiming live support

Test exact SKUs and stock; insufficient combined stock; duplicate SKU; variable product; wrong currency/amount; already-refunded source sale; stale preview; simultaneous apply; timeout after POST; timeout after status change; later recompare; missing remote reference; nonstandard stock hook; changed destination stock. Verify zero new PayPal charges and that transferred quantities match destination inventory changes. Use only synthetic orders and sandbox funds.

## Final connection flow

Settings → WooCommerce shows Connect test store → Recovery preview → Confirm return. The connection form accepts the seller's test-store HTTPS origin and consumer key/secret, saves credentials encrypted only after read access succeeds, and never changes store data during connection testing. The read test does not establish write permissions or plugin stock-hook compatibility.

For a new store, install WooCommerce on a non-production WordPress installation you control, add simple USD managed-stock products with the exact sample SKUs MUG-BLU, MUG-RED and TOTE-NAT, then create a dedicated Read/Write REST API key under WooCommerce → Settings → Advanced → REST API. The seller enters their own URL directly; no deployment operator approves individual stores. Configure `WOOCOMMERCE_ENCRYPTION_KEY` privately once for the deployment. Without it the form remains visible with a clear setup notice, and saving is disabled; the server also refuses plaintext storage. No store is provisioned or registered automatically.

After stopping RestoreCart checkout and resolving payments, compare before confirming. Inspect payment references, quantities, conflicts and current stock. Pause other store writes, explicitly confirm the return, then compare again. A successful repeated comparison should show zero new changes. Connection stages and a saved last-return check persist in the database; these are not a certification of every WooCommerce configuration.

A real-store test must include a paid sandbox emergency order, unsupported product, stale-stock rejection, repeated comparison and an interrupted return. No real-store verification has yet been completed because no test store is configured.

## Self-service verification — 1 November 2026

Controlled tests cover URL normalization/rejection, private/reserved IPv4 and IPv6, mixed DNS answers, pinned per-request lookup, blocked redirects, authentication errors without response-body leakage, invalid/oversized JSON, total DNS/response deadlines, concurrency limits, seller-scoped attempt limits, missing encryption, encrypted credential storage, read-only connection and disconnect. Existing HTTP tests enforce owner-only access and CSRF; existing return tests cover stale stock, unsupported variants, uncertain writes, destination leases and repeat-safe reconciliation. No test connects to an arbitrary external merchant. No real WooCommerce return is claimed.

The entry path is complete for supported test stores, but saving a connection on a particular deployment requires its encryption key. A successful read test does not prove write permissions, account ownership beyond possession of credentials, or compatibility with custom plugins. WordPress subdirectory installations, custom ports and production stores remain outside this prototype's scope.

## Simplified connection interface

Settings now puts a visible WooCommerce card under Connections, above backups/storage. It shows Not connected and a Connect store button. The button opens Store URL, consumer key, consumer secret, the test-store confirmation, and Connect/Cancel. Key instructions and supported-use limitations are collapsed. Connected status means API read access was checked; it does not certify a completed recovery. Connector guards and the test-only server contract are unchanged.
