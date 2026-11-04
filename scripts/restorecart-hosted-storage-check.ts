import { readFileSync, writeFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { openRC } from "../server/restorecart/store";
const base =
  process.env.RESTORECART_HOSTED_CHECK_URL ||
  "https://restorecart.onrender.com";
if (new URL(base).protocol !== "https:")
  throw Error("Hosted verification requires HTTPS.");
const stage = process.argv[2] || "before";
const privatePath = ".data/hosted-storage-session.json";
const m = JSON.parse(
  readFileSync(".data/turso-verification-manifest.json", "utf8"),
);
let cookie = "",
  csrf = "";
async function call(path: string, body?: any) {
  const r = await fetch(base + "/api/restorecart" + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body
        ? {
            "Content-Type": "application/json",
            "x-csrf-token": csrf,
            Origin: base,
          }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(55000),
  });
  const set = r.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  if (!r.ok) throw Error(`Hosted check returned HTTP ${r.status}.`);
  const data = await r.json();
  if (data.csrf) csrf = data.csrf;
  return data;
}
try {
  if (stage === "before") {
    const session = await call("/session");
    assert.equal(session.storage.externalConfigured, true);
    const db = openRC();
    let email: string;
    try {
      email = (
        db
          .prepare("SELECT email FROM rc_accounts WHERE id=?")
          .get(m.accountId) as any
      ).email;
    } finally {
      db.close();
    }
    await call("/login", {
      email,
      password: "ControlledPersistenceCheck2026!",
    });
    const orders = await call("/my-orders");
    assert.ok(
      orders.some((o: any) => o.id === m.orderId && o.state === "paid"),
    );
    writeFileSync(
      privatePath,
      JSON.stringify({ cookie, csrf, before: new Date().toISOString(), base }),
      { mode: 0o600 },
    );
    console.log(
      "Hosted service uses Turso; controlled account and order verified before restart. Private session saved.",
    );
  } else if (stage === "after") {
    if (!existsSync(privatePath)) throw Error("Run before first.");
    const prior = JSON.parse(readFileSync(privatePath, "utf8"));
    assert.equal(prior.base, base);
    cookie = prior.cookie;
    csrf = prior.csrf;
    const session = await call("/session");
    assert.equal(session.storage.externalConfigured, true);
    assert.equal(session.user?.id, m.accountId);
    const orders = await call("/my-orders");
    assert.ok(
      orders.some((o: any) => o.id === m.orderId && o.state === "paid"),
    );
    writeFileSync(
      "tests/evidence/restorecart-hosted-storage.json",
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          base,
          before: prior.before,
          after: new Date().toISOString(),
          checks: {
            externalStorage: true,
            sameAuthenticatedSession: true,
            controlledAccountRetained: true,
            controlledPaidOrderRetained: true,
          },
          paymentProviderCalls: 0,
          scope:
            "Actual Render restart check using existing controlled payment reference. Complemented by independent Turso image, stock and recovery verification.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Hosted persistence passed: authenticated session, account and controlled order survived restart.",
    );
  } else throw Error("Use before or after.");
} catch (e) {
  console.error(
    e instanceof Error
      ? e.message
      : "Hosted verification failed; sensitive details suppressed.",
  );
  process.exitCode = 1;
}
