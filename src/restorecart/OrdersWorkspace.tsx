import { lazy, Suspense, useState } from "react";
import { OperationsChat } from "./OperationsChat";
import { SampleOrderChat } from "./SampleOrderChat";
import { SidePanel } from "./SidePanel";
import { OrderProgress } from "./OrderProgress";
import { matchesOrderFilter, sampleOrders } from "./orderExamples";
import { orderProgress } from "./orderStatus";
import { OrderViewBoundary } from "./OrderViewBoundary";
const OrderTable = lazy(() => import("./OrderTable"));
const PickupSchedule = lazy(() => import("./PickupSchedule"));
const filters = [
  "All",
  "Payment checking",
  "To prepare",
  "Ready for pickup",
  "Collected",
  "Canceled / refunded",
];
export function OrdersWorkspace({
  shop,
  orders,
  api,
  run,
  busy,
  refresh,
  plan,
  onPlan,
  userId,
  renderOrder,
  initialFilter = "All",
}: any) {
  const [sample, setSample] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(initialFilter),
    [view, setView] = useState("Table"),
    [selected, setSelected] = useState(""),
    [assistant, setAssistant] = useState(false);
  const data = sample ? sampleOrders : orders;
  const visible = data.filter(
    (o: any) =>
      matchesOrderFilter(o, filter) &&
      `${o.id} ${o.snapshot?.lines?.map((l: any) => l.name).join(" ")} ${orderProgress(o).label}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const order = data.find((o: any) => o.id === selected);
  return (
    <section className="rc-panel rc-orders-workspace">
      <div className="rc-orders-heading">
        <h2 className="rc-sr">Orders</h2>
        <div className="rc-order-filters" aria-label="Order data">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              className={value === sample ? "active" : ""}
              aria-pressed={value === sample}
              onClick={() => {
                setSample(value);
                setSelected("");
                setAssistant(false);
                setFilter("All");
                setSearch("");
              }}
            >
              {value ? "Sample orders" : "Sandbox orders"}
            </button>
          ))}
        </div>
      </div>
      {sample && (
        <p className="rc-sample-notice">
          Sample data · Actions don’t affect payments or inventory.
        </p>
      )}
      <div className="rc-orders-toolbar">
        <input
          type="search"
          aria-label="Search orders"
          placeholder="Search orders or items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Order status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {filters.map((f) => (
            <option key={f} value={f}>
              {f} ({data.filter((o: any) => matchesOrderFilter(o, f)).length})
            </option>
          ))}
        </select>
        <select
          aria-label="Order view"
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          <option>Table</option>
          <option>Pickup schedule</option>
        </select>
        {sample ? (
          <button
            className="rc-button secondary"
            onClick={() => setAssistant(true)}
          >
            Assistant
          </button>
        ) : (
          <OperationsChat
            shopId={shop.id}
            orders={orders}
            api={api}
            onPlan={onPlan}
            onSaved={refresh}
            onOpenOrder={setSelected}
          />
        )}
        <button
          className="rc-link"
          disabled={!!busy}
          onClick={() => run("Refreshing orders", refresh)}
        >
          Refresh
        </button>
      </div>
      {!data.length ? (
        <div className="rc-orders-empty">
          <h3>No purchases yet</h3>
          <p>Completed checkouts will appear here.</p>
          {shop.published && (
            <a
              className="rc-button secondary"
              href={`/s/${shop.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Open storefront
            </a>
          )}
          <button className="rc-button" onClick={() => setSample(true)}>
            Try sample orders
          </button>
        </div>
      ) : !visible.length ? (
        <div className="rc-orders-empty">
          <h3>No matching orders</h3>
          <button
            className="rc-link"
            onClick={() => {
              setSearch("");
              setFilter("All");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <OrderViewBoundary
          onFallback={() => setView("Table")}
          key={`${view}:${sample}`}
        >
          <Suspense fallback={<p>Loading orders…</p>}>
            {view === "Table" ? (
              <>
                <div className="rc-desktop-orders">
                  <OrderTable
                    key={`${shop.id}:${sample}`}
                    storageKey={`${userId}:${shop.id}:${sample}:compact-v2`}
                    orders={visible}
                    onSelect={setSelected}
                    plan={sample ? null : plan}
                  />
                </div>
                <div className="rc-compact-mobile-orders">
                  {visible.map((o: any) => (
                    <button key={o.id} onClick={() => setSelected(o.id)}>
                      <strong>
                        {o.sample
                          ? o.id.replace("sample-order-", "Sample ")
                          : o.id.slice(-8)}
                      </strong>
                      <span>
                        {o.snapshot.lines
                          .map((l: any) => `${l.quantity} × ${l.name}`)
                          .join(", ")}
                      </span>
                      <span>
                        {orderProgress(o).label} · $
                        {(o.amount / 100).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <PickupSchedule
                orders={visible}
                shopId={shop.id}
                api={sample ? undefined : api}
                onSelect={setSelected}
                onSaved={refresh}
              />
            )}
          </Suspense>
        </OrderViewBoundary>
      )}
      <SidePanel
        open={!!order}
        onClose={() => setSelected("")}
        title="Order details"
      >
        {order &&
          (sample ? (
            <>
              <h3>Sample order</h3>
              <p>
                {order.snapshot.lines
                  .map((line: any) => `${line.quantity} × ${line.name}`)
                  .join(", ")}{" "}
                · ${(order.amount / 100).toFixed(2)}
              </p>
              <OrderProgress order={order} />
              <small>Sample only. No payment or inventory changes.</small>
            </>
          ) : (
            renderOrder(order)
          ))}
      </SidePanel>
      <SidePanel
        open={sample && assistant}
        onClose={() => setAssistant(false)}
        title="Assistant"
      >
        <SampleOrderChat />
      </SidePanel>
    </section>
  );
}
