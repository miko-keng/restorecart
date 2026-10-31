# Hosted rescue-to-return verification — 31 October 2026

## Version and environment

- Implementation: `85c947470c5a3985434e60d1430585fe13337d9e`.
- Hosted app: https://restorecart.onrender.com/restorecart
- Render service: RestoreCart, free Node service; deployment of the implementation confirmed succeeded/live.
- Hosted `/healthz` returned `status: ok`, `application: restorecart`.
- Separate disposable seller/buyer accounts were used. Existing user shops and local localhost:4388 records were not edited by the test.
- No fresh Gemini API call was made. The genuine saved 30 October review was shown with its provenance.

## Actual browser journey

| Scenario | Observed result |
| --- | --- |
| New seller registration | Account created; separate empty workspace |
| Prepared catalog after reset | Source records, shop details and three unresolved products loaded |
| Saved Gemini review | Blue mug $18 PDF / $20 CSV conflict, source names, saved-result label; no API call |
| Human review | Blue $20/count8/allocation3/source explanation; Red $18/count5/allocation2; Tote $12/count4/allocation2; all checked and Mark ready |
| Preview and publication | Three ready products shown; published shop usable by the buyer |
| Buyer registration | Shopping opened directly; one app login for the shop |
| Basket | 2 × Blue mug + 1 × Natural tote = $52 USD |
| Initial payment attempt | Configuration error kept payment unconfirmed. Unapproved checkout canceled; no success claimed |
| Corrected configuration | Operator privately corrected the sandbox secret; matching local credential pair independently authenticated (HTTP 200) |
| Real PayPal sandbox checkout | Redirected to sandbox.paypal.com; test buyer approved $52; app returned paid and confirmed verified capture |
| Capture verification | Receipt reported a verified sandbox capture, paid and Preparing. Detailed provider reference retained privately. |
| Actual seller Orders | AG Grid contained the same 2 mugs + 1 tote order, paid, $52, refunded $0 |
| Pickup appointment | 1 November 2026, 10:00–10:20, saved against that paid order and shown on its receipt |
| Fulfillment tracking | Seller marked Ready, receipt showed Ready for pickup; then Mark collected and receipt showed Collected |
| Close/report | Stop new orders succeeded; no unresolved payments; Download sales report completed with its confirmation message |
| First local-file comparison | 3 changes: add the captured/collected order; subtract 2 Blue and 1 Tote; captured/net $52, refunds $0 |
| Apply | Updated supported Original Store JSON v1 destination to revision 1 |
| Repeat comparison | 0 changes, 1 order already recorded; resulting inventory Blue6/Red5/Tote3 |

## Public evidence

- [Hosted marketplace](../../tests/evidence/restorecart-release-hosted-products.png)
- [Saved preview](../../tests/evidence/restorecart-release-hosted-preview.png)
- [Full automated test output](../../tests/evidence/restorecart-release-tests.txt)
- [Production build output](../../tests/evidence/restorecart-release-build.txt)

Detailed transaction screenshots, private receipt links and provider transaction references are excluded from this public report. Local transaction screenshots are retained in the ignored `.data/release-evidence/` folder for the entrant to review.

## Limits of this evidence

The payment used real PayPal sandbox APIs and test funds, not a simulated transport. The independent HTTP unit/integration suite still uses controlled provider fixtures. The live journey does not prove every failure mode or independently prove hosted webhook delivery; worker/webhook contracts are covered by automated tests.

The destination is the supported local JSON adapter, not an automatic write to a live Shopify/WooCommerce store. WooCommerce remains optional and real-store unverified. No external persistent database was activated. A configuration redeploy removed app accounts and the temporary shop, confirming the documented reset risk; prepared records could be loaded again, but old app transactions did not become persistent.

For role switching during the test, the old buyer receipt tab was closed before authenticating the seller; its saved receipt link was then reopened for tracking. Use separate browser profiles for simultaneous buyer and seller rehearsal, as documented. Ordinary tabs share a session and are not isolated role environments.

The final public video remains pending; these screenshots and test outputs are not claimed to be a completed video. The original Bryntum setup note was located and summarized in BRYNTUM_SETUP.md; it does not establish personal trial expiry or hosted evaluation entitlement.
