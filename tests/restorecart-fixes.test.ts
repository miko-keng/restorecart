import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openRC,
  incident,
  available,
  reserve,
  lock,
  commitCapture,
  closeIncident,
  save,
} from "../server/restorecart/store";
import { accountTables } from "../server/restorecart/accounts";
import {
  prepareSampleShop,
  prepareEmptyConfiguredWorkspace,
} from "../server/restorecart/demo";
import { allowance, claim } from "../server/restorecart/quota";
import { wooConnector, publicAddress } from "../server/restorecart/woocommerce";
import { createApp } from "../server/restorecart/app";
import { workerStatus } from "../server/restorecart/diagnostics";

test("AI allowances isolate sellers, reserve synchronously, renew and survive reopening SQLite", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rc-quota-")),
    path = join(dir, "db.sqlite"),
    p = { sellerCallsPerWindow: 2, globalCallsPerWindow: 3, windowSeconds: 60 };
  let db = openRC(path);
  try {
    const outcomes = await Promise.allSettled(
      [0, 1, 2].map(async () => claim(db, "alice", p, 1000)),
    );
    assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 2);
    assert.equal(allowance(db, "bob", p, 1000).sellerRemaining, 2);
    db.close();
    db = openRC(path);
    assert.equal(allowance(db, "alice", p, 1000).remaining, 0);
    assert.equal(claim(db, "bob", p, 1000).remaining, 0);
    assert.throws(() => claim(db, "charlie", p, 1000), /allowance reached/);
    assert.equal(allowance(db, "alice", p, 61000).remaining, 2);
  } finally {
    db.close();
    rmSync(dir, { recursive: true });
  }
});
test("Startup publishes a separate sample once and never replenishes stock or reopens it", async () => {
  const db = openRC(":memory:");
  accountTables(db);
  try {
    await prepareEmptyConfiguredWorkspace(db);
    const sample = await prepareSampleShop(db),
      fresh = incident(db, sample.id);
    assert.equal(fresh.state, "live");
    assert.equal(fresh.name, "Sunday Studio Sample Shop");
    const draft = db
      .prepare(
        "SELECT body FROM rc_incidents WHERE json_extract(body,'$.name')='Sunday Studio Demo'",
      )
      .get() as any;
    assert.equal(
      JSON.parse(draft.body).products.find((p: any) => p.sku === "MUG-BLU")
        .price,
      "",
    );
    const o = reserve(
      db,
      sample.id,
      "buyer",
      "sample-buy",
      "test-token",
      fresh.published!.revision,
      [{ sku: "MUG-BLU", quantity: 2 }],
    );
    db.prepare("UPDATE rc_orders SET state='awaiting_buyer' WHERE id=?").run(
      o.id,
    );
    lock(db, o.id);
    commitCapture(db, o.id, "CAP-SAMPLE");
    closeIncident(db, sample.id);
    await prepareEmptyConfiguredWorkspace(db);
    assert.equal(available(db, sample.id, "MUG-BLU", 8), 6);
    assert.ok(["closing", "closed"].includes(incident(db, sample.id).state));
    assert.equal(db.prepare("SELECT count(*) n FROM rc_incidents").get()?.n, 2);
    assert.equal(db.prepare("SELECT count(*) n FROM rc_orders").get()?.n, 1);
  } finally {
    db.close();
  }
});
async function wooFixture(extraOrder = false, storage = ":memory:") {
  process.env.WOOCOMMERCE_TEST_ORIGINS = "https://woo-test.example";
  process.env.WOOCOMMERCE_ENCRYPTION_KEY = "ab".repeat(32);
  const db = openRC(storage);
  accountTables(db);
  const shop = await prepareSampleShop(db);
  const o = reserve(
    db,
    shop.id,
    "buyer",
    "woo-sale",
    "test-token",
    shop.published!.revision,
    [
      { sku: "MUG-BLU", quantity: 2 },
      { sku: "TOTE-NAT", quantity: 1 },
    ],
  );
  db.prepare("UPDATE rc_orders SET state='awaiting_buyer' WHERE id=?").run(
    o.id,
  );
  lock(db, o.id);
  commitCapture(db, o.id, "CAP-WOO");
  if (extraOrder) {
    const next = reserve(
      db,
      shop.id,
      "buyer2",
      "woo-sale2",
      "test-token2",
      shop.published!.revision,
      [{ sku: "MUG-BLU", quantity: 1 }],
    );
    db.prepare("UPDATE rc_orders SET state='awaiting_buyer' WHERE id=?").run(
      next.id,
    );
    lock(db, next.id);
    commitCapture(db, next.id, "CAP-WOO2");
  }
  closeIncident(db, shop.id);
  const products: any[] = [
      {
        id: 11,
        sku: "MUG-BLU",
        stock_quantity: 8,
        type: "simple",
        manage_stock: true,
      },
      {
        id: 12,
        sku: "TOTE-NAT",
        stock_quantity: 4,
        type: "simple",
        manage_stock: true,
      },
    ],
    orders: any[] = [],
    writes: any[] = [];
  let timeoutCreate = false,
    timeoutFinish = false,
    failFinish = false;
  const transport: any = async (
    _base: any,
    _key: any,
    _secret: any,
    path: string,
    method = "GET",
    body: any,
  ) => {
    const u = new URL("https://fake/" + path);
    if (method === "GET" && u.pathname === "/products")
      return structuredClone(
        u.searchParams.has("sku")
          ? products.filter((p) => p.sku === u.searchParams.get("sku"))
          : products,
      );
    if (method === "GET" && u.pathname === "/orders")
      return structuredClone(orders);
    if (method === "GET" && u.pathname.startsWith("/orders/"))
      return structuredClone(
        orders.find((o) => o.id === Number(path.split("/")[1])),
      );
    writes.push({ path, method, body });
    if (method === "POST") {
      const dest = {
        ...body,
        id: 101 + orders.length,
        total: body.line_items
          .reduce((n: number, l: any) => n + Number(l.total), 0)
          .toFixed(2),
        line_items: body.line_items.map((l: any) => ({
          ...l,
          sku: products.find((p) => p.id === l.product_id).sku,
        })),
      };
      orders.push(dest);
      if (timeoutCreate) throw Error("timeout after create");
      return structuredClone(dest);
    }
    if (failFinish) throw Error("destination unavailable before status update");
    const remote = orders.find((o) => o.id === Number(path.split("/")[1]));
    if (remote.status === "pending")
      for (const l of remote.line_items)
        products.find((p) => p.id === l.product_id).stock_quantity -=
          l.quantity;
    remote.status = body.status;
    if (timeoutFinish) throw Error("timeout after stock hook");
    return structuredClone(remote);
  };
  const woo = wooConnector(db, transport);
  const connect = () =>
    woo.connect(shop.id, {
      url: "https://woo-test.example",
      key: "ck_test",
      secret: "cs_test",
      testStore: true,
    });
  await connect();
  return {
    db,
    shop,
    woo,
    transport,
    products,
    orders,
    writes,
    connect,
    flags: (flags: any) => {
      timeoutCreate = !!flags.timeoutCreate;
      timeoutFinish = !!flags.timeoutFinish;
      failFinish = !!flags.failFinish;
    },
    close() {
      db.close();
      delete process.env.WOOCOMMERCE_TEST_ORIGINS;
      delete process.env.WOOCOMMERCE_ENCRYPTION_KEY;
    },
  };
}
test("WooCommerce encrypted connection, explicit preview and repeat return never charge or repeat stock", async () => {
  const f = await wooFixture();
  try {
    assert.equal(f.woo.status(f.shop.id).connected, true);
    assert.equal(f.woo.status(f.shop.id).stage, "connection-tested");
    assert.ok(
      !JSON.stringify(
        f.db
          .prepare(
            "SELECT value FROM rc_meta WHERE key LIKE 'woo-connection:%'",
          )
          .all(),
      ).includes("cs_test"),
    );
    const p = await f.woo.compare(f.shop.id);
    assert.equal(p.changes.length, 1);
    assert.equal(f.writes.length, 0);
    const r = await f.woo.apply(f.shop.id, {
      previewId: p.previewId,
      testStorePaused: true,
    });
    assert.equal(r.applied, 1);
    assert.equal(f.woo.status(f.shop.id).stage, "return-checked");
    assert.equal(f.orders[0].set_paid, false);
    assert.equal(f.orders[0].payment_method, "");
    assert.equal(f.products[0].stock_quantity, 6);
    assert.equal(f.products[1].stock_quantity, 3);
    const repeat = await f.woo.compare(f.shop.id);
    assert.equal(repeat.changes.length, 0);
    assert.equal(repeat.alreadyRecorded, 1);
    await f.woo.apply(f.shop.id, {
      previewId: repeat.previewId,
      testStorePaused: true,
    });
    assert.equal(f.writes.length, 2);
  } finally {
    f.close();
  }
});
test("WooCommerce refuses ambiguous/variable SKUs and stale stock before writes", async () => {
  const f = await wooFixture();
  try {
    f.products.push({ ...f.products[0], id: 19 });
    assert.equal((await f.woo.compare(f.shop.id)).canApply, false);
    f.products.pop();
    f.products[0].type = "variable";
    assert.match(
      (await f.woo.compare(f.shop.id)).conflicts.join(),
      /simple product/,
    );
    f.products[0].type = "simple";
    const p = await f.woo.compare(f.shop.id);
    f.products[0].stock_quantity--;
    await assert.rejects(
      () =>
        f.woo.apply(f.shop.id, {
          previewId: p.previewId,
          testStorePaused: true,
        }),
      /changed/,
    );
    assert.equal(f.writes.length, 0);
    await assert.rejects(
      () =>
        f.woo.connect(f.shop.id, {
          url: "https://evil.example",
          key: "ck_x",
          secret: "cs_x",
          testStore: true,
        }),
      /allowed/,
    );
  } finally {
    f.close();
  }
});
test("WooCommerce timeout after creating a pending order is found before retry, no duplicate POST", async () => {
  const f = await wooFixture();
  try {
    const p = await f.woo.compare(f.shop.id);
    f.flags({ timeoutCreate: true });
    await assert.rejects(
      () =>
        f.woo.apply(f.shop.id, {
          previewId: p.previewId,
          testStorePaused: true,
        }),
      /timeout/,
    );
    assert.equal(f.orders.length, 1);
    assert.equal(f.products[0].stock_quantity, 8);
    const retry = await f.woo.compare(f.shop.id);
    f.flags({});
    await f.woo.apply(f.shop.id, {
      previewId: retry.previewId,
      testStorePaused: true,
    });
    assert.equal(f.orders.length, 1);
    assert.equal(f.products[0].stock_quantity, 6);
    assert.equal(f.writes.filter((w) => w.method === "POST").length, 1);
  } finally {
    f.close();
  }
});
test("WooCommerce timeout after stock hook reconciles by remote reference without repeating stock", async () => {
  const f = await wooFixture();
  try {
    const p = await f.woo.compare(f.shop.id);
    f.flags({ timeoutFinish: true });
    await assert.rejects(
      () =>
        f.woo.apply(f.shop.id, {
          previewId: p.previewId,
          testStorePaused: true,
        }),
      /timeout/,
    );
    f.flags({});
    const retry = await f.woo.compare(f.shop.id);
    assert.equal(retry.alreadyRecorded, 1);
    await f.woo.apply(f.shop.id, {
      previewId: retry.previewId,
      testStorePaused: true,
    });
    assert.equal(f.products[0].stock_quantity, 6);
    assert.equal(f.writes.length, 2);
  } finally {
    f.close();
  }
});
test("WooCommerce lost response without discoverable order stops instead of blind creation", async () => {
  const f = await wooFixture();
  try {
    const p = await f.woo.compare(f.shop.id);
    f.flags({ timeoutCreate: true });
    await assert.rejects(() =>
      f.woo.apply(f.shop.id, { previewId: p.previewId, testStorePaused: true }),
    );
    f.orders.length = 0;
    assert.match(
      (await f.woo.compare(f.shop.id)).conflicts.join(),
      /uncertain/,
    );
    assert.equal(f.writes.length, 1);
  } finally {
    f.close();
  }
});
test("WooCommerce refunds and pending payments block unsafe transfer; private address targets blocked", async () => {
  const f = await wooFixture();
  try {
    f.db.prepare("UPDATE rc_orders SET refunded=amount").run();
    assert.match((await f.woo.compare(f.shop.id)).conflicts.join(), /refunded/);
    f.db.prepare("UPDATE rc_orders SET state='pending'").run();
    await assert.rejects(() => f.woo.compare(f.shop.id), /Resolve payments/);
    for (const a of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.169.254",
      "172.16.0.2",
      "192.168.1.1",
      "::1",
      "::ffff:127.0.0.1",
      "fc00::1",
    ])
      assert.equal(publicAddress(a), false, a);
    assert.equal(publicAddress("8.8.8.8"), true);
  } finally {
    f.close();
  }
});
test("Worker records redacted retry and seller-specific diagnostics without changing uncertain payment", async () => {
  const db = openRC(":memory:");
  const runtime = createApp({
    db,
    paymentTransport: (async () => {
      throw Error("secret-provider-error");
    }) as any,
  });
  try {
    const shop = await prepareSampleShop(db);
    const o = reserve(
      db,
      shop.id,
      "buyer",
      "diagnostic",
      "token",
      shop.published!.revision,
      [{ sku: "MUG-BLU", quantity: 1 }],
    );
    db.prepare(
      "UPDATE rc_orders SET state='pending',provider='provider' WHERE id=?",
    ).run(o.id);
    await runtime.tick();
    const state = workerStatus(db, shop.id);
    assert.equal(state.pending, 1);
    assert.equal(state.retries, 1);
    assert.ok(state.heartbeat);
    assert.equal(
      JSON.stringify(state).includes("secret-provider-error"),
      false,
    );
    assert.equal(
      db.prepare("SELECT state FROM rc_orders WHERE id=?").get(o.id)?.state,
      "pending",
    );
  } finally {
    db.close();
  }
});

