import { partnerSettings } from "../server/restorecart/paypalConnections";
const settings = partnerSettings();
console.log("PayPal sandbox seller connections");
if (process.argv.includes("--hosted"))
  console.log("Checking the hosted verification URL.");
console.log(
  settings.configured
    ? "Platform settings: present (not yet verified with PayPal)"
    : `Missing or invalid: ${settings.missing.join(", ")}`,
);
console.log(
  `Webhook ID: ${process.env.PAYPAL_WEBHOOK_ID ? "present" : "missing"}`,
);
console.log(
  `Callback origin: ${process.env.RESTORECART_BASE_URL?.startsWith("https://") ? "HTTPS configured" : "use a public HTTPS origin for hosted webhook testing"}`,
);
if (process.argv.includes("--verify") && settings.configured) {
  const response = await fetch(
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    console.log(`Sandbox credential check failed: HTTP ${response.status}`);
    process.exitCode = 1;
  } else {
    const body = (await response.json()) as any;
    console.log("Sandbox credentials: accepted");
    const expectedOrigin = (
      process.argv.includes("--hosted")
        ? process.env.RESTORECART_VERIFICATION_BASE_URL
        : process.env.RESTORECART_BASE_URL
    )?.replace(/\/+$/, "");
    if (process.env.PAYPAL_WEBHOOK_ID) {
      const webhook = await fetch(
        `https://api-m.sandbox.paypal.com/v1/notifications/webhooks/${encodeURIComponent(process.env.PAYPAL_WEBHOOK_ID)}`,
        {
          headers: { Authorization: `Bearer ${body.access_token}` },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!webhook.ok) {
        console.log(
          `Webhook lookup: HTTP ${webhook.status} (check that it belongs to this Platform app)`,
        );
        process.exitCode = 1;
      } else {
        const hook = (await webhook.json()) as any;
        console.log(
          `Webhook endpoint matches configured origin: ${hook.url === `${expectedOrigin}/api/paypal/webhook` ? "yes" : "no"}`,
        );
        const subscribed = new Set(
          (hook.event_types || []).map((e: any) => e.name),
        );
        const required = [
          "CHECKOUT.ORDER.APPROVED",
          "PAYMENT.CAPTURE.COMPLETED",
          "PAYMENT.CAPTURE.PENDING",
          "PAYMENT.CAPTURE.DENIED",
          "PAYMENT.CAPTURE.REFUNDED",
          "PAYMENT.CAPTURE.REVERSED",
          "MERCHANT.ONBOARDING.COMPLETED",
          "MERCHANT.PARTNER-CONSENT.REVOKED",
        ];
        const missing = subscribed.has("*")
          ? []
          : required.filter((name) => !subscribed.has(name));
        console.log(
          missing.length
            ? `Webhook subscriptions missing: ${missing.join(", ")}`
            : "Webhook subscriptions: complete",
        );
        if (
          missing.length ||
          hook.url !== `${expectedOrigin}/api/paypal/webhook`
        )
          process.exitCode = 1;
      }
    }
    console.log(
      "This check does not prove seller consent, payment routing or webhook delivery.",
    );
  }
} else
  console.log(
    "No PayPal requests made. Add --verify for a read-only credential/webhook check.",
  );
console.log("No credentials displayed.");
if (!settings.configured) process.exitCode = 1;
