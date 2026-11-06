import { nextOrderAction, allowedOrderActions } from "./orderAdvice";
import { useMemo, useState, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import { safeCsvCell } from "./orderOperations";
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
  const [extraColumns, setExtraColumns] = useState(false);
  const grid = useRef<any>(null),
    restoring = useRef(false);
  const storage = storageKey ? `rc-order-table-v1:${storageKey}` : "";
  const persist = (api: any) => {
    if (!storage || restoring.current) return;
    try {
      sessionStorage.setItem(
        storage,
        JSON.stringify({
          columns: api.getColumnState(),
          filters: api.getFilterModel(),
        }),
      );
    } catch {}
  };
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
        hide: true,
        valueGetter: (p) => (p.data?.refunded || 0) / 100,
        filter: "agNumberColumnFilter",
        valueFormatter: (p) => `$${Number(p.value).toFixed(2)}`,
        minWidth: 140,
      },
      {
        headerName: "Net USD",
        colId: "net",
        hide: true,
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
        hide: true,
        minWidth: 190,
        valueGetter: (p) =>
          p.data?.pickupWindow
            ? new Date(p.data.pickupWindow.start).toLocaleString()
            : "Not scheduled",
      },
      {
        headerName: "Actions",
        colId: "actions",
        hide: true,
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
      <details className="rc-table-options">
        <summary>Table options</summary>
        <div className="rc-buttonrow">
          <button
            className="rc-link"
            onClick={() =>
              grid.current?.exportDataAsCsv({
                fileName: orders.some((o) => o.sample)
                  ? "sample-orders.csv"
                  : "restorecart-orders.csv",
                processCellCallback: (p: any) => safeCsvCell(p.value),
              })
            }
          >
            Export CSV
          </button>
          <button
            className="rc-link"
            onClick={() => {
              grid.current?.setFilterModel(null);
              grid.current?.resetColumnState();
              setExtraColumns(false);
              if (storage) sessionStorage.removeItem(storage);
            }}
          >
            Reset table
          </button>
          <label>
            <input
              type="checkbox"
              checked={extraColumns}
              onChange={(e) => {
                setExtraColumns(e.target.checked);
                grid.current?.setColumnsVisible(
                  ["refunded", "net", "pickup"],
                  e.target.checked,
                );
              }}
            />{" "}
            Financial and pickup columns
          </label>
        </div>
      </details>
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
                  setExtraColumns(
                    api
                      .getColumnState()
                      .some(
                        (c: any) =>
                          ["refunded", "net", "pickup"].includes(c.colId) &&
                          !c.hide,
                      ),
                  );
                }
              } catch {}
            restoring.current = false;
          }}
          onFilterChanged={({ api }) => {
            persist(api);
          }}
          onSortChanged={({ api }) => {
            persist(api);
          }}
          onColumnMoved={({ api }) => persist(api)}
          onColumnResized={(e) => {
            if (e.finished) persist(e.api);
          }}
          onRowClicked={(event) => event.data && onSelect(event.data.id)}
          onCellKeyDown={(event) => {
            if ((event.event as KeyboardEvent)?.key === "Enter" && event.data)
              onSelect(event.data.id);
          }}
          columnDefs={columns}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            flex: 1,
          }}
          pagination
          paginationPageSize={20}
          paginationPageSizeSelector={[10, 20, 50]}
          getRowId={(p) => p.data.id}
        />
      </div>
    </div>
  );
}
