import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, "")
  : import.meta.env.DEV
    ? "http://localhost:8000"
    : "/api";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Claims Denial Validation MVP" },
      {
        name: "description",
        content:
          "Upload denial, master, pricing, contract, and rules files to generate structured research findings.",
      },
    ],
  }),
});

type FileKey =
  | "denial_records"
  | "contracts_data"
  | "customer_master"
  | "material_master"
  | "pricing_data"
  | "rules_brain";

type Screen = "upload" | "review";

type StageStatus = "pending" | "running" | "complete" | "error";

type FileSpec = {
  key: FileKey;
  label: string;
  description: string;
};

type LogEntry = {
  time: string;
  message: string;
  level: "info" | "success" | "error";
};

type Stage = {
  id: string;
  label: string;
  status: StageStatus;
};

const FILE_SPECS: FileSpec[] = [
  {
    key: "denial_records",
    label: "Denial Records",
    description: "DenialRecords_Populated.xlsx",
  },
  {
    key: "contracts_data",
    label: "Contracts Data",
    description: "ContractsData_Populated.xlsx",
  },
  {
    key: "customer_master",
    label: "Customer Master Records",
    description: "CustomerMasterRecords_Populated.xlsx",
  },
  {
    key: "material_master",
    label: "Material Master Records",
    description: "MaterialMasterRecords_Populated.xlsx",
  },
  {
    key: "pricing_data",
    label: "Pricing Data",
    description: "PricingData_Populated.xlsx",
  },
  {
    key: "rules_brain",
    label: "Rules Brain",
    description: "Claims_AI_Rules_Brain.xlsx",
  },
];

const INITIAL_STAGES: Stage[] = [
  { id: "uploaded", label: "Files uploaded", status: "pending" },
  { id: "validated", label: "Files validated", status: "pending" },
  { id: "rules", label: "Rules brain loaded", status: "pending" },
  { id: "processing", label: "Claims processed", status: "pending" },
  { id: "output", label: "Output generated", status: "pending" },
];

