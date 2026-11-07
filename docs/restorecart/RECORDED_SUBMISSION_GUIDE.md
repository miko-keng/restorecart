# RestoreCart — simple recording guide

Aim for 2–3 minutes. Sign in as the seller before recording. No buyer login, PayPal login or purchase is needed.

**Before recording:** Select an untouched **Sunday Studio Demo** draft. If it’s missing, use **Shop options → Load prepared Sunday Studio Demo**. To keep the video focused on Blue mug, open **Review** for Red mug and Natural tote, tick **Hide this product from the shop**, and click **Save as hidden**. Close each panel. Check that **Settings → PayPal payments** shows **Shared demo** if you’re using the configured demo account.

1. **Show the conflict.** In **Shop editor**, click **Open AI review** and point to **Saved response**. Click **Review** beside Blue mug.

   **Say:** “RestoreCart helps a shop reopen from surviving records. This saved Gemini review flags a conflict: the old PDF says eighteen dollars and the stock sheet says twenty. The seller decides.”

2. **Confirm and publish.** Enter **Price (USD): 20.00**, **Reason: Latest stock sheet confirms $20**, **Physical units counted: 8**, and **Set aside for this shop: 3**. Tick the product and stock confirmation, click **Mark ready**, then close the panel. Click **Preview**, show the $20 price, close the preview and click **Publish shop**.

   **Say:** “I confirm the price, count eight mugs and set three aside. I preview the corrected listing before publishing.”

3. **Show sample fulfillment.** Click **Orders → Sample orders → Assistant → Play demo chat**. Click **Approve** and show **Ready for pickup (sample)**.

   **Say:** “This is a sample order. The assistant replays a saved Gemini response without another API call. My approval changes the sample only.”

4. **Show the PayPal setup.** Close the assistant and open **Settings → PayPal payments**.

   **Say:** “Shared demo checkout uses one configured PayPal sandbox business account. Individual seller onboarding hasn’t been verified end to end. No payment was made in this recording.”

Optional: **Reset demo → Play demo chat → Reject** shows the sample staying **Preparing**. **AI test results** shows the synthetic evaluation; it does not measure accuracy on real merchant data.

For a separate checkout and recovery test, use the [full-transaction rehearsal](../../DEMO_REHEARSAL_GUIDE.md).
