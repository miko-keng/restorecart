# RestoreCart submission text

## Tagline

Keep selling from the records you have. Bring every emergency sale back.

## Problem and audience

A small merchant whose storefront is unavailable may still have spreadsheets, PDFs and product photos. Rebuilding listings is only part of the problem: conflicting prices, uncertain stock and emergency orders must be reviewed and accounted for when the original store returns.

## What RestoreCart does

RestoreCart helps a merchant reconstruct a temporary pickup catalog, resolve conflicting evidence, publish reviewed products, accept PayPal sandbox payments, fulfill orders and return recorded emergency sales through a duplicate-safe local recovery file. Buyers search products with visible seller attribution, save a basket and track pickup status from their receipt.

The distinctive workflow is evidence → human decision → verified payment → fulfillment → repeat-safe return. AI proposals cannot approve stock, publish listings or mark a payment paid. The system preserves original records and makes missing information visible.

## How we built it

React and TypeScript provide separate buyer/seller views in one application. Express enforces ownership, sessions, CSRF checks, catalog prices and inventory reservations. SQLite stores operational records. An optional external libSQL adapter is implemented, but the submitted default hosted prototype uses resettable local storage.

PayPal Orders, capture verification, refund handling and verified webhook reconciliation are central to the order lifecycle. Server-side amount/currency checks and idempotent journals prevent repeated capture processing. One configured sandbox merchant receives prototype payments; independent seller payout onboarding is outside scope.

Gemini interprets source documents and images, proposes catalog details with evidence references, flags disagreements and asks focused questions. Results are validated before becoming drafts; sellers approve the sellable facts. A genuine recorded review is replayable for reliable demonstrations and is clearly labelled with its original provenance. Saved replay is not presented as a fresh API request.

AG Grid Community supplies searchable/filterable order management. Bryntum Scheduler Pro is an optional evaluation-only pickup timeline; a plain appointment-list fallback remains available. Render hosts the application. No AG Studio AI product is claimed.

## Challenges and what we learned

Making a storefront appear is easier than maintaining trustworthy state. We separated draft and published catalogs, kept payment uncertainty visible, preserved other unsaved product edits, and tested recovery repetition against retained transaction journals. Recovery currently supports Original Store JSON v1; an optional self-service WooCommerce test connector accepts seller-entered URL and encrypted credentials without per-store operator approval; real-store verification remains pending.

## Demonstrated scope and limits

This is a working sandbox prototype, not a production disaster-recovery guarantee. The default free hosted database may reset and lose accounts/orders. Sample order statuses are simulated and do not enter financial or recovery reports. Catalog backups exclude orders and payments. External persistence is optional and not cloud-restart verified. No merchant impact metrics or novice trials are claimed without evidence.

Automated verification: 153 tests passing, covering server workflows, validation, stock/payment idempotency, recovery, storage contracts and connector contracts. A historical real local Gemini + $52 PayPal sandbox journey is documented separately. The hosted release report documents a real $52 sandbox purchase through fulfillment and repeated local recovery on implementation 85c9474. The latest local report separately covers self-service security and recovery-summary changes. No new live WooCommerce or PayPal run is implied by controlled tests.

## Links

- Code: https://github.com/miko-keng/restorecart
- Demo: https://restorecart.onrender.com/restorecart
- Video: PENDING — add the public YouTube URL after recording and signed-out verification.
- Exact recording actions and narration: ../../DEMO_REHEARSAL_GUIDE.md

## Next steps

Activate and verify external persistence, test the optional connector against a consenting merchant's test store, and run observed merchant trials measuring time to publish and successful reconciliation. These are future validation, not claimed achievements.

Local operational enhancements add source-linked seller decision history, filtered AG Grid financial totals and CSV export, and confirmed Bryntum pickup rescheduling. Six controlled AI validation scenarios are included; these are not a fresh model accuracy benchmark. See [current local report](PRIORITIES_12367_REPORT.md).

Connect PayPal seller onboarding is implemented locally with controlled tests; actual sandbox platform configuration and external consent verification are pending. The existing shared-account sandbox demonstration is not evidence of verified marketplace onboarding.
