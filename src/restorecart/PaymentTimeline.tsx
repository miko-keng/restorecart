export function PaymentTimeline({ order: o }: { order: any }) {
  return (
    <details className="rc-notice rc-demo-panel">
      <summary>PayPal payment timeline · recorded state</summary>
      <p>
        State summary, not a timestamped event log. Missing evidence is shown as
        unconfirmed.
      </p>
      <ol>
        <li>
          Approval:{" "}
          {o.capture
            ? "prerequisite to recorded capture"
            : o.state === "awaiting_buyer"
              ? "waiting for buyer"
              : "not separately confirmed"}
          .
        </li>
        <li>
          Capture: {o.capture ? `recorded (${o.capture})` : "not recorded"}.
        </li>
        <li>
          Verification:{" "}
          {o.state === "paid" && o.capture
            ? "server accepted capture after payment checks"
            : "no verified completed capture shown"}
          .
        </li>
        <li>
          Pending:{" "}
          {[
            "pending",
            "capture_requested",
            "needs_reconciliation",
            "creating",
          ].includes(o.state)
            ? "checking — do not hand over items"
            : "no pending capture state recorded"}
          .
        </li>
        <li>
          Refund:{" "}
          {o.refunded > 0
            ? `$${(o.refunded / 100).toFixed(2)} recorded`
            : o.refund?.state === "checking"
              ? "checking — wait for confirmation"
              : "none recorded"}
          .
        </li>
      </ol>
      <p>
        Duplicate protection: server uses stable capture/refund request
        identifiers and deduplicates webhook events. This describes the
        safeguard, not proof of a webhook delivery for this order.
      </p>
    </details>
  );
}
