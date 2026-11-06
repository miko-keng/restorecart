import { Decimal } from "decimal.js";
export type PayPalContext = {
  merchantId: string;
  partnerId: string;
  clientId: string;
  attributionId: string;
};
let cached: { token: string; expiry: number; client: string } | null = null;
export const paypalReady = () =>
  !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
async function token() {
  if (
    cached &&
    cached.expiry > Date.now() &&
    cached.client === process.env.PAYPAL_CLIENT_ID
  )
    return cached.token;
  const r = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error(
      "PayPal could not connect. Check the sandbox credentials in your local configuration.",
    );
  const b = (await r.json()) as any;
  cached = {
    token: b.access_token,
    client: process.env.PAYPAL_CLIENT_ID || "",
    expiry: Date.now() + (b.expires_in - 60) * 1000,
  };
  return cached.token;
}
export async function paypal(
  path: string,
  method = "GET",
  body?: unknown,
  requestId?: string,
  seller?: PayPalContext,
) {
  if (
    seller &&
    (seller.clientId !== process.env.PAYPAL_CLIENT_ID ||
      seller.partnerId !== process.env.PAYPAL_PARTNER_MERCHANT_ID)
  )
    throw new Error(
      "The platform credentials changed. Restore the original credentials before processing this order.",
    );
  const assertion = seller
    ? `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(JSON.stringify({ iss: seller.clientId, payer_id: seller.merchantId })).toString("base64url")}.`
    : "";
  const attribution =
    seller?.attributionId || process.env.PAYPAL_PARTNER_ATTRIBUTION_ID;
  const r = await fetch("https://api-m.sandbox.paypal.com" + path, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(assertion ? { "PayPal-Auth-Assertion": assertion } : {}),
      ...(attribution ? { "PayPal-Partner-Attribution-Id": attribution } : {}),
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const data = (await r.json()) as any;
  if (!r.ok)
    throw Object.assign(
      new Error(
        (path.startsWith("/v1/customer/partners/") ||
          path === "/v2/customer/partner-referrals") &&
          [401, 403].includes(r.status)
          ? "This Platform app cannot connect sellers yet. Check its PayPal sandbox permissions."
          : "PayPal is still checking this request. Please check the order status before trying again.",
      ),
      { providerName: data.name, providerStatus: r.status },
    );
  return data;
}
export function captureObservation(body: any) {
  const pu = body.purchase_units;
  if (!Array.isArray(pu) || pu.length !== 1)
    throw new Error("Unexpected payment structure.");
  const captures = pu[0].payments?.captures;
  if (!Array.isArray(captures) || captures.length !== 1)
    throw new Error("Payment is not fully captured yet.");
  const c = captures[0];
  const a = c.amount;
  if (!a || !new Decimal(a.value).isFinite())
    throw new Error("Invalid capture amount.");
  return {
    id: c.id,
    status: c.status,
    amount: new Decimal(a.value).toFixed(2),
    currency: a.currency_code,
    merchant: pu[0].payee?.merchant_id || "",
  };
}
export async function verifyWebhook(
  headers: Record<string, unknown>,
  event: any,
) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return false;
  const verified = await paypal(
    "/v1/notifications/verify-webhook-signature",
    "POST",
    {
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    },
  );
  return verified.verification_status === "SUCCESS";
}
