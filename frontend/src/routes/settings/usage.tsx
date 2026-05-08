import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Bot, Clock, FileSpreadsheet, MessageSquare, Zap } from "lucide-react";
import { StatCard } from "@/components/app/StatCard";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/settings/usage")({
  component: UsagePage,
  head: () => ({ meta: [{ title: "Usage & Tokens — McKesson Claims AI" }] }),
});

const MODEL_LABELS: Record<string, string> = {
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o mini",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function fmtCost(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.001) return `< $0.001`;
  return `$${n.toFixed(4)}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function UsagePage() {
  const { totalClaimsProcessed, processingTimeMs, selectedModel, sessionTokens } = useApp();

  const avgTimeDisplay = processingTimeMs
    ? processingTimeMs < 1000
      ? `${processingTimeMs}ms`
      : `${(processingTimeMs / 1000).toFixed(1)}s`
    : "—";

  const modelName = MODEL_LABELS[selectedModel] ?? selectedModel;
  const hasTokens = sessionTokens.totalTokens > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Usage &amp; Tokens</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Session-level usage statistics for validation runs and AI Analyst queries.
        </p>
      </div>

      {/* Validation stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Validation Runs"
          value={totalClaimsProcessed}
          subtext="this session"
          icon={<FileSpreadsheet className="h-4 w-4" />}
          tone={totalClaimsProcessed > 0 ? "success" : "default"}
        />
        <StatCard
          label="Avg Processing Time"
          value={avgTimeDisplay}
          subtext="per validation run"
          icon={<Clock className="h-4 w-4" />}
          tone="info"
        />
      </div>

      {/* AI token stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Tokens Used"
          value={hasTokens ? fmt(sessionTokens.totalTokens) : "—"}
          subtext={
            hasTokens
              ? `${fmt(sessionTokens.promptTokens)} in · ${fmt(sessionTokens.completionTokens)} out`
              : "No AI messages yet"
          }
          icon={<Zap className="h-4 w-4" />}
          tone={hasTokens ? "info" : "default"}
        />
        <StatCard
          label="Estimated Cost"
          value={hasTokens ? fmtCost(sessionTokens.estimatedCostUsd) : "—"}
          subtext={hasTokens ? `across ${sessionTokens.messageCount} AI messages` : "Based on token usage"}
          icon={<BarChart3 className="h-4 w-4" />}
          tone={hasTokens ? "success" : "default"}
        />
        <StatCard
          label="AI Messages Sent"
          value={hasTokens ? sessionTokens.messageCount : "—"}
          subtext="via AI Analyst this session"
          icon={<MessageSquare className="h-4 w-4" />}
          tone={hasTokens ? "info" : "default"}
        />
        <StatCard
          label="Avg Tokens / Message"
          value={
            hasTokens && sessionTokens.messageCount > 0
              ? fmt(Math.round(sessionTokens.totalTokens / sessionTokens.messageCount))
              : "—"
          }
          subtext="prompt + completion"
          icon={<Bot className="h-4 w-4" />}
          tone={hasTokens ? "info" : "default"}
        />
      </div>

      {/* Current config */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Current Configuration</h3>
        <div className="space-y-3">
          <InfoRow label="Selected Model" value={modelName} />
          <InfoRow
            label="OpenAI Key"
            value={(() => {
              try { return localStorage.getItem("openai_api_key") ? "Configured" : "Not set"; }
              catch { return "Not set"; }
            })()}
          />
          <InfoRow label="Backend Status" value="Online" />
          <InfoRow
            label="Token Tracking"
            value={hasTokens ? "Active — tracking live" : "Waiting for first AI message"}
          />
        </div>
      </div>

      {/* Pricing reference */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Model Pricing Reference</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-muted-foreground font-medium">Model</th>
                <th className="pb-2 text-right text-muted-foreground font-medium">Input (per 1M)</th>
                <th className="pb-2 text-right text-muted-foreground font-medium">Output (per 1M)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { name: "GPT-4o", input: "$2.50", output: "$10.00" },
                { name: "GPT-4o mini", input: "$0.15", output: "$0.60" },
              ].map((row) => (
                <tr key={row.name} className={row.name === modelName ? "font-semibold text-blue-700" : ""}>
                  <td className="py-2">
                    {row.name}
                    {row.name === modelName && (
                      <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">{row.input}</td>
                  <td className="py-2 text-right">{row.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Estimates are approximate. Actual billing appears on your OpenAI account dashboard.
        </p>
      </div>
    </div>
  );
}
