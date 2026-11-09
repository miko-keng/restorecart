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
  openingWindows = [],
  height = 300,
}: {
  orders: any[];
  height?: number;
  onSelect?: (id: string) => void;
  onPropose?: (id: string, start: string, end: string) => void;
  proposals?: { orderId: string; start: string; end: string }[];
  openingWindows?: PickupRange[];
}) {
  const key = JSON.stringify([
    orders.map((o) => [
      o.id,
      o.pickupWindow,
      o.fulfillment,
      o.pickupNeedsReschedule,
    ]),
    proposals,
    !!onPropose,
  ]);
  const project = useMemo(
    () => ({
      resources: [{ id: "counter", name: "Pickup counter" }],
      events: [
        ...orders.map((o) => ({
          id: o.id,
          name: `Order ${o.id.slice(-8)} · ${o.pickupNeedsReschedule ? "Reschedule" : o.fulfillment === "ready" ? "Ready" : o.fulfillment === "collected" ? "Collected" : "Preparing"}`,
          startDate: new Date(o.pickupWindow.start),
          endDate: new Date(o.pickupWindow.end),
          manuallyScheduled: true,
          draggable:
            !!onPropose &&
            !o.sample &&
            o.fulfillment !== "collected" &&
            o.refund?.state !== "checking",
          eventColor: o.pickupNeedsReschedule
            ? "red"
            : o.fulfillment === "ready"
              ? "green"
              : "orange",
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
  const starts = orders.map((order) => Date.parse(order.pickupWindow.start));
  const ends = orders.map((order) => Date.parse(order.pickupWindow.end));
  const nearbyWindows = openingWindows.filter((window) =>
    starts.some(
      (start) =>
        start >= Date.parse(window.start) && start < Date.parse(window.end),
    ),
  );
  const padding = onPropose ? 2 * 60 * 60000 : 30 * 60000;
  const start = Math.min(
    ...starts.map((time) => time - padding),
    ...nearbyWindows.map((window) => Date.parse(window.start)),
    ...proposals.map((proposal) => Date.parse(proposal.start)),
  );
  const end = Math.max(
    ...ends.map((time) => time + padding),
    ...nearbyWindows.map((window) => Date.parse(window.end)),
    ...proposals.map((proposal) => Date.parse(proposal.end)),
  );
  return (
    <div className="rc-pickup-timeline">
      <BryntumSchedulerPro
        key={key}
        project={project as any}
        startDate={new Date(start)}
        endDate={new Date(end)}
        height={height}
        viewPreset={
          onPropose
            ? {
                base: "hourAndDay",
                timeResolution: { unit: "minute", increment: 5 },
              }
            : "hourAndDay"
        }
        readOnly={!onPropose}
        onEventClick={({ eventRecord }) => {
          const id = String(eventRecord.id);
          if (!id.startsWith("proposal:")) onSelect?.(id);
        }}
        onBeforeEventDelete={() => false}
        onBeforeEventDrag={({ eventRecord }) => eventRecord.draggable !== false}
        onBeforeEventDropFinalize={({ context }) => {
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
        columns={[{ text: "Counter", field: "name", width: 118 }]}
      />
    </div>
  );
}

type PickupRange = { start: string; end: string };
export function BuyerBlockTimeline({
  day,
  appointment,
  blocks,
  disabled,
  onDraft,
}: {
  day: string;
  appointment?: PickupRange | null;
  blocks: PickupRange[];
  disabled: boolean;
  onDraft: (range: PickupRange) => void;
}) {
  const startDate = new Date(`${day}T00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  const anchor = appointment
    ? new Date(appointment.start)
    : new Date(startDate);
  if (anchor < startDate || anchor >= endDate || !appointment) {
    anchor.setTime(+startDate);
    anchor.setHours(12);
  }
  const key = JSON.stringify([day, appointment, blocks]);
  const project = useMemo(() => {
    const events = [
      ...(appointment
        ? [
            {
              ...appointment,
              id: "pickup",
              resource: "pickup",
              name: "Your appointment",
              eventColor: "green",
            },
          ]
        : []),
      ...blocks.map((block, index) => ({
        ...block,
        id: `blocked:${index}`,
        resource: "blocked",
        name: "Unavailable",
        eventColor: "gray",
      })),
    ];
    return {
      resources: [
        { id: "pickup", name: "Pickup" },
        { id: "blocked", name: "Unavailable" },
      ],
      events: events.map(({ id, name, start, end, eventColor }) => ({
        id,
        name,
        startDate: new Date(start),
        endDate: new Date(end),
        eventColor,
        manuallyScheduled: true,
        draggable: false,
      })),
      assignments: events.map(({ id, resource }) => ({
        id,
        eventId: id,
        resourceId: resource,
      })),
    };
  }, [key]);
  return (
    <div className="rc-buyer-pickup-timeline">
      <BryntumSchedulerPro
        key={key}
        project={project as any}
        visibleDate={{ date: anchor, block: "center" }}
        startDate={startDate}
        endDate={endDate}
        height={190}
        rowHeight={48}
        viewPreset="hourAndDay"
        columns={[{ text: "Schedule", field: "name", width: 110 }]}
        eventEditFeature={false}
        taskEditFeature={false}
        eventMenuFeature={false}
        scheduleMenuFeature={false}
        eventDragFeature={false}
        eventResizeFeature={false}
        onBeforeEventDelete={() => false}
        onBeforeDragCreate={({ resourceRecord }) =>
          !disabled && resourceRecord.id === "blocked"
        }
        onBeforeDragCreateFinalize={({ context }) => {
          context.async = true;
          const { startDate, endDate } = context;
          context.finalize(false);
          if (!disabled && startDate < endDate)
            onDraft({
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            });
        }}
      />
    </div>
  );
}
