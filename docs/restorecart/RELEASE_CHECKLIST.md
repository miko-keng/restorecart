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
| Final source push | Implementation commit `85c9474` pushed to main |
| Latest Render deploy | `85c9474` succeeded and Live; corrected-configuration deployment confirmed |
| Public repository / license | GitHub marks repository Public; MIT license visible in About and root LICENSE |
| Hosted seller/buyer journey | Test seller and buyer registered; isolated draft prepared; genuine saved Gemini conflict reviewed; three products confirmed, previewed and published; $52 buyer basket verified |
| Hosted actual sandbox capture / fulfillment / repeated local recovery | Passed on `85c9474`: $52 captured; actual seller order; scheduled pickup; buyer Ready/Collected; first return 3 changes; repeat 0 changes / 1 already recorded |
| Video | Recording script ready; final recording/upload/public URL pending |
| Bryntum entitlement | Trial package 7.3.7 confirmed; original BRYNTUM_SETUP.md located and documented; it contains no personal trial start/expiry or hosted evaluation entitlement. Appointment-list fallback retained. |
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

## Hosted payment diagnosis

The deployed app created an order for $52 and correctly retained Payment checking after PayPal connection failed. Its unapproved checkout was canceled; no paid order or fulfillment was fabricated. A private comparison confirmed that the hosted client ID matches the known-working sandbox app, while the configured secret differs. The local pair authenticated against PayPal sandbox (HTTP 200). Credential values are not included in this report. The operator corrected the secret privately and redeployed; the retry then completed the actual $52 sandbox payment, fulfillment and duplicate-safe recovery. No fake payment was substituted. That configuration redeploy discarded temporary app records, so the test seller/buyer and prepared shop were recreated using the documented reset procedure.

## Completion and remaining user work

Engineering, local regression, source push, Render deployment and the advertised hosted rescue-to-return journey are complete. See [hosted report](HOSTED_RELEASE_REPORT.md). Final evidence/documentation is pushed with Render's documented `[skip render]` phrase because it changes no runtime code and an unnecessary redeploy would discard the demonstrated transaction records. The running implementation remains `85c9474`.

The final video has not been recorded or uploaded; the user confirmed none exists. The exact script is prepared. Public YouTube-link validation and adding that URL to the submission remain pending. Bryntum's personal trial expiry/hosted entitlement is not established by the located setup file; retain the list fallback and do not claim it is verified.
