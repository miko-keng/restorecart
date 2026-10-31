import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import { orderProgress } from "./orderStatus";
ModuleRegistry.registerModules([AllCommunityModule]);
export default function OrderTable({
  orders,
  onSelect,
}: {
  orders: any[];
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const columns = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Order",
        field: "id",
        minWidth: 160,
        valueFormatter: (p) =>
          p.data.sample
            ? `Sample ${String(p.value).split("-").pop()}`
            : String(p.value || "").slice(-8),
      },
      {
        headerName: "Items",
        colId: "items",
        minWidth: 220,
        valueGetter: (p) =>
          p.data.snapshot.lines
            .map((l: any) => `${l.quantity} × ${l.name}`)
            .join(", "),
      },
      {
        headerName: "Status",
        colId: "status",
        valueGetter: (p) => orderProgress(p.data).label,
        minWidth: 165,
      },
      {
        headerName: "Total USD",
        field: "amount",
        filter: "agNumberColumnFilter",
        valueFormatter: (p) => `$${(p.value / 100).toFixed(2)}`,
        minWidth: 125,
      },
      {
        headerName: "Refunded USD",
        field: "refunded",
        filter: "agNumberColumnFilter",
        valueFormatter: (p) => `$${(p.value / 100).toFixed(2)}`,
        minWidth: 140,
      },
      {
        headerName: "Pickup appointment",
        colId: "pickup",
        minWidth: 190,
        valueGetter: (p) =>
          p.data.pickupWindow
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
    [onSelect],
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
      <p>
        Sort a column or use its filter to find orders. Open an order for pickup
        and payment actions.
      </p>
      <div style={{ height: 390, width: "100%" }}>
        <AgGridReact
          theme={themeQuartz}
          rowData={orders}
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
