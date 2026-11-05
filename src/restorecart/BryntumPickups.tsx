import { useMemo } from "react";
import { BryntumSchedulerPro } from "@bryntum/schedulerpro-react";
import "@bryntum/schedulerpro/schedulerpro.css";
import "@bryntum/schedulerpro/stockholm-light.css";
import "@bryntum/schedulerpro/fontawesome/css/fontawesome.css";
import "@bryntum/schedulerpro/fontawesome/css/solid.css";
export default function BryntumPickups({
  orders,
  onSelect,
  onPropose,
  proposals = [],
  onProposalSelect,
}: {
  orders: any[];
  onSelect?: (id: string) => void;
  onPropose?: (id: string, start: string, end: string) => void;
  proposals?: { orderId: string; start: string; end: string }[];
  onProposalSelect?: (id: string) => void;
}) {
  const key = JSON.stringify([
    orders.map((o) => [o.id, o.pickupWindow, o.fulfillment]),
    proposals,
  ]);
  const project = useMemo(
    () => ({
      resources: [{ id: "counter", name: "Pickup counter" }],
      events: [
        ...orders.map((o) => ({
          id: o.id,
          name: `Order ${o.id.slice(-8)} · ${o.fulfillment === "ready" ? "Ready" : o.fulfillment === "collected" ? "Collected" : "Preparing"}`,
          startDate: new Date(o.pickupWindow.start),
          endDate: new Date(o.pickupWindow.end),
          manuallyScheduled: true,
          draggable:
            !!onPropose &&
            !o.sample &&
            o.fulfillment !== "collected" &&
            o.refund?.state !== "checking",
          eventColor: o.fulfillment === "ready" ? "green" : "orange",
        })),
        ...proposals.map((p) => ({
          id: `proposal:${p.orderId}`,
          name: `Proposed · Order ${p.orderId.slice(-8)}`,
          startDate: new Date(p.start),
          endDate: new Date(p.end),
          manuallyScheduled: true,
          draggable: false,
          eventColor: "blue",
        })),
      ],
      assignments: [
        ...orders.map((o) => ({
          id: o.id,
          eventId: o.id,
          resourceId: "counter",
        })),
        ...proposals.map((p) => ({
          id: `proposal:${p.orderId}`,
          eventId: `proposal:${p.orderId}`,
          resourceId: "counter",
        })),
      ],
    }),
    [key],
  );
  const start =
      Math.min(
        ...orders.map((o) => Date.parse(o.pickupWindow.start)),
        ...proposals.map((p) => Date.parse(p.start)),
      ) - 1800000,
    end =
      Math.max(
        ...orders.map((o) => Date.parse(o.pickupWindow.end)),
        ...proposals.map((p) => Date.parse(p.end)),
      ) + 1800000;
  return (
    <div className="rc-pickup-timeline">
      <BryntumSchedulerPro
        key={key}
        project={project as any}
        startDate={new Date(start)}
        endDate={new Date(end)}
        height={300}
        viewPreset="hourAndDay"
        readOnly={!onPropose}
        onEventClick={({ eventRecord }: any) =>
          String(eventRecord.id).startsWith("proposal:")
            ? onProposalSelect?.(String(eventRecord.id).slice(9))
            : onSelect?.(String(eventRecord.id))
        }
        onBeforeEventDelete={() => false}
        onBeforeEventDrag={({ eventRecord }: any) =>
          eventRecord.draggable !== false
        }
        onBeforeEventDropFinalize={({ context }: any) => {
          context.async = true;
          // Keep the persisted position until the seller confirms and the server accepts it.
          const id = String(context.eventRecord.id),
            start = context.startDate,
            end = context.endDate;
          const valid = context.valid !== false;
          context.finalize(false);
          if (valid && start instanceof Date && end instanceof Date)
            onPropose?.(id, start.toISOString(), end.toISOString());
        }}
        eventEditFeature={false}
        taskEditFeature={false}
        eventMenuFeature={false}
        scheduleMenuFeature={false}
        onBeforeEventAdd={() => false}
        eventDragCreateFeature={false}
        eventResizeFeature={false}
        columns={[{ text: "Resource", field: "name", width: 160 }]}
      />
    </div>
  );
}
