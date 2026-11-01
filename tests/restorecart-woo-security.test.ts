import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
  createWooRequest,
  publicAddress,
  storeOrigin,
} from "../server/restorecart/wooNetwork";
import { wooConnector } from "../server/restorecart/woocommerce";
import { openRC, createIncident } from "../server/restorecart/store";
import { accountTables, assignOwner } from "../server/restorecart/accounts";

function network(
  o: {
    addresses?: string[];
    status?: number;
    data?: string;
    timeoutMs?: number;
    maxBytes?: number;
    hang?: boolean;
  } = {},
) {
  const requests: any[] = [];
  let lookups = 0;
  const call = createWooRequest({
    timeoutMs: o.timeoutMs ?? 500,
    maxBytes: o.maxBytes ?? 1000,
    lookup: (async () => {
      lookups++;
      return (o.addresses ?? ["8.8.8.8"]).map((address) => ({
        address,
        family: address.includes(":") ? 6 : 4,
      }));
    }) as any,
    request: ((url: URL, options: any, callback: any) => {
      requests.push({ url, options });
      const req = new EventEmitter() as any;
      req.write = () => {};
      req.destroy = () => {
        req.emit("error", Error("Synthetic socket failure"));
      };
      req.end = () => {
        if (o.hang) return;
        queueMicrotask(() => {
          const res = new PassThrough() as any;
          res.statusCode = o.status ?? 200;
          callback(res);
          res.end(o.data ?? "[]");
        });
      };
      return req;
    }) as any,
  });
  return { requests, call, lookups: () => lookups };
}
const args = [
  "https://shop.example",
  "ck_synthetic",
  "cs_synthetic",
  "products?per_page=1",
] as const;

test("Woo self-service accepts public domains and rejects ambiguous URL forms before DNS", async () => {
  assert.equal(
    storeOrigin("https://SHOP.example:443/"),
    "https://shop.example",
  );
  for (const url of [
    "http://shop.example",
    "https://localhost",
    "https://store.local",
    "https://store.internal",
    "https://127.0.0.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://0177.0.0.1",
    "https://[::1]",
    "https://169.254.169.254",
    "https://user:pass@shop.example",
    "https://shop.example:444",
    "https://shop.example/path",
    "https://shop.example?key=secret",
    "https://shop.example/#frag",
    "https://shop.example.",
    "https://%31%32%37.0.0.1",
    "https://shop.example\\@127.0.0.1",
    "https://-bad.example",
    "https://shop..example",
    "https://" + "x".repeat(301),
  ]) {
    const n = network();
    await assert.rejects(
      n.call(url, args[1], args[2], args[3]),
      () => true,
      url,
    );
    assert.equal(n.lookups(), 0, url);
    assert.equal(n.requests.length, 0, url);
  }
});

test("Woo public address policy rejects local, metadata, reserved and IPv6 transition targets", () => {
  for (const address of [
    "0.1.2.3",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.0.1",
    "192.0.0.9",
    "192.0.2.1",
    "192.88.99.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::ffff:8.8.8.8",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "2001::1",
    "2001:20::1",
    "2002:7f00:1::1",
    "3fff::1",
    "bad",
  ])
    assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
});

test("Woo mixed DNS answers fail before transmitting credentials", async () => {
  for (const addresses of [
    [],
    ["8.8.8.8", "10.0.0.1"],
    ["2606:4700:4700::1111", "::1"],
  ]) {
    const n = network({ addresses });
    await assert.rejects(n.call(...args), /private or unsupported/);
    assert.equal(n.requests.length, 0);
  }
});

test("Woo pins each validated resolution and preserves original HTTPS hostname", async () => {
  const n = network();
  assert.deepEqual(await n.call(...args), []);
  const { url, options } = n.requests[0];
  assert.equal(url.hostname, "shop.example");
  assert.equal(url.protocol, "https:");
  assert.equal(url.pathname, "/wp-json/wc/v3/products");
  assert.notEqual(options.rejectUnauthorized, false);
  assert.equal(options.agent, false);
  let pinned: unknown;
  options.lookup(
    "shop.example",
    { all: true },
    (_e: unknown, value: unknown) => {
      pinned = value;
    },
  );
  assert.deepEqual(pinned, [{ address: "8.8.8.8", family: 4 }]);
  await n.call(...args);
  assert.equal(n.lookups(), 2, "fresh DNS validation for every request");
});

test("Woo rejects redirect, auth error, malformed JSON and oversized responses without leaking body", async () => {
  for (const [options, pattern] of [
    [{ status: 302, data: "cs_sensitive" }, /Redirects are blocked/],
    [{ status: 401, data: "cs_sensitive" }, /consumer key/],
    [{ status: 403, data: "cs_sensitive" }, /permissions/],
    [{ data: "not JSON cs_sensitive" }, /invalid JSON/],
    [{ data: "x".repeat(1100) }, /size limit/],
  ] as const) {
    const n = network(options);
    await assert.rejects(n.call(...args), (e) => {
      assert.match((e as Error).message, pattern);
      assert.ok(!(e as Error).message.includes("cs_sensitive"));
      return true;
    });
    assert.equal(n.requests.length, 1, "no redirect or automatic retry");
  }
});

