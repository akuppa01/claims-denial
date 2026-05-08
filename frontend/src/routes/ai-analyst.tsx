import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, ChevronDown, FileText, Key, Loader2, TrendingDown } from "lucide-react";
import { AIAssistantPanel } from "@/components/app/AIAssistantPanel";
import { useApp } from "@/context/AppContext";
import type { OutputRun, OutputRow } from "@/context/AppContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-analyst")({
  component: AIAnalystPage,
  head: () => ({ meta: [{ title: "AI Analyst — ASVA Group Claims AI" }] }),
});

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function RunSelector({
  runs,
  selectedRun,
  onSelect,
}: {
  runs: OutputRun[];
  selectedRun: OutputRun | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (runs.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <ChevronDown className="h-4 w-4" />
        No runs yet — run a validation first
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span className="max-w-[300px] truncate">
          {selectedRun ? selectedRun.label : "Select output file…"}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-border bg-white shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-slate-50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Session Runs ({runs.length})
              </p>
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {[...runs].reverse().map((run) => (
                <li key={run.id}>
                  <button
                    onClick={() => { onSelect(run.id); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-blue-50",
                      selectedRun?.id === run.id && "bg-blue-50",
                    )}
                  >
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                      selectedRun?.id === run.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500",
                    )}>
                      {run.runNumber}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{run.label}</p>
                      <p className="text-[10px] text-muted-foreground">{run.outputRows.length} claims</p>
                    </div>
                    {selectedRun?.id === run.id && (
                      <span className="ml-auto text-[10px] font-medium text-blue-600 shrink-0">Active</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function StatsPanel({ outputRows }: { outputRows: OutputRow[] }) {
  const total = outputRows.length;
  const valid = outputRows.filter((r) => r.validationStatus === "Valid").length;
  const invalid = outputRows.filter((r) => r.validationStatus === "Invalid").length;
  const review = outputRows.filter((r) => r.validationStatus === "Review").length;
  const hasData = total > 0;

  const topDenials = outputRows
    .filter((r) => r.denialReason && r.denialReason !== "N/A")
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.denialReason] = (acc[r.denialReason] || 0) + 1;
      return acc;
    }, {});
  const sortedDenials = Object.entries(topDenials)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatChip label="Total Claims" value={hasData ? total : "—"} color="border-border bg-white" />
        <StatChip label="Valid" value={hasData ? valid : "—"} color="border-emerald-200 bg-emerald-50" />
        <StatChip label="Invalid" value={hasData ? invalid : "—"} color="border-red-200 bg-red-50" />
        <StatChip label="Review" value={hasData ? review : "—"} color="border-amber-200 bg-amber-50" />
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-foreground">Top Denial Reasons</h3>
        </div>
        {!hasData ? (
          <p className="text-xs text-muted-foreground">Select a run to see denial patterns.</p>
        ) : sortedDenials.length === 0 ? (
          <p className="text-xs text-muted-foreground">No denial reasons found.</p>
        ) : (
          <div className="space-y-2">
            {sortedDenials.map(([reason, count]) => (
              <div key={reason} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground">{reason}</span>
                  <span className="text-muted-foreground font-medium">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-400"
                    style={{ width: `${invalid > 0 ? (count / invalid) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasData && (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">Confidence Distribution</h3>
          </div>
          {(["High", "Medium", "Low"] as const).map((c) => {
            const n = outputRows.filter((r) => r.confidence === c).length;
            const pct = total ? (n / total) * 100 : 0;
            const color = c === "High" ? "bg-emerald-400" : c === "Medium" ? "bg-amber-400" : "bg-red-400";
            return (
              <div key={c} className="space-y-1 mb-2">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground">{c}</span>
                  <span className="text-muted-foreground">{n} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasData && (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">What can I ask?</h3>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>• "Summarize this validation run"</li>
            <li>• "Which claims need human review?"</li>
            <li>• "What are the top denial reasons?"</li>
            <li>• "Draft an email summary for my manager"</li>
            <li>• "How many invalid claims are high confidence?"</li>
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            Run a validation first to get insights specific to your data.{" "}
            <Link to="/validate" className="underline">Go to validation →</Link>
          </p>
        </div>
      )}
    </div>
  );
}

function AIAnalystPage() {
  const { outputRuns, selectedRun, setSelectedRunId } = useApp();
  const [isLoadingRun, setIsLoadingRun] = useState(false);
  const [localRunId, setLocalRunId] = useState<string | null>(null);

  // Local selection independent of global (so Output Viewer and AI Analyst can differ)
  const activeRun = localRunId
    ? outputRuns.find((r) => r.id === localRunId) ?? selectedRun
    : selectedRun;

  function handleSelectRun(id: string) {
    setIsLoadingRun(true);
    setLocalRunId(id);
    setSelectedRunId(id);
    setTimeout(() => setIsLoadingRun(false), 300);
  }

  const activeRows = activeRun?.outputRows ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">AI Analyst</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a run, review stats, and chat with your claims data.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RunSelector runs={outputRuns} selectedRun={activeRun} onSelect={handleSelectRun} />
          <Link
            to="/settings/api-keys"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-muted/50"
          >
            <Key className="h-3.5 w-3.5" />
            API Keys
          </Link>
        </div>
      </div>

      {isLoadingRun ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Loading run data…</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            <StatsPanel outputRows={activeRows} />
          </div>
          <div className="lg:col-span-3">
            <div className="h-[640px]">
              <AIAssistantPanel
                outputRows={activeRows}
                runLabel={activeRun?.label}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
