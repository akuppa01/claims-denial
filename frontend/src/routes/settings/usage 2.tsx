import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Clock, FileSpreadsheet, Zap } from "lucide-react";
import { StatCard } from "@/components/app/StatCard";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/settings/usage")({
  component: UsagePage,
  head: () => ({ meta: [{ title: "Usage & Tokens — McKesson Claims AI" }] }),
});

function UsagePage() {
  const { totalClaimsProcessed, processingTimeMs, selectedModel } = useApp();

  const avgTimeDisplay = processingTimeMs
    ? processingTimeMs < 1000
      ? `${processingTimeMs}ms`
      : `${(processingTimeMs / 1000).toFixed(1)}s`
    : "—";

  const modelName =
    selectedModel === "gpt-4o" ? "GPT-4o" : selectedModel === "gpt-4o-mini" ? "GPT-4o mini" : selectedModel;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Usage &amp; Tokens</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Session-level usage statistics. Token tracking requires AI Analyst to be enabled.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Tokens Used (Session)"
          value="—"
          subtext="AI Analyst not yet enabled"
          icon={<Zap className="h-4 w-4" />}
          tone="default"
        />
        <StatCard
          label="Estimated Cost"
          value="—"
          subtext="Based on token usage"
          icon={<BarChart3 className="h-4 w-4" />}
          tone="default"
        />
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

      {/* Model info */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Current Configuration</h3>
        <div className="space-y-3">
          <InfoRow label="Selected Model" value={modelName} />
          <InfoRow label="Backend Status" value="Online (no AI features)" />
          <InfoRow label="Token Tracking" value="Pending AI Analyst setup" />
          <InfoRow label="Billing" value="Usage billed through your provider account" />
        </div>
      </div>

      <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
        <p className="text-xs font-medium text-amber-800">Token tracking coming soon</p>
        <p className="mt-1 text-xs text-amber-700">
          Once AI Analyst is enabled, token consumption and cost estimates will be tracked per
          session and shown here in real-time.
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
