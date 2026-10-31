# Judge access and reset recovery

Hosted entry: https://restorecart.onrender.com/restorecart
Public browsing: https://restorecart.onrender.com/restorecart/shops
Repository: https://github.com/miko-keng/restorecart

## Browser-only access

No operator credentials are published. Buyers can browse the prepared Sunday Studio Sample Shop immediately. Use the buyer Register screen to create a disposable app account; sellers use `/restorecart/seller/sign-in` → Register for their own workspace. Use a distinct email/username, a password of at least 10 characters, and no sensitive personal data. Registration requirements shown by the app remain authoritative.

A newly registered seller can click **Load prepared Sunday Studio Demo** to get its own source records, review draft and shop details. Show the saved genuine Gemini review without spending API allowance, review stock and prices, Mark ready, Preview and Publish. Use that exact shop link in the buyer profile.

The public demo-user passwords in README apply only after the local account seeder, not to Render. Separate browser profiles isolate buyer and seller app logins. PayPal approval requires a PayPal sandbox personal buyer account, separate from the RestoreCart app login; app registration does not create a PayPal account. Entrants should provide any judge sandbox access privately in the submission's access field, not in the public repository.

## If the demo resets

Render Free may sleep or discard its local database. Allow the service to wake up. Startup recreates a public sample shop and the configured seller's prepared draft on an empty database. Register a new disposable account if your prior login is gone, then load the prepared draft again. Existing accounts, orders and payment journals cannot be reconstructed from the hardcoded sample records.

Do not redeploy between purchase and recovery. Duplicate-safe recovery is tested while its order and journal records are retained. A PayPal sandbox transaction can still exist at PayPal after the application's temporary database resets; do not attempt to describe an example order as the lost transaction.

For a local reproducible setup, follow README, seed the synthetic accounts, and use DEMO_REHEARSAL_GUIDE.md. WooCommerce and external storage are optional; no additional store or database registration is required for this scoped demo.
