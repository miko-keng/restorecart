# Sample chat and reliability review

Orders → Sample preview now includes a preparation walkthrough for **1 Blue mug · $20 · Preparing**. Approve changes only the panel's local sample to Ready for pickup; Reject leaves it Preparing. Reset allows either path to be rehearsed again. Neither action calls an API or changes the shared order examples, payments, inventory or recovery reports.

## Record a genuine response

Run `npm run restorecart:record-sample-chat` with `GEMINI_API_KEY` configured in the environment or local `.env`, then rebuild. This makes one Gemini request for the fixture's exact order and prompt and saves the answer, model, timestamp and input alongside the fixture. Review the generated text before committing it. A failed request preserves the previous recording. Replay makes no requests and spends no tokens. Changing the fixture input disables the saved-response label until it is recorded again.

A genuine response was recorded on 6 November 2026 using the existing local configuration and model `gemini-3.5-flash-lite`. The panel now offers **Show saved Gemini chat** under **Saved Gemini demo · Sample orders**. The answer recommends inspecting and packaging the mug; its shipping wording is preserved verbatim, while the separate local demo action explicitly demonstrates pickup readiness.

## Review of the feedback

The concern about prepared data is valid. The repository does, however, already contain a saved benchmark: `tests/evidence/restorecart-verifier-evaluation.json`. The new catalog review disclosure displays its actual results: 12 claims, 9 combined decisions matching expected labels, zero unsupported acceptances and 5 supported claims retained. It also breaks out development and holdout results and states that this is a small synthetic set, not real merchant accuracy. The feedback's proposed 20/12/5/3 numbers are illustrative and should not be published as measurements. This benchmark evaluates a verifier on fixed human-authored proposals, not the complete Gemini producer workflow. Provider 503 failures remain an availability limitation; replay does not solve or measure live availability.

The PayPal visibility concern is also valid. Actual order details now disclose approval, capture, verification, pending and refund state, and explain duplicate protection. This is explicitly a state summary, not a historical event log: the current order payload cannot prove separate approval timestamps or webhook delivery. Existing safeguards and automated tests are not evidence of real merchant onboarding or production webhook delivery. Those still require a documented integration run.

## Validation

Production build passed with the existing large vendor chunk warning. All 188 automated tests passed, including four new disclosure tests. One Gemini request recorded the sample answer. No payment, publication, deployment or remote repository push was made.

## Browser end-to-end check — 6 November 2026

Tested against an isolated local SQLite workspace, without loading production credentials:

- Seller sign-in and prepared draft opened successfully.
- Synthetic scorecard expanded: 12 claims, 9/12 matching labels, development 5/6, holdout 4/6, zero unsupported acceptances; limitations visible.
- Orders → Sample preview → Show saved Gemini chat displayed the genuine saved text, model and timestamp.
- Approve changed only the panel to Ready for pickup (sample).
- Reset restored Preparing; replay and Reject showed Rejected — sample stays Preparing.
- Actual sandbox orders remained empty with captured, refunded and net totals at zero.
- Visual inspection caught inherited notice-bar flex styling; corrected the multi-paragraph panels to block layout and verified the conversation was readable.

The browser run covered the changed sample and evaluation journey. Payment state disclosures were checked by automated component tests; no new PayPal transaction, webhook delivery or merchant onboarding was claimed by this run.

Follow-up: timestamped payment observations, preserved evidence decisions and shared server reopening checks are now implemented. See [Reliability workflows](RELIABILITY_WORKFLOWS.md) for current behavior and validation.
