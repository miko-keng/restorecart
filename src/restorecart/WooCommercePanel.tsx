import { useEffect, useState } from "react";
export function WooCommercePanel(p: any) {
  const [status, setStatus] = useState<any>(null),
    [preview, setPreview] = useState<any>(null),
    [result, setResult] = useState(""),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false);
  const path = `/incidents/${p.current.id}/woocommerce`;
  useEffect(() => {
    let alive = true;
    setStatus(null);
    setPreview(null);
    setResult("");
    setPaused(false);
    setError("");
    p.api(path)
      .then((s: any) => {
        if (alive) setStatus(s);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [p.current.id]);
  return (
    <details className="rc-panel">
      <summary>
        WooCommerce —{" "}
        {status?.connected ? "Connection tested" : "Not connected"}
      </summary>
      <ol
        className="rc-connection-stages"
        aria-label="WooCommerce recovery stages"
      >
        <li>
          {status?.connected ? "✓ Connection tested" : "Connect test store"}
        </li>
        <li>{preview ? "✓ Recovery preview" : "Preview recovery"}</li>
        <li>{status?.lastReturn ? "✓ Return checked" : "Confirm return"}</li>
      </ol>
      <p>
        Test-store connector · live recovery not yet independently verified.
        Connection testing reads records only; no stock or orders are changed.
      </p>
      <p>
        Optional test-store recovery. Downloading sales reports and local
        recovery files works without connecting.
      </p>
      <p>
        Supports simple USD products with managed stock. Variations and refunded
        sales require manual recovery. No additional buyer payment is taken.
      </p>
      {error && <p role="alert">{error}</p>}
      {!status ? (
        <p>Checking connection…</p>
      ) : !status.configured ? (
        <p>
          WooCommerce setup is unavailable on this deployment. The connection
          form is built; an operator must enable your test-store URL and
          credential encryption first. File recovery remains available.
        </p>
      ) : !status.connected ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            p.run("Checking test-store connection", async () => {
              await p.api(path + "/connect", {
                url: f.get("url"),
                key: f.get("key"),
                secret: f.get("secret"),
                testStore: f.get("testStore") === "on",
              });
              form.reset();
              setStatus(await p.api(path));
            });
          }}
        >
          <label>
            Test store URL
            <input
              name="url"
              type="url"
              required
              placeholder="https://your-test-store.example"
            />
          </label>
          <p>
            In your test store: WooCommerce → Settings → Advanced → REST API.
            Create a key for this integration with Read/Write access. Enter
            credentials here, never in chat. Read/Write permits later order
            recovery; Test connection itself only reads.
          </p>
          <label>
            WooCommerce consumer key
            <input name="key" type="password" autoComplete="off" required />
          </label>
          <label>
            WooCommerce consumer secret
            <input name="secret" type="password" autoComplete="off" required />
          </label>
          <label>
            <input name="testStore" type="checkbox" required />
            This is my test store, not a live merchant shop.
          </label>
          <button className="rc-button secondary" disabled={!!p.busy}>
            Test connection and save
          </button>
        </form>
      ) : (
        <>
          <p>
            Connected: {status.base}. API access checked; complete a test return
            to verify this store’s stock behavior.
          </p>
          <button
            className="rc-link"
            disabled={!!p.busy}
            onClick={() =>
              p.run("Disconnecting test store", async () => {
                await p.api(path + "/disconnect", {});
                setPreview(null);
                setStatus(await p.api(path));
              })
            }
          >
            Disconnect test store
          </button>
          {!["closing", "closed"].includes(p.current.state) && (
            <p>Stop new orders and resolve payments before comparing.</p>
          )}
          <button
            className="rc-button secondary"
            disabled={
              !!p.busy || !["closing", "closed"].includes(p.current.state)
            }
            onClick={() =>
              p.run("Comparing test-store records", async () => {
                setPreview(await p.api(path + "/compare", {}));
                setResult("");
                setPaused(false);
              })
            }
          >
            Compare WooCommerce return
          </button>
          {preview && (
            <div className="rc-return-preview">
              <h3>
                {preview.changes.length} order(s) to return ·{" "}
                {preview.alreadyRecorded} already recorded
              </h3>
              {preview.conflicts.map((c: string) => (
                <p role="alert" key={c}>
                  {c}
                </p>
              ))}
              {preview.changes.map((c: any) => (
                <div key={c.orderId}>
                  <b>
                    {c.action} · ${Number(c.amount / 100).toFixed(2)}
                  </b>
                  <p>
                    PayPal sandbox capture:{" "}
                    {c.paymentReference || "Reference unavailable"} · Order{" "}
                    {c.orderId}
                  </p>
                  {c.products.map((v: any) => (
                    <p key={v.sku}>
                      {v.sku}: return {v.quantity} sold units; currently{" "}
                      {v.stockBefore} in destination stock.
                    </p>
                  ))}
                </div>
              ))}
              <p>
                Payment references are preserved. This return does not charge
                the customer again. Repeating the comparison should show
                already-recorded orders instead of new changes.
              </p>
              <p>
                Creates an externally paid order, then uses WooCommerce’s
                standard stock handling. It does not invoke a payment gateway.
                Pending or uncertain transfers must be inspected before
                retrying.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={paused}
                  onChange={(e) => setPaused(e.target.checked)}
                />
                I have paused other sales and stock edits on this test store
                during the return.
              </label>
              <button
                className="rc-button"
                disabled={
                  !!p.busy ||
                  !paused ||
                  !preview.canApply ||
                  !preview.changes.length
                }
                onClick={() =>
                  p.run("Returning sales to test store", async () => {
                    const r = await p.api(path + "/apply", {
                      previewId: preview.previewId,
                      testStorePaused: true,
                    });
                    setResult(r.message);
                    setStatus(await p.api(path));
                    setPreview(await p.api(path + "/compare", {}));
                    setPaused(false);
                  })
                }
              >
                Confirm return to test store
              </button>
            </div>
          )}
          {result && <p role="status">{result}</p>}
        </>
      )}
    </details>
  );
}
