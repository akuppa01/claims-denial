import { useState, useMemo, Fragment } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { OutputRow } from "@/context/AppContext";

type FilterStatus = "all" | "Valid" | "Invalid" | "Review";
type SortDir = "asc" | "desc" | null;
type SortKey = keyof OutputRow | null;

const MOCK_ROWS: OutputRow[] = [
  {
    claimId: "CLM-10042",
    customer: "Acme Health Systems",
    material: "MAT-2301",
    denialReason: "Pricing Mismatch",
    validationStatus: "Invalid",
    recommendation: "Verify contract pricing — billed amount exceeds contract rate",
    confidence: "High",
    notes: "Contract: $45.00 | Billed: $52.00",
  },
  {
    claimId: "CLM-10043",
    customer: "Midwest Medical Group",
    material: "MAT-4410",
    denialReason: "Contract Expired",
    validationStatus: "Invalid",
    recommendation: "Renew contract before resubmitting claim",
    confidence: "High",
    notes: "Contract expired 2024-03-31",
  },
  {
    claimId: "CLM-10044",
    customer: "Regional Care Partners",
    material: "MAT-0982",
    denialReason: "Eligibility Check",
    validationStatus: "Review",
    recommendation: "Manual review required — customer record incomplete",
    confidence: "Medium",
    notes: "Missing DEA number in customer master",
  },
  {
    claimId: "CLM-10045",
    customer: "National Pharmacy Chain",
    material: "MAT-1155",
    denialReason: "N/A",
    validationStatus: "Valid",
    recommendation: "Approve — all criteria met",
    confidence: "High",
    notes: "Fully validated",
  },
  {
    claimId: "CLM-10046",
    customer: "Summit Hospital Group",
    material: "MAT-3309",
    denialReason: "Tier Mismatch",
    validationStatus: "Review",
    recommendation: "Verify product tier assignment with contracts team",
    confidence: "Medium",
    notes: "Product tier 2 vs contract tier 3",
  },
  {
    claimId: "CLM-10047",
    customer: "Valley Health Network",
    material: "MAT-7701",
    denialReason: "N/A",
    validationStatus: "Valid",
    recommendation: "Approve — all criteria met",
    confidence: "High",
    notes: "Fully validated",
  },
];

const STATUS_BADGE: Record<OutputRow["validationStatus"], string> = {
  Valid: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  Invalid: "bg-red-100 text-red-700 ring-1 ring-red-200",
  Review: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  High: "text-emerald-600 font-semibold",
  Medium: "text-amber-600 font-semibold",
  Low: "text-red-600 font-semibold",
};

const CONFIDENCE_DOT: Record<string, string> = {
  High: "bg-emerald-500",
  Medium: "bg-amber-500",
  Low: "bg-red-500",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type ColumnDef = {
  key: keyof OutputRow;
  label: string;
  visible: boolean;
  sortable: boolean;
  minWidth: string;
};

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "claimId", label: "Claim ID", visible: true, sortable: true, minWidth: "100px" },
  { key: "customer", label: "Customer", visible: true, sortable: true, minWidth: "160px" },
  { key: "material", label: "Material", visible: true, sortable: true, minWidth: "100px" },
  { key: "denialReason", label: "Denial Reason", visible: true, sortable: true, minWidth: "140px" },
  { key: "validationStatus", label: "Status", visible: true, sortable: true, minWidth: "100px" },
  { key: "recommendation", label: "Recommendation", visible: true, sortable: false, minWidth: "220px" },
  { key: "confidence", label: "Confidence", visible: true, sortable: true, minWidth: "100px" },
  { key: "notes", label: "Notes", visible: false, sortable: false, minWidth: "180px" },
];

type Props = {
  rows?: OutputRow[];
  onDownload: () => void;
  hasDownload: boolean;
};

