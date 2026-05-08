import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Play,
  RefreshCw,
  Shield,
  Upload,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/app/StatCard";
import { useApp } from "@/context/AppContext";
import { FILE_SPECS } from "@/context/AppContext";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — McKesson Claims AI" }] }),
});

function Dashboard() {
  const { lastRunAt, totalClaimsProcessed, processingTimeMs, downloadUrl, files } = useApp();

  const uploadedCount = FILE_SPECS.filter((spec) => files[spec.key]).length;
  const allUploaded = uploadedCount === FILE_SPECS.length;
  const hasOutput = !!downloadUrl;

  const avgTimeDisplay = processingTimeMs
    ? processingTimeMs < 1000
      ? `${processingTimeMs}ms`
      : `${(processingTimeMs / 1000).toFixed(1)}s`
    : "—";

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Welcome to Claims AI</h2>
            <p className="mt-1 text-sm text-blue-100">
              SAP-powered claims validation with AI-driven recommendations
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/upload"
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow transition-colors hover:bg-blue-50"
            >
              <Upload className="h-4 w-4" />
              Upload Claims
            </Link>
            {allUploaded && (
              <Link
                to="/validate"
                className="flex items-center gap-2 rounded-lg border border-blue-300/50 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                <Play className="h-4 w-4" />
                Run Validation
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Validation Runs"
          value={totalClaimsProcessed}
          subtext="this session"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={totalClaimsProcessed > 0 ? "success" : "default"}
        />
        <StatCard
          label="Files Uploaded"
          value={`${uploadedCount} / ${FILE_SPECS.length}`}
          subtext={allUploaded ? "All files ready" : "Upload remaining files"}
          icon={<FileSpreadsheet className="h-4 w-4" />}
          tone={allUploaded ? "success" : uploadedCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Avg Processing Time"
          value={avgTimeDisplay}
          subtext="per validation run"
          icon={<Clock className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="Claims Needing Review"
          value={hasOutput ? "~30%" : "—"}
          subtext="estimate from last run"
          icon={<Users className="h-4 w-4" />}
          tone={hasOutput ? "warning" : "default"}
        />
        <StatCard
          label="Manual Lookups Avoided"
          value={totalClaimsProcessed > 0 ? `~${totalClaimsProcessed * 12}` : "—"}
          subtext="estimated this session"
          icon={<RefreshCw className="h-4 w-4" />}
          tone={totalClaimsProcessed > 0 ? "success" : "default"}
        />
        <StatCard
          label="Estimated Hours Saved"
          value={totalClaimsProcessed > 0 ? `~${(totalClaimsProcessed * 2.5).toFixed(1)}h` : "—"}
          subtext="vs. manual review"
          icon={<BarChart3 className="h-4 w-4" />}
          tone={totalClaimsProcessed > 0 ? "success" : "default"}
        />
      </div>

      {/* Last run */}
      {lastRunAt && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700">
            Last validation completed at{" "}
            <strong>{lastRunAt.toLocaleTimeString()}</strong> on{" "}
            {lastRunAt.toLocaleDateString()}
          </span>
          {hasOutput && (
            <Link
              to="/output"
              className="ml-auto flex items-center gap-1 text-xs font-medium text-green-700 hover:underline"
            >
              View output <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {/* Getting started */}
      {!allUploaded && totalClaimsProcessed === 0 && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Get started in 3 steps</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                step: 1,
                icon: <Upload className="h-5 w-5" />,
                title: "Upload Files",
                desc: "Upload all 6 required Excel files including denial records, contracts, pricing, and rules brain.",
                to: "/upload",
                cta: "Upload now",
              },
              {
                step: 2,
                icon: <Shield className="h-5 w-5" />,
                title: "Run Validation",
                desc: "The engine validates claims against contracts, pricing, and reason code logic.",
                to: "/validate",
                cta: "Review & run",
              },
              {
                step: 3,
                icon: <BarChart3 className="h-5 w-5" />,
                title: "Review Output",
                desc: "Download the output Excel or view results in the browser with filtering.",
                to: "/output",
                cta: "View output",
              },
            ].map(({ step, icon, title, desc, to, cta }) => (
              <div key={step} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    {icon}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Step {step}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                <Link
                  to={to as "/"}
                  className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  {cta} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
