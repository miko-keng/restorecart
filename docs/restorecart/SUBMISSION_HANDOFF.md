# Final submission handoff

## What to submit

- Project name: **RestoreCart**
- One-line pitch: **Reopen from surviving records. Return every emergency sale once.**
- Public source: https://github.com/miko-keng/restorecart (MIT license at root; do not publish secrets).
- Hosted demo: https://restorecart.onrender.com/restorecart
- Browser-only judge access and reset instructions: [JUDGE_ACCESS.md](JUDGE_ACCESS.md).
- Copy-ready description and tools explanation: [SUBMISSION_DESCRIPTION.md](SUBMISSION_DESCRIPTION.md).
- Recording actions, speech and exact values: [DEMO_REHEARSAL_GUIDE.md](../../DEMO_REHEARSAL_GUIDE.md).
- Public YouTube video: **pending recording/upload**. Add its actual link to README and Devpost, then verify signed out. No placeholder should be submitted as a functioning video.

## Evidence against the five equally weighted criteria

| Criterion | Evidence to show | Claim boundary |
| --- | --- | --- |
| Technological implementation | Gemini cites conflicting source prices; seller approval; PayPal server capture checks; stock reservation; repeat-safe recovery | Saved Gemini replay is labelled. Controlled connector tests are not a real WooCommerce deployment. |
| Design | Prepared draft, field-level findings, actionable readiness checks, preview/publish, basket, pickup status, concise return result | Demonstrate one clear journey; skip optional setup panels during the main flow. |
| Potential impact | A specific small merchant reopens from surviving records, fulfills a sale and avoids duplicate stock adjustment | Do not invent merchant trials, time savings, revenue rescued or usage numbers. $52 is a sandbox transaction, not commercial impact. |
| Innovation / idea | Evidence-based reconstruction joined to verified commerce and a traceable return process | Do not claim every individual feature is novel, or that AI autonomously approves payments/stock. |
| Presentation | Under-three-minute functioning video with conflict → decision → payment → pickup → return → zero repeat changes | Real PayPal approval must be visible; sample orders cannot stand in for it. |

## Scope to state in the form

Resettable sandbox prototype; pickup only; one configured PayPal sandbox merchant. The default free hosted database can reset and lose operational records. Hardcoded examples are not previous real purchases. Shop backups exclude payments/orders. Local Original Store JSON v1 recovery is demonstrated. WooCommerce is optional, test-only and live-store unverified. External persistence is optional and not cloud-restart verified. Bryntum is an optional trial timeline with a plain list fallback; personal entitlement through judging has not been established by the setup file.

## Final human actions

1. Use the updated local build or deploy the exact tested changes before recording. A runtime redeploy may clear hosted records; finish purchase and recovery in the same running session.
2. If demonstrating WooCommerce connection saving, privately configure the server encryption key once. No WooCommerce account is needed for the main JSON-recovery demo. Never use invented credentials or pretend a disconnected store is connected.
3. Record the real functioning flow, upload publicly to YouTube, check while signed out, and add the URL to the submission.
4. Provide PayPal sandbox buyer access privately to judges if required; RestoreCart account registration does not create a PayPal account. Never put sandbox passwords or receipt bearer links in the public repository/video.
5. Check Devpost fields, public repo/license, demo link, video duration/access and applicable third-party trial rights. Submit the form yourself; final submission and any legal declarations are not performed by these code changes.

No implementation or test suite guarantees a winning score. The strongest remaining work is a clear, honest end-to-end demonstration using the tested version.
