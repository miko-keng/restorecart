# Final release verification — 31 October 2026

## Agreed scope

Resettable sandbox prototype; no external database registration is required for this release. WooCommerce is implemented as an optional seller-configured test connector; real-store verification remains pending. Video shows genuine saved Gemini replay and an actual PayPal sandbox transaction, never a simulated payment.

## Local verification completed

- 114 tests passed, no failures or skipped tests; production build passed.
- Desktop/mobile visual checks completed; page-wide horizontal overflow absent on checked mobile pages.
- Isolated database on port 4391: seller sign-in, incomplete draft save, missing-stock guidance/focus, preserving another product's unsaved edit, editing an approved product returning it to Needs review, actionable publish checklist opening the correct product, Mark ready, included/hidden preview, Escape dismissal and publication passed.
- Original localhost:4388 user data was not changed by the isolated scenarios.
- Buyer search/sorting and basket access, actual/sample distinction, AG Grid and Bryntum example timeline checked in the visual pass.
- Payment/recovery/duplicate handling verified by automated controlled-transport tests. Historical real sandbox flow is linked from README; it is not a new hosted checkout.
- Configured private credential values scanned against changed and new files before staging: no matches.

## Release stages

| Stage | Evidence/status |
| --- | --- |
| Final source push | Pending in this release task |
| Latest Render deploy | Pending after push; prior live commit b426755 |
| Public repository / license | LICENSE exists at root; public signed-out check pending |
| Hosted seller/buyer journey | Pending on the new deployed commit |
| Hosted actual sandbox capture / fulfillment / repeated local recovery | Pending on the new deployed commit |
| Video | Recording script ready; final recording/upload/public URL pending |
| Bryntum entitlement | Trial package 7.3.7 confirmed; individual trial start/expiry and hosted evaluation entitlement cannot be established from repository files. Appointment-list fallback retained. |
| External storage | Optional, not configured or cloud-restart verified |

## Submission materials ready

- [Judge access and reset instructions](JUDGE_ACCESS.md)
- [Project description and tools explanation](SUBMISSION_DESCRIPTION.md)
- [Exact recording script](../../DEMO_REHEARSAL_GUIDE.md)
- [Architecture and setup](../../README.md)
- [Render deployment](../../DEPLOY_RENDER.md)
- [Visual verification](VISUAL_POLISH_QA.md)

## Trial and rules references

Bryntum's installed package identifies itself as a trial; a generic 45-day duration does not establish this user's start date or applicable distribution entitlement. Confirm these privately from the evaluation email/customer account; do not commit a license key. The hosted plain appointment-list fallback remains available.

- https://bryntum.com/products/license/
- https://bryntum.com/download/
- https://paypalaihackathon.devpost.com/rules

The rules list judging as 1–15 December 2026. Do not infer trial coverage through that period from an October download without checking the actual entitlement. No expiry date is fabricated here.
