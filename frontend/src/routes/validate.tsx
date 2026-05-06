import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowStep } from "@/components/app/WorkflowStep";
import { LogsPanel } from "@/components/app/LogsPanel";
import { useApp, FILE_SPECS } from "@/context/AppContext";

export const Route = createFileRoute("/validate")({
  component: ValidatePage,
  head: () => ({ meta: [{ title: "Validation Runs — McKesson Claims AI" }] }),
});

function ValidatePage() {
  const {
    files,
    stages,
    logs,
    isProcessing,
    downloadUrl,
    runError,
    runValidation,
    triggerOutputDownload,
    reset,
  } = useApp();
  const navigate = useNavigate();

  const allUploaded = FILE_SPECS.every((spec) => files[spec.key]);
  const success = !!downloadUrl && !runError;

  if (!allUploaded) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <FileSpreadsheet className="h-6 w-6 text-amber-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Files not uploaded yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload all 6 required files before running validation.
        </p>
        <Link
          to="/upload"
          className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Go to Upload
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Review &amp; Run Validation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review uploaded files and run the claims validation pipeline.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/upload" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Upload
          </Link>
        </Button>
      </div>

      {/* Uploaded files list */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Uploaded Documents</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {FILE_SPECS.map((spec) => {
            const file = files[spec.key];
            return (
              <div
                key={spec.key}
                className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{spec.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {file?.name ?? spec.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Run controls */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Run Pipeline</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Sends all 6 files to <code className="font-mono">/process-claims</code>
            </p>

            <div className="flex flex-wrap gap-2">
              <Button onClick={runValidation} disabled={isProcessing} className="gap-2">
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isProcessing ? "Processing…" : "Run Validation"}
              </Button>
              <Button
                variant="outline"
                onClick={reset}
                disabled={isProcessing}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>

            {runError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Validation failed</p>
                  <p className="mt-0.5 text-xs text-red-600">{runError}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <p className="text-xs font-medium text-green-700">Validation completed!</p>
                </div>
                <Button
                  onClick={triggerOutputDownload}
                  className="w-full gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Download className="h-4 w-4" />
                  Download OutputFile_Generated.xlsx
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => navigate({ to: "/output" })}
                >
                  View in Output Viewer
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Workflow + Logs */}
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Workflow Status</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {stages.map((stage, i) => (
                <WorkflowStep
                  key={stage.id}
                  label={stage.label}
                  status={stage.status}
                  index={i + 1}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-foreground">System Logs</h3>
            <LogsPanel logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
