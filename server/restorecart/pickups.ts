import { z } from "zod";
import { fail } from "./domain";
import { order, tx, type DB } from "./store";
export function pickupWindow(
  db: DB,
  id: string,
): { start: string; end: string } | null {
  const row = db
    .prepare("SELECT value FROM rc_meta WHERE key=?")
    .get(`pickup:${id}`) as any;
  return row ? JSON.parse(row.value) : null;
}
const windowSchema = z
  .object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
  })
  .strict();
export function buyerPickupBlocks(
  db: DB,
  id: string,
): z.infer<typeof windowSchema>[] {
  const row = db
    .prepare("SELECT value FROM rc_meta WHERE key=?")
    .get(`pickup-blocks:${id}`) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : [];
}
function overlaps(
  start: number,
  end: number,
  window: z.infer<typeof windowSchema>,
) {
  return Date.parse(window.start) < end && Date.parse(window.end) > start;
}
export function pickupNeedsReschedule(db: DB, id: string) {
  const appointment = pickupWindow(db, id);
  return (
    !!appointment &&
    buyerPickupBlocks(db, id).some((window) =>
      overlaps(
        Date.parse(appointment.start),
        Date.parse(appointment.end),
        window,
      ),
    )
  );
}
export function changeBuyerPickupBlock(
  db: DB,
  id: string,
  buyerId: string,
  input: unknown,
) {
  const change = z
    .object({ operation: z.enum(["add", "remove"]), window: windowSchema })
    .strict()
    .parse(input);
  const start = Date.parse(change.window.start),
    end = Date.parse(change.window.end);
  if (start >= end) fail("Choose an end time after the start.");
  const window = {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
  return tx(db, () => {
    if (order(db, id).buyer !== buyerId)
      fail("Only the buyer who placed this order can edit these times.", 403);
    eligible(db, id);
    let blocks = buyerPickupBlocks(db, id).filter(
      (block) => block.start !== window.start || block.end !== window.end,
    );
    if (change.operation === "add") {
      if (end <= Date.now()) fail("Choose a time that has not already ended.");
      blocks = blocks.filter((block) => Date.parse(block.end) > Date.now());
      if (blocks.length >= 20)
        fail("Remove a blocked time before adding another.");
      blocks.push(window);
    }
    blocks.sort((a, b) => a.start.localeCompare(b.start));
    db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
      `pickup-blocks:${id}`,
      JSON.stringify(blocks),
    );
    return blocks;
  });
}
function localDay(iso: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const val = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${val("year")}-${val("month")}-${val("day")}`;
  } catch {
    fail("Choose a valid time zone.");
  }
}
export function pickupAvailability(
  db: DB,
  id: string,
): { timezone: string; days: { day: string; start: string; end: string }[] } {
  const row = db
    .prepare("SELECT value FROM rc_meta WHERE key=?")
    .get(`pickup-hours:${id}`) as any;
  return row ? JSON.parse(row.value) : { timezone: "", days: [] };
}
function activeAppointments(db: DB, incident: string, except = "") {
  return (
    db
      .prepare(
        "SELECT id FROM rc_orders WHERE incident=? AND id!=? AND state='paid' AND refunded=0 AND fulfillment!='collected'",
      )
      .all(incident, except) as any[]
  ).flatMap((o) => {
    const w = pickupWindow(db, o.id);
    return w ? [{ ...w, id: o.id }] : [];
  });
}
export function savePickupAvailability(db: DB, id: string, input: unknown) {
  const b = z
    .object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      timezone: z.string().min(1).max(100),
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
    })
    .strict()
    .parse(input);
  const start = Date.parse(b.start),
    end = Date.parse(b.end);
  if (
    end <= start ||
    end - start > 86400000 ||
    localDay(b.start, b.timezone) !== b.day ||
    localDay(b.end, b.timezone) !== b.day
  )
    fail("Choose opening and closing times on the same local date.");
  return tx(db, () => {
    const old = pickupAvailability(db, id);
    if (old.timezone && old.timezone !== b.timezone)
      fail("Use the schedule's existing time zone.", 409);
    for (const w of activeAppointments(db, id))
      if (
        localDay(w.start, b.timezone) === b.day &&
        (Date.parse(w.start) < start || Date.parse(w.end) > end)
      )
        fail(
          "This opening window would exclude an existing appointment. Reschedule that order first.",
          409,
        );
    const days = old.days.filter(
      (d) => d.day !== b.day && Date.parse(d.end) >= Date.now(),
    );
    if (days.length >= 31) fail("Up to 31 future opening dates are supported.");
    days.push({
      day: b.day,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });
    days.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const result = { timezone: b.timezone, days };
    db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
      `pickup-hours:${id}`,
      JSON.stringify(result),
    );
    return result;
  });
}
function eligible(db: DB, id: string) {
  const o = order(db, id);
  if (
    o.state !== "paid" ||
    o.refunded ||
    o.fulfillment === "collected" ||
    db
      .prepare(
        "SELECT order_id FROM rc_refunds WHERE order_id=? AND state='checking'",
      )
      .get(id)
  )
    fail("Schedule only paid, unrefunded orders awaiting collection.", 409);
  return o;
}
export function suggestPickupWindow(db: DB, id: string, input: unknown) {
  const b = z
    .object({
      from: z.string().datetime({ offset: true }),
      minutes: z.number().int().min(1).max(240),
    })
    .strict()
    .parse(input);
  const o = eligible(db, id),
    availability = pickupAvailability(db, o.incident),
    busy = [
      ...activeAppointments(db, o.incident, id),
      ...buyerPickupBlocks(db, id),
    ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const earliest = Math.max(Date.parse(b.from), Date.now()),
    duration = b.minutes * 60000;
  for (const day of availability.days) {
    let start =
      Math.ceil(Math.max(earliest, Date.parse(day.start)) / 60000) * 60000;
    for (const w of busy)
      if (Date.parse(w.start) < start + duration && Date.parse(w.end) > start)
        start = Date.parse(w.end);
    if (start + duration <= Date.parse(day.end))
      return {
        start: new Date(start).toISOString(),
        end: new Date(start + duration).toISOString(),
        expected: pickupWindow(db, id),
      };
  }
  fail(
    "No available slot fits. Add an opening date or choose a shorter pickup duration.",
    409,
  );
}
export function savePickupWindow(
  db: DB,
  id: string,
  input: unknown,
  onSaved?: () => void,
) {
  const b = z
    .object({
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
      expected: windowSchema.nullable().optional(),
    })
    .strict()
    .parse(input);
  const start = Date.parse(b.start),
    end = Date.parse(b.end);
  if (end <= start || end - start > 240 * 60000)
    fail("Choose a pickup window between 1 and 240 minutes.");
  if (end - start < 60000) fail("Choose at least one minute for pickup.");
  return tx(db, () => {
    const o = eligible(db, id);
    const old = pickupWindow(db, id);
    if (
      b.expected !== undefined &&
      !(b.expected === null && old === null) &&
      !(
        b.expected &&
        old &&
        Date.parse(b.expected.start) === Date.parse(old.start) &&
        Date.parse(b.expected.end) === Date.parse(old.end)
      )
    )
      fail("This appointment changed. Refresh before rescheduling.", 409);
    const availability = pickupAvailability(db, o.incident);
    if (
      availability.days.length &&
      !availability.days.some(
        (d) => Date.parse(d.start) <= start && Date.parse(d.end) >= end,
      )
    )
      fail("Choose a time inside a saved pickup opening window.", 409);
    if (
      o.state !== "paid" ||
      o.refunded ||
      o.fulfillment === "collected" ||
      db
        .prepare(
          "SELECT order_id FROM rc_refunds WHERE order_id=? AND state='checking'",
        )
        .get(id)
    )
      fail("Schedule only paid, unrefunded orders awaiting collection.", 409);
    if (
      buyerPickupBlocks(db, id).some((window) => overlaps(start, end, window))
    )
      fail(
        "The buyer marked this time unavailable. Choose another pickup window.",
        409,
      );
    const other = db
      .prepare(
        "SELECT id FROM rc_orders WHERE incident=? AND id!=? AND state='paid' AND refunded=0 AND fulfillment!='collected'",
      )
      .all(o.incident, id) as any[];
    if (
      other.some((v) => {
        const w = pickupWindow(db, v.id);
        return w && Date.parse(w.start) < end && Date.parse(w.end) > start;
      })
    )
      fail(
        "The pickup counter already has an order in that window. Choose another time.",
        409,
      );
    db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
      `pickup:${id}`,
      JSON.stringify({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      }),
    );
    onSaved?.();
    return {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    };
  });
}
