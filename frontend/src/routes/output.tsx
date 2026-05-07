import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronDown, Download, FileSpreadsheet, Loader2, Play } from "lucide-react";
import { OutputTable } from "@/components/app/OutputTable";
import { AIAssistantPanel } from "@/components/app/AIAssistantPanel";
import { useApp } from "@/context/AppContext";
import type { OutputRun } from "@/context/AppContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/output")({
  component: OutputPage,
  head: () => ({ meta: [{ title: "Output Viewer — McKesson Claims AI" }] }),
});

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

  if (runs.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <FileSpreadsheet className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="max-w-[260px] truncate">
          {selectedRun ? selectedRun.label : "Select output file…"}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
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
            <ul className="max-h-60 overflow-y-auto py-1">
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

function OutputPage() {
  const { outputRuns, selectedRun, setSelectedRunId, triggerOutputDownload, totalClaimsProcessed } = useApp();
  const hasRun = totalClaimsProcessed > 0;
  const [isLoadingRun, setIsLoadingRun] = useState(false);

  function handleSelectRun(id: string) {
    setIsLoadingRun(true);
    setSelectedRunId(id);
    setTimeout(() => setIsLoadingRun(false), 300);
  }

  function handleDownload() {
    if (!selectedRun?.downloadUrl) return;
    const link = document.createElement("a");
    link.href = selectedRun.downloadUrl;
    link.download = `OutputFile_Run${selectedRun.runNumber}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  if (!hasRun) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
          <FileSpreadsheet className="h-6 w-6 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">No output yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Run a validation to see output results here.
        </p>
        <Link
          to="/validate"
          className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Play className="h-4 w-4" />
          Go to Validation
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Output Viewer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a run, browse results, and query with AI Analyst.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RunSelector runs={outputRuns} selectedRun={selectedRun} onSelect={handleSelectRun} />
          {selectedRun?.downloadUrl && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/50"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              Download
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoadingRun ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Loading output file…</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <OutputTable
              rows={selectedRun?.outputRows}
              onDownload={handleDownload}
              hasDownload={!!selectedRun?.downloadUrl}
            />
          </div>
          <div className="xl:col-span-1">
            <div className="h-[600px]">
              <AIAssistantPanel
                outputRows={selectedRun?.outputRows}
                runLabel={selectedRun?.label}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
