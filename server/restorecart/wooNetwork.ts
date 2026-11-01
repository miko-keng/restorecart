import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { fail } from "./domain";

// Conservative public-address policy: unsupported special-use ranges fail closed.
const blocked = new BlockList();
for (const [ip, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(ip, bits, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [ip, bits] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["2620:4f:8000::", 48],
] as const)
  blocked.addSubnet(ip, bits, "ipv6");
export function publicAddress(ip: string) {
  return isIP(ip) === 4
    ? !blocked.check(ip, "ipv4")
    : isIP(ip) === 6 &&
        globalV6.check(ip, "ipv6") &&
        !blocked.check(ip, "ipv6");
}
export function storeOrigin(raw: string) {
  // Reject ambiguous forms before URL normalization (numeric IP aliases, escapes, userinfo).
  if (raw.length > 300 || !/^https:\/\/[a-z0-9.-]+(?::443)?\/?$/i.test(raw))
    fail(
      "Enter a public HTTPS store URL, without a path, login, query or custom port.",
    );
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    fail("Enter a valid public HTTPS store domain.");
  }
  const host = u.hostname;
  if (
    isIP(host) ||
    !host.includes(".") ||
    host.endsWith(".") ||
    host
      .split(".")
      .some(
        (label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
      ) ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/.test(host)
  )
    fail("Use a public store domain, not a local address or IP address.");
  return u.origin;
}

// Inject network primitives only in controlled tests; production always uses DNS + verified TLS.
export function createWooRequest(
  deps: {
    lookup?: typeof lookup;
    request?: typeof request;
    timeoutMs?: number;
    maxBytes?: number;
  } = {},
) {
  const resolveHost = deps.lookup || lookup,
    send = deps.request || request;
  const timeoutMs = deps.timeoutMs ?? 20000,
    maxBytes = deps.maxBytes ?? 8_000_000;
  let active = 0;
  return async (
    base: string,
    key: string,
    secret: string,
    path: string,
    method = "GET",
    body?: any,
  ): Promise<any> => {
    base = storeOrigin(base);
    if (!/^(?:products|orders)(?:\/[1-9][0-9]*)?(?:\?[^#]*)?$/.test(path))
      fail("Unsupported WooCommerce API resource.");
    if (active >= 4)
      fail("Store connections are busy. Try again shortly.", 429);
    active++;
    let req: ReturnType<typeof request> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const work = async () => {
        const u = new URL(base + "/wp-json/wc/v3/" + path);
        const addresses = await resolveHost(u.hostname, { all: true });
        if (
          !addresses.length ||
          addresses.some((a) => !publicAddress(a.address))
        )
          fail(
            "Store DNS includes a private or unsupported address. Use a public HTTPS test store.",
          );
        // A DNS timeout must not lead to a late request with credentials.
        if (!timer)
          throw Error(
            "Store connection timed out. Try again after checking the store.",
          );
        const address = addresses[0];
        return new Promise((resolve, reject) => {
          req = send(
            u,
            {
              method,
              agent: false,
              headers: {
                Authorization:
                  "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
              lookup: ((_h: any, o: any, cb: any) =>
                o?.all
                  ? cb(null, [address])
                  : cb(null, address.address, address.family)) as any,
            },
            (res) => {
              // Never follow redirects or echo remote response bodies/credentials in errors.
              if (
                !res.statusCode ||
                res.statusCode < 200 ||
                res.statusCode >= 300
              ) {
                res.resume();
                const advice = [401, 403].includes(res.statusCode || 0)
                  ? "Check the consumer key, secret and REST API permissions."
                  : res.statusCode &&
                      res.statusCode >= 300 &&
                      res.statusCode < 400
                    ? "Redirects are blocked. Enter the store's final HTTPS domain."
                    : "Check WooCommerce REST API availability and try again.";
                reject(
                  Error(`WooCommerce HTTP ${res.statusCode || 0}. ${advice}`),
                );
                req?.destroy();
                return;
              }
              const chunks: Buffer[] = [];
              let bytes = 0;
              res.on("data", (b: Buffer) => {
                bytes += b.length;
                if (bytes > maxBytes) {
                  reject(
                    Error("WooCommerce response exceeded the size limit."),
                  );
                  req?.destroy();
                } else chunks.push(b);
              });
              res.on("error", () =>
                reject(
                  Error(
                    "Store response was interrupted. Inspect the destination before retrying.",
                  ),
                ),
              );
              res.on("end", () => {
                try {
                  resolve(JSON.parse(Buffer.concat(chunks).toString()));
                } catch {
                  reject(
                    Error(
                      "WooCommerce returned invalid JSON. Check its REST API endpoint.",
                    ),
                  );
                }
              });
            },
          );
          req.on("error", () =>
            reject(
              Error(
                "Secure store connection failed. Check its domain and TLS certificate; inspect the destination before retrying.",
              ),
            ),
          );
          if (body !== undefined) req.write(JSON.stringify(body));
          req.end();
        });
      };
      return await Promise.race([
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timer = undefined;
            reject(
              Error(
                "Store connection timed out. Inspect the destination before retrying.",
              ),
            );
            req?.destroy();
          }, timeoutMs);
        }),
        work(),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      timer = undefined;
      active--;
    }
  };
}
