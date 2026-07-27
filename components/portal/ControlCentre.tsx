"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import CommandPalette from "./CommandPalette";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { ControlCentre as Payload, DirectoryRow } from "@/lib/portal-types";

/** Cohere palette — one ink series plus muted steps, never a rainbow. */
const SERIES = ["#17171c", "#003c33", "#75758a", "#c9c9d1"];

const KIND_ICON = { project: FolderKanban, person: UserRound, organisation: Building2 } as const;

function fmt(value: number, unit?: string | null): string {
  const n = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return `${n}${unit ?? ""}`;
}

/** Inline sparkline. Kept as raw SVG — a chart library per tile is overkill. */
function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const d = points.map((p, i) => `${i * step},${20 - (p / max) * 18}`).join(" ");
  return (
    <svg className="portal-cc-spark" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden>
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function ControlCentre() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [globalFilter, setGlobalFilter] = useState("");
  const [kind, setKind] = useState<"all" | DirectoryRow["kind"]>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/control/overview`, { headers: authHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Could not load the control centre.");
      }
      setData(await res.json());
      setError("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () => (data?.directory ?? []).filter((r) => kind === "all" || r.kind === kind),
    [data, kind],
  );

  const columns = useMemo<ColumnDef<DirectoryRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all rows"
            checked={table.getIsAllPageRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.name}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const Icon = KIND_ICON[row.original.kind];
          return (
            <div className="portal-cc-cell-name">
              <Icon size={14} aria-hidden />
              <div>
                <strong>{row.original.name}</strong>
                {row.original.subtitle && <small>{row.original.subtitle}</small>}
              </div>
            </div>
          );
        },
      },
      { accessorKey: "kind", header: "Type" },
      {
        id: "state",
        header: "State",
        accessorFn: (r) => r.status ?? r.role ?? (r.approved === false ? "Pending" : ""),
        cell: ({ row }) => {
          const r = row.original;
          if (r.kind === "person") {
            return (
              <>
                {r.role && <span className="portal-cc-chip">{r.role}</span>}
                {r.approved === false && <span className="portal-cc-chip tone-warn">Pending</span>}
              </>
            );
          }
          return r.status ? <span className="portal-cc-chip">{r.status}</span> : <span className="portal-cc-dim">—</span>;
        },
      },
      {
        accessorKey: "organization_name",
        header: "Organisation",
        cell: ({ getValue }) => (getValue() as string) || <span className="portal-cc-dim">—</span>,
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })
                   : <span className="portal-cc-dim">—</span>;
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getRowId: (r) => `${r.kind}:${r.id}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const selectedPending = selected.filter((r) => r.kind === "person" && r.approved === false);

  /** Bulk approve/reject. Sequential so a mid-way failure is reported honestly. */
  const decide = async (verb: "approve" | "reject") => {
    if (!selectedPending.length) return;
    setBusy(true);
    let done = 0;
    try {
      for (const person of selectedPending) {
        const res = await apiFetch(`${API_BASE_URL}/admin/${verb}/${person.id}`, {
          method: "POST",
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`Failed on ${person.name} after ${done} of ${selectedPending.length}.`);
        done += 1;
      }
      setNotice(`${done} ${done === 1 ? "person" : "people"} ${verb}d.`);
      setError("");
      setRowSelection({});
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <div>Loading control centre...</div>;

  const paletteActions = [
    { id: "refresh", label: "Refresh control centre", hint: "reload all panels", run: load },
    { id: "projects", label: "Go to Projects", run: () => router.push("/portal/admin") },
  ];

  return (
    <div className="portal-cc" style={{ display: "grid", gap: "24px" }}>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && !error && <div className="alert alert-success">{notice}</div>}

      <section className="table-card">
        <div className="portal-cc-head">
          <div>
            <span className="portal-cc-eyebrow">
              {data?.scope === "platform" ? "Platform-wide" : data?.organization_name}
            </span>
            <h4>Control centre</h4>
            <p>Everything under management in one view — activity, composition, and a directory you can act on.</p>
          </div>
          <div className="portal-cc-actions">
            {data && <CommandPalette directory={data.directory} actions={paletteActions} />}
            <button type="button" className="btn-secondary" onClick={load}>
              <RefreshCw size={14} aria-hidden className={loading ? "portal-pulse-spin" : undefined} /> Refresh
            </button>
          </div>
        </div>

        <div className="portal-cc-metrics">
          {data?.metrics.map((m) => (
            <div key={m.key} className="portal-cc-metric">
              <span>{m.label}</span>
              <strong>{fmt(m.value, m.unit)}</strong>
              <div className="portal-cc-metric-foot">
                {m.delta != null && (
                  <em className={m.delta >= 0 ? "is-up" : "is-down"}>
                    {m.delta >= 0 ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />}
                    {Math.abs(m.delta)}%
                  </em>
                )}
                {m.spark.length > 1 && <Spark points={m.spark} />}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="table-card">
        <div className="portal-cc-head">
          <div>
            <h4>Activity, last 12 weeks</h4>
            <p>Weekly updates, meetings and action items created. Flat lines mean the operating rhythm has stopped.</p>
          </div>
        </div>
        <div className="portal-cc-chart">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.series ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <defs>
                {["updates", "meetings", "actions"].map((k, i) => (
                  <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES[i]} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={SERIES[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#75758a" }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#75758a" }} width={38} />
              <Tooltip
                contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, boxShadow: "none" }}
                cursor={{ stroke: "#d9d9dd" }}
              />
              {["updates", "meetings", "actions"].map((k, i) => (
                <Area
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={SERIES[i]}
                  strokeWidth={1.6}
                  fill={`url(#g-${k})`}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="portal-cc-legend">
          {["updates", "meetings", "actions"].map((k, i) => (
            <span key={k}>
              <i style={{ background: SERIES[i] }} /> {k}
            </span>
          ))}
        </div>
      </section>

      <div className="portal-cc-split">
        <section className="table-card">
          <h5 className="portal-cc-subhead">Project status</h5>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie
                data={data?.project_status ?? []}
                dataKey="value"
                nameKey="name"
                innerRadius={46}
                outerRadius={72}
                paddingAngle={2}
                stroke="none"
              >
                {(data?.project_status ?? []).map((_, i) => (
                  <Cell key={i} fill={SERIES[i % SERIES.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="portal-cc-legend">
            {(data?.project_status ?? []).map((s, i) => (
              <span key={s.name}>
                <i style={{ background: SERIES[i % SERIES.length] }} /> {s.name} · {s.value}
              </span>
            ))}
          </div>
        </section>

        <section className="table-card">
          <h5 className="portal-cc-subhead">People by role</h5>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={data?.role_mix ?? []} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#75758a" }} />
              <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#212121" }} />
              <Tooltip contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "#f4f4f2" }} />
              <Bar dataKey="value" fill={SERIES[0]} radius={[0, 3, 3, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="table-card">
        <div className="portal-cc-head">
          <div>
            <h4>Directory</h4>
            <p>Every project, person and organisation in scope. Select rows to act on them in bulk.</p>
          </div>
          <div className="portal-cc-actions">
            <input
              className="portal-cc-input"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filter directory"
              aria-label="Filter directory"
            />
            <div className="portal-cc-tabs" role="group" aria-label="Filter by type">
              {(["all", "project", "person", "organisation"] as const).map((k) => (
                <button key={k} type="button" className={kind === k ? "is-active" : ""} onClick={() => setKind(k)}>
                  {k === "all" ? "All" : k}
                </button>
              ))}
            </div>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="portal-cc-bulk">
            <strong>{selected.length} selected</strong>
            {selectedPending.length > 0 ? (
              <>
                <span>{selectedPending.length} awaiting approval</span>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => decide("approve")}>
                  <Check size={14} aria-hidden /> Approve
                </button>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => decide("reject")}>
                  <X size={14} aria-hidden /> Reject
                </button>
              </>
            ) : (
              <span>No bulk action applies to this selection.</span>
            )}
            <button type="button" className="portal-cc-clear" onClick={() => setRowSelection({})}>
              Clear
            </button>
          </div>
        )}

        <table className="portal-cc-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id}>
                    {h.isPlaceholder ? null : h.column.getCanSort() ? (
                      <button type="button" onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" && <ArrowUp size={11} aria-hidden />}
                        {h.column.getIsSorted() === "desc" && <ArrowDown size={11} aria-hidden />}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="portal-cc-dim">
                  Nothing matches this view.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={row.getIsSelected() ? "is-selected" : ""}
                  onClick={() =>
                    row.original.kind === "project" && router.push(`/portal/projects/${row.original.id}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="portal-cc-pager">
          <span>
            {table.getFilteredRowModel().rows.length} rows · page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
          <div>
            <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft size={15} aria-hidden />
            </button>
            <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight size={15} aria-hidden />
            </button>
          </div>
        </div>
      </section>

      <section className="table-card">
        <div className="portal-cc-head">
          <div>
            <h4>Recent activity</h4>
            <p>The last things that happened, newest first.</p>
          </div>
        </div>
        {!data?.feed.length ? (
          <p className="portal-cc-dim">Nothing recorded recently.</p>
        ) : (
          <ol className="portal-cc-feed">
            {data.feed.map((f, i) => (
              <li key={i} onClick={() => f.project_id && router.push(`/portal/projects/${f.project_id}`)}>
                <span className={`portal-cc-chip kind-${f.kind}`}>{f.kind}</span>
                <div>
                  <strong>{f.title}</strong>
                  {f.detail && <small>{f.detail}</small>}
                </div>
                <time>
                  {f.at
                    ? new Date(f.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })
                    : ""}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
