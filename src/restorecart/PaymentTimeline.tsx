const labels: Record<string, string> = {
  checkout_created: "Checkout created — awaiting buyer",
  buyer_approved: "Buyer approval observed",
  capture_requested: "Capture requested",
  capture_verified: "Capture verified — amount and merchant checked",
  capture_pending: "Capture pending",
  capture_check_required: "Capture outcome uncertain — reconciliation required",
  payment_failed: "Payment failed or voided",
  refund_requested: "Refund requested or checked",
  refund_pending: "Refund not completed",
  refund_verified: "Refund verified",
  refund_failed: "Refund failed",
  payment_reversed: "Payment reversal verified",
  webhook_received: "Verified webhook received",
  webhook_processed: "Webhook processed",
  webhook_duplicate_ignored: "Duplicate webhook ignored",
  webhook_retry: "Webhook requires retry",
};
export function PaymentTimeline({ order: o }: { order: any }) {
  return (
    <details className="rc-notice rc-demo-panel">
      <summary>PayPal payment history</summary>
      <p>
        Times show when RestoreCart recorded each event. Requests and pending
        outcomes do not confirm a completed payment.
      </p>
      {o.paymentHistory?.length ? (
        <ol>
          {o.paymentHistory.map((event: any) => (
            <li key={event.id}>
              <b>{labels[event.kind] || event.kind}</b> ·{" "}
              <time dateTime={event.at}>
                {new Date(event.at).toLocaleString()}
              </time>
              <p>
                Evidence:{" "}
                {event.source === "api"
                  ? "PayPal API response / request"
                  : event.source === "webhook"
                    ? "Verified webhook processing"
                    : "Background reconciliation"}
                {event.reference ? ` · Reference: ${event.reference}` : ""}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          No timestamped payment events recorded. Older orders retain their
          current state below; missing history is not reconstructed.
        </p>
      )}
      <h4>Current recorded state</h4>
      <p>
        The current state below is separate from the event history. Missing
        evidence is shown as unconfirmed.
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
