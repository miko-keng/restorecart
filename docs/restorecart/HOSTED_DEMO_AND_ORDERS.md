# Hosted demo, migration audit and order views — 30 October 2026

## Root cause and extraction audit

The prior seeder created synthetic accounts only locally and deliberately refused production. Therefore deployment contained the demo source code but no prepared shop for a newly configured hosted seller. This was an initialization gap, not a missing source copy.

Compared all 50 original files matching server/restorecart, src/restorecart, scripts/restorecart*.ts, tests/restorecart*.test.ts, examples/restorecart, docs/restorecart, the public icon and configuration against the standalone repository before these changes. No files were missing. Only server/restorecart/index.ts differed, for the intentional standalone /healthz route. The required shared server/paypal.ts, tests/evidence files, dependency declarations, frontend entry point, license and deployment setup were also included in extraction. Historical evidence remains historical.

Private .env files, trial licence values, account databases and actual merchant orders remain excluded. An old database belongs to its original users; it is not converted into fake hosted sales.

## Hosted setup

- Bootstrap only an empty configured seller workspace, using a prepared Sunday Studio Demo draft.
- Any authenticated seller can explicitly load a prepared demo owned by that seller through POST /api/restorecart/demo/prepare.
- CSRF and seller-role checks apply. Concurrent requests share one setup task; repeated requests preserve saved review, publication and sales.
- Two source files, source-backed products and contact/pickup details are preloaded. Confirmation, physical stock count and allocation remain unresolved.
- Status examples remain clearly simulated client cards, never rc_orders or recovery/payment records.

## Useful sponsor views

AG Grid Community 36.2.0: sorting, column filters, quick search, numeric order/refund amounts, pagination, and opening the order action card. This does not use AG Studio or its trial key.

Bryntum Scheduler Pro trial 7.3.7: a read-only timeline of actual saved pickup appointments at one counter per shop. Official npm trial alias and matching React wrapper; install scripts disabled. Lazy loaded, with an ordinary appointment list and card view available. Local evaluation defaults enabled; hosted builds default disabled unless VITE_ENABLE_BRYNTUM=true under applicable rights. No extra API service, model call or payment is involved.

Pickup scheduling validates paid status, no refund/checking refund, not collected, a positive 1–240 minute interval and no overlap with another active paid pickup at the same shop. Adjacent windows are permitted. Times are stored as explicit ISO offsets and shown in the browser's local timezone. Rescheduling an order does not change its immutable purchased lines/prices, payment state or stock. No customer appointment-confirmation notification or shipping tracking is implemented. The existing original-store schema does not include these optional appointment windows.

## Verification

- Full regression and HTTP integration suite: 82 tests passed, zero failures/skips.
- New coverage: hosted empty-workspace bootstrap, concurrent/idempotent demo setup, role/CSRF/ownership isolation, absence of fabricated sales, unpaid/refunded/collected appointment rejection, overlapping/adjacent windows, invalid durations and buyer receipt/history visibility.
- Fresh production startup was checked with a temporary database: configured seller sign-in succeeds, one owned demo draft appears with two sources and three unresolved products, and the order list is empty. The loopback test forwarded the production cookie explicitly; secure-cookie settings remain unchanged.
- Both README Mermaid diagrams pass parsing.
- Production TypeScript/build check passes. Large vendor chunks remain lazy-loaded and produce a size warning.
- Browser check used a separate temporary SQLite database and a single explicitly simulated paid order. No real merchant records, live Gemini calls or PayPal requests were used.
- Browser observed the prepared draft, AG Grid row display, quick-filter no-match/match results, opening an order action card, and the Bryntum timeline with the exact saved pickup interval.
- An initial dev-only late dependency optimization caused duplicate React loading. Added React deduplication, preoptimization and a separate HMR port; the repeated browser check rendered both views. An error boundary keeps Cards usable if an optional view fails.
- Screenshots in tests/evidence/restorecart-ag-grid-qa.png and tests/evidence/restorecart-bryntum-qa.png show isolated QA data, not evidence of a new sandbox transaction.

Official references:
- AG Grid React installation: https://www.ag-grid.com/react-data-grid/installation/
- Bryntum React trial setup: https://bryntum.com/products/schedulerpro/docs/guide/SchedulerPro/quick-start/react
- Public trial registry: https://bryntum.com/products/scheduler/docs-llm/guide/Scheduler/npm/repository/public-repository-access.md
