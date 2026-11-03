import { useEffect, useState } from "react";
export function PayPalConnectionPanel(p: any) {
  const [status, setStatus] = useState<any>(null),
    [error, setError] = useState(""),
    [consent, setConsent] = useState(false),
    [disconnecting, setDisconnecting] = useState(false);
  const path = `/incidents/${p.current.id}/paypal`;
  useEffect(() => {
    let alive = true;
    setStatus(null);
    setError("");
    setConsent(false);
    setDisconnecting(false);
    p.api(path)
      .then((value: any) => {
        if (alive) setStatus(value);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [p.current.id]);
  const run = (label: string, task: () => Promise<void>) =>
    p.run(label, async () => {
      setError("");
      try {
        await task();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "PayPal connection could not be checked. Try again.",
        );
        try {
          setStatus(await p.api(path));
        } catch {
          /* Keep the last known status when offline. */
        }
      }
    });
  return (
    <section
      className="rc-panel rc-paypal-card"
      aria-label="PayPal account connection"
    >
      <div className="rc-woo-heading">
        <div>
          <h3>PayPal payments</h3>
          <span className="rc-woo-status">
            {!status
              ? "Checking…"
              : status.connected
                ? "Connected · sandbox"
                : status.state === "pending"
                  ? "Finish connecting"
                  : status.state === "revoked"
                    ? "Permission removed"
                    : "Not connected"}
          </span>
        </div>
      </div>
      <p>
        Connect your PayPal account to receive this shop’s sandbox payments. You
        sign in securely on PayPal.
      </p>
      {error && <p role="alert">{error}</p>}
      {status?.demo && (
        <p role="status">
          This demonstration currently pays the shared sandbox account. Your own
          PayPal account is not connected.
        </p>
      )}
      {status && !status.configured && (
        <p role="status">
          Account connection is not enabled on this deployment yet. PayPal
          platform setup is required.
        </p>
      )}
      {status?.connected ? (
        <>
          <p>
            PayPal merchant ID: <strong>{status.merchantId}</strong>
          </p>
          {status.checkedAt && (
            <small>
              Verified {new Date(status.checkedAt).toLocaleString()}
            </small>
          )}
          <div className="rc-actions">
            <button
              className="rc-button secondary"
              disabled={!!p.busy}
              onClick={() =>
                run("Checking PayPal", async () =>
                  setStatus(await p.api(path + "/check", {})),
                )
              }
            >
              Check connection
            </button>
            <button className="rc-link" onClick={() => setDisconnecting(true)}>
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="rc-checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={!status?.configured || !!p.busy}
            />
            I agree to share connection details with PayPal to set up payments.
          </label>
          <div className="rc-actions">
            <button
              className="rc-button"
              disabled={!status?.configured || !consent || !!p.busy}
              onClick={() =>
                run("Opening PayPal", async () => {
                  const result = await p.api(path + "/connect", {
                    consent: true,
                  });
                  window.location.assign(result.url);
                })
              }
            >
              {status?.state === "pending"
                ? "Restart PayPal connection"
                : "Connect PayPal"}
            </button>
            {status?.state === "pending" && (
              <button
                className="rc-button secondary"
                disabled={!!p.busy || !status.configured}
                onClick={() =>
                  run("Checking PayPal", async () =>
                    setStatus(await p.api(path + "/check", {})),
                  )
                }
              >
                I finished setup — check connection
              </button>
            )}
          </div>
          {status && !status.demo && (
            <small>
              New checkouts stay unavailable until your account is verified.
            </small>
          )}
        </>
      )}
      {disconnecting && (
        <div
          className="rc-notice"
          role="group"
          aria-label="Confirm PayPal disconnect"
        >
          <p>
            Disconnect this shop? New checkouts will stop. Existing orders keep
            their original payment account. To remove the platform’s permissions
            completely, also revoke them in PayPal.
          </p>
          <button
            className="rc-button secondary"
            disabled={!!p.busy}
            onClick={() =>
              run("Disconnecting PayPal", async () => {
                setStatus(await p.api(path + "/disconnect", {}));
                setDisconnecting(false);
              })
            }
          >
            Disconnect this shop
          </button>
          <button className="rc-link" onClick={() => setDisconnecting(false)}>
            Keep connected
          </button>
        </div>
      )}
      <small>
        Sandbox only — no real money. Pickup orders may have different Seller
        Protection eligibility; review{" "}
        <a
          href="https://www.paypal.com/us/legalhub/paypal/seller-protection"
          target="_blank"
          rel="noreferrer"
        >
          PayPal’s Seller Protection terms
        </a>
        .
      </small>
    </section>
  );
}
