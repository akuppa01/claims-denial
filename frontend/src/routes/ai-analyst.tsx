import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, FileText, Key, TrendingDown } from "lucide-react";
import { AIAssistantPanel } from "@/components/app/AIAssistantPanel";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/ai-analyst")({
  component: AIAnalystPage,
  head: () => ({ meta: [{ title: "AI Analyst — McKesson Claims AI" }] }),
});

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function AIAnalystPage() {
  const { outputRows, totalClaimsProcessed } = useApp();

  const total = outputRows.length;
  const valid = outputRows.filter((r) => r.validationStatus === "Valid").length;
  const invalid = outputRows.filter((r) => r.validationStatus === "Invalid").length;
  const review = outputRows.filter((r) => r.validationStatus === "Review").length;

  const topDenials = outputRows
    .filter((r) => r.denialReason && r.denialReason !== "N/A")
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.denialReason] = (acc[r.denialReason] || 0) + 1;
      return acc;
    }, {});
  const sortedDenials = Object.entries(topDenials)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hasData = total > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">AI Analyst</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Chat with your claims data, get summaries, and investigate exceptions.
          </p>
        </div>
        <Link
          to="/settings/api-keys"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-muted/50"
        >
          <Key className="h-3.5 w-3.5" />
          Configure API Key
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: context + stats */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatChip label="Total Claims" value={hasData ? total : "—"} color="border-border bg-white" />
            <StatChip label="Valid" value={hasData ? valid : "—"} color="border-emerald-200 bg-emerald-50" />
            <StatChip label="Invalid" value={hasData ? invalid : "—"} color="border-red-200 bg-red-50" />
            <StatChip label="Review" value={hasData ? review : "—"} color="border-amber-200 bg-amber-50" />
          </div>

          {/* Top denial reasons */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-foreground">Top Denial Reasons</h3>
            </div>
            {!hasData ? (
              <p className="text-xs text-muted-foreground">Run a validation to see denial patterns.</p>
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
                        style={{ width: `${(count / invalid) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confidence breakdown */}
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

          {/* Prompt guide */}
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

        {/* Right: chat panel */}
        <div className="lg:col-span-3">
          <div className="h-[640px]">
            <AIAssistantPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
