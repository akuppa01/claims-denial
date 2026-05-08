import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSpreadsheet, Play } from "lucide-react";
import { OutputTable } from "@/components/app/OutputTable";
import { AIAssistantPanel } from "@/components/app/AIAssistantPanel";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/output")({
  component: OutputPage,
  head: () => ({ meta: [{ title: "Output Viewer — McKesson Claims AI" }] }),
});

function OutputPage() {
  const { downloadUrl, outputRows, triggerOutputDownload, totalClaimsProcessed } = useApp();
  const hasRun = totalClaimsProcessed > 0;

  if (!hasRun && !downloadUrl) {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Output Viewer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse validation results with filters, or download the full Excel report.
          {!downloadUrl && " Preview data shown below is sample output."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <OutputTable
            rows={outputRows.length > 0 ? outputRows : undefined}
            onDownload={triggerOutputDownload}
            hasDownload={!!downloadUrl}
          />
        </div>
        <div className="xl:col-span-1">
          <AIAssistantPanel />
        </div>
      </div>
    </div>
  );
}
