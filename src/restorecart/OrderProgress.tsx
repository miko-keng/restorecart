import { orderProgress, orderSteps, type TrackableOrder } from "./orderStatus";
export function OrderProgress({
  order,
}: {
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
      <p>{status.description}</p>
      {order.pickupWindow && (
        <p>
          Pickup appointment:{" "}
          {new Date(order.pickupWindow.start).toLocaleString()} –{" "}
          {new Date(order.pickupWindow.end).toLocaleTimeString()}
        </p>
      )}
      {status.step >= 0 && (
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