export function OutputTable({ rows, onDownload, hasDownload }: Props) {
  const displayRows = rows && rows.length > 0 ? rows : MOCK_ROWS;
  const isMock = !rows || rows.length === 0;

  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [globalSearch, setGlobalSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showColMenu, setShowColMenu] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const visibleColumns = columns.filter((c) => c.visible);

  function handleSort(key: keyof OutputRow) {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function toggleColumn(key: keyof OutputRow) {
    setColumns((cols) => cols.map((c) => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  const filtered = useMemo(() => {
    let result = displayRows;

    if (filterStatus !== "all") {
      result = result.filter((r) => r.validationStatus === filterStatus);
    }

    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      result = result.filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (sortKey && sortDir) {
      result = [...result].sort((a, b) => {
        const av = String(a[sortKey] ?? "").toLowerCase();
        const bv = String(b[sortKey] ?? "").toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [displayRows, filterStatus, globalSearch, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const counts = {
    all: displayRows.length,
    Valid: displayRows.filter((r) => r.validationStatus === "Valid").length,
    Invalid: displayRows.filter((r) => r.validationStatus === "Invalid").length,
    Review: displayRows.filter((r) => r.validationStatus === "Review").length,
  };

  function SortIcon({ colKey }: { colKey: keyof OutputRow }) {
    if (sortKey !== colKey) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30 inline" />;
    if (sortDir === "asc") return <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" />;
    return <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />;
  }

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Top toolbar */}
      <div className="border-b border-border bg-slate-50/60 px-4 py-3 space-y-3">
        {/* Row 1: status filter tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "Valid", "Invalid", "Review"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilterStatus(f); setPage(1); }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                filterStatus === f
                  ? f === "all"
                    ? "bg-blue-600 text-white shadow-sm"
                    : f === "Valid"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : f === "Invalid"
                    ? "bg-red-600 text-white shadow-sm"
                    : "bg-amber-500 text-white shadow-sm"
                  : "bg-white border border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              {f === "all" ? "All" : f}{" "}
              <span className="opacity-75">({counts[f]})</span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {/* Column visibility */}
            <div className="relative">
              <button
                onClick={() => setShowColMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-border bg-white shadow-lg p-2">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Toggle Columns
                  </p>
                  {columns.map((col) => (
                    <label
                      key={col.key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => toggleColumn(col.key)}
                        className="h-3 w-3 accent-blue-600"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {hasDownload && (
              <Button variant="outline" size="sm" onClick={onDownload} className="gap-1.5 h-7 text-xs">
                <Download className="h-3 w-3" />
                Export Excel
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: search */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-400 transition-all">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => { setGlobalSearch(e.target.value); setPage(1); }}
            placeholder="Search claims, customers, materials, reasons…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mock data notice */}
      {isMock && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2">
          <p className="text-xs text-amber-700">
            Showing sample preview data. Run a validation to see real results.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" onClick={() => setShowColMenu(false)}>
          <thead>
            <tr className="border-b border-border bg-slate-50">
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  style={{ minWidth: col.minWidth }}
                  className={cn(
                    "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none",
                    col.sortable && "cursor-pointer hover:text-foreground transition-colors",
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {col.sortable && <SortIcon colKey={col.key} />}
                </th>
              ))}
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="py-14 text-center text-sm text-muted-foreground"
                >
                  No rows match your search or filter.
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <Fragment key={row.claimId}>
                  <tr
                    className={cn(
                      "transition-colors hover:bg-blue-50/40 cursor-pointer",
                      expandedRow === row.claimId && "bg-blue-50/30",
                    )}
                    onClick={() => setExpandedRow(expandedRow === row.claimId ? null : row.claimId)}
                  >
                    {visibleColumns.map((col) => {
                      if (col.key === "validationStatus") {
                        return (
                          <td key={col.key} className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                                STATUS_BADGE[row.validationStatus],
                              )}
                            >
                              {row.validationStatus}
                            </span>
                          </td>
                        );
                      }
                      if (col.key === "confidence") {
                        return (
                          <td key={col.key} className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn("h-1.5 w-1.5 rounded-full shrink-0", CONFIDENCE_DOT[row.confidence] ?? "bg-slate-400")}
                              />
                              <span className={cn("text-xs", CONFIDENCE_COLORS[row.confidence] ?? "text-muted-foreground")}>
                                {row.confidence}
                              </span>
                            </div>
                          </td>
                        );
                      }
                      if (col.key === "claimId") {
                        return (
                          <td key={col.key} className="px-4 py-3 font-mono text-xs font-medium text-blue-700">
                            {row.claimId}
                          </td>
                        );
                      }
                      if (col.key === "recommendation") {
                        return (
                          <td key={col.key} className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                            <span className="line-clamp-2">{row.recommendation}</span>
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} className="px-4 py-3 text-xs text-foreground">
                          {String(row[col.key] ?? "")}
                        </td>
                      );
                    })}
                    <td className="px-2 py-3 text-muted-foreground text-xs text-center">
                      {expandedRow === row.claimId ? "▲" : "▼"}
                    </td>
                  </tr>

                  {expandedRow === row.claimId && (
                    <tr className="bg-slate-50/80 border-b border-border">
                      <td colSpan={visibleColumns.length + 1} className="px-6 py-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Claim ID</p>
                            <p className="font-mono text-blue-700 font-medium">{row.claimId}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Customer</p>
                            <p>{row.customer}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Material</p>
                            <p className="font-mono">{row.material}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Denial Reason</p>
                            <p>{row.denialReason}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recommendation</p>
                            <p className="text-muted-foreground">{row.recommendation}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                            <p className="text-muted-foreground">{row.notes}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-slate-50/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {filtered.length === 0
              ? "No results"
              : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length} rows`}
          </span>
          <span className="text-border">|</span>
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded border border-border bg-white px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-blue-300"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
