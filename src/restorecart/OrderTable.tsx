import { nextOrderAction, allowedOrderActions } from "./orderAdvice";
import { useMemo, useState, useRef, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import {
  matchesOrderView,
  orderTotals,
  safeCsvCell,
  type OrderView,
} from "./orderOperations";
import { orderProgress } from "./orderStatus";
ModuleRegistry.registerModules([AllCommunityModule]);
export default function OrderTable({
  orders,
  onSelect,
  storageKey,
  plan,
}: {
  orders: any[];
  onSelect: (id: string) => void;
  storageKey?: string;
  plan?: any;
}) {
  const [search, setSearch] = useState(""),
    [view, setView] = useState<OrderView>("all"),
    [totals, setTotals] = useState(orderTotals(orders));
  const grid = useRef<any>(null),
    restoring = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const storage = storageKey ? `rc-order-table-v1:${storageKey}` : "";
  const summarize = (api: any) => {
    const rows: any[] = [];
    api.forEachNodeAfterFilterAndSort((n: any) => {
      if (n.data) rows.push(n.data);
    });
    setTotals(orderTotals(rows));
  };
  const persist = (api: any) => {
    if (!storage || restoring.current) return;
    try {
      sessionStorage.setItem(
        storage,
        JSON.stringify({
          columns: api.getColumnState(),
          filters: api.getFilterModel(),
          search,
          view,
        }),
      );
    } catch {}
  };
  useEffect(() => {
    if (grid.current) {
      grid.current.onFilterChanged();
      persist(grid.current);
    }
  }, [view, search]);
  const columns = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Order",
        field: "id",
        minWidth: 160,
        valueFormatter: (p) =>
          p.data?.sample
            ? `Sample ${String(p.value).split("-").pop()}`
            : String(p.value || "").slice(-8),
      },
      {
        headerName: "Items",
        colId: "items",
        minWidth: 220,
        valueGetter: (p) =>
          (p.data?.snapshot?.lines || [])
            .map((l: any) => `${l.quantity} × ${l.name}`)
            .join(", "),
      },
      {
        headerName: "Status",
        colId: "status",
        valueGetter: (p) => (p.data ? orderProgress(p.data).label : ""),
        minWidth: 165,
      },
      {
        headerName: "Next action",
        colId: "nextAction",
        minWidth: 210,
        valueGetter: (p) => {
          if (!p.data) return "";
          const recommended = plan?.actions?.find(
            (a: any) =>
              a.orderId === p.data.id &&
              allowedOrderActions(p.data).includes(a.action),
          );
          return recommended?.label || nextOrderAction(p.data);
        },
      },
      {
        headerName: "Total USD",
        colId: "amount",
        valueGetter: (p) => (p.data?.amount || 0) / 100,
        filter: "agNumberColumnFilter",
        valueFormatter: (p) => `$${Number(p.value).toFixed(2)}`,
        minWidth: 125,
      },
      {
        headerName: "Refunded USD",
        colId: "refunded",
        valueGetter: (p) => (p.data?.refunded || 0) / 100,
        filter: "agNumberColumnFilter",
        valueFormatter: (p) => `$${Number(p.value).toFixed(2)}`,
        minWidth: 140,
      },
      {
        headerName: "Net USD",
        colId: "net",
        valueGetter: (p) =>
          (p.data?.state === "paid" && p.data.capture
            ? p.data.amount - p.data.refunded
            : 0) / 100,
        filter: "agNumberColumnFilter",
        valueFormatter: (p) => `$${Number(p.value).toFixed(2)}`,
        minWidth: 120,
      },
      {
        headerName: "Pickup appointment",
        colId: "pickup",
        minWidth: 190,
        valueGetter: (p) =>
          p.data?.pickupWindow
            ? new Date(p.data.pickupWindow.start).toLocaleString()
            : "Not scheduled",
      },
      {
        headerName: "Actions",
        colId: "actions",
        sortable: false,
        filter: false,
        minWidth: 130,
        cellRenderer: (p: any) => (
          <button
            type="button"
            className="rc-link"
            onClick={() => onSelect(p.data.id)}
          >
            Open order
          </button>
        ),
      },
    ],
    [onSelect, plan],
  );
  return (
    <div>
      <label>
        Search orders
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Order, item or status"
        />
      </label>
      <div className="rc-buttonrow">
        <label>
          Order workspace
          <select
            aria-label="Order workspace"
            value={view}
            onChange={(e) => setView(e.target.value as OrderView)}
          >
            <option value="all">All orders</option>
            <option value="attention">Needs attention</option>
            <option value="prepare">To prepare</option>
            <option value="unscheduled">Unscheduled pickups</option>
          </select>
        </label>
        <button
          type="button"
          className="rc-button secondary"
          onClick={() =>
            grid.current?.exportDataAsCsv({
              fileName: orders.some((o) => o.sample)
                ? "sample-orders.csv"
                : "restorecart-orders.csv",
              columnKeys: [
                "id",
                "items",
                "status",
                "amount",
                "refunded",
                "net",
                "pickup",
                "nextAction",
              ],
              exportedRows: "filteredAndSorted",
              processCellCallback: (p: any) => safeCsvCell(p.value),
            })
          }
        >
          Export filtered CSV
        </button>
        <button
          type="button"
          className="rc-link"
          onClick={() => {
            setSearch("");
            setView("all");
            grid.current?.setFilterModel(null);
            grid.current?.resetColumnState();
            if (storage) sessionStorage.removeItem(storage);
          }}
        >
          Reset table view
        </button>
      </div>
      <p role="status">
        {orders.some((o) => o.sample)
          ? "Sample preview — illustrative totals"
          : "Actual orders — verified capture totals"}
        : {totals.count} shown · Captured ${(totals.captured / 100).toFixed(2)}{" "}
        · Refunded ${(totals.refunded / 100).toFixed(2)} · Net $
        {(totals.net / 100).toFixed(2)}
      </p>
      <p>
        Sort a column or use its filter to find orders. Open an order for pickup
        and payment actions.
      </p>
      <div style={{ height: 390, width: "100%" }}>
        <AgGridReact
          theme={themeQuartz}
          rowData={orders}
          onGridReady={({ api }) => {
            grid.current = api;
            restoring.current = true;
            if (storage)
              try {
                const saved = JSON.parse(
                  sessionStorage.getItem(storage) || "null",
                );
                if (saved) {
                  if (Array.isArray(saved.columns))
                    api.applyColumnState({
                      state: saved.columns,
                      applyOrder: true,
                    });
                  if (saved.filters) api.setFilterModel(saved.filters);
                  if (typeof saved.search === "string")
                    setSearch(saved.search.slice(0, 200));
                  if (
                    ["all", "attention", "prepare", "unscheduled"].includes(
                      saved.view,
                    )
                  )
                    setView(saved.view);
                }
              } catch {}
            restoring.current = false;
            summarize(api);
          }}
          isExternalFilterPresent={() => viewRef.current !== "all"}
          doesExternalFilterPass={(node) =>
            matchesOrderView(node.data, viewRef.current)
          }
          onFilterChanged={({ api }) => {
            summarize(api);
            persist(api);
          }}
          onSortChanged={({ api }) => {
            summarize(api);
            persist(api);
          }}
          onColumnMoved={({ api }) => persist(api)}
          onColumnResized={(e) => {
            if (e.finished) persist(e.api);
          }}
          onRowDataUpdated={({ api }) => summarize(api)}
          onRowClicked={(event) => event.data && onSelect(event.data.id)}
          columnDefs={columns}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            flex: 1,
          }}
          quickFilterText={search}
          pagination
          paginationPageSize={20}
          paginationPageSizeSelector={[10, 20, 50]}
          getRowId={(p) => p.data.id}
        />
      </div>
    </div>
  );
}
