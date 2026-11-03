export type OrderView = "all" | "attention" | "prepare" | "unscheduled";
export function matchesOrderView(o: any, view: OrderView) {
  const eligible =
    o.state === "paid" &&
    !o.refunded &&
    o.fulfillment !== "collected" &&
    o.refund?.state !== "checking";
  if (view === "attention")
    return (
      ["capture_requested", "pending", "needs_reconciliation"].includes(
        o.state,
      ) || o.refund?.state === "checking"
    );
  if (view === "prepare") return eligible && o.fulfillment !== "ready";
  if (view === "unscheduled") return eligible && !o.pickupWindow;
  return true;
}
export function orderTotals(rows: any[]) {
  const paid = rows.filter((o) => o.state === "paid" && !!o.capture);
  const captured = paid.reduce((n, o) => n + o.amount, 0),
    refunded = paid.reduce((n, o) => n + o.refunded, 0);
  return { count: rows.length, captured, refunded, net: captured - refunded };
}
export function safeCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\t\r\n]|^\s*[=+\-@]/.test(text)) text = "'" + text;
  return text;
}
