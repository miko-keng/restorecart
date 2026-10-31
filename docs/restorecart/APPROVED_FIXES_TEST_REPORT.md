# Approved improvements — verification report

Date: **31 October 2026**, Asia/Kuala_Lumpur. Scope: local standalone RestoreCart checkout. Changes have not been pushed or deployed. Existing user rehearsal databases were not reset.

## Automated checks

- **98 tests passed**, 0 failed, 0 skipped; production build and TypeScript check passed.
- Two README Mermaid architecture diagrams parsed successfully.
- Existing domain/HTTP tests continue covering reconstruct → publish → sandbox-transport checkout → fulfillment → local recovery, basket/account persistence, buyer/seller isolation, reservations/stock contention, payment uncertainty, refunds, signed callback validation, duplicate events, backup restoration and repeat-safe recovery.
- New cases cover quota renewal, independent seller allowance, shared cap, concurrent claims and SQLite reopen; sample draft versus published sample; no stock replenishment/reopening at startup; owner/CSRF protection for operations and WooCommerce; trusted versus forged forwarding headers; redacted worker retries; encrypted connection; read-only WooCommerce preview; missing/duplicate/variable SKUs; stale and insufficient combined stock; sequential orders sharing stock; concurrent applies across connector instances; creation timeout; finalization timeout; missing remote references; repeat application; refunded and pending source orders; blocked private network targets.
- Logs: [tests](../../tests/evidence/restorecart-approved-fixes-tests.txt), [build](../../tests/evidence/restorecart-approved-fixes-build.txt), [summary](../../tests/evidence/restorecart-approved-fixes-summary.json).

## Actual Gemini API check

One actual Gemini request reconstructed **CANDLE-LAV at $14.00** and **CANDLE-CIT at $16.00** from a new synthetic CSV using unfamiliar headers (`item_ref`, `display_label`, `asking_usd`, `on_hand`). Both variants retained zero allocation and required human confirmation. Repeating reconstruction used the saved result with **zero additional provider calls**. No global AI mode toggle was needed; config remains live. [Evidence](../../tests/evidence/restorecart-approved-fixes-live.json).

## Actual browser checks

Used isolated SQLite `/private/tmp/restorecart-approved-fixes.sqlite`, local port 4388; no reset of the user's 4387 rehearsal or historical payment records.

1. Marketplace immediately showed three products from **Sunday Studio Sample Shop**, with 8/5/4 units, exact shop identity and illustrative artwork. Searching tote returned the tote. Price ascending displayed $12, $18, $20. Add to basket incremented the badge without reserving stock.
2. Local demo seller could sign in to a separate unresolved **Sunday Studio Demo** draft. Gemini allowance and renewal time were visible; publishing remained blocked while unresolved products existed.
3. Edited Red mug description and Blue mug price/count/allocation at the same time. Saving Blue preserved the unsaved Red description and displayed one remaining unsaved product. Discard returned Red to the saved value. [Proof](../../tests/evidence/restorecart-approved-draft-preserved.png).
4. Recovery displayed **WooCommerce — Not connected** and explained that setup was disabled and file recovery remained available. No destination request or credential entry was needed.
5. At a requested 390×844 viewport (375 CSS content pixels after scrollbar), seller editor, recovery and buyer directory had no horizontal page overflow; checked product inputs remained within width. [Mobile evidence](../../tests/evidence/restorecart-approved-mobile.png).
6. Preview accepted Tab focus inside the dialog and Escape closed it. Reduced-motion CSS was inspected; no full accessibility certification is claimed.
7. Stopped/restarted only the isolated 4388 process with the same SQLite file. Seller sign-in remained valid, saved Blue review remained ready, sample still had three products, and basket survived. This proves ordinary restart behavior with an existing file, not persistence after Render deletes ephemeral files. [Sample evidence](../../tests/evidence/restorecart-approved-sample.png).

8. A second throwaway server deliberately delayed the OrderTable asset for three seconds and returned HTTP 503. The browser showed “Loading order table…”, then the contained error message; switching back to Cards removed the error and retained the seller workspace. No external APIs were used.

## External limits and next validation

- **WooCommerce:** API behavior tested with injected responses, including simulated standard stock hooks. No real WooCommerce store/API key supplied. Real custom taxes, stock hooks and notifications must be checked on a dedicated allowed test store before claiming live support. Variations and refunded sales are deliberately blocked for manual recovery in this connector version.
- **PayPal:** no new actual transaction or refund in this run. Existing actual local sandbox capture remains documented in [earlier E2E report](FINAL_E2E_REPORT.md). New regression tests use injected provider transports. Hosted callback delivery has not been proven for this local un-deployed change.
- **Hosting:** no code push, deployment, paid hosting or store registration performed. Temporary SQLite remains temporary. Login proxy behavior is tested under explicit hop settings; actual Render ingress topology still requires operator verification.
- **Licensing:** AG Grid Community needs no Enterprise key. Bryntum remains optional with a plain appointment-list fallback. The user's actual trial entitlement/expiry and its applicability throughout the December judging period cannot be established from a local package install; operator must verify before enabling hosted trial use. No licence restriction was bypassed.
- **Impact/video:** [merchant trial guide](MERCHANT_TRIAL_GUIDE.md) has no invented results. The updated [three-minute guide](../../DEMO_REHEARSAL_GUIDE.md) supplies actions, speech and exact inputs. Actual merchant trials, final video and complete device/accessibility testing remain external validation.

## Follow-up: confirmation and evidence layout

The user reported stretched checkboxes and off-screen labels. Fixed the inherited full-width checkbox style, added bounded text spans, grouped evidence by document/location, hid raw excerpts behind their own disclosure, and clarified AI review versus seller confirmation. Browser verification measured each visible confirmation checkbox at approximately 16px and confirmed its text stayed inside the label. Existing user inputs were not saved/discarded by this check; no Gemini request was made. Production build passed. [Fixed screen](../../tests/evidence/restorecart-confirm-ui-fixed.png).
