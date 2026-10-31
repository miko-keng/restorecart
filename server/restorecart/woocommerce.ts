import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { z } from "zod";
import { hash, uid, fail } from "./domain";
import { recovery, tx, type DB } from "./store";
import { meta, putMeta } from "./continuity";
export type WooTransport = (
  base: string,
  key: string,
  secret: string,
  path: string,
  method?: string,
  body?: any,
) => Promise<any>;
type Connection = { base: string; key: string; secret: string };
function settings() {
  const origins = (process.env.WOOCOMMERCE_TEST_ORIGINS || "")
    .split(",")
    .filter(Boolean)
    .map((s) => s.trim());
  const encryption = process.env.WOOCOMMERCE_ENCRYPTION_KEY || "";
  return {
    origins,
    encryption,
    enabled: /^[a-f0-9]{64}$/i.test(encryption) && origins.length > 0,
  };
}
function checkBase(base: string) {
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    fail("Enter the HTTPS origin of an allowed test store.");
  }
  if (!settings().enabled)
    fail(
      "WooCommerce is not configured. File recovery remains available.",
      503,
    );
  if (
    u!.protocol !== "https:" ||
    u!.username ||
    u!.password ||
    u!.search ||
    u!.hash ||
    u!.pathname !== "/" ||
    !settings().origins.includes(u!.origin)
  )
    fail(
      "Only an operator-allowed HTTPS test-store origin can be connected.",
      400,
    );
  return u!.origin;
}
function seal(value: Connection) {
  const iv = randomBytes(12),
    c = createCipheriv(
      "aes-256-gcm",
      Buffer.from(settings().encryption, "hex"),
      iv,
    );
  const body = Buffer.concat([c.update(JSON.stringify(value)), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}
function connection(db: DB, id: string): Connection {
  const raw = meta(db, `woo-connection:${id}`, null);
  if (!raw) fail("WooCommerce is not connected.", 409);
  try {
    const [iv, tag, body] = raw
      .split(".")
      .map((b: string) => Buffer.from(b, "base64"));
    const d = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(settings().encryption, "hex"),
      iv,
    );
    d.setAuthTag(tag);
    const c = JSON.parse(Buffer.concat([d.update(body), d.final()]).toString());
    checkBase(c.base);
    return c;
  } catch {
    fail(
      "WooCommerce credentials are unavailable. Reconnect the test store.",
      409,
    );
  }
}
// Allowlisted test origins plus pinned public DNS protect stored credentials from redirects/rebinding.
export function publicAddress(ip: string) {
  if (isIP(ip) === 4) {
    const a = ip.split(".").map(Number);
    return !(
      a[0] === 0 ||
      a[0] === 10 ||
      a[0] === 127 ||
      a[0] >= 224 ||
      (a[0] === 169 && a[1] === 254) ||
      (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
      (a[0] === 192 && a[1] === 168) ||
      (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
      (a[0] === 198 && (a[1] === 18 || a[1] === 19))
    );
  }
  // IPv6 only globally routable unicast; mapped IPv4, local and multicast are blocked.
  return (
    isIP(ip) === 6 &&
    /^[23][0-9a-f]{3}:/i.test(ip) &&
    !ip.toLowerCase().startsWith("2001:db8:")
  );
}
export const wooRequest: WooTransport = async (
  base,
  key,
  secret,
  path,
  method = "GET",
  body,
) => {
  checkBase(base);
  const u = new URL(base + "/wp-json/wc/v3/" + path);
  const addresses = await lookup(u.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    fail("Test store must resolve to public HTTPS addresses.");
  const address = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(
      u,
      {
        method,
        headers: {
          Authorization:
            "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        lookup: ((_h: any, _o: any, cb: any) =>
          _o?.all
            ? cb(null, [address])
            : cb(null, address.address, address.family)) as any,
      },
      (res) => {
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (b) => {
          bytes += b.length;
          if (bytes > 8_000_000)
            req.destroy(Error("WooCommerce response exceeded limit"));
          else chunks.push(b);
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300)
            return reject(
              Error(
                `WooCommerce request failed (HTTP ${res.statusCode || 0}). Saved work is preserved.`,
              ),
            );
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch {
            reject(Error("WooCommerce returned invalid JSON."));
          }
        });
      },
    );
    req.setTimeout(20000, () =>
      req.destroy(
        Error(
          "WooCommerce request timed out. Check destination before retrying.",
        ),
      ),
    );
    req.on("error", () =>
      reject(
        Error(
          "WooCommerce connection failed. Check destination before retrying.",
        ),
      ),
    );
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};
export function wooConnector(db: DB, transport: WooTransport = wooRequest) {
  const busy = new Set<string>();
  const leases = new Map<string, string>();
  const call = (c: Connection, path: string, method = "GET", body?: any) => {
    const held = leases.get(c.base);
    if (held)
      tx(db, () => {
        const lock = meta(db, `woo-lock:${c.base}`, null);
        if (lock?.owner !== held)
          fail(
            "Return lease changed; inspect the destination before retrying.",
            409,
          );
        putMeta(db, `woo-lock:${c.base}`, {
          owner: held,
          expires: Date.now() + 1800000,
        });
      });
    return transport(c.base, c.key, c.secret, path, method, body);
  };
  function expectedStock(base: string, sku: string) {
    const rows = db
      .prepare("SELECT value FROM rc_meta WHERE key GLOB ?")
      .all(`woo-journal:${base}:*`) as any[];
    const latest = rows
      .map((r) => JSON.parse(r.value))
      .filter((j) => ["done", "finalizing"].includes(j.stage))
      .sort((a, b) => (b.sequence || 0) - (a.sequence || 0))
      .find((j) => j.products?.some((p: any) => p.sku === sku));
    return latest?.products.find((p: any) => p.sku === sku)?.after;
  }
  async function allOrders(c: Connection) {
    const orders: any[] = [];
    for (let page = 1; page <= 20; page++) {
      const rows = await call(
        c,
        `orders?per_page=100&page=${page}&orderby=id&order=desc`,
      );
      if (!Array.isArray(rows))
        fail("WooCommerce order list was invalid.", 502);
      orders.push(...rows);
      if (rows.length < 100) return orders;
    }
    fail(
      "Test store exceeds the supported 2,000-order scan. No changes were applied.",
      409,
    );
  }
  async function product(c: Connection, sku: string) {
    const rows = await call(
      c,
      `products?sku=${encodeURIComponent(sku)}&per_page=100`,
    );
    const exact = Array.isArray(rows) ? rows.filter((p) => p.sku === sku) : [];
    if (exact.length !== 1)
      fail(
        `SKU ${sku}: expected exactly one destination product. Resolve missing or ambiguous matches.`,
        409,
      );
    if (rows.length >= 100)
      fail(`SKU ${sku}: destination result needs manual inspection.`, 409);
    const p = exact[0];
    if (
      p.type !== "simple" ||
      p.manage_stock !== true ||
      !Number.isInteger(p.stock_quantity) ||
      p.stock_quantity < 0 ||
      !Number.isSafeInteger(p.id)
    )
      fail(
        `SKU ${sku}: this connector currently requires a simple product with managed stock. Variations need manual recovery.`,
        409,
      );
    return p;
  }
  const marker = (o: any) => `restorecart:${o.capture}`;
  const matches = (remote: any, o: any) =>
    remote.meta_data?.some(
      (m: any) => m.key === "restorecart_capture" && m.value === marker(o),
    );
  function verify(remote: any, o: any) {
    if (!remote || !Number.isSafeInteger(remote.id) || remote.id < 1)
      fail("Destination order reference is invalid.", 502);
    const lines = remote.line_items || [];
    const expected = o.lines
      .map((l: any) => [
        l.sku,
        l.quantity,
        ((l.quantity * l.unitCents) / 100).toFixed(2),
      ])
      .sort();
    const actual = lines.map((l: any) => [l.sku, l.quantity, l.total]).sort();
    if (
      remote.currency !== "USD" ||
      Math.round(Number(remote.total) * 100) !== o.amount ||
      remote.transaction_id !== o.capture ||
      JSON.stringify(expected) !== JSON.stringify(actual) ||
      !matches(remote, o)
    )
      fail(
        "Destination order differs from the recorded sale. Inspect it before continuing.",
        409,
      );
  }
  async function build(id: string) {
    const c = connection(db, id),
      report = recovery(db, id),
      remote = await allOrders(c);
    const conflicts: string[] = [],
      actions: any[] = [];
    let alreadyRecorded = 0;
    for (const o of report.orders) {
      if (o.refunded) {
        conflicts.push(
          `Order ${o.id}: refunded sales require manual file recovery in this connector version.`,
        );
        continue;
      }
      const found = remote.filter((r) => matches(r, o));
      if (found.length > 1) {
        conflicts.push(
          `Order ${o.id}: duplicate destination references require manual resolution.`,
        );
        continue;
      }
      try {
        const products = [];
        for (const l of o.lines) {
          const p = await product(c, l.sku);
          products.push({
            sku: l.sku,
            id: p.id,
            stock: p.stock_quantity,
            quantity: l.quantity,
          });
        }
        const journal = meta(db, `woo-journal:${c.base}:${o.capture}`, null);
        if (found.length) {
          verify(found[0], o);
          if (
            ["on-hold", "processing", "completed"].includes(found[0].status)
          ) {
            if (journal?.stage === "done" || journal?.stage === "finalizing") {
              alreadyRecorded++;
              actions.push({
                order: o,
                remoteId: found[0].id,
                products,
                action: "verify existing",
                journal,
              });
              continue;
            }
            conflicts.push(
              `Order ${o.id}: destination already has an active order without this return journal. Inspect stock before continuing.`,
            );
            continue;
          }
          if (found[0].status !== "pending")
            fail(
              "Destination order is canceled or refunded; inspect it manually.",
              409,
            );
        } else if (journal)
          fail(
            "An earlier write has an uncertain destination outcome. Do not recreate this order; inspect the test store.",
            409,
          );
        for (const p of products)
          if (p.stock < p.quantity)
            fail(`SKU ${p.sku}: insufficient destination stock.`, 409);
        actions.push({
          order: o,
          products,
          remoteId: found[0]?.id || null,
          action: found.length ? "finish pending" : "create external sale",
        });
      } catch (e) {
        conflicts.push((e as Error).message);
      }
    }
    const demand = new Map<number, number>();
    for (const a of actions.filter((a) => a.action !== "verify existing"))
      for (const p of a.products)
        demand.set(p.id, (demand.get(p.id) || 0) + p.quantity);
    for (const a of actions)
      for (const p of a.products)
        if ((demand.get(p.id) || 0) > p.stock)
          conflicts.push(
            `SKU ${p.sku}: combined emergency demand exceeds current stock.`,
          );
    return {
      base: c.base,
      reportHash: hash(JSON.stringify(report.orders)),
      actions,
      conflicts: [...new Set(conflicts)],
      alreadyRecorded,
    };
  }
  return {
    status(id: string) {
      const saved = !!meta(db, `woo-connection:${id}`, null);
      let base = "";
      if (saved && settings().enabled)
        try {
          base = connection(db, id).base;
        } catch {}
      return {
        configured: settings().enabled,
        connected: !!base,
        base,
        testOnly: true,
        stage: base
          ? meta(db, `woo-last-return:${id}`, null)
            ? "return-checked"
            : "connection-tested"
          : "not-connected",
        lastReturn: base ? meta(db, `woo-last-return:${id}`, null) : null,
        liveVerified: false,
        scope:
          "Simple managed-stock USD products; refunded sales and variations use file recovery. Live WooCommerce verification pending.",
      };
    },
    async connect(id: string, input: unknown) {
      const b = z
        .object({
          url: z.string().max(300),
          key: z.string().regex(/^ck_[a-zA-Z0-9]+$/),
          secret: z.string().regex(/^cs_[a-zA-Z0-9]+$/),
          testStore: z.literal(true),
        })
        .strict()
        .parse(input);
      const c = { base: checkBase(b.url), key: b.key, secret: b.secret };
      await call(c, "products?per_page=1");
      await call(c, "orders?per_page=1");
      const active = meta(db, `woo-connection:${id}`, null);
      if (active && connection(db, id).base !== c.base)
        fail("Disconnect before choosing a different test store.", 409);
      putMeta(db, `woo-connection:${id}`, seal(c));
      putMeta(db, `woo-preview:${id}`, null);
      putMeta(db, `woo-last-return:${id}`, null);
      return { connected: true, base: c.base, readChecked: true };
    },
    disconnect(id: string) {
      db.prepare("DELETE FROM rc_meta WHERE key IN (?,?,?)").run(
        `woo-connection:${id}`,
        `woo-preview:${id}`,
        `woo-last-return:${id}`,
      );
      return { connected: false };
    },
    async compare(id: string) {
      const preview = await build(id),
        previewId = uid("woo-preview");
      putMeta(db, `woo-preview:${id}`, {
        ...preview,
        previewId,
        expires: Date.now() + 300000,
      });
      return {
        previewId,
        conflicts: preview.conflicts,
        canApply: !preview.conflicts.length,
        alreadyRecorded: preview.alreadyRecorded,
        changes: preview.actions
          .filter((a) => a.action !== "verify existing")
          .map((a) => ({
            orderId: a.order.id,
            paymentReference: a.order.capture,
            action: a.action,
            amount: a.order.amount,
            products: a.products.map((p: any) => ({
              sku: p.sku,
              quantity: p.quantity,
              stockBefore: p.stock,
            })),
          })),
      };
    },
    async apply(id: string, input: unknown) {
      const b = z
          .object({ previewId: z.string(), testStorePaused: z.literal(true) })
          .strict()
          .parse(input),
        c = connection(db, id);
      const lock = c.base;
      if (busy.has(lock))
        fail("Another return to this test store is in progress.", 409);
      const lease = uid("woo-lease");
      tx(db, () => {
        const old = meta(db, `woo-lock:${lock}`, null);
        if (old?.expires > Date.now())
          fail(
            "Another return is active or awaiting lease expiry. No changes were repeated.",
            409,
          );
        putMeta(db, `woo-lock:${lock}`, {
          owner: lease,
          expires: Date.now() + 1800000,
        });
      });
      busy.add(lock);
      leases.set(lock, lease);
      try {
        const saved = meta(db, `woo-preview:${id}`, null);
        if (
          !saved ||
          saved.previewId !== b.previewId ||
          saved.expires < Date.now()
        )
          fail("Compare again; the return preview expired.", 409);
        const latest = await build(id);
        if (latest.conflicts.length) fail(latest.conflicts.join(" "), 409);
        if (
          JSON.stringify([saved.base, saved.reportHash, saved.actions]) !==
          JSON.stringify([latest.base, latest.reportHash, latest.actions])
        )
          fail(
            "Destination records changed. Compare again before applying.",
            409,
          );
        let applied = 0;
        for (const a of latest.actions) {
          const o = a.order,
            key = `woo-journal:${c.base}:${o.capture}`;
          let remote = a.remoteId
            ? await call(c, `orders/${a.remoteId}`)
            : null;
          if (a.action === "verify existing") {
            verify(remote, o);
            const j = a.journal;
            for (const p of j.products || []) {
              const current = await product(c, p.sku);
              if (current.stock_quantity !== expectedStock(c.base, p.sku))
                fail(
                  `SKU ${p.sku}: stock changed after transfer. Inspect destination; no write was repeated.`,
                  409,
                );
            }
            putMeta(db, key, { ...j, stage: "done" });
            continue;
          }
          const planned: { sku: string; before: number; after: number }[] = [];
          for (const l of o.lines) {
            const p = await product(c, l.sku);
            if (p.stock_quantity < l.quantity)
              fail("Destination stock changed. Compare again.", 409);
            planned.push({
              sku: l.sku,
              before: p.stock_quantity,
              after: p.stock_quantity - l.quantity,
            });
          }
          if (!remote) {
            putMeta(db, key, { stage: "creating", products: planned });
            remote = await call(c, "orders", "POST", {
              status: "pending",
              currency: "USD",
              set_paid: false,
              payment_method: "",
              payment_method_title:
                "Already collected by RestoreCart (PayPal sandbox)",
              transaction_id: o.capture,
              customer_note:
                "Emergency sale already paid in PayPal sandbox. Do not charge again.",
              meta_data: [{ key: "restorecart_capture", value: marker(o) }],
              line_items: o.lines.map((l: any) => ({
                product_id: a.products.find((p: any) => p.sku === l.sku).id,
                quantity: l.quantity,
                subtotal: ((l.quantity * l.unitCents) / 100).toFixed(2),
                total: ((l.quantity * l.unitCents) / 100).toFixed(2),
                taxes: [],
              })),
            });
          }
          verify(remote, o);
          // WooCommerce's standard order-status hook owns the one-time stock reduction; never PUT absolute stock quantities.
          for (const p of planned) {
            if ((await product(c, p.sku)).stock_quantity !== p.before)
              fail(
                "Stock changed during transfer. Pending destination order retained for inspection.",
                409,
              );
          }
          const sequence = tx(db, () => {
            const n = Number(meta(db, `woo-sequence:${c.base}`, 0)) + 1;
            putMeta(db, `woo-sequence:${c.base}`, n);
            putMeta(db, key, {
              stage: "finalizing",
              remoteId: remote.id,
              products: planned,
              sequence: n,
            });
            return n;
          });
          remote = await call(c, `orders/${remote.id}`, "PUT", {
            status: o.fulfillment === "collected" ? "completed" : "on-hold",
          });
          verify(remote, o);
          if (!["on-hold", "completed"].includes(remote.status))
            fail("Destination status requires inspection.", 409);
          for (const p of planned)
            if ((await product(c, p.sku)).stock_quantity !== p.after)
              fail(
                "Destination stock did not match the expected reduction. Inspect the test store before continuing.",
                409,
              );
          putMeta(db, key, {
            stage: "done",
            remoteId: remote.id,
            products: planned,
            sequence,
          });
          applied++;
        }
        putMeta(db, `woo-preview:${id}`, null);
        if (applied || latest.alreadyRecorded)
          putMeta(db, `woo-last-return:${id}`, {
            at: Date.now(),
            applied,
            alreadyRecorded: latest.alreadyRecorded,
          });
        return {
          applied,
          alreadyRecorded: latest.alreadyRecorded,
          message:
            "Test-store return checked. No payment gateway was invoked. Compare again to verify no duplicate changes.",
        };
      } finally {
        busy.delete(lock);
        leases.delete(lock);
        tx(db, () => {
          if (meta(db, `woo-lock:${lock}`, null)?.owner === lease)
            db.prepare("DELETE FROM rc_meta WHERE key=?").run(
              `woo-lock:${lock}`,
            );
        });
      }
    },
  };
}
export function mountWoo(
  router: any,
  db: DB,
  seller: any,
  wrap: any,
  transport?: WooTransport,
) {
  const woo = wooConnector(db, transport);
  router.get(
    "/incidents/:id/woocommerce",
    seller,
    wrap((req: any, res: any) => res.json(woo.status(req.params.id))),
  );
  for (const [path, fn] of [
    ["connect", woo.connect],
    ["compare", woo.compare],
    ["apply", woo.apply],
    ["disconnect", woo.disconnect],
  ] as const)
    router.post(
      `/incidents/:id/woocommerce/${path}`,
      seller,
      wrap(async (req: any, res: any) =>
        res.json(await fn(req.params.id, req.body)),
      ),
    );
}
