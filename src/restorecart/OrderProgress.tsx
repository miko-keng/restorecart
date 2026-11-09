import { orderProgress, orderSteps, type TrackableOrder } from "./orderStatus";
const pickupDate = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
export function pickupTimeLabel(window: { start: string; end: string }) {
  return pickupDate.formatRange(new Date(window.start), new Date(window.end));
}

export function OrderProgress({
  order,
  compact = false,
}: {
  compact?: boolean;
  order: TrackableOrder & {
    pickupWindow?: { start: string; end: string } | null;
  };
}) {
  const status = orderProgress(order);
  return (
    <section
      className="rc-order-progress"
      aria-label="Order tracking"
      aria-live="polite"
    >
      <h3>{status.label}</h3>
      {!compact && <p>{status.description}</p>}
      {order.pickupWindow && (
        <p>Pickup · {pickupTimeLabel(order.pickupWindow)}</p>
      )}
      {!compact && status.step >= 0 && (
        <ol>
          {orderSteps.map((s, i) => (
            <li
              key={s}
              aria-current={i === status.step ? "step" : undefined}
              className={i <= status.step ? "reached" : ""}
            >
              {s}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
