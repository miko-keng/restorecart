export type OrderAction =
  "check_payment" | "prepare" | "schedule_pickup" | "notify_pickup" | "none";
export function allowedOrderActions(o: any): OrderAction[] {
  if (o.refund?.state === "checking") return ["check_payment"];
  if (
    o.refunded ||
    ["canceled", "failed"].includes(o.state) ||
    o.fulfillment === "collected"
  )
    return ["none"];
  // Samples are labelled illustrative only; genuine orders require a recorded capture.
  if (o.state !== "paid" || (!o.capture && !o.sample)) return ["check_payment"];
  const result: OrderAction[] = [];
  if (o.fulfillment !== "ready") result.push("prepare");
  if (!o.pickupWindow) result.push("schedule_pickup");
  if (o.fulfillment === "ready") result.push("notify_pickup");
  return result.length ? result : ["none"];
}
export const actionLabel: Record<OrderAction, string> = {
  check_payment: "Check payment status",
  prepare: "Prepare order",
  schedule_pickup: "Schedule pickup",
  notify_pickup: "Review pickup instructions",
  none: "No action needed",
};
export function nextOrderAction(o: any) {
  return actionLabel[allowedOrderActions(o)[0]];
}
