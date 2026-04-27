import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Play,
  RotateCcw,
  Circle,
  ArrowRight,
  ArrowLeft,
  Eye,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "http://localhost:8000";

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

type FileGroup = "input" | "master" | "rules";

type FileSpec = {
  key: FileKey;
  label: string;
  description: string;
  group: FileGroup;
};

const FILE_SPECS: FileSpec[] = [
  {
    key: "denial_records",
    label: "Denial Records",
    description: "DenialRecords_Populated.xlsx",
    group: "input",
  },
  {
    key: "contracts_data",
    label: "Contracts Data",
    description: "ContractsData_Populated.xlsx",
    group: "master",
  },
  {
    key: "customer_master",
    label: "Customer Master Records",
    description: "CustomerMasterRecords_Populated.xlsx",
    group: "master",
  },
  {
    key: "material_master",
    label: "Material Master Records",
    description: "MaterialMasterRecords_Populated.xlsx",
    group: "master",
  },
  {
    key: "pricing_data",
    label: "Pricing Data",
    description: "PricingData_Populated.xlsx",
    group: "master",
  },
  {
    key: "rules_brain",
    label: "Rules Brain",
    description: "Claims_AI_Rules_Brain.xlsx",
    group: "rules",
  },
];

const GROUPS: { id: FileGroup; title: string; subtitle: string }[] = [
  { id: "input", title: "Input File", subtitle: "Denial records to validate" },
  { id: "master", title: "Master Data", subtitle: "Reference datasets" },
  { id: "rules", title: "Rules", subtitle: "Validation logic" },
];

type Stage = {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error";
};

const INITIAL_STAGES: Stage[] = [
  { id: "uploaded", label: "Files uploaded", status: "pending" },
  { id: "validated", label: "Files validated", status: "pending" },
  { id: "rules", label: "Rules brain loaded", status: "pending" },
  { id: "join", label: "Join logic applied", status: "pending" },
  { id: "checks", label: "Validation checks", status: "pending" },
  { id: "output", label: "Output generated", status: "pending" },
];

type LogEntry = { time: string; message: string; level: "info" | "error" | "success" };

type Screen = "upload" | "run";

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

function downloadOutputFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "OutputFile_Generated.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function Index() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [errors, setErrors] = useState<Partial<Record<FileKey, string>>>({});
  const [focusKey, setFocusKey] = useState<FileKey | null>(null);
  const [previewKey, setPreviewKey] = useState<FileKey | null>(null);

  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const allUploaded = useMemo(() => FILE_SPECS.every((s) => files[s.key]), [files]);
  const uploadedCount = FILE_SPECS.filter((s) => files[s.key]).length;

  function addLog(message: string, level: LogEntry["level"] = "info") {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message, level }]);
  }

  function setStage(id: string, status: Stage["status"]) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  function handleFile(key: FileKey, file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setErrors((p) => ({ ...p, [key]: "Only .xlsx files are accepted" }));
      return;
    }
    setErrors((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
    setFiles((p) => ({ ...p, [key]: file }));
  }

  function removeFile(key: FileKey) {
    setFiles((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
    setErrors((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  }

  function downloadFile(key: FileKey) {
    const f = files[key];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function changeFile(key: FileKey) {
    setFocusKey(key);
    setScreen("upload");
  }

  function reset() {
    setFiles({});
    setErrors({});
    setStages(INITIAL_STAGES);
    setLogs([]);
    setIsProcessing(false);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setRunError(null);
    setScreen("upload");
    setFocusKey(null);
  }

  async function runValidation() {
    if (!allUploaded || isProcessing) return;
    setIsProcessing(true);
    setRunError(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
    setStages(INITIAL_STAGES.map((s) => ({ ...s, status: "pending" })));
    setLogs([]);

    try {
      addLog("Files selected: 6", "info");
      setStage("uploaded", "complete");

      setStage("validated", "running");
      addLog("Validating uploaded files");
      await new Promise((r) => setTimeout(r, 300));
      setStage("validated", "complete");

      setStage("rules", "running");
      addLog("Loading rules brain");
      await new Promise((r) => setTimeout(r, 300));
      setStage("rules", "complete");

      const formData = new FormData();
      FILE_SPECS.forEach((s) => {
        const f = files[s.key];
        if (f) formData.append(s.key, f, f.name);
      });

      setStage("join", "running");
      addLog("Sending files to backend");
      const res = await fetch(`${API_BASE_URL}/process-claims`, {
        method: "POST",
        body: formData,
      });
      addLog("Backend processing started");

      if (!res.ok) {
        const message = await getErrorMessage(res);
        throw new Error(`Server returned ${res.status}: ${message}`);
      }

      setStage("join", "complete");
      setStage("checks", "complete");
      setStage("output", "running");

      const blob = await res.blob();
      addLog("Output received", "success");
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      downloadOutputFile(url);
      setStage("output", "complete");
      addLog("Download ready", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setRunError(message);
      addLog(message, "error");
      setStages((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s)),
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function triggerDownload() {
    if (!downloadUrl) return;
    downloadOutputFile(downloadUrl);
  }

  const success = !!downloadUrl && !runError;
  const previewFile = previewKey ? files[previewKey] : undefined;
  const previewSpec = previewKey ? FILE_SPECS.find((s) => s.key === previewKey) : undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-primary">McKesson</span>
                <span className="h-3 w-px bg-border" />
                <span className="text-sm font-semibold tracking-tight">Claims Validation</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Internal MVP · v0.1</div>
            </div>
          </div>
          <StepIndicator screen={screen} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {screen === "upload" ? (
          <UploadScreen
            files={files}
            errors={errors}
            focusKey={focusKey}
            uploadedCount={uploadedCount}
            allUploaded={allUploaded}
            onFile={handleFile}
            onRemove={removeFile}
            onNext={() => {
              setFocusKey(null);
              setScreen("run");
            }}
          />
        ) : (
          <RunScreen
            files={files}
            stages={stages}
            logs={logs}
            isProcessing={isProcessing}
            runError={runError}
            success={success}
            onView={(k) => setPreviewKey(k)}
            onDownload={downloadFile}
            onChange={changeFile}
            onBack={() => setScreen("upload")}
            onRun={runValidation}
            onReset={reset}
            onDownloadOutput={triggerDownload}
          />
        )}
      </main>

      <Dialog open={!!previewKey} onOpenChange={(o) => !o && setPreviewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previewSpec?.label}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="space-y-3 text-sm">
              <Row label="File name" value={previewFile.name} />
              <Row label="Size" value={`${(previewFile.size / 1024).toFixed(1)} KB`} />
              <Row
                label="Type"
                value={
                  previewFile.type ||
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
              />
              <Row
                label="Last modified"
                value={new Date(previewFile.lastModified).toLocaleString()}
              />
              <p className="text-xs text-muted-foreground pt-2">
                In-app spreadsheet preview is not available in this MVP. Use Download to open the
                file locally.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => previewKey && downloadFile(previewKey)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}

function StepIndicator({ screen }: { screen: Screen }) {
  const steps = [
    { id: "upload", label: "Upload" },
    { id: "run", label: "Validate" },
  ];
  return (
    <div className="hidden sm:flex items-center gap-2">
      {steps.map((s, i) => {
        const active = s.id === screen;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "text-xs",
                active ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/60" />}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Screen 1: Upload ---------------- */

function UploadScreen({
  files,
  errors,
  focusKey,
  uploadedCount,
  allUploaded,
  onFile,
  onRemove,
  onNext,
}: {
  files: Partial<Record<FileKey, File>>;
  errors: Partial<Record<FileKey, string>>;
  focusKey: FileKey | null;
  uploadedCount: number;
  allUploaded: boolean;
  onFile: (k: FileKey, f: File | null) => void;
  onRemove: (k: FileKey) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Upload Files</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Upload all 6 required files to continue. Only .xlsx files are accepted.
          {focusKey && (
            <span className="ml-1 text-primary">
              Replace the highlighted file, then click Next.
            </span>
          )}
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Required files</h2>
            <p className="text-xs text-muted-foreground">
              {uploadedCount} of {FILE_SPECS.length} uploaded
            </p>
          </div>
          <div className="text-xs text-muted-foreground">.xlsx only</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FILE_SPECS.map((spec) => (
            <UploadCard
              key={spec.key}
              spec={spec}
              file={files[spec.key]}
              error={errors[spec.key]}
              highlight={focusKey === spec.key}
              onSelect={(f) => onFile(spec.key, f)}
              onRemove={() => onRemove(spec.key)}
            />
          ))}
        </div>
      </Card>

      <div className="flex justify-end items-center gap-3">
        {!allUploaded && (
          <span className="text-xs text-muted-foreground">Upload all 6 files to continue.</span>
        )}
        <Button onClick={onNext} disabled={!allUploaded} className="gap-2">
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Screen 2: Run ---------------- */

function RunScreen({
  files,
  stages,
  logs,
  isProcessing,
  runError,
  success,
  onView,
  onDownload,
  onChange,
  onBack,
  onRun,
  onReset,
  onDownloadOutput,
}: {
  files: Partial<Record<FileKey, File>>;
  stages: Stage[];
  logs: LogEntry[];
  isProcessing: boolean;
  runError: string | null;
  success: boolean;
  onView: (k: FileKey) => void;
  onDownload: (k: FileKey) => void;
  onChange: (k: FileKey) => void;
  onBack: () => void;
  onRun: () => void;
  onReset: () => void;
  onDownloadOutput: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Review &amp; Run Validation
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Review your files, then run the validation pipeline.
          </p>
        </div>
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to upload
        </Button>
      </div>

      {/* Compact pipeline-style document capsules (GitLab CI inspired) */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Uploaded documents</div>
            <div className="text-[11px] text-muted-foreground">
              {FILE_SPECS.length} files · grouped by stage
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground hidden sm:block">
            Hover a capsule for actions
          </div>
        </div>
        <div className="flex flex-wrap items-stretch gap-x-2 gap-y-3">
          {GROUPS.map((g, gi) => {
            const groupFiles = FILE_SPECS.filter((s) => s.group === g.id);
            return (
              <div key={g.id} className="flex items-stretch gap-2">
                <div className="flex flex-col">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                    {g.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {groupFiles.map((spec) => (
                      <DocCapsule
                        key={spec.key}
                        spec={spec}
                        file={files[spec.key]}
                        onView={() => onView(spec.key)}
                        onDownload={() => onDownload(spec.key)}
                        onChange={() => onChange(spec.key)}
                      />
                    ))}
                  </div>
                </div>
                {gi < GROUPS.length - 1 && (
                  <div className="hidden md:flex items-end pb-1">
                    <div className="h-px w-4 bg-border" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Split: left actions / right workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6">
            <h2 className="text-base font-semibold mb-1">Run pipeline</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Sends all 6 files to <code className="font-mono">/process-claims</code>.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={onRun} disabled={isProcessing} className="gap-2">
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isProcessing ? "Processing…" : "Run Validation"}
              </Button>
              <Button variant="outline" onClick={onReset} disabled={isProcessing} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>

            {runError && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Validation failed</div>
                  <div className="text-destructive/80">{runError}</div>
                </div>
              </div>
            )}

            {success && (
              <div className="mt-4 space-y-3">
                <Button
                  onClick={onDownloadOutput}
                  className="gap-2 bg-success text-success-foreground hover:bg-success/90 w-full"
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

        {/* Right */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-6">
            <h2 className="text-base font-semibold mb-4">Workflow</h2>
            <HorizontalWorkflow stages={stages} />
          </Card>

          <Card className="p-2">
            <Accordion type="single" collapsible defaultValue="logs">
              <AccordionItem value="logs" className="border-none">
                <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
                  Logs ({logs.length})
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {logs.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-2">No activity yet.</div>
                  ) : (
                    <ul className="max-h-72 overflow-auto rounded-md bg-surface-muted p-3 space-y-1.5 font-mono text-xs">
                      {logs.map((l, idx) => (
                        <li
                          key={idx}
                          className={cn(
                            "flex gap-2",
                            l.level === "error" && "text-destructive",
                            l.level === "success" && "text-success",
                          )}
                        >
                          <span className="text-muted-foreground shrink-0">{l.time}</span>
                          <span className="break-all">{l.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DocCapsule({
  spec,
  file,
  onView,
  onDownload,
  onChange,
}: {
  spec: FileSpec;
  file?: File;
  onView: () => void;
  onDownload: () => void;
  onChange: () => void;
}) {
  const ready = !!file;
  return (
    <div className="group relative">
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full border pl-2.5 pr-1 py-1 transition-colors",
          ready
            ? "border-success/40 bg-success/10 hover:bg-success/15"
            : "border-border bg-surface-muted hover:bg-muted",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            ready ? "bg-success" : "bg-muted-foreground/40",
          )}
        />
        <FileSpreadsheet
          className={cn("h-3 w-3 shrink-0", ready ? "text-success" : "text-muted-foreground")}
        />
        <span className="text-[11px] font-medium text-foreground max-w-[140px] truncate">
          {spec.label}
        </span>
        <div className="flex items-center gap-0.5 ml-0.5">
          <CapsuleAction icon={Eye} label={`View ${spec.label}`} onClick={onView} />
          <CapsuleAction icon={Download} label={`Download ${spec.label}`} onClick={onDownload} />
          <CapsuleAction icon={RefreshCw} label={`Change ${spec.label}`} onClick={onChange} />
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 hidden group-hover:block">
        <div className="rounded-md bg-foreground px-2 py-1 text-[10px] text-background whitespace-nowrap shadow">
          {file?.name ?? spec.description}
        </div>
      </div>
    </div>
  );
}

function CapsuleAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-primary transition-colors"
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

function HorizontalWorkflow({ stages }: { stages: Stage[] }) {
  return (
    <div className="overflow-x-auto">
      <ol className="flex items-start gap-2 min-w-max">
        {stages.map((stage, i) => (
          <li key={stage.id} className="flex items-start gap-2">
            <div className="flex flex-col items-center w-28 text-center">
              <StageIcon status={stage.status} />
              <div
                className={cn(
                  "mt-2 text-[11px] font-medium",
                  stage.status === "complete" && "text-foreground",
                  stage.status === "running" && "text-primary",
                  stage.status === "error" && "text-destructive",
                  stage.status === "pending" && "text-muted-foreground",
                )}
              >
                {stage.label}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/80 capitalize">
                {stage.status}
              </div>
            </div>
            {i < stages.length - 1 && (
              <div
                className={cn(
                  "h-px w-8 mt-[14px]",
                  stages[i].status === "complete" ? "bg-success/60" : "bg-border",
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------- Shared bits ---------------- */

function UploadCard({
  spec,
  file,
  error,
  highlight,
  onSelect,
  onRemove,
}: {
  spec: FileSpec;
  file?: File;
  error?: string;
  highlight?: boolean;
  onSelect: (f: File | null) => void;
  onRemove: () => void;
}) {
  const status: "Missing" | "Uploaded" | "Error" = error ? "Error" : file ? "Uploaded" : "Missing";

  const inputId = `file-${spec.key}`;

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface p-4 transition-colors",
        status === "Uploaded" && "border-success/40 bg-success/5",
        status === "Error" && "border-destructive/40 bg-destructive/5",
        status === "Missing" && "border-border",
        highlight && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{spec.label}</div>
          <div className="text-xs text-muted-foreground">{spec.description}</div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3">
        {file ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs truncate">{file.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <label
                htmlFor={inputId}
                className="cursor-pointer p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label={`Replace ${spec.label}`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </label>
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${spec.label}`}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed border-border bg-surface-muted px-3 py-3 text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
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
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: "Missing" | "Uploaded" | "Error" }) {
  const styles =
    status === "Uploaded"
      ? "bg-success/15 text-success"
      : status === "Error"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        styles,
      )}
    >
      {status}
    </span>
  );
}

function StageIcon({ status }: { status: Stage["status"] }) {
  if (status === "complete") return <CheckCircle2 className="h-5 w-5 text-success shrink-0" />;
  if (status === "running")
    return <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />;
  if (status === "error") return <AlertCircle className="h-5 w-5 text-destructive shrink-0" />;
  return <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />;
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold",
          tone === "success" ? "text-success" : "text-foreground",
        )}
      >
        {value}
      </div>
    </Card>
  );
}
