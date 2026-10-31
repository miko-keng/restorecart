import { createIncident, incident, save, publish, type DB } from "./store";
import { assignOwner, BOOTSTRAP } from "./accounts";
import { addSample, deterministicCandidates, sourceList } from "./sources";

/** Prepare only the named demo draft; never reset a shop with sales or a publication. */
const preparing = new WeakMap<
  DB,
  Map<string, Promise<ReturnType<typeof createIncident>>>
>();
export async function prepareDemoShop(db: DB, owner: string, practice = false) {
  const taskKey = `${owner}:${practice ? "practice" : "demo"}`;
  let owners = preparing.get(db);
  if (!owners) {
    owners = new Map();
    preparing.set(db, owners);
  }
  const pending = owners.get(taskKey);
  if (pending) return pending;
  const task = prepareDemoShopOnce(db, owner, practice);
  owners.set(taskKey, task);
  try {
    return await task;
  } finally {
    owners.delete(taskKey);
  }
}
async function prepareDemoShopOnce(db: DB, owner: string, practice: boolean) {
  const name = practice
    ? "Sunday Studio Conflict Practice"
    : "Sunday Studio Demo";
  const found = db
    .prepare(
      "SELECT i.id FROM rc_incidents i JOIN rc_owners o ON o.id=i.id AND o.kind='incident' WHERE o.account_id=? AND json_extract(i.body,'$.name')=? ORDER BY i.rowid LIMIT 1",
    )
    .get(owner, name) as any;
  const shop = found ? incident(db, found.id) : createIncident(db, name);
  assignOwner(db, "incident", shop.id, owner);
  if (
    (shop as any).demoPrepared ||
    shop.published ||
    db.prepare("SELECT id FROM rc_orders WHERE incident=? LIMIT 1").get(shop.id)
  )
    return shop;
  if (!sourceList(db, shop.id).length) await addSample(db, shop.id);
  shop.products = deterministicCandidates(sourceList(db, shop.id));
  shop.pickup =
    "Collect at the Sunday Studio counter. Show your order receipt.";
  shop.originalUrl = "";
  shop.revision++;
  Object.assign(shop, { demoPrepared: true, conflictPractice: practice });
  save(db, shop);
  for (const [key, value] of Object.entries({
    [`contact:${shop.id}`]: {
      contact: "hello@sunday.example",
      hours: "Tuesday–Saturday, 10am–5pm",
      status:
        "Our main website is temporarily offline. Order here for studio pickup.",
    },
    [`counts:${shop.id}`]: {},
    [`photos:${shop.id}`]: {},
  }))
    db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
      key,
      JSON.stringify(value),
    );
  return shop;
}

/** Only bootstrap an empty configured workspace; never reset an existing seller shop. */
export async function prepareEmptyConfiguredWorkspace(db: DB) {
  const existing = db
    .prepare(
      "SELECT i.id FROM rc_incidents i LEFT JOIN rc_owners o ON o.id=i.id AND o.kind='incident' WHERE o.account_id=? OR o.id IS NULL LIMIT 1",
    )
    .get(BOOTSTRAP);
  if (!existing) await prepareDemoShop(db, BOOTSTRAP);
  await prepareSampleShop(db);
}

const sampleTasks = new WeakMap<DB, Promise<any>>();
/** Fixed sample identity prevents ordinary restarts from resetting stock or reopening a closed sample. */
export async function prepareSampleShop(db: DB) {
  const pending = sampleTasks.get(db);
  if (pending) return pending;
  const task = (async () => {
    const existing = db
      .prepare("SELECT id FROM rc_incidents WHERE slug='sunday-studio-sample'")
      .get() as any;
    if (existing) return incident(db, existing.id);
    const shop = createIncident(db, "Sunday Studio Sample Shop");
    assignOwner(db, "incident", shop.id, BOOTSTRAP);
    await addSample(db, shop.id);
    shop.slug = "sunday-studio-sample";
    shop.products = deterministicCandidates(sourceList(db, shop.id)).map(
      (p) => ({
        ...p,
        price: p.sku === "MUG-BLU" ? "20.00" : p.price,
        resolved: true,
        allocation: p.sku === "MUG-BLU" ? 8 : p.sku === "MUG-RED" ? 5 : 4,
        resolutionNote:
          "Preloaded sample price and stock; not a physical merchant count.",
      }),
    );
    shop.pickup =
      "Sample pickup counter — sandbox demonstration only. Show your receipt.";
    Object.assign(shop, { sampleShop: true });
    // createIncident initially wrote a random slug; update it deliberately before saving the fixed sample.
    db.prepare("UPDATE rc_incidents SET slug=? WHERE id=?").run(
      shop.slug,
      shop.id,
    );
    save(db, shop);
    const counts = Object.fromEntries(
      shop.products.map((p) => [
        p.sku,
        { quantity: p.allocation, allocation: p.allocation, at: Date.now() },
      ]),
    );
    const contact = {
      contact: "hello@sunday.example",
      hours: "Tuesday–Saturday, 10am–5pm",
      status:
        "Sample shop · Test purchases only · Demo data may reset after the service restarts.",
    };
    for (const [key, value] of Object.entries({
      [`counts:${shop.id}`]: counts,
      [`contact:${shop.id}`]: contact,
      [`public-contact:${shop.id}`]: contact,
    }))
      db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
        key,
        JSON.stringify(value),
      );
    return publish(db, shop.id, shop.revision);
  })();
  sampleTasks.set(db, task);
  try {
    return await task;
  } finally {
    sampleTasks.delete(db);
  }
}
