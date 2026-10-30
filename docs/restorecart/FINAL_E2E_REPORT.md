# Final seller/buyer E2E report — 30 October 2026

## Result

Ready for rehearsal on the verified local standalone build after two UI fixes. Full automated suite: **84 passed, zero failures/skips**. Production build passed. A real PayPal sandbox checkout and a live Gemini review succeeded. No real-money transaction occurred.

Testing used a separate local SQLite database on port 4386. Existing merchant/demo databases and Render records were not modified. A fresh rehearsal copy is on port 4387 with no sales and unresolved review fields. It uses saved local sandbox/AI configuration, without copying secrets into the public repo. The rehearsal service is a local development process; after a machine/app restart it may need starting again.

## Scenario results and evidence boundary

| User story | Result | Evidence type |
| --- | --- | --- |
| Seller opens prepared Sunday Studio Demo | Two sources and shop details prefilled; three products require review | Browser |
| AI resolves surviving-record ambiguity | Live Gemini identifies $18/$20 Blue mug conflict and asks seller; no silent publication | Live Gemini + browser |
| Seller confirms prices/counts/allocations | Publish blocked first; then 3 ready, preview correct and publication succeeds | Browser |
| Buyer finds tote and sorts prices | Keyword finds tote, price ascending and named merchant retained | Browser |
| Buyer edits mixed basket and signs out/in | 2 blue mugs + 1 tote = $52; cart restored after login | Browser |
| Buyer checks out | Saved sandbox personal buyer signs into real PayPal sandbox and approves $52; server verifies completed capture; cart clears | Live sandbox + browser |
| Seller handles paid order | Correct order appears in Orders and AG Grid; status filters change with pickup actions | Browser |
| Seller schedules pickup | Saved 31 October, 10:00–10:20 MYT; buyer sees time, Bryntum shows saved interval | Browser |
| Buyer follows progress | Receipt changes Preparing → Ready → Collected automatically, without manual reload | Browser |
| Seller closes rescue shop | Quantities and checkout become disabled publicly; export blocked before closure | Browser |
| Seller downloads final report | Actual downloaded CSV contains $52, MUG-BLU, TOTE-NAT and collected state | Browser download + file inspection |
| Seller returns emergency records | First compare: one order + two stock events = 3 changes; output stock 6/5/3 | Browser + downloaded JSON |
| Seller repeats return | 0 changes, 1 order already recorded; one output order and two inventory events | Browser + file inspection |
| Seller reopens backup | Versioned backup preserves three products, two sources, corrections and contact details; no orders copied; counts/allocations reset | Browser upload + UI |
| Seller practices backup recovery | Isolated rehearsal cannot publish; return practice passes 2 first changes / 0 repeated changes | Browser |
| Seller refreshes restored draft | Initial failure fixed: selected owned restored/rehearsal draft is remembered; all owned shops remain selectable | Browser retest + regression |
| Seller tries refund after collection | Server rejects before PayPal refund; unsupported UI action now hidden with an explanation | Browser negative + regression |
| Buyer cancels, payment stalls, provider times out, stock races | Existing transport-injected scenarios verify cancellation, stock locks, retries, amount/merchant checks and idempotency | Automated HTTP/domain, not new live provider tests |
| Seller refunds uncollected order and later returns refund delta | Full refund, explicit restock and later repeat-safe return changes pass | Automated injected-transport integration, not a successful live refund in this run |
| Seller imports unusual columns or mismatched photos | Source mapping, conflicting evidence and exact variant/photo confirmation pass | Automated HTTP/domain |
| Buyer/other seller tries private records | Role, CSRF and ownership restrictions pass | Automated HTTP |

## Verified values

| SKU | Price USD | Physical count | Set aside | Bought | Remaining emergency stock | Original-store count after return |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| MUG-BLU | 20.00 | 8 | 3 | 2 | 1 | 6 |
| MUG-RED | 18.00 | 5 | 2 | 0 | 2 | 5 |
| TOTE-NAT | 12.00 | 4 | 2 | 1 | 1 | 3 |

Captured $52; refunded $0; net $52. One captured order remains collected. The attempted collected-order refund was rejected before any provider refund. Original-store output contains one order and two stock events. The public six-state illustrations never created orders, financial totals or stock events.

## Fixes found during E2E

1. Demo-first selection overrode a restored draft on refresh, while the selector hid other owned shops. A shared selection helper now resumes the remembered owned shop first, then the demo, then the first available shop. It never accepts a remembered ID outside the seller's returned authorized list. Selector exposes all owned shops. Browser refresh retest passed.
2. A collected paid order showed Refund options although the server allows uncollected refunds only. Shared UI eligibility now requires verified capture, paid/unrefunded/uncollected state and no checking refund. Collected orders show an explanation. Server rejection remains unchanged. Browser retest and new tests passed.

## Limits before a hosted recording

This was a local browser/API run, not a check of your current Render deployment. Deploy the final fix commit first. Hosted credentials, current model quota, correct base URL and the new PayPal webhook registration still need to be configured there. Local return-page reconciliation verified the capture; external webhook delivery was not verified. Gemini remains persistently live with existing budgets. Routine tests used fixtures and did not change the saved AI setting.

Original Store JSON v1 is a local destination adapter, not an automatic Shopify/WooCommerce update. Simulated order illustrations must not be presented as provider-verified sales. Bryntum is an optional evaluation view; hosting rights and the build flag still apply. Free Render filesystem storage can be lost on restart/deploy.

See ../../DEMO_REHEARSAL_GUIDE.md for exact rehearsal inputs and buttons. Screenshots and machine-readable summary are in tests/evidence. No API keys, sandbox passwords or receipt access tokens are included in this report.
