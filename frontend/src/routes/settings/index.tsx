import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, CheckCircle2, Key, XCircle, Zap } from "lucide-react";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — McKesson Claims AI" }] }),
});

const MODEL_LABELS: Record<string, string> = {
  "gpt-4o": "GPT-4o (OpenAI)",
  "gpt-4o-mini": "GPT-4o mini (OpenAI)",
  "claude-sonnet": "Claude Sonnet (Anthropic)",
  "gemini-pro": "Gemini Pro (Google)",
};

function ApiKeyStatus({ storageKey, label }: { storageKey: string; label: string }) {
  let configured = false;
  try {
    configured = !!localStorage.getItem(storageKey);
  } catch {}

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {configured ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-700">Configured</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Not set</span>
          </>
        )}
      </span>
    </div>
  );
}

function SettingsPage() {
  const { selectedModel, totalClaimsProcessed, processingTimeMs, outputRuns } = useApp();

  const modelLabel = MODEL_LABELS[selectedModel] ?? selectedModel;
  const avgTimeDisplay = processingTimeMs
    ? processingTimeMs < 1000
      ? `${processingTimeMs}ms`
      : `${(processingTimeMs / 1000).toFixed(1)}s`
    : "—";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Configuration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Current system configuration and session overview.
        </p>
      </div>

      {/* AI config */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-foreground">AI Configuration</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <span className="text-sm text-muted-foreground">Selected Model</span>
            <span className="text-sm font-semibold text-foreground">{modelLabel}</span>
          </div>
          <ApiKeyStatus storageKey="openai_api_key" label="OpenAI API Key" />
          <ApiKeyStatus storageKey="anthropic_api_key" label="Anthropic API Key" />
        </div>
        <div className="flex gap-2 pt-1">
          <Link
            to="/settings/models"
            className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Change Model
          </Link>
          <Link
            to="/settings/api-keys"
            className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Manage API Keys
          </Link>
        </div>
      </div>

      {/* Session stats */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-foreground">Session Statistics</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <span className="text-sm text-muted-foreground">Validation Runs</span>
            <span className="text-sm font-semibold text-foreground">{totalClaimsProcessed}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <span className="text-sm text-muted-foreground">Output Files Available</span>
            <span className="text-sm font-semibold text-foreground">{outputRuns.length}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Last Processing Time</span>
            <span className="text-sm font-semibold text-foreground">{avgTimeDisplay}</span>
          </div>
        </div>
      </div>

      {/* API key strategy callout */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-foreground">API Key Approach</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          API keys are stored in your browser's{" "}
          <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">localStorage</code> and
          sent directly from your browser to OpenAI — they never touch the McKesson Claims AI backend.
          This is the recommended approach for demos: flexible, secure, and easy to rotate without
          redeployment. Simply paste a key in{" "}
          <Link to="/settings/api-keys" className="underline text-blue-600">API Keys</Link> before
          your demo session.
        </p>
      </div>
    </div>
  );
}
