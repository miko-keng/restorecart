import { Badge, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { PaymentsUi } from "./PaymentsUi";
const labels: Record<string, string> = {
  checkout_created: "Checkout created",
  buyer_approved: "Buyer approved",
  capture_requested: "Capture requested",
  capture_verified: "Capture verified",
  capture_pending: "Capture pending",
  capture_check_required: "Capture needs checking",
  payment_failed: "Payment failed or voided",
  refund_requested: "Refund requested",
  refund_pending: "Refund not completed",
  refund_verified: "Refund verified",
  refund_failed: "Refund failed",
  payment_reversed: "Payment reversal verified",
  webhook_received: "Webhook received",
  webhook_processed: "Webhook processed",
  webhook_duplicate_ignored: "Duplicate webhook ignored",
  webhook_retry: "Webhook requires retry",
};
export function PaymentTimeline({ order: o }: { order: any }) {
  return (
    <PaymentsUi>
      <Card
        size="3"
        className="rc-payment-card"
        aria-label="PayPal payment history"
      >
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Heading as="h3" size="4">
            PayPal payment history
          </Heading>
          <Badge color={o.state === "paid" && o.capture ? "teal" : "amber"}>
            {o.refunded > 0
              ? "Refund recorded"
              : o.refund?.state === "checking"
                ? "Refund checking"
                : o.state === "paid" && o.capture
                  ? "Paid · verified"
                  : "Payment unconfirmed"}
          </Badge>
        </Flex>
        <Text as="p" size="1" color="gray" mt="2" mb="4">
          Recorded observations · sandbox
        </Text>
        {o.paymentHistory?.length ? (
          <ol className="rc-payment-events">
            {o.paymentHistory.map((event: any) => (
              <li
                key={event.id}
                data-tone={
                  /failed|reversed/.test(event.kind)
                    ? "danger"
                    : /pending|check_required|retry/.test(event.kind)
                      ? "warning"
                      : "success"
                }
              >
                <b>{labels[event.kind] || event.kind}</b>{" "}
                <Badge color="gray" size="1">
                  {event.source === "api"
                    ? "API"
                    : event.source === "webhook"
                      ? "Webhook"
                      : "Recheck"}
                </Badge>{" "}
                ·{" "}
                <time dateTime={event.at}>
                  {new Date(event.at).toLocaleString()}
                </time>
                <details>
                  <summary>Evidence</summary>
                  <p>
                    {" "}
                    {event.source === "api"
                      ? "PayPal API response / request"
                      : event.source === "webhook"
                        ? "Verified webhook processing"
                        : "Background reconciliation"}
                    {event.reference ? ` · Reference: ${event.reference}` : ""}
                  </p>
                </details>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            No timestamped payment events recorded. Older orders retain their
            current state below; missing history is not reconstructed.
          </p>
        )}
        <details className="rc-payment-details">
          <summary>Verification details</summary>
          <p>
            Times show when RestoreCart recorded events. Requests and pending
            states are not completed payments.
          </p>
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
      </Card>
    </PaymentsUi>
  );
}
