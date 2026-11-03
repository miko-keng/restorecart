import { z } from "zod";
import { randomBytes } from "node:crypto";
import { paypal, paypalReady, type PayPalContext } from "../paypal";
import { fail, hash, uid } from "./domain";
import { type DB, tx } from "./store";
import { requireOwned, userFor } from "./accounts";

type Transport = typeof paypal;
const merchantPattern = /^[2-9A-HJ-NP-Z]{13}$/;
function read(db: DB, key: string): any {
  const r = db.prepare("SELECT value FROM rc_meta WHERE key=?").get(key) as any;
  return r ? JSON.parse(r.value) : null;
}
function write(db: DB, key: string, value: any) {
  db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
    key,
    JSON.stringify(value),
  );
}
export function partnerSettings() {
  const partner = process.env.PAYPAL_PARTNER_MERCHANT_ID || "";
  const attribution = process.env.PAYPAL_PARTNER_ATTRIBUTION_ID || "";
  const client = process.env.PAYPAL_CLIENT_ID || "";
  return {
    partner,
    attribution,
    client,
    configured:
      paypalReady() &&
      merchantPattern.test(partner) &&
      /^[A-Za-z0-9_-]{1,100}$/.test(attribution),
  };
}
function assertConfigured() {
  const c = partnerSettings();
  if (!c.configured)
    fail(
      "PayPal account connection is not enabled on this deployment yet.",
      503,
    );
  return c;
}
export function connectionStatus(db: DB, id: string) {
  const c = partnerSettings(),
    saved = read(db, `paypal-connection:${id}`);
  const connected =
    c.configured &&
    saved?.state === "connected" &&
    saved.clientId === c.client &&
    saved.partnerId === c.partner;
  return {
    configured: c.configured,
    connected,
    state: connected
      ? "connected"
      : saved?.state === "connected"
        ? "reconnect"
        : saved?.state || "not_connected",
    merchantId: connected ? saved.merchantId : null,
    checkedAt: saved?.checkedAt || null,
    demo:
      !saved &&
      !c.partner &&
      !c.attribution &&
      process.env.PAYPAL_REQUIRE_SELLER_CONNECTION !== "true",
  };
}
export function paymentDestination(db: DB, id: string): PayPalContext | null {
  const c = partnerSettings(),
    saved = read(db, `paypal-connection:${id}`);
  if (connectionStatus(db, id).demo) return null;
  if (!connectionStatus(db, id).connected || !c.configured)
    fail(
      "This seller must connect PayPal in Settings before checkout is available.",
      409,
    );
  return {
    merchantId: saved.merchantId,
    partnerId: c.partner,
    clientId: c.client,
    attributionId: c.attribution,
  };
}
export function validateSellerStatus(
  data: any,
  tracking: string,
  merchant?: string,
) {
  const c = assertConfigured();
  const grants = (data?.oauth_integrations || [])
    .flatMap((i: any) => i.oauth_third_party || [])
    .filter((g: any) => g.partner_client_id === c.client);
  const scopes = grants.flatMap((g: any) => g.scopes || []);
  if (
    !merchantPattern.test(data?.merchant_id || "") ||
    (merchant && data.merchant_id !== merchant) ||
    data.tracking_id !== tracking ||
    data.payments_receivable !== true ||
    data.primary_email_confirmed !== true ||
    !scopes.includes("https://uri.paypal.com/services/payments/refund") ||
    !scopes.includes(
      "https://uri.paypal.com/services/payments/payment/authcapture",
    )
  )
    fail(
      "PayPal setup is incomplete. Confirm your email and grant payment and refund permissions in PayPal, then check again.",
      409,
    );
  return data.merchant_id as string;
}
export async function verifyConnection(
  db: DB,
  id: string,
  transport: Transport = paypal,
) {
  const c = assertConfigured(),
    saved = read(db, `paypal-connection:${id}`);
  if (
    !saved?.tracking ||
    saved.clientId !== c.client ||
    saved.partnerId !== c.partner
  )
    fail("Start a new PayPal connection from Settings.", 409);
  const response = await transport(
    `/v1/customer/partners/${c.partner}/merchant-integrations?tracking_id=${encodeURIComponent(saved.tracking)}`,
  );
  if (
    response?.tracking_id !== saved.tracking ||
    !merchantPattern.test(response?.merchant_id || "")
  )
    fail("PayPal has not completed this account connection yet.", 409);
  const data = await transport(
    `/v1/customer/partners/${c.partner}/merchant-integrations/${response.merchant_id}`,
  );
  let merchantId: string;
  try {
    merchantId = validateSellerStatus(
      data,
      saved.tracking,
      response.merchant_id,
    );
  } catch (error) {
    const current = read(db, `paypal-connection:${id}`);
    if (
      current?.generation === saved.generation &&
      current?.state === "connected"
    )
      write(db, `paypal-connection:${id}`, { ...current, state: "pending" });
    throw error;
  }
  tx(db, () => {
    const current = read(db, `paypal-connection:${id}`);
    if (
      current?.tracking !== saved.tracking ||
      current?.generation !== saved.generation ||
      current?.state === "disconnected" ||
      current?.state === "revoked"
    )
      fail("The connection changed. Start a new connection.", 409);
    write(db, `paypal-connection:${id}`, {
      ...current,
      merchantId,
      state: "connected",
      checkedAt: new Date().toISOString(),
    });
  });
  return connectionStatus(db, id);
}
export async function connectionEvent(
  db: DB,
  event: any,
  transport: Transport = paypal,
) {
  if (
    ![
      "MERCHANT.ONBOARDING.COMPLETED",
      "MERCHANT.PARTNER-CONSENT.REVOKED",
    ].includes(event.event_type)
  )
    return false;
  const rows = db
    .prepare(
      "SELECT key,value FROM rc_meta WHERE key GLOB 'paypal-connection:*'",
    )
    .all() as any[];
  for (const r of rows) {
    const c = JSON.parse(r.value),
      resource = event.resource || {};
    if (event.event_type === "MERCHANT.PARTNER-CONSENT.REVOKED") {
      if (
        c.merchantId &&
        c.merchantId === resource.merchant_id &&
        (!resource.client_id || resource.client_id === c.clientId)
      )
        write(db, r.key, {
          ...c,
          state: "revoked",
          checkedAt: new Date().toISOString(),
        });
    } else if (c.tracking === resource.tracking_id && c.state === "pending")
      await verifyConnection(
        db,
        r.key.slice("paypal-connection:".length),
        transport,
      );
  }
  return true;
}
export function mountPayPalConnections(
  router: any,
  db: DB,
  seller: any,
  asyncRoute: any,
  base: string,
  transport: Transport = paypal,
) {
  const path = "/incidents/:id/paypal";
  router.get(path, seller, (req: any, res: any) =>
    res.json(connectionStatus(db, String(req.params.id))),
  );
  router.post(
    path + "/connect",
    seller,
    asyncRoute(async (req: any, res: any) => {
      const c = assertConfigured(),
        id = String(req.params.id),
        account = res.locals.user.id;
      const input = z
        .object({ consent: z.literal(true) })
        .strict()
        .safeParse(req.body);
      if (!input.success)
        fail("Agree to share connection details with PayPal to continue.");
      for (const row of db
        .prepare(
          "SELECT key,value FROM rc_meta WHERE key GLOB 'paypal-return:*'",
        )
        .all() as any[]) {
        if (JSON.parse(row.value).expires < Date.now())
          db.prepare("DELETE FROM rc_meta WHERE key=?").run(row.key);
      }
      const old = read(db, `paypal-connection:${id}`);
      if (old?.state === "connected")
        fail("Disconnect this account before connecting another.", 409);
      if (old?.started > Date.now() - 15000)
        fail("Wait a few seconds before starting again.", 429);
      const state = randomBytes(32).toString("hex"),
        tracking = uid("rcseller"),
        generation = uid("connection");
      const pending = {
        state: "pending",
        tracking,
        generation,
        started: Date.now(),
        clientId: c.client,
        partnerId: c.partner,
      };
      write(db, `paypal-connection:${id}`, pending);
      write(db, `paypal-return:${hash(state)}`, {
        id,
        account,
        session: res.locals.session.id,
        generation,
        expires: Date.now() + 30 * 60000,
      });
      const referral = await transport(
        "/v2/customer/partner-referrals",
        "POST",
        {
          tracking_id: tracking,
          partner_config_override: {
            return_url: `${base}/api/restorecart/paypal/return?state=${state}`,
          },
          operations: [
            {
              operation: "API_INTEGRATION",
              api_integration_preference: {
                rest_api_integration: {
                  integration_method: "PAYPAL",
                  integration_type: "THIRD_PARTY",
                  third_party_details: { features: ["PAYMENT", "REFUND"] },
                },
              },
            },
          ],
          products: ["EXPRESS_CHECKOUT"],
          legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
        },
        `rc-onboard-${generation}`,
      );
      const url = new URL(
        referral?.links?.find((l: any) => l.rel === "action_url")?.href ||
          "about:blank",
      );
      if (
        url.origin !== "https://www.sandbox.paypal.com" ||
        url.username ||
        url.password
      )
        fail("PayPal did not return a valid sandbox connection link.", 502);
      res.json({ url: url.href });
    }),
  );
  router.post(
    path + "/check",
    seller,
    asyncRoute(async (req: any, res: any) =>
      res.json(await verifyConnection(db, String(req.params.id), transport)),
    ),
  );
  router.post(path + "/disconnect", seller, (req: any, res: any) => {
    const id = String(req.params.id),
      saved = read(db, `paypal-connection:${id}`);
    write(db, `paypal-connection:${id}`, {
      ...saved,
      state: "disconnected",
      generation: uid("disconnected"),
    });
    res.json(connectionStatus(db, id));
  });
  router.get(
    "/paypal/return",
    seller,
    asyncRoute(async (req: any, res: any) => {
      const state = String(req.query.state || "");
      if (!/^[a-f0-9]{64}$/.test(state))
        fail("This PayPal return link is invalid or expired.", 400);
      const key = `paypal-return:${hash(state)}`,
        pending = read(db, key);
      if (
        !pending ||
        pending.expires < Date.now() ||
        pending.session !== res.locals.session.id ||
        pending.account !== userFor(db, res.locals.session)?.id
      )
        fail(
          "This PayPal return link is invalid or expired. Open Settings and check the connection.",
          403,
        );
      requireOwned(db, pending.account, "incident", pending.id);
      const current = read(db, `paypal-connection:${pending.id}`);
      if (current?.generation !== pending.generation)
        fail("This connection was replaced. Open Settings to continue.", 409);
      db.prepare("DELETE FROM rc_meta WHERE key=?").run(key);
      // Browser-provided merchant IDs and success flags never establish authorization.
      let result = "connected";
      try {
        await verifyConnection(db, pending.id, transport);
      } catch {
        result = "pending";
      }
      res.redirect(
        303,
        `/restorecart/seller?settings=payments&shop=${encodeURIComponent(pending.id)}&paypal=${result}`,
      );
    }),
  );
}
