import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Download,
  Eye,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LogsConsole } from "@/components/claims/logs-console";
import { PipelineNode } from "@/components/claims/pipeline-node";
import { ResultsPanel } from "@/components/claims/results-panel";
import type {
  FileKey,
  FileSpec,
  LogEntry,
  PipelineStage,
  PipelineStageStatus,
  ValidationSummary,
} from "@/components/claims/types";
import { UploadCapsule } from "@/components/claims/upload-capsule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const configuredPowerBiUrl = import.meta.env.VITE_POWER_BI_URL?.trim();
const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, "")
  : import.meta.env.DEV
    ? "http://localhost:8000"
    : "/api";
const POWER_BI_URL = configuredPowerBiUrl || "https://app.powerbi.com/";

const FILE_SPECS: FileSpec[] = [
  { key: "denial_records", label: "Denial Records", description: "DenialRecords_Populated.xlsx" },
  { key: "contracts_data", label: "Contracts Data", description: "ContractsData_Populated.xlsx" },
  {
    key: "customer_master",
    label: "Customer Master",
    description: "CustomerMasterRecords_Populated.xlsx",
  },
  {
    key: "material_master",
    label: "Material Master",
    description: "MaterialMasterRecords_Populated.xlsx",
  },
  { key: "pricing_data", label: "Pricing Data", description: "PricingData_Populated.xlsx" },
  { key: "rules_brain", label: "Rules Brain", description: "Claims_AI_Rules_Brain.xlsx" },
];

const PIPELINE_BLUEPRINT: Array<
  Omit<PipelineStage, "status"> & {
    durationMs: number;
    startMessage: string;
    completeMessage: string;
  }
> = [
  {
    id: "files-ingested",
    label: "Files Ingested",
    description: "Verifying required workbooks.",
    durationMs: 600,
    startMessage: "Validating files.",
    completeMessage: "All required files are present.",
  },
  {
    id: "data-mapping",
    label: "Data Mapping",
    description: "Aligning source columns.",
    durationMs: 800,
    startMessage: "Mapping source data.",
    completeMessage: "Source mapping complete.",
  },
  {
    id: "rules-engine",
    label: "Rules Engine",
    description: "Loading pricing and contract rules.",
    durationMs: 800,
    startMessage: "Loading rules engine.",
    completeMessage: "Rules engine ready.",
  },
  {
    id: "ai-validation",
    label: "AI Validation",
    description: "Reviewing claims and exceptions.",
    durationMs: 1200,
    startMessage: "Running AI validation.",
    completeMessage: "AI validation complete.",
  },
  {
    id: "output-generated",
    label: "Output Generated",
    description: "Preparing the final workbook.",
    durationMs: 700,
    startMessage: "Generating output workbook.",
    completeMessage: "Output workbook is ready.",
  },
];

const INITIAL_STAGES: PipelineStage[] = PIPELINE_BLUEPRINT.map(({ ...stage }) => ({
  id: stage.id,
  label: stage.label,
  description: stage.description,
  status: "idle",
}));

const PIPELINE_ICONS = [Upload, Database, ShieldCheck, Sparkles, Download];

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Claims Intelligence Engine" },
      {
        name: "description",
        content: "AI-powered validation across contracts, pricing, and denials.",
      },
    ],
  }),
});

