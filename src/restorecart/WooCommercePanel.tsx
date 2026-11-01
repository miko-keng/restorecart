import { useEffect, useState } from "react";
export function WooCommercePanel(p: any) {
  const [status, setStatus] = useState<any>(null),
    [preview, setPreview] = useState<any>(null),
    [result, setResult] = useState(""),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [connecting, setConnecting] = useState(false);
  const path = `/incidents/${p.current.id}/woocommerce`;
  useEffect(() => {
    let alive = true;
    setStatus(null);
    setConnecting(false);
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
    <section
      className="rc-panel rc-woo-card"
      aria-label="WooCommerce connection"
    >
      <div className="rc-woo-heading">
        <div>
          <h3>WooCommerce</h3>
          <span className="rc-woo-status">
            {!status
              ? "Checking…"
              : status.connected
                ? "Connected"
                : "Not connected"}
          </span>
        </div>
        {status && !status.connected && !connecting && (
          <button className="rc-button" onClick={() => setConnecting(true)}>
            Connect store
          </button>
        )}
      </div>
      <p>Connect your store to return emergency orders.</p>
      {error && <p role="alert">{error}</p>}
      {!status ? (
        <p>Checking connection…</p>
      ) : !status.connected ? (
        connecting && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              setError("");
              p.run("Connecting store", async () => {
                try {
                  await p.api(path + "/connect", {
                    url: f.get("url"),
                    key: f.get("key"),
                    secret: f.get("secret"),
                    testStore: f.get("testStore") === "on",
                  });
                  form.reset();
                  setStatus(await p.api(path));
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Connection failed. Check your store details.",
                  );
                }
              });
            }}
          >
            {!status.configured && (
              <p role="status">
                Connecting is unavailable on this deployment. You can still
                download reports and use file recovery.
              </p>
            )}
            <label>
              Store URL
              <input
                name="url"
                type="url"
                required
                maxLength={300}
                autoComplete="url"
                autoFocus
                placeholder="https://your-store.com"
              />
            </label>
            <label>
              WooCommerce consumer key
              <input
                name="key"
                type="password"
                autoComplete="off"
                maxLength={128}
                required
              />
            </label>
            <label>
              WooCommerce consumer secret
              <input
                name="secret"
                type="password"
                autoComplete="off"
                maxLength={128}
                required
              />
            </label>
            <label>
              <input name="testStore" type="checkbox" required />
              I’m connecting a test store.
            </label>
            <p>Checks access without changing orders or stock.</p>
            <details className="rc-woo-help">
              <summary>Where do I find my API keys?</summary>
              <p>
                In WooCommerce, open Settings → Advanced → REST API and create a
                Read/Write key. Paste its consumer key and secret here.
              </p>
            </details>
            <div className="rc-buttonrow">
              <button
                className="rc-button secondary"
                disabled={!!p.busy || !status.configured}
              >
                Connect
              </button>
              <button
                type="button"
                className="rc-button secondary"
                onClick={() => {
                  setConnecting(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )
      ) : (
        <>
          <p>{status.base}</p>
          <button
            className="rc-link"
            disabled={!!p.busy}
            onClick={() =>
              p.run("Disconnecting store", async () => {
                await p.api(path + "/disconnect", {});
                setPreview(null);
                setStatus(await p.api(path));
              })
            }
          >
            Disconnect
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
              p.run("Comparing store records", async () => {
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
                I have paused other sales and stock edits on this store during
                the return.
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
                  p.run("Returning sales to store", async () => {
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
                Confirm return
              </button>
            </div>
          )}
          {result && <p role="status">{result}</p>}
        </>
      )}
      <details className="rc-woo-help">
        <summary>Supported use and connection details</summary>
        <p>
          This prototype supports test stores with simple USD products and
          managed stock. Real-store recovery has not yet been independently
          verified. Variations and refunded sales need manual recovery. No
          additional buyer payment is taken.
        </p>
        <p>
          Use a public HTTPS domain without a subfolder or custom port.
          Credentials are encrypted on the server. If demo data resets,
          reconnect your store. Revoke the key in WooCommerce when finished.
        </p>
      </details>
    </section>
  );
}
