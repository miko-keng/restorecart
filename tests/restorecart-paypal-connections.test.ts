import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/restorecart/app";
import {
  openRC,
  createIncident,
  incident,
  save,
  reserve,
  order,
  publish,
} from "../server/restorecart/store";
import { assignOwner } from "../server/restorecart/accounts";
import { payments } from "../server/restorecart/payments";
import {
  connectionStatus,
  paymentDestination,
  verifyConnection,
  connectionEvent,
} from "../server/restorecart/paypalConnections";
import { paypal } from "../server/paypal";
const MERCHANT = "2ABCDEFGHJKLM",
  PARTNER = "3ABCDEFGHJKLM",
  OTHER = "4ABCDEFGHJKLM";
async function fixture() {
  const original = { ...process.env };
  Object.assign(process.env, {
    PAYPAL_CLIENT_ID: "controlled-partner-client",
    PAYPAL_CLIENT_SECRET: "controlled-partner-secret",
    PAYPAL_PARTNER_MERCHANT_ID: PARTNER,
    PAYPAL_PARTNER_ATTRIBUTION_ID: "CONTROLLED_BN",
    PAYPAL_ENV: "sandbox",
  });
  const db = openRC(":memory:"),
    requests: any[] = [],
    provider = new Map<string, any>();
  let tracking = "",
    returnUrl = "",
    signupUrl =
      "https://www.sandbox.paypal.com/bizsignup/partner/entry?referralToken=CONTROLLED",
    permissions = true,
    receivable = true,
    emailConfirmed = true,
    statusMerchant = MERCHANT,
    lookupTracking = "",
    n = 0;
  const transport: typeof paypal = async (
    path,
    method = "GET",
    body: any,
    requestId,
    context,
  ) => {
    requests.push({ path, method, body, requestId, context });
    if (path === "/v2/customer/partner-referrals") {
      tracking = body.tracking_id;
      returnUrl = body.partner_config_override.return_url;
      return { links: [{ rel: "action_url", href: signupUrl }] };
    }
    if (path.includes("merchant-integrations?tracking_id="))
      return { merchant_id: MERCHANT, tracking_id: lookupTracking || tracking };
    if (path.includes("merchant-integrations/"))
      return {
        merchant_id: statusMerchant,
        tracking_id: tracking,
        payments_receivable: receivable,
        primary_email_confirmed: emailConfirmed,
        oauth_integrations: permissions
          ? [
              {
                oauth_third_party: [
                  {
                    partner_client_id: process.env.PAYPAL_CLIENT_ID,
                    scopes: [
                      "https://uri.paypal.com/services/payments/payment/authcapture",
                      "https://uri.paypal.com/services/payments/refund",
                    ],
                  },
                ],
              },
            ]
          : [],
      };
    if (path === "/v2/checkout/orders") {
      const p = {
        id: `CONTROLLED${++n}`,
        status: "CREATED",
        purchase_units: body.purchase_units,
        links: [
          {
            rel: "payer-action",
            href: "https://www.sandbox.paypal.com/checkoutnow?token=CONTROLLED",
          },
        ],
      };
      provider.set(p.id, p);
      return p;
    }
    if (path.endsWith("/capture")) {
      const p = provider.get(path.split("/")[4]);
      p.status = "COMPLETED";
      p.purchase_units[0].payments = {
        captures: [
          {
            id: "CONTROLLEDCAPTURE",
            status: "COMPLETED",
            amount: p.purchase_units[0].amount,
          },
        ],
      };
      return p;
    }
    if (path.endsWith("/refund"))
      return {
        id: "CONTROLLEDREFUND",
        status: "COMPLETED",
        amount: body.amount,
      };
    return provider.get(path.split("/").at(-1)!);
  };
  const runtime = createApp({
    db,
    base: "http://localhost",
    testPassword: "Testing123!",
    paymentTransport: transport,
  });
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  function client() {
    let cookie = "",
      csrf = "";
    return {
      async request(path: string, body?: any, csrfEnabled = true) {
        const response = await fetch(
          origin +
            (path.startsWith("/api/") ? path : "/api/restorecart" + path),
          {
            redirect: "manual",
            method: body === undefined ? "GET" : "POST",
            headers: {
              "Content-Type": "application/json",
              cookie,
              ...(csrfEnabled ? { "x-csrf-token": csrf } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          },
        );
        if (response.headers.get("set-cookie"))
          cookie = response.headers.get("set-cookie")!.split(";")[0];
        const data = response.headers
          .get("content-type")
          ?.includes("application/json")
          ? await response.json()
          : await response.text();
        if (data?.csrf) csrf = data.csrf;
        return {
          status: response.status,
          data,
          location: response.headers.get("location"),
        };
      },
    };
  }
  const seller = client(),
    buyer = client(),
    stranger = client();
  for (const c of [seller, buyer, stranger]) await c.request("/session");
  await seller.request("/login", {
    email: "seller@restorecart.test",
    password: "Testing123!",
  });
  const shop = (
    await seller.request("/incidents", { name: "Controlled seller connection" })
  ).data;
  const path = `/incidents/${shop.id}/paypal`;
  return {
    db,
    runtime,
    seller,
    buyer,
    stranger,
    path,
    shop,
    transport,
    requests,
    provider,
    get callback() {
      return new URL(returnUrl).pathname + new URL(returnUrl).search;
    },
    async connect() {
      return seller.request(path + "/connect", { consent: true });
    },
    set flags(v: any) {
      if (v.permissions !== undefined) permissions = v.permissions;
      if (v.receivable !== undefined) receivable = v.receivable;
      if (v.emailConfirmed !== undefined) emailConfirmed = v.emailConfirmed;
      if (v.merchant) statusMerchant = v.merchant;
      if (v.lookupTracking) lookupTracking = v.lookupTracking;
      if (v.signupUrl) signupUrl = v.signupUrl;
    },
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
      db.close();
      for (const k of Object.keys(process.env))
        if (!(k in original)) delete process.env[k];
      Object.assign(process.env, original);
    },
  };
}
function ready(f: Awaited<ReturnType<typeof fixture>>) {
  const i = incident(f.db, f.shop.id);
  i.products = [
    {
      sku: "MUG",
      name: "Test mug",
      price: "20.00",
      currency: "USD",
      description: "Controlled fixture",
      allocation: 5,
      resolved: true,
      excluded: false,
      resolutionNote: "",
      candidates: [],
    },
  ];
  i.pickup = "Test counter";
  save(f.db, i);
  publish(f.db, i.id, incident(f.db, i.id).revision);
  return incident(f.db, i.id);
}
test("PayPal connect is owner-only, CSRF protected, consent required and never accepts a seller merchant ID", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.buyer.request(f.path)).status, 403);
    assert.equal(
      (
        await f.stranger.request("/register", {
          email: "other@example.test",
          username: "other-seller",
          password: "OtherTesting123!",
          role: "seller",
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.stranger.request(f.path + "/connect", { consent: true })).status,
      403,
    );
    assert.equal(
      (await f.seller.request(f.path + "/connect", { consent: true }, false))
        .status,
      403,
    );
    assert.equal(
      (await f.seller.request(f.path + "/connect", { merchantId: OTHER }))
        .status,
      400,
    );
    const r = await f.connect();
    assert.equal(r.status, 200);
    assert.match(r.data.url, /^https:\/\/www.sandbox.paypal.com\//);
    const referral = f.requests.find(
      (r) => r.path === "/v2/customer/partner-referrals",
    );
    assert.deepEqual(
      referral.body.operations[0].api_integration_preference
        .rest_api_integration.third_party_details.features,
      ["PAYMENT", "REFUND"],
    );
    assert.equal(connectionStatus(f.db, f.shop.id).connected, false);
    assert.throws(
      () => paymentDestination(f.db, f.shop.id),
      /must connect PayPal/,
    );
    assert.equal((await f.connect()).status, 429);
  } finally {
    await f.close();
  }
});
test("PayPal return binds session and owner, ignores forged success parameters, verifies server grants and consumes state once", async () => {
  const f = await fixture();
  try {
    await f.connect();
    const callback = f.callback;
    assert.equal((await f.buyer.request(callback)).status, 403);
    const r = await f.seller.request(
      callback + `&merchantIdInPayPal=${OTHER}&permissionsGranted=true`,
    );
    assert.equal(r.status, 303);
    assert.match(r.location!, /paypal=connected/);
    assert.equal(connectionStatus(f.db, f.shop.id).merchantId, MERCHANT);
    assert.equal((await f.seller.request(callback)).status, 403);
    assert.equal(
      (await f.seller.request("/paypal/return?state=bad")).status,
      400,
    );
  } finally {
    await f.close();
  }
});
test("PayPal incomplete scopes, unconfirmed email, mismatched tracking or merchant cannot enable checkout", async () => {
  const f = await fixture();
  try {
    await f.connect();
    f.flags = { permissions: false };
    assert.equal(
      (await f.seller.request(f.callback + "&permissionsGranted=true")).status,
      303,
    );
    assert.equal(connectionStatus(f.db, f.shop.id).connected, false);
    for (const flags of [
      { permissions: true, emailConfirmed: false },
      { emailConfirmed: true, receivable: false },
      { receivable: true, merchant: OTHER },
      { merchant: MERCHANT, lookupTracking: "another-seller" },
    ]) {
      f.flags = flags;
      assert.equal((await f.seller.request(f.path + "/check", {})).status, 409);
    }
    assert.throws(
      () => paymentDestination(f.db, f.shop.id),
      /must connect PayPal/,
    );
  } finally {
    await f.close();
  }
});
test("PayPal expired/replaced callback and external signup links are rejected", async () => {
  const f = await fixture();
  try {
    await f.connect();
    const first = f.callback;
    assert.equal(
      (await f.seller.request(f.path + "/disconnect", {})).status,
      200,
    );
    assert.equal((await f.seller.request(first)).status, 409);
    f.flags = { signupUrl: "https://evil.example/bizsignup" };
    const other = (
      await f.seller.request("/incidents", { name: "Bad redirect fixture" })
    ).data;
    assert.equal(
      (
        await f.seller.request(`/incidents/${other.id}/paypal/connect`, {
          consent: true,
        })
      ).status,
      502,
    );
    assert.equal(connectionStatus(f.db, f.shop.id).connected, false);
  } finally {
    await f.close();
  }
});
test("PayPal connected destination is pinned through checkout, capture and refund even after the shop disconnects", async () => {
  const f = await fixture();
  try {
    await f.connect();
    await f.seller.request(f.callback);
    const i = ready(f);
    const pay = payments(f.db, "http://localhost", f.transport);
    let o = reserve(
      f.db,
      i.id,
      "controlled-buyer",
      "controlled-request",
      "receipt-token",
      i.published!.revision,
      [{ sku: "MUG", quantity: 1 }],
      paymentDestination(f.db, i.id),
    );
    o = await pay.ensure(o.id);
    const creation = f.requests.find((r) => r.path === "/v2/checkout/orders");
    assert.equal(creation.body.purchase_units[0].payee.merchant_id, MERCHANT);
    assert.equal(creation.context.merchantId, MERCHANT);
    await f.seller.request(f.path + "/disconnect", {});
    assert.throws(() => paymentDestination(f.db, i.id), /must connect PayPal/);
    f.provider.get(o.provider).status = "APPROVED";
    o = await pay.reconcile(o.id, true);
    assert.equal(o.state, "paid");
    await pay.refund(o.id);
    assert.equal(order(f.db, o.id).refunded, 2000);
    for (const r of f.requests.filter(
      (r) => r.path.endsWith("/capture") || r.path.endsWith("/refund"),
    ))
      assert.equal(r.context.merchantId, MERCHANT);
  } finally {
    await f.close();
  }
});
test("PayPal consent revocation blocks new purchases and changed platform credentials require reconnect", async () => {
  const f = await fixture();
  try {
    await f.connect();
    await f.seller.request(f.callback);
    await connectionEvent(
      f.db,
      {
        event_type: "MERCHANT.PARTNER-CONSENT.REVOKED",
        resource: { merchant_id: MERCHANT, client_id: "different-client" },
      },
      f.transport,
    );
    assert.equal(connectionStatus(f.db, f.shop.id).connected, true);
    process.env.PAYPAL_CLIENT_ID = "changed-client";
    assert.throws(
      () => paymentDestination(f.db, f.shop.id),
      /must connect PayPal/,
    );
    process.env.PAYPAL_CLIENT_ID = "controlled-partner-client";
    await connectionEvent(
      f.db,
      {
        event_type: "MERCHANT.PARTNER-CONSENT.REVOKED",
        resource: { merchant_id: MERCHANT },
      },
      f.transport,
    );
    assert.equal(connectionStatus(f.db, f.shop.id).state, "revoked");
    assert.throws(
      () => paymentDestination(f.db, f.shop.id),
      /must connect PayPal/,
    );
    await assert.rejects(
      () => verifyConnection(f.db, f.shop.id, f.transport),
      /connection changed/,
    );
  } finally {
    await f.close();
  }
});
test("PayPal defaults to seller connection; shared-account demo requires explicit opt-in", async () => {
  const f = await fixture();
  try {
    delete process.env.PAYPAL_PARTNER_MERCHANT_ID;
    delete process.env.PAYPAL_PARTNER_ATTRIBUTION_ID;
    delete process.env.PAYPAL_ALLOW_SHARED_DEMO;
    assert.equal((await f.seller.request(f.path)).data.demo, false);
    assert.throws(
      () => paymentDestination(f.db, f.shop.id),
      /must connect PayPal/,
    );
    assert.equal((await f.connect()).status, 503);
    process.env.PAYPAL_ALLOW_SHARED_DEMO = "true";
    assert.equal((await f.seller.request(f.path)).data.demo, true);
    assert.equal(paymentDestination(f.db, f.shop.id), null);
    process.env.PAYPAL_REQUIRE_SELLER_CONNECTION = "true";
    assert.throws(
      () => paymentDestination(f.db, f.shop.id),
      /must connect PayPal/,
    );
  } finally {
    await f.close();
  }
});
test("PayPal transport sets seller authorization and attribution headers, not seller passwords", async () => {
  const f = await fixture(),
    originalFetch = globalThis.fetch;
  try {
    const seen: any[] = [];
    globalThis.fetch = (async (url: any, init: any) => {
      seen.push({ url, init });
      return new Response(
        JSON.stringify(
          String(url).endsWith("/token")
            ? { access_token: "controlled-access", expires_in: 600 }
            : { id: "controlled" },
        ),
        { status: 200 },
      );
    }) as any;
    await paypal("/v2/checkout/orders", "POST", {}, "controlled-idempotency", {
      merchantId: MERCHANT,
      partnerId: PARTNER,
      clientId: "controlled-partner-client",
      attributionId: "CONTROLLED_BN",
    });
    const headers = seen.at(-1).init.headers,
      parts = headers["PayPal-Auth-Assertion"].split(".");
    assert.deepEqual(
      JSON.parse(Buffer.from(parts[1], "base64url").toString()),
      { iss: "controlled-partner-client", payer_id: MERCHANT },
    );
    assert.equal(headers["PayPal-Partner-Attribution-Id"], "CONTROLLED_BN");
    assert.equal(headers["PayPal-Request-Id"], "controlled-idempotency");
    await assert.rejects(
      () =>
        paypal("/v2/checkout/orders", "POST", {}, undefined, {
          merchantId: MERCHANT,
          partnerId: PARTNER,
          clientId: "wrong-client",
          attributionId: "CONTROLLED_BN",
        }),
      /credentials changed/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await f.close();
  }
});

test("PayPal expired return and removed grants cannot leave a shop falsely connected", async () => {
  const f = await fixture();
  try {
    await f.connect();
    const callback = f.callback;
    const row = f.db
      .prepare("SELECT key,value FROM rc_meta WHERE key GLOB 'paypal-return:*'")
      .get() as any;
    f.db
      .prepare("UPDATE rc_meta SET value=? WHERE key=?")
      .run(
        JSON.stringify({ ...JSON.parse(row.value), expires: Date.now() - 1 }),
        row.key,
      );
    assert.equal((await f.seller.request(callback)).status, 403);
    await verifyConnection(f.db, f.shop.id, f.transport);
    assert.equal(connectionStatus(f.db, f.shop.id).connected, true);
    f.flags = { permissions: false };
    assert.equal((await f.seller.request(f.path + "/check", {})).status, 409);
    assert.equal(connectionStatus(f.db, f.shop.id).connected, false);
    assert.throws(
      () => paymentDestination(f.db, f.shop.id),
      /must connect PayPal/,
    );
  } finally {
    await f.close();
  }
});
test("PayPal HTTP checkout blocks an unconnected seller before reserving inventory", async () => {
  const f = await fixture();
  try {
    const i = ready(f);
    const r = await f.buyer.request(`/shops/${i.slug}/orders`, {
      requestKey: "controlled-blocked-request",
      revision: i.published!.revision,
      lines: [{ sku: "MUG", quantity: 1 }],
    });
    assert.equal(r.status, 409);
    assert.equal(
      (f.db.prepare("SELECT count(*) n FROM rc_holds").get() as any).n,
      0,
    );
    await f.connect();
    await f.seller.request(f.callback);
    const success = await f.buyer.request(`/shops/${i.slug}/orders`, {
      requestKey: "controlled-success-request",
      revision: i.published!.revision,
      lines: [{ sku: "MUG", quantity: 1 }],
    });
    assert.equal(success.status, 200);
    assert.equal(
      order(f.db, success.data.id).snapshot.paymentDestination.merchantId,
      MERCHANT,
    );
  } finally {
    await f.close();
  }
});

test("PayPal setup status lists missing names without exposing credentials", async () => {
  const f = await fixture();
  try {
    delete process.env.PAYPAL_PARTNER_ATTRIBUTION_ID;
    const response = await f.seller.request(f.path);
    assert.equal(response.data.configured, false);
    assert.deepEqual(response.data.setupMissing, [
      "PAYPAL_PARTNER_ATTRIBUTION_ID",
    ]);
    assert.ok(
      !JSON.stringify(response.data).includes("controlled-partner-secret"),
    );
    assert.ok(
      !JSON.stringify(response.data).includes("controlled-partner-client"),
    );
  } finally {
    await f.close();
  }
});

test("Two connected sandbox sellers keep checkout, capture and refund destinations separate", async () => {
  const f = await fixture();
  try {
    await f.connect();
    await f.seller.request(f.callback);
    const first = ready(f);
    const second = createIncident(f.db, "Second sandbox seller");
    second.products = structuredClone(first.products);
    second.pickup = "Second pickup counter";
    save(f.db, second);
    publish(f.db, second.id, second.revision);
    const connections = new Map([
      [MERCHANT, "first-tracking"],
      [OTHER, "second-tracking"],
    ]);
    for (const [shopId, merchantId, tracking] of [
      [first.id, MERCHANT, "first-tracking"],
      [second.id, OTHER, "second-tracking"],
    ]) {
      f.db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
        `paypal-connection:${shopId}`,
        JSON.stringify({
          state: "connected",
          merchantId,
          tracking,
          generation: shopId,
          clientId: process.env.PAYPAL_CLIENT_ID,
          partnerId: PARTNER,
        }),
      );
    }
    const calls: any[] = [],
      provider = new Map<string, any>();
    const transport: typeof paypal = async (
      path,
      method = "GET",
      body: any,
      key,
      context,
    ) => {
      calls.push({ path, context, body });
      if (path.includes("merchant-integrations?tracking_id=")) {
        const tracking = new URL(
          "https://fixture.invalid" + path,
        ).searchParams.get("tracking_id");
        return {
          tracking_id: tracking,
          merchant_id: [...connections].find(
            ([, value]) => value === tracking,
          )?.[0],
        };
      }
      if (path.includes("merchant-integrations/")) {
        const merchant = path.split("/").at(-1)!;
        return {
          merchant_id: merchant,
          tracking_id: connections.get(merchant),
          payments_receivable: true,
          primary_email_confirmed: true,
          oauth_integrations: [
            {
              oauth_third_party: [
                {
                  partner_client_id: process.env.PAYPAL_CLIENT_ID,
                  scopes: [
                    "https://uri.paypal.com/services/payments/refund",
                    "https://uri.paypal.com/services/payments/payment/authcapture",
                  ],
                },
              ],
            },
          ],
        };
      }
      if (path === "/v2/checkout/orders") {
        const id = `ORDER${provider.size + 1}`;
        const result = {
          id,
          status: "APPROVED",
          purchase_units: body.purchase_units,
          links: [
            {
              rel: "payer-action",
              href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}`,
            },
          ],
        };
        provider.set(id, result);
        return result;
      }
      if (path.endsWith("/capture")) {
        const result = provider.get(path.split("/")[4]);
        result.status = "COMPLETED";
        result.purchase_units[0].payments = {
          captures: [
            {
              id: `CAP${result.id}`,
              status: "COMPLETED",
              amount: result.purchase_units[0].amount,
            },
          ],
        };
        return result;
      }
      if (path.endsWith("/refund"))
        return {
          id: `REF${context!.merchantId}`,
          status: "COMPLETED",
          amount: body.amount,
        };
      return provider.get(path.split("/").at(-1)!);
    };
    const pay = payments(f.db, "http://localhost", transport);
    for (const [index, shop] of [first, incident(f.db, second.id)].entries()) {
      const destination = paymentDestination(f.db, shop.id)!;
      const created = reserve(
        f.db,
        shop.id,
        `buyer-${index}`,
        `request-for-seller-${index}`,
        `receipt-${index}`,
        shop.published!.revision,
        [{ sku: "MUG", quantity: 1 }],
        destination,
      );
      await pay.ensure(created.id);
      await pay.reconcile(created.id, true);
      await pay.refund(created.id);
      const stored = order(f.db, created.id);
      assert.equal(stored.merchant, index === 0 ? MERCHANT : OTHER);
      assert.equal(stored.refunded, 2000);
      assert.equal(
        stored.snapshot.paymentDestination.merchantId,
        stored.merchant,
      );
    }
    for (const merchant of [MERCHANT, OTHER]) {
      const sellerCalls = calls.filter(
        (call) => call.context?.merchantId === merchant,
      );
      assert.ok(
        sellerCalls.some(
          (call) =>
            call.path === "/v2/checkout/orders" &&
            call.body.purchase_units[0].payee.merchant_id === merchant,
        ),
      );
      assert.ok(sellerCalls.some((call) => call.path.endsWith("/capture")));
      assert.ok(sellerCalls.some((call) => call.path.endsWith("/refund")));
    }
  } finally {
    await f.close();
  }
});

test("Signature-checked webhook ingress records duplicate protection without repeating money or stock", async () => {
  const f = await fixture(),
    originalFetch = globalThis.fetch;
  try {
    await f.connect();
    await f.seller.request(f.callback);
    const shop = ready(f),
      pay = payments(f.db, "http://localhost", f.transport);
    const created = reserve(
      f.db,
      shop.id,
      "webhook-buyer",
      "webhook-request",
      "private-receipt",
      shop.published!.revision,
      [{ sku: "MUG", quantity: 1 }],
      paymentDestination(f.db, shop.id),
    );
    const o = await pay.ensure(created.id);
    f.provider.get(o.provider).status = "APPROVED";
    process.env.PAYPAL_WEBHOOK_ID = "controlled-webhook";
    const event = {
      id: "CONTROLLED-WEBHOOK-1",
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: o.provider },
    };
    let signatureOk = false;
    globalThis.fetch = (async (url: any) =>
      new Response(
        JSON.stringify(
          String(url).endsWith("/v1/oauth2/token")
            ? { access_token: "controlled-token", expires_in: 3600 }
            : { verification_status: signatureOk ? "SUCCESS" : "FAILURE" },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;
    await assert.rejects(pay.receive({}, event), /signature/);
    assert.equal(
      (f.db.prepare("SELECT count(*) n FROM rc_events").get() as any).n,
      0,
    );
    signatureOk = true;
    await pay.receive({}, event);
    await pay.worker();
    await pay.receive({}, event);
    await pay.worker();
    const { paymentHistory } =
      await import("../server/restorecart/paymentHistory");
    const history = paymentHistory(f.db, o.id);
    assert.equal(
      history.filter((e) => e.kind === "webhook_received").length,
      1,
    );
    assert.equal(
      history.filter((e) => e.kind === "webhook_processed").length,
      1,
    );
    assert.equal(
      history.filter((e) => e.kind === "webhook_duplicate_ignored").length,
      1,
    );
    assert.equal(
      (
        f.db
          .prepare("SELECT count(*) n FROM rc_moves WHERE order_id=?")
          .get(o.id) as any
      ).n,
      1,
    );
    assert.ok(!JSON.stringify(history).includes("private-receipt"));
  } finally {
    globalThis.fetch = originalFetch;
    await f.close();
  }
});

test("PayPal onboarding permission errors explain setup rather than imply a pending payment", async () => {
  const f = await fixture(),
    originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: any) =>
      new Response(
        JSON.stringify(
          String(url).endsWith("/v1/oauth2/token")
            ? { access_token: "controlled-token", expires_in: 3600 }
            : { name: "NOT_AUTHORIZED" },
        ),
        {
          status: String(url).endsWith("/v1/oauth2/token") ? 200 : 403,
          headers: { "Content-Type": "application/json" },
        },
      )) as typeof fetch;
    await assert.rejects(
      paypal("/v2/customer/partner-referrals", "POST", {}),
      (error: any) =>
        error.providerStatus === 403 &&
        /sandbox permissions/.test(error.message) &&
        !/still checking/.test(error.message),
    );
  } finally {
    globalThis.fetch = originalFetch;
    await f.close();
  }
});
