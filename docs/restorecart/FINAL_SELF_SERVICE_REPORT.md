# Final self-service verification — 1 November 2026

## Result

**125 automated tests passed; zero failures, cancellations or skipped tests. Production build passed.** This updates the earlier 114-test release. Eleven new security/connection tests and recovery-summary assertions were added. Existing payment, account ownership, CSRF, inventory, refund, uncertain-write, duplicate and storage tests continue to pass.

- [Full test output](../../tests/evidence/restorecart-final-self-service-tests.txt)
- [Build output](../../tests/evidence/restorecart-final-self-service-build.txt)

The existing large optional AG Grid/Bryntum chunk warnings remain; these are build warnings, not errors. No dependency or payment-provider integration was replaced for this work.

## Implemented

1. **Self-service test-store connection:** selected seller shop → Settings → WooCommerce → URL, consumer key and secret → Test connection and save. No per-store operator allowlist. One private deployment encryption key is required. The form remains visible if setup is missing and explains why saving is unavailable.
2. **Safeguards and tests:** root HTTPS domains/443 only, bounded input, prohibited ambiguous URLs, conservative special-address blocking for IPv4/IPv6, all-answer DNS validation and per-request pinning, normal TLS hostname verification, no redirects, 20-second total deadline including DNS, 8 MB response limit, four concurrent outbound requests, ten connection attempts per seller per ten minutes. Errors give next steps without including remote bodies or credentials. Test connection is read-only; saved credentials are encrypted.
3. **Actual-data recovery summary:** returned order and stock-change counts, captured/refunded/net totals and existing-order count come from reconciliation. Technical detail is collapsed. A repeat comparison with retained history shows Return verified only if conflict-free with zero changes and at least one already-recorded order. Apply is disabled with zero changes.
4. **Updated 2:55 demo:** exact actions, input values, expected result and narration. Genuine saved Gemini review, actual PayPal sandbox purchase, fulfillment, supported local recovery and repeat comparison. Optional connectors stay outside the main video.
5. **Submission materials:** description/tools explanation, public-source/license links, judge access, honest scope, judging-evidence mapping and final human handoff checklist. Video upload and Devpost submission are not fabricated.

## Browser/UAT checks

The main scenario ran on isolated SQLite at port 4392. A deliberately named **Synthetic recovery UI check** shop had one synthetic $10 order and one inventory event. It is not a PayPal capture and is not a submission-demo fixture. The user's existing rehearsal database was not altered by this recovery test.

| Scenario | Observed result |
| --- | --- |
| Seller demo sign-in | Prepared Sunday Studio draft opened |
| Settings with missing server encryption | Connection fields visible, setup explanation, saving disabled |
| Synthetic local return | Two changes: one order plus one stock event; one returned order, captured/net $10, refunded $0; inventory 4 → 3 |
| Repeat comparison | Return verified; one order already recorded; zero new changes; Apply disabled |
| Mobile 390 × 844 | Recovery and connection panels checked; no page-wide horizontal overflow |
| Normal local port 4388 with private encryption enabled | Existing demo seller signed in; Test connection and save available |
| Private-address URL through the actual form, synthetic keys | https://127.0.0.1 rejected with public-domain guidance; no connection saved |

The private local encryption key was generated into ignored `.data/woocommerce.env` with owner-only file permissions and was not displayed or committed. The normal local server was started with this file plus the existing private API configuration, reusing `/private/tmp/restorecart-approved-fixes.sqlite` without resetting it. The isolated test server can be stopped independently. On Render, configure a private encryption key separately once if connector saving is needed.

Screenshots use synthetic test data or blank credential forms:

- [Desktop return verification](../../tests/evidence/restorecart-final-recovery-verified.png)
- [Mobile recovery](../../tests/evidence/restorecart-final-recovery-mobile.png)
- [Mobile connection setup](../../tests/evidence/restorecart-final-connect-mobile.png)
- [Connection form with encryption enabled](../../tests/evidence/restorecart-final-connect-ready.png)

## Boundaries

This is local verification of the new implementation, not a new hosted release or real WooCommerce test. No new Gemini API call or PayPal payment was made for this verification. The historical hosted real $52 PayPal journey remains documented in [HOSTED_RELEASE_REPORT.md](HOSTED_RELEASE_REPORT.md) for implementation 85c9474. The new runtime changes must be deployed before claiming that the hosted URL includes them; redeployment may reset temporary data.

WooCommerce still needs a consenting seller's actual test store for live validation. Connection reading alone does not prove write permission or custom stock-hook behavior. Application tests are not a penetration test or a guarantee against all attacks. External durable storage and trial entitlement through judging are not newly verified. The final public video is not recorded/uploaded by this work.

Implementation references: [WooCommerce merchant API-key instructions](https://woocommerce.com/document/woocommerce-rest-api/) and [OWASP SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## Subsequent UI simplification — 1 November 2026

WooCommerce now appears at the top of Settings under Connections, above Backups and storage. The visible card shows Not connected and Connect store. The button opens the three credential fields, a short test-store confirmation and Connect/Cancel. API-key help and supported-use limitations are collapsed. The existing connector/security contract is unchanged.

Browser checks passed for opening/cancelling the form, initial keyboard focus on Store URL and mobile width without horizontal page overflow. All 125 tests and production build passed again. [Simplified card screenshot](../../tests/evidence/restorecart-woo-simple.png). This UI is included in the self-service source release. Verify Render deployment separately; the browser checks above were local.