test("Woo total deadline covers delayed DNS and never sends a late credential request", async () => {
  let resolve: (v: any) => void = () => {};
  let sends = 0;
  const call = createWooRequest({
    timeoutMs: 15,
    lookup: (() =>
      new Promise((r) => {
        resolve = r;
      })) as any,
    request: (() => {
      sends++;
      throw Error("Must not send");
    }) as any,
  });
  await assert.rejects(call(...args), /timed out/);
  resolve([{ address: "8.8.8.8", family: 4 }]);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(sends, 0);
});

test("Woo total response deadline and concurrent request limit release slots on failure", async () => {
  const n = network({ hang: true, timeoutMs: 20 });
  const pending = Array.from({ length: 4 }, () => n.call(...args));
  const results = Promise.allSettled(pending);
  await assert.rejects(n.call(...args), /busy/);
  assert.ok((await results).every((r) => r.status === "rejected"));
  await assert.rejects(n.call(...args), /timed out|Secure store/);
  assert.equal(n.requests.length, 5);
});

test("Woo fixed API resource guard rejects arbitrary paths", async () => {
  const n = network();
  for (const path of [
    "../admin",
    "https://other.example",
    "orders/../users",
    "users",
    "orders#x",
  ])
    await assert.rejects(
      n.call(args[0], args[1], args[2], path),
      /Unsupported/,
    );
  assert.equal(n.lookups(), 0);
});

function fixture(transport: any) {
  const db = openRC(":memory:");
  accountTables(db);
  const a = createIncident(db, "A"),
    b = createIncident(db, "B");
  assignOwner(db, "incident", a.id, "seller-one");
  assignOwner(db, "incident", b.id, "seller-one");
  process.env.WOOCOMMERCE_ENCRYPTION_KEY = "a".repeat(64);
  // A deliberately different old allowlist cannot require per-store approval anymore.
  process.env.WOOCOMMERCE_TEST_ORIGINS = "https://old.example";
  return {
    db,
    a,
    b,
    woo: wooConnector(db, transport),
    close() {
      db.close();
      delete process.env.WOOCOMMERCE_ENCRYPTION_KEY;
      delete process.env.WOOCOMMERCE_TEST_ORIGINS;
    },
  };
}
const credentials = {
  url: args[0],
  key: args[1],
  secret: args[2],
  testStore: true,
};

test("Woo seller self-service connects without operator origin approval; read-only and encrypted", async () => {
  const calls: any[] = [];
  const f = fixture(async (...v: any[]) => {
    calls.push(v);
    return [];
  });
  try {
    await f.woo.connect(f.a.id, credentials);
    assert.ok(f.woo.status(f.a.id).connected);
    assert.ok(!JSON.stringify(f.woo.status(f.a.id)).includes(args[2]));
    assert.equal(calls.length, 2);
    assert.ok(calls.every((v) => v[4] === "GET"));
    const stored = JSON.stringify(
      f.db
        .prepare("SELECT value FROM rc_meta WHERE key LIKE 'woo-connection:%'")
        .all(),
    );
    assert.ok(!stored.includes(args[2]));
    f.woo.disconnect(f.a.id);
    assert.equal(f.woo.status(f.a.id).connected, false);
  } finally {
    f.close();
  }
});

test("Woo missing encryption, invalid credentials and malformed API cannot save a connection", async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    return { error: "not WooCommerce" };
  });
  try {
    delete process.env.WOOCOMMERCE_ENCRYPTION_KEY;
    assert.equal(f.woo.status(f.a.id).configured, false);
    await assert.rejects(f.woo.connect(f.a.id, credentials), /encryption/);
    assert.equal(calls, 0);
    process.env.WOOCOMMERCE_ENCRYPTION_KEY = "a".repeat(64);
    for (const invalid of [
      { key: "ck_" + "a".repeat(129) },
      { secret: "cs_bad!" },
      { testStore: false },
      { url: "http://localhost" },
    ])
      await assert.rejects(
        f.woo.connect(f.a.id, { ...credentials, ...invalid }),
      );
    assert.equal(calls, 0);
    await assert.rejects(
      f.woo.connect(f.a.id, credentials),
      /did not return WooCommerce/,
    );
    assert.equal(f.woo.status(f.a.id).connected, false);
  } finally {
    f.close();
  }
});

test("Woo failed connection attempts share a persisted seller limit across shops and instances", async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    throw Error("Wrong credentials");
  };
  const f = fixture(transport);
  try {
    for (let i = 0; i < 10; i++)
      await assert.rejects(
        f.woo.connect(i % 2 ? f.a.id : f.b.id, credentials),
        /Wrong credentials/,
      );
    const another = wooConnector(f.db, transport);
    await assert.rejects(another.connect(f.a.id, credentials), /attempt limit/);
    assert.equal(calls, 10);
    const other = createIncident(f.db, "Other seller");
    assignOwner(f.db, "incident", other.id, "seller-two");
    await assert.rejects(
      another.connect(other.id, credentials),
      /Wrong credentials/,
    );
    assert.equal(calls, 11);
  } finally {
    f.close();
  }
});
