# Approved RestoreCart improvements — 31 October 2026

## What changed

- Startup prepares an immediately published **Sunday Studio Sample Shop**, separate from **Sunday Studio Demo**, the unresolved $18/$20 review draft. The sample has a stable URL `/s/sunday-studio-sample` and belongs to the configured seller. It uses illustrative product artwork and preloaded sample stock; these are not AI outputs or actual merchant counts. No orders/payments are seeded. Restarting with an existing database never replenishes stock or reopens a closed sample.
- AI requests have durable SQLite quotas: 12 calls per seller and 60 globally per one-hour window by default. Configure `sellerCallsPerWindow`, `globalCallsPerWindow`, `windowSeconds` in `restorecart.config.json`. Calls are reserved atomically before contacting Gemini; unsuccessful requests count. Cached answers consume no new allowance. Quotas renew automatically. Temporary hosting can still lose this database and its quota history.
- Each product retains its own unsaved draft through other-product saves and ordinary refreshes. Drafts are namespaced by account, shop and SKU in browser session storage, expire after 24 hours and contain no API keys. Discard edits explicitly to load saved fields. A product changed by another saved version requires review; server revisions still prevent overwrites. Use a private browser profile for a shared computer.
- Payment retries record redacted diagnostic events and a heartbeat. The seller sees pending checks/retries and retains **Check PayPal again**. Public health remains non-sensitive. No AI can mark an uncertain payment paid.
- The seller journey reads **Import → Resolve → Publish → Fulfill → Return sales**. The reset notice, draft preview, published shop and optional recovery integrations have distinct labels.
- Optional WooCommerce test-store connector provides encrypted credentials, read-only comparison, explicit confirmation and journaled recovery. It is **Not connected** by default. See [connector setup and limits](WOOCOMMERCE_TEST_CONNECTOR.md).

## Free hosting boundary

SQLite is still local temporary storage on Render Free. Seeding makes a fresh demo usable; it does not reconstruct lost orders, accounts, capture references, recovery journals or connection credentials. A shop backup excludes transactions. Do not promise permanent merchant recovery using this deployment. Never redeploy midway through a recorded transaction/recovery demonstration.

## Operator configuration

`RESTORECART_TRUST_PROXY_HOPS` defaults to 0, ignoring forwarded IPs for login throttling. Set it to the exact trusted ingress hop count (0–2) only after verifying the deployment topology. Do not use a blanket trust-all value. Tests demonstrate forged forwarded addresses cannot bypass the default limiter and distinct clients separate only with an explicitly trusted proxy hop. Render's actual forwarded chain has not been inspected in this implementation.

Existing Render variables and webhook registration remain necessary. These changes are local until a separately authorized push/deployment. Changing `VITE_ENABLE_BRYNTUM` needs a build. Hosted timeline use still requires applicable evaluation rights. No new libraries or paid services were purchased.

## Evidence boundaries

- Automated tests use injected PayPal/WooCommerce/AI transports. They do not contact a live merchant store or establish hosted webhook delivery.
- Browser tests use an isolated local database; the user's existing rehearsal database is not reset.
- A separate opt-in synthetic fresh-file Gemini check reports the actual result in `tests/evidence/restorecart-approved-fixes-live.json`.
- Earlier local real sandbox checkout evidence remains in `FINAL_E2E_REPORT.md`; it is not represented as a new payment in this run.
- Actual merchant trials, physical-device testing and final video remain human validation tasks; browser breakpoint and keyboard smoke checks are recorded in APPROVED_FIXES_TEST_REPORT.md. The supplied merchant protocol records outcomes without inventing results.
