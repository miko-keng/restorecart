import type { TrackableOrder } from "./orderStatus";
type AttentionOrder = TrackableOrder & {
  refund?: { state?: string };
  pickupNeedsReschedule?: boolean;
};
export function pickupConflict(o: AttentionOrder) {
  return (
    !!o.pickupNeedsReschedule &&
    o.state === "paid" &&
    !o.refunded &&
    o.refund?.state !== "checking" &&
    o.fulfillment !== "collected"
  );
}
export function matchesOrderFilter(o: AttentionOrder, filter: string): boolean {
  if (filter === "All") return true;
  if (filter === "Needs attention")
    return pickupConflict(o) || matchesOrderFilter(o, "Payment checking");
  if (filter === "Payment checking")
    return (
      !["paid", "failed", "canceled"].includes(o.state) ||
      o.refund?.state === "checking"
    );
  if (filter === "Canceled / refunded")
    return ["canceled", "failed"].includes(o.state) || o.refunded > 0;
  if (o.state !== "paid" || o.refunded || o.refund?.state === "checking")
    return false;
  if (filter === "Ready for pickup") return o.fulfillment === "ready";
  if (filter === "Collected") return o.fulfillment === "collected";
  return (
    filter === "To prepare" && !["ready", "collected"].includes(o.fulfillment)
  );
}
const statuses = [
  {
    state: "pending",
    fulfillment: "not_ready",
    refunded: 0,
    name: "Payment checking",
  },
  { state: "paid", fulfillment: "not_ready", refunded: 0, name: "To prepare" },
  {
    state: "paid",
    fulfillment: "ready",
    refunded: 0,
    name: "Ready for pickup",
  },
  { state: "paid", fulfillment: "collected", refunded: 0, name: "Collected" },
  {
    state: "canceled",
    fulfillment: "not_ready",
    refunded: 0,
    name: "Canceled",
  },
  { state: "paid", fulfillment: "canceled", refunded: 2000, name: "Refunded" },
];

// UI-only examples: never inserted into order/payment storage.
export function createSampleOrders(day = new Date()) {
  const start = new Date(day);
  start.setHours(14, 0, 0, 0);
  return statuses.map((status, i) => ({
    ...status,
    sample: true,
    id: `sample-order-${i + 1}`,
    amount: 2000,
    currency: "USD",
    snapshot: {
      lines: [
        { sku: "MUG-BLU", name: "Blue mug", quantity: 1, unitPrice: 2000 },
      ],
    },
    pickupWindow: [1, 2, 3].includes(i)
      ? {
          start: new Date(+start + (i - 1) * 1800000).toISOString(),
          end: new Date(+start + (i - 1) * 1800000 + 1800000).toISOString(),
        }
      : null,
  }));
}
export const sampleOrders = createSampleOrders();