test("WooCommerce multiple orders sharing a SKU verify the final combined stock on repeat", async () => {
  const f = await wooFixture(true);
  try {
    const p = await f.woo.compare(f.shop.id);
    assert.equal(p.changes.length, 2);
    await f.woo.apply(f.shop.id, {
      previewId: p.previewId,
      testStorePaused: true,
    });
    assert.equal(f.products[0].stock_quantity, 5);
    const r = await f.woo.compare(f.shop.id);
    assert.equal(r.alreadyRecorded, 2);
    await f.woo.apply(f.shop.id, {
      previewId: r.previewId,
      testStorePaused: true,
    });
    assert.equal(f.products[0].stock_quantity, 5);
    assert.equal(f.writes.length, 4);
  } finally {
    f.close();
  }
});

test("WooCommerce SQLite destination lease rejects concurrent applies across connector instances", async () => {
  const f = await wooFixture();
  try {
    const preview = await f.woo.compare(f.shop.id),
      other = wooConnector(f.db, f.transport);
    const results = await Promise.allSettled([
      f.woo.apply(f.shop.id, {
        previewId: preview.previewId,
        testStorePaused: true,
      }),
      other.apply(f.shop.id, {
        previewId: preview.previewId,
        testStorePaused: true,
      }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(f.orders.length, 1);
    assert.equal(f.products[0].stock_quantity, 6);
  } finally {
    f.close();
  }
});
test("WooCommerce rejects combined stock shortfall before creating any remote orders", async () => {
  const f = await wooFixture(true);
  try {
    f.products[0].stock_quantity = 2;
    const p = await f.woo.compare(f.shop.id);
    assert.equal(p.canApply, false);
    assert.match(p.conflicts.join(), /combined emergency demand/);
    assert.equal(f.writes.length, 0);
  } finally {
    f.close();
  }
});

test("WooCommerce uncertain return resumes after database reopen without duplicate remote orders", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rc-woo-restart-"));
  const path = join(dir, "persist.sqlite");
  const f = await wooFixture(false, path);
  let reopened: ReturnType<typeof openRC> | null = null;
  try {
    const preview = await f.woo.compare(f.shop.id);
    f.flags({ timeoutFinish: true });
    await assert.rejects(
      f.woo.apply(f.shop.id, {
        previewId: preview.previewId,
        testStorePaused: true,
      }),
    );
    const writesBefore = f.writes.length;
    f.db.close();
    reopened = openRC(path);
    const resumed = wooConnector(reopened, f.transport);
    assert.equal(resumed.status(f.shop.id).connected, true);
    f.flags({});
    const compare = await resumed.compare(f.shop.id);
    await resumed.apply(f.shop.id, {
      previewId: compare.previewId,
      testStorePaused: true,
    });
    const repeat = await resumed.compare(f.shop.id);
    assert.equal(repeat.changes.length, 0);
    assert.equal(repeat.alreadyRecorded, 1);
    assert.equal(f.orders.length, 1);
    assert.equal(f.products[0].stock_quantity, 6);
    assert.equal(f.writes.length, writesBefore);
  } finally {
    reopened?.close();
    try {
      f.close();
    } catch {}
    delete process.env.WOOCOMMERCE_TEST_ORIGINS;
    delete process.env.WOOCOMMERCE_ENCRYPTION_KEY;
    rmSync(dir, { recursive: true, force: true });
  }
});