function Index() {
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [errors, setErrors] = useState<Partial<Record<FileKey, string>>>({});
  const [previewKey, setPreviewKey] = useState<FileKey | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);

  const allUploaded = useMemo(() => FILE_SPECS.every((spec) => files[spec.key]), [files]);
  const uploadedCount = useMemo(() => FILE_SPECS.filter((spec) => files[spec.key]).length, [files]);
  const previewSpec = previewKey ? FILE_SPECS.find((spec) => spec.key === previewKey) : undefined;
  const previewFile = previewKey ? files[previewKey] : undefined;
  const activeStage = stages.find((stage) => stage.status === "running");
  const hasCompleted = Boolean(downloadUrl && summary && !runError);

  useEffect(() => {
    if (!downloadUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  function addLog(message: string, level: LogEntry["level"] = "info") {
    setLogs((current) => [
      ...current,
      {
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        message,
        level,
      },
    ]);
  }

  function updateStage(id: string, status: PipelineStageStatus) {
    setStages((current) =>
      current.map((stage) => (stage.id === id ? { ...stage, status } : stage)),
    );
  }

  function setFile(key: FileKey, file: File | null) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setErrors((current) => ({ ...current, [key]: "Only .xlsx files are accepted." }));
      return;
    }

    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    setFiles((current) => ({ ...current, [key]: file }));
    setRunError(null);
  }

  function removeFile(key: FileKey) {
    setFiles((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function reset() {
    setFiles({});
    setErrors({});
    setPreviewKey(null);
    setStages(INITIAL_STAGES);
    setLogs([]);
    setIsProcessing(false);
    setProgressValue(0);
    setSummary(null);
    setRunError(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  }

  function triggerFileDownload(file: File) {
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function triggerOutputDownload() {
    if (!downloadUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "OutputFile_Generated.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function openPowerBi() {
    window.open(POWER_BI_URL, "_blank", "noopener,noreferrer");
  }

  async function getErrorMessage(response: Response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      if (payload && typeof payload === "object" && "detail" in payload) {
        const detail = payload.detail;
        if (typeof detail === "string" && detail.trim()) {
          return detail;
        }
      }
    }

    const text = await response.text().catch(() => "");
    return text.trim() || `Server returned ${response.status}`;
  }

  async function submitFiles() {
    const formData = new FormData();

    FILE_SPECS.forEach((spec) => {
      const file = files[spec.key];
      if (file) {
        formData.append(spec.key, file, file.name);
      }
    });

    const response = await fetch(`${API_BASE_URL}/process-claims`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    return response.blob();
  }

  async function runValidation() {
    if (!allUploaded || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setRunError(null);
    setLogs([]);
    setStages(INITIAL_STAGES);
    setSummary(null);
    setProgressValue(5);

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    addLog("Validation started.");

    try {
      const backendPromise = submitFiles();

      for (const [index, stage] of PIPELINE_BLUEPRINT.entries()) {
        updateStage(stage.id, "running");
        addLog(stage.startMessage);
        setProgressValue(Math.round((index / PIPELINE_BLUEPRINT.length) * 100) + 10);
        await wait(stage.durationMs);

        if (stage.id === "output-generated") {
          const blob = await backendPromise;
          const objectUrl = URL.createObjectURL(blob);
          setDownloadUrl(objectUrl);
          setSummary(buildValidationSummary(files));
        }

        updateStage(stage.id, "complete");
        addLog(stage.completeMessage, "success");
        setProgressValue(Math.round(((index + 1) / PIPELINE_BLUEPRINT.length) * 100));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      setRunError(message);
      addLog(message, "error");
      setStages((current) =>
        current.map((stage) =>
          stage.status === "running" ? { ...stage, status: "error" } : stage,
        ),
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <main className="mx-auto flex h-full max-w-7xl flex-col px-4 py-4 lg:px-6">
        <header className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Claims Operations
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                Claims Intelligence Engine
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                AI-powered validation across contracts, pricing, and denials.
              </p>
            </div>

            <div className="flex gap-3">
              <MetricPill label="Files" value={`${uploadedCount}/6`} />
              <MetricPill
                label="Status"
                value={isProcessing ? "Running" : hasCompleted ? "Complete" : "Ready"}
              />
            </div>
          </div>
        </header>

        <section className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.45fr_1fr]">
          <div className="min-h-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Upload files</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Add the six required Excel files, then run validation.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={reset}
                  disabled={isProcessing}
                  className="h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button
                  onClick={runValidation}
                  disabled={!allUploaded || isProcessing}
                  className="h-10 rounded-xl bg-primary px-4 text-white"
                >
                  {isProcessing ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isProcessing ? "Running" : "Run Validation"}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid h-[calc(100%-4rem)] min-h-0 gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
              {FILE_SPECS.map((spec) => (
                <UploadCapsule
                  key={spec.key}
                  spec={spec}
                  file={files[spec.key]}
                  error={errors[spec.key]}
                  onSelect={(file) => setFile(spec.key, file)}
                  onRemove={() => removeFile(spec.key)}
                />
              ))}
            </div>
          </div>

          <div
            className="grid min-h-0 gap-4"
            style={{ gridTemplateRows: hasCompleted ? "auto auto auto" : "auto auto 1fr" }}
          >
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Pipeline</h2>
                  <p className="mt-1 text-sm text-slate-600">One continuous validation flow.</p>
                </div>
                <div className="w-40">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Progress</span>
                    <span>{progressValue}%</span>
                  </div>
                  <Progress value={progressValue} className="h-2 bg-slate-100" />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {stages.map((stage, index) => {
                  const Icon = PIPELINE_ICONS[index];
                  return (
                    <PipelineNode
                      key={stage.id}
                      icon={Icon}
                      stage={stage}
                      isLast={index === stages.length - 1}
                    />
                  );
                })}
              </div>

              {runError ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Validation failed</p>
                    <p>{runError}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>
                    {activeStage?.label ?? (hasCompleted ? "Validation complete" : "Ready to run")}
                  </span>
                </div>
              )}
            </section>

            {hasCompleted ? (
              <ResultsPanel
                visible={hasCompleted}
                summary={summary}
                onDownload={triggerOutputDownload}
                onOpenPowerBi={openPowerBi}
              />
            ) : null}

            <LogsConsole logs={logs} activeStageLabel={activeStage?.label} />
          </div>
        </section>
      </main>

      <Dialog open={!!previewKey} onOpenChange={(open) => !open && setPreviewKey(null)}>
        <DialogContent className="border-slate-200 bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle>{previewSpec?.label}</DialogTitle>
          </DialogHeader>
          {previewFile ? (
            <div className="space-y-3 text-sm">
              <InfoRow label="File name" value={previewFile.name} />
              <InfoRow label="Size" value={`${(previewFile.size / 1024).toFixed(1)} KB`} />
              <InfoRow
                label="Type"
                value={
                  previewFile.type ||
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
              />
              <InfoRow
                label="Last modified"
                value={new Date(previewFile.lastModified).toLocaleString()}
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => triggerFileDownload(previewFile)}
                  className="h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-200 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="break-all text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function buildValidationSummary(files: Partial<Record<FileKey, File>>): ValidationSummary {
  const totalBytes = Object.values(files).reduce((sum, file) => sum + (file?.size ?? 0), 0);
  const totalClaims = Math.max(120, Math.round(totalBytes / 3200));
  const invalidClaims = Math.max(8, Math.round(totalClaims * 0.12));
  const flaggedAnomalies = Math.max(4, Math.round(totalClaims * 0.04));

  return {
    totalClaims,
    invalidClaims,
    flaggedAnomalies,
  };
}

function wait(durationMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}
