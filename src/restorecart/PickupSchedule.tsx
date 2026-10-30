import { lazy, Suspense } from "react";
const BryntumPickups = lazy(() => import("./BryntumPickups"));
export default function PickupSchedule({ orders }: { orders: any[] }) {
  const appointments = orders.filter(
    (o) => o.state === "paid" && !o.refunded && o.pickupWindow,
  );
  const enabled =
    import.meta.env.VITE_ENABLE_BRYNTUM === "true" ||
    (import.meta.env.DEV && import.meta.env.VITE_ENABLE_BRYNTUM !== "false");
  return (
    <section aria-label="Pickup appointments">
      <h3>Pickup counter schedule</h3>
      <p>
        Only seller-saved pickup appointments appear here. Use Cards → Schedule
        pickup time to book a paid order. Buyers see the saved time on their
        receipt.
      </p>
      {!appointments.length ? (
        <p>No pickup appointments saved yet.</p>
      ) : (
        <>
          {enabled && (
            <Suspense fallback={<p>Loading pickup timeline…</p>}>
              <BryntumPickups orders={appointments} />
            </Suspense>
          )}
          <ul>
            {appointments.map((o) => (
              <li key={o.id}>
                Order {o.id.slice(-8)} ·{" "}
                {new Date(o.pickupWindow.start).toLocaleString()} –{" "}
                {new Date(o.pickupWindow.end).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
