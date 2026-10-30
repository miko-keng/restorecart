import { useMemo } from "react";
import { BryntumSchedulerPro } from "@bryntum/schedulerpro-react";
import "@bryntum/schedulerpro/schedulerpro.css";
import "@bryntum/schedulerpro/stockholm-light.css";
import "@bryntum/schedulerpro/fontawesome/css/fontawesome.css";
import "@bryntum/schedulerpro/fontawesome/css/solid.css";
export default function BryntumPickups({ orders }: { orders: any[] }) {
  const key = JSON.stringify(
    orders.map((o) => [o.id, o.pickupWindow, o.fulfillment]),
  );
  const project = useMemo(
    () => ({
      resources: [{ id: "counter", name: "Pickup counter" }],
      events: orders.map((o) => ({
        id: o.id,
        name: `Order ${o.id.slice(-8)} · ${o.fulfillment === "ready" ? "Ready" : o.fulfillment === "collected" ? "Collected" : "Preparing"}`,
        startDate: new Date(o.pickupWindow.start),
        endDate: new Date(o.pickupWindow.end),
        manuallyScheduled: true,
        eventColor: o.fulfillment === "ready" ? "green" : "orange",
      })),
      assignments: orders.map((o) => ({
        id: o.id,
        eventId: o.id,
        resourceId: "counter",
      })),
    }),
    [key],
  );
  const start =
      Math.min(...orders.map((o) => Date.parse(o.pickupWindow.start))) -
      1800000,
    end =
      Math.max(...orders.map((o) => Date.parse(o.pickupWindow.end))) + 1800000;
  return (
    <div className="rc-pickup-timeline">
      <BryntumSchedulerPro
        key={key}
        project={project as any}
        startDate={new Date(start)}
        endDate={new Date(end)}
        height={300}
        viewPreset="hourAndDay"
        readOnly
        eventEditFeature={false}
        eventDragCreateFeature={false}
        eventResizeFeature={false}
        columns={[{ text: "Resource", field: "name", width: 160 }]}
      />
    </div>
  );
}
