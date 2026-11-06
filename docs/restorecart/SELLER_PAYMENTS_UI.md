# Seller sandbox payments and simpler UI

## Changes

- Tester shops require a verified seller connection. Shared-account checkout is available only with explicit `PAYPAL_ALLOW_SHARED_DEMO=true`, no saved seller connection and `PAYPAL_REQUIRE_SELLER_CONNECTION` not set to `true`. Configured partner credentials always select seller-connected mode.
- The buyer basket explains when a seller must connect PayPal. The server still verifies the destination before reserving stock. Existing orders retain their original merchant context.
- Settings uses a compact PayPal card: status, one-line explanation, consent and connection/check actions. Unconfigured connections open a setup explanation instead of leaving a mysterious disabled button. Connection metadata is expandable.
- The reopening checklist shows product names and review actions. Individual checks are expandable. Catalog readiness and payment readiness are separate, with a direct Connect PayPal shortcut.
- Payment history uses a visual timeline with short event names; references and verification details are expandable. Pending/refund status is not presented as a completed payment.
- Sample Gemini chat retains the genuine recorded answer and clear sample label; prompt/model and detailed isolation wording are expandable. Approve/Reject remain local-only.
- Recovery shows the reason when report/comparison actions are unavailable.

## UI library choice

Radix Themes is used for cards, badges, buttons, layout and accessible dialogs. It fits the existing React app without a Tailwind conversion. Styles are scoped to these panels; the existing storefront, AG Grid and pickup schedule remain in place. Dialogs are layered above the sticky toolbar and restore focus to their launching controls.

Compared official documentation:

- https://www.radix-ui.com/themes/docs/overview/getting-started
- https://www.radix-ui.com/themes/docs/components/dialog
- https://ui.shadcn.com/docs/installation/vite

## Private Platform configuration

The original `.env` contains checkout credentials. The user's existing `.data/backend-verification.env` contains separate sandbox Platform settings. Keep these files private and separate; do not commit or copy their values into UI code.

Use Node's environment-file options to load the original file first and the Platform verification file second when testing a separate workspace. Override database/persistence settings to use an isolated local database. Do not switch the credentials of a deployment that still has unsettled orders without accounting for those orders' original app context.

`npm run restorecart:paypal:setup` checks presence/format only. Add `-- --verify` to check sandbox OAuth and the registered webhook using read-only requests. `--hosted` compares the webhook against `RESTORECART_VERIFICATION_BASE_URL`. No credential values are printed. A successful check does not prove seller consent, routing or delivery.

## Verification boundary

Automated tests cover two merchant destinations through checkout/capture/refund; strict default gating and explicit shared-demo opt-in; signature verification failure; verified duplicate ingress; one stock movement; callback ownership/session binding; revocation and reconnect cases. Controlled tests are not real merchant transactions.

Browser checks cover the compact checklist, sample chat, missing-setup dialog, consent enabling Connect PayPal, pending/check/connected UI states, and payment timeline. Connected-state/timeline screenshots labelled `UI test` use controlled responses, not actual PayPal payments.

Using the private Platform configuration, actual PayPal sandbox OAuth succeeded and the Partner Referrals API generated a genuine signup URL. The browser reached PayPal's seller permission page. PayPal displayed the partner business name “Test Store”; the user must verify that identity and complete seller authorization. The registered webhook points at the hosted `/api/paypal/webhook` and includes the expected event subscriptions. Delivery, real seller authorization completion and two-seller money routing remain pending until demonstrated.

Final automated validation: **198 tests passed**, production build passed with the existing large vendor chunk warnings. The actual Platform OAuth and referral request succeeded; this is stronger than fixture-only verification, but it is not yet proof of completed seller consent or actual hosted webhook delivery.

## Selected demo fallback

The user chose the existing configured sandbox account after the Malaysia seller onboarding screen requested identity details. No real ID was entered and no completed seller authorization is claimed. PayPal documents `LMTN` for simulating a new-account signup, but this does not establish a test national ID for the existing-account screen encountered here.

Run `RESTORECART_DEMO_ENV_FILE=/path/to/checkout.env npm run dev:shared-demo`. This explicitly selects the existing checkout credentials, clears Platform routing only for this process, uses a separate local SQLite database and labels the UI **Shared demo**. The default application remains seller-connected; it is not silently converted to shared-account mode. The launcher does not modify either private environment file or the pending onboarding database.

Official references: https://developer.paypal.com/platforms/seller-onboarding and https://developer.paypal.com/sandbox-testing/accounts

Shared-demo fallback was browser-verified on an isolated local database: Settings displays **Shared demo** and **Test payments use the configured demo account**. A read-only OAuth request confirmed the original checkout credentials are accepted. No new payment was created for this fallback check.