function Index() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [errors, setErrors] = useState<Partial<Record<FileKey, string>>>({});
  const [previewKey, setPreviewKey] = useState<FileKey | null>(null);
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const allUploaded = useMemo(() => FILE_SPECS.every((spec) => files[spec.key]), [files]);
  const uploadedCount = useMemo(
    () => FILE_SPECS.filter((spec) => files[spec.key]).length,
    [files],
  );
  const previewSpec = previewKey ? FILE_SPECS.find((spec) => spec.key === previewKey) : undefined;
  const previewFile = previewKey ? files[previewKey] : undefined;
  const success = !!downloadUrl && !runError;

  function addLog(message: string, level: LogEntry["level"] = "info") {
    setLogs((current) => [
      ...current,
      { time: new Date().toLocaleTimeString(), message, level },
    ]);
  }

  function updateStage(id: string, status: StageStatus) {
    setStages((current) =>
      current.map((stage) => (stage.id === id ? { ...stage, status } : stage)),
    );
  }

  function setFile(key: FileKey, file: File | null) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setErrors((current) => ({ ...current, [key]: "Only .xlsx files are accepted" }));
      return;
    }

    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    setFiles((current) => ({ ...current, [key]: file }));
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
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setDownloadUrl(null);
    setRunError(null);
    setScreen("upload");
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

  async function runValidation() {
    if (!allUploaded || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setRunError(null);
    setLogs([]);
    setStages(INITIAL_STAGES.map((stage) => ({ ...stage, status: "pending" })));

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      addLog("Files selected: 6");
      updateStage("uploaded", "complete");

      updateStage("validated", "running");
      addLog("Validating uploaded files");
      await new Promise((resolve) => setTimeout(resolve, 200));
      updateStage("validated", "complete");

      updateStage("rules", "running");
      addLog("Loading rules brain");
      await new Promise((resolve) => setTimeout(resolve, 200));
      updateStage("rules", "complete");

      updateStage("processing", "running");
      addLog("Sending files to backend");

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
        const message = await getErrorMessage(response);
        throw new Error(`Server returned ${response.status}: ${message}`);
      }

      updateStage("processing", "complete");
      updateStage("output", "running");
      addLog("Backend processing complete", "success");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setDownloadUrl(objectUrl);
      updateStage("output", "complete");
      addLog("Output ready for download", "success");
      triggerOutputDownload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-primary">McKesson</div>
              <div className="text-sm font-semibold tracking-tight text-foreground">
                Claims Validation
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <StepDot active={screen === "upload"} index={1} label="Upload" />
            <ArrowRight className="h-3 w-3" />
            <StepDot active={screen === "review"} index={2} label="Validate" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {screen === "upload" ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Upload Files
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Upload all 6 required Excel files to continue.
              </p>
            </div>

            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Required files</h2>
                  <p className="text-xs text-muted-foreground">
                    {uploadedCount} of {FILE_SPECS.length} uploaded
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">.xlsx only</div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {FILE_SPECS.map((spec) => (
                  <UploadCard
                    key={spec.key}
                    spec={spec}
                    file={files[spec.key]}
                    error={errors[spec.key]}
                    onSelect={(file) => setFile(spec.key, file)}
                    onRemove={() => removeFile(spec.key)}
                  />
                ))}
              </div>
            </Card>

            <div className="flex items-center justify-end gap-3">
              {!allUploaded && (
                <span className="text-xs text-muted-foreground">
                  Upload all 6 files to continue.
                </span>
              )}
              <Button
                onClick={() => setScreen("review")}
                disabled={!allUploaded}
                className="gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  Review &amp; Run Validation
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Review your uploaded files, then run the claims validation pipeline.
                </p>
              </div>
              <Button variant="outline" onClick={() => setScreen("upload")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to upload
              </Button>
            </div>

            <Card className="p-6">
              <h2 className="mb-4 text-base font-semibold">Uploaded documents</h2>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {FILE_SPECS.map((spec) => {
                  const file = files[spec.key];
                  return (
                    <div
                      key={spec.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                          <span className="text-sm font-medium text-foreground">{spec.label}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {file?.name ?? spec.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <ActionButton
                          icon={<Eye className="h-3.5 w-3.5" />}
                          label={`View ${spec.label}`}
                          onClick={() => setPreviewKey(spec.key)}
                        />
                        <ActionButton
                          icon={<Download className="h-3.5 w-3.5" />}
                          label={`Download ${spec.label}`}
                          onClick={() => file && triggerFileDownload(file)}
                        />
                        <ActionButton
                          icon={<RefreshCw className="h-3.5 w-3.5" />}
                          label={`Replace ${spec.label}`}
                          onClick={() => setScreen("upload")}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-2">
                <Card className="p-6">
                  <h2 className="mb-1 text-base font-semibold">Run pipeline</h2>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Sends all 6 files to <code className="font-mono">/process-claims</code>.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={runValidation} disabled={isProcessing} className="gap-2">
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {isProcessing ? "Processing..." : "Run Validation"}
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
                    <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-medium">Validation failed</div>
                        <div className="text-destructive/80">{runError}</div>
                      </div>
                    </div>
                  )}

                  {success && (
                    <div className="mt-4 space-y-3">
                      <Button
                        onClick={triggerOutputDownload}
                        className="w-full gap-2 bg-success text-success-foreground hover:bg-success/90"
                      >
                        <Download className="h-4 w-4" />
                        Download OutputFile_Generated.xlsx
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <SummaryCard label="Files" value="6" />
                        <SummaryCard label="Status" value="Complete" tone="success" />
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              <div className="space-y-4 lg:col-span-3">
                <Card className="p-6">
                  <h2 className="mb-4 text-base font-semibold">Workflow</h2>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {stages.map((stage) => (
                      <div
                        key={stage.id}
                        className="flex items-center gap-3 rounded-md border border-border bg-surface-muted px-4 py-3"
                      >
                        <StageStatusIcon status={stage.status} />
                        <div>
                          <div className="text-sm font-medium text-foreground">{stage.label}</div>
                          <div className="text-xs capitalize text-muted-foreground">
                            {stage.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="mb-4 text-base font-semibold">Logs</h2>
                  {logs.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No activity yet.</div>
                  ) : (
                    <ul className="space-y-2 rounded-md bg-surface-muted p-3 font-mono text-xs">
                      {logs.map((log, index) => (
                        <li
                          key={`${log.time}-${index}`}
                          className={cn(
                            "flex gap-3",
                            log.level === "error" && "text-destructive",
                            log.level === "success" && "text-success",
                          )}
                        >
                          <span className="shrink-0 text-muted-foreground">{log.time}</span>
                          <span className="break-all">{log.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!previewKey} onOpenChange={(open) => !open && setPreviewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previewSpec?.label}</DialogTitle>
          </DialogHeader>
          {previewFile && (
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
              <p className="pt-2 text-xs text-muted-foreground">
                In-app spreadsheet preview is not available in this MVP. Use Download to open the
                file locally.
              </p>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => triggerFileDownload(previewFile)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadCard({
  spec,
  file,
  error,
  onSelect,
  onRemove,
}: {
  spec: FileSpec;
  file?: File;
  error?: string;
  onSelect: (file: File | null) => void;
  onRemove: () => void;
}) {
  const inputId = `file-${spec.key}`;
  const status = error ? "error" : file ? "uploaded" : "missing";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        status === "uploaded" && "border-success/40 bg-success/5",
        status === "error" && "border-destructive/40 bg-destructive/5",
        status === "missing" && "border-border bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{spec.label}</div>
          <div className="text-xs text-muted-foreground">{spec.description}</div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            status === "uploaded" && "bg-success/15 text-success",
            status === "error" && "bg-destructive/10 text-destructive",
            status === "missing" && "bg-muted text-muted-foreground",
          )}
        >
          {status}
        </span>
      </div>

      <div className="mt-3">
        {file ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-xs">{file.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <label
                htmlFor={inputId}
                className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </label>
              <button
                type="button"
                onClick={onRemove}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface-muted px-3 py-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Choose .xlsx file
          </label>
        )}

        <input
          id={inputId}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
        />
      </div>

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: JSX.Element;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-primary"
    >
      {icon}
    </button>
  );
}

function StageStatusIcon({ status }: { status: StageStatus }) {
  if (status === "complete") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />;
  }

  if (status === "running") {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />;
  }

  if (status === "error") {
    return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />;
  }

  return <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40" />;
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold", tone === "success" && "text-success")}>
        {value}
      </div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}

function StepDot({
  active,
  index,
  label,
}: {
  active: boolean;
  index: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {index}
      </div>
      <span className={active ? "font-medium text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}
