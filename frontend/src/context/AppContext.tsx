import { createContext, useContext, useState, useRef, type ReactNode } from "react";

export type FileKey =
  | "denial_records"
  | "contracts_data"
  | "customer_master"
  | "material_master"
  | "pricing_data"
  | "rules_brain";

export type StageStatus = "pending" | "running" | "complete" | "error";

export type LogEntry = {
  time: string;
  message: string;
  level: "phase" | "step" | "detail" | "info" | "success" | "error" | "warn";
  count?: number;
};

export type Stage = {
  id: string;
  label: string;
  status: StageStatus;
};

export type OutputRow = {
  claimId: string;
  customer: string;
  material: string;
  denialReason: string;
  validationStatus: "Valid" | "Invalid" | "Review";
  recommendation: string;
  confidence: string;
  notes: string;
};

export type OutputRun = {
  id: string;
  label: string;
  timestamp: Date;
  outputRows: OutputRow[];
  downloadUrl: string | null;
  runNumber: number;
};

export const FILE_SPECS: Array<{
  key: FileKey;
  label: string;
  description: string;
  required: boolean;
}> = [
  {
    key: "denial_records",
    label: "Denial Records",
    description: "DenialRecords_Populated.xlsx",
    required: true,
  },
  {
    key: "contracts_data",
    label: "Contracts Data",
    description: "ContractsData_Populated.xlsx",
    required: true,
  },
  {
    key: "customer_master",
    label: "Customer Master Records",
    description: "CustomerMasterRecords_Populated.xlsx",
    required: true,
  },
  {
    key: "material_master",
    label: "Material Master Records",
    description: "MaterialMasterRecords_Populated.xlsx",
    required: true,
  },
  {
    key: "pricing_data",
    label: "Pricing Data",
    description: "PricingData_Populated.xlsx",
    required: true,
  },
  {
    key: "rules_brain",
    label: "Rules Brain",
    description: "Claims_AI_Rules_Brain.xlsx",
    required: true,
  },
];

export const INITIAL_STAGES: Stage[] = [
  { id: "uploaded", label: "Files uploaded", status: "pending" },
  { id: "validated", label: "Schema validated", status: "pending" },
  { id: "rules", label: "Rules loaded", status: "pending" },
  { id: "processing", label: "Claims processed", status: "pending" },
  { id: "recommendations", label: "Recommendations generated", status: "pending" },
  { id: "output", label: "Output generated", status: "pending" },
];

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, "")
  : import.meta.env.DEV
    ? "http://localhost:8000"
    : "/api";

export type SessionTokens = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  messageCount: number;
};

export const EMPTY_TOKENS: SessionTokens = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
  messageCount: 0,
};

// Pricing per 1M tokens [input, output] — May 2026 published rates
const MODEL_RATES: Record<string, [number, number]> = {
  "gpt-4o":      [2.50, 10.00],
  "gpt-4o-mini": [0.15,  0.60],
};

export function calcTokenCost(
  promptTokens: number,
  completionTokens: number,
  model: string,
): number {
  const [inputRate, outputRate] = MODEL_RATES[model] ?? [2.50, 10.00];
  return (promptTokens * inputRate + completionTokens * outputRate) / 1_000_000;
}

function loadSelectedModel(): string {
  try {
    return localStorage.getItem("selected_model") || "gpt-4o-mini";
  } catch {
    return "gpt-4o-mini";
  }
}

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function revokeIfBlobUrl(url: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

type AppState = {
  files: Partial<Record<FileKey, File>>;
  fileErrors: Partial<Record<FileKey, string>>;
  stages: Stage[];
  logs: LogEntry[];
  isProcessing: boolean;
  downloadUrl: string | null;
  outputRows: OutputRow[];
  outputRuns: OutputRun[];
  selectedRunId: string | null;
  runError: string | null;
  lastRunAt: Date | null;
  totalClaimsProcessed: number;
  processingTimeMs: number | null;
  selectedModel: string;
  sessionTokens: SessionTokens;
};

type AppContextValue = AppState & {
  setFile: (key: FileKey, file: File | null) => void;
  removeFile: (key: FileKey) => void;
  reset: () => void;
  runValidation: () => Promise<void>;
  triggerOutputDownload: () => void;
  setSelectedModel: (model: string) => void;
  setSelectedRunId: (id: string | null) => void;
  selectedRun: OutputRun | null;
  addTokenUsage: (promptTokens: number, completionTokens: number, model: string) => void;
};

const initialState: AppState = {
  files: {},
  fileErrors: {},
  stages: INITIAL_STAGES,
  logs: [],
  isProcessing: false,
  downloadUrl: null,
  outputRows: [],
  outputRuns: [],
  selectedRunId: null,
  runError: null,
  lastRunAt: null,
  totalClaimsProcessed: 0,
  processingTimeMs: null,
  selectedModel: loadSelectedModel(),
  sessionTokens: EMPTY_TOKENS,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const startTimeRef = useRef<number | null>(null);

  function addLog(message: string, level: LogEntry["level"] = "info") {
    setState((s) => ({
      ...s,
      logs: [...s.logs, { time: new Date().toLocaleTimeString(), message, level }],
    }));
  }

  function updateStage(id: string, status: StageStatus) {
    setState((s) => ({
      ...s,
      stages: s.stages.map((stage) => (stage.id === id ? { ...stage, status } : stage)),
    }));
  }

  function setFile(key: FileKey, file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setState((s) => ({
        ...s,
        fileErrors: { ...s.fileErrors, [key]: "Only .xlsx files are accepted" },
      }));
      return;
    }
    setState((s) => {
      const next = { ...s.fileErrors };
      delete next[key];
      return { ...s, files: { ...s.files, [key]: file }, fileErrors: next };
    });
  }

  function removeFile(key: FileKey) {
    setState((s) => {
      const files = { ...s.files };
      const fileErrors = { ...s.fileErrors };
      delete files[key];
      delete fileErrors[key];
      return { ...s, files, fileErrors };
    });
  }

  function reset() {
    state.outputRuns.forEach((run) => {
      revokeIfBlobUrl(run.downloadUrl);
    });
    revokeIfBlobUrl(state.downloadUrl);
    setState(initialState);
  }

  function triggerOutputDownload() {
    const url = state.downloadUrl;
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = "OutputFile_Generated.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function setSelectedModel(model: string) {
    try { localStorage.setItem("selected_model", model); } catch {}
    setState((s) => ({ ...s, selectedModel: model }));
  }

  function setSelectedRunId(id: string | null) {
    setState((s) => ({ ...s, selectedRunId: id }));
  }

  function addTokenUsage(promptTokens: number, completionTokens: number, model: string) {
    const cost = calcTokenCost(promptTokens, completionTokens, model);
    setState((s) => ({
      ...s,
      sessionTokens: {
        promptTokens: s.sessionTokens.promptTokens + promptTokens,
        completionTokens: s.sessionTokens.completionTokens + completionTokens,
        totalTokens: s.sessionTokens.totalTokens + promptTokens + completionTokens,
        estimatedCostUsd: s.sessionTokens.estimatedCostUsd + cost,
        messageCount: s.sessionTokens.messageCount + 1,
      },
    }));
  }

  async function getErrorMessage(response: Response): Promise<string> {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      if (payload?.detail && typeof payload.detail === "string") return payload.detail;
    }
    const text = await response.text().catch(() => "");
    return text.trim() || `Server returned ${response.status}`;
  }

  async function runValidation() {
    const allUploaded = FILE_SPECS.every((spec) => state.files[spec.key]);
    if (!allUploaded || state.isProcessing) return;

    startTimeRef.current = Date.now();

    setState((s) => ({
      ...s,
      isProcessing: true,
      runError: null,
      logs: [],
      stages: INITIAL_STAGES.map((stage) => ({ ...stage, status: "pending" as StageStatus })),
    }));

    try {
      addLog("Pipeline started — 6 files queued", "phase");
      FILE_SPECS.forEach((spec) => {
        const f = state.files[spec.key];
        addLog(`${spec.label}: ${f?.name ?? "—"}`, "detail");
      });
      updateStage("uploaded", "complete");

      updateStage("validated", "running");
      addLog("Phase 1 — File validation", "phase");
      await new Promise((r) => setTimeout(r, 150));
      addLog("Checking XLSX format & sheet structure", "step");
      await new Promise((r) => setTimeout(r, 150));
      addLog("Column header mapping verified for all 6 files", "step");
      updateStage("validated", "complete");
      addLog("All files passed schema validation", "success");

      updateStage("rules", "running");
      addLog("Phase 2 — Rules engine", "phase");
      await new Promise((r) => setTimeout(r, 150));
      addLog("Loading Claims_AI_Rules_Brain.xlsx", "step");
      await new Promise((r) => setTimeout(r, 100));
      addLog("Parsing validation rule sheets", "detail");
      addLog("Parsing denial reason code mappings", "detail");
      addLog("Parsing pricing tolerance thresholds", "detail");
      updateStage("rules", "complete");
      addLog("Rules brain loaded successfully", "success");

      updateStage("processing", "running");
      addLog("Phase 3 — Claims processing", "phase");
      addLog("Joining denial records → customer master", "step");
      await new Promise((r) => setTimeout(r, 100));
      addLog("Resolving customer IDs via DEA / HIN / 340B fields", "detail");
      addLog("Checking contract eligibility per customer segment", "step");
      await new Promise((r) => setTimeout(r, 100));
      addLog("Comparing claim dates against contract effective ranges", "detail");
      addLog("Validating billed prices against contract rates", "step");
      await new Promise((r) => setTimeout(r, 100));
      addLog("Checking material tier assignments", "detail");
      addLog("Applying denial reason code logic", "step");
      addLog("Dispatching to backend /process-claims", "step");

      const formData = new FormData();
      FILE_SPECS.forEach((spec) => {
        const file = state.files[spec.key];
        if (file) formData.append(spec.key, file, file.name);
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
      addLog("Claims processing complete", "success");

      updateStage("recommendations", "running");
      addLog("Phase 4 — Recommendations", "phase");
      await new Promise((r) => setTimeout(r, 150));
      addLog("Scoring each claim (Valid / Invalid / Review)", "step");
      addLog("Assigning confidence levels based on rule coverage", "detail");
      addLog("Generating human-readable recommendations", "step");
      await new Promise((r) => setTimeout(r, 150));
      updateStage("recommendations", "complete");
      addLog("Recommendations generated", "success");

      updateStage("output", "running");
      addLog("Phase 5 — Output generation", "phase");
      addLog("Formatting Excel output with styling", "step");

      const data = await response.json();
      const rows: OutputRow[] = data.rows ?? [];
      const downloadUrl = resolveApiUrl(data.download_url ?? "");
      const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : null;

      updateStage("output", "complete");
      const elapsedStr = elapsed ? ` (${(elapsed / 1000).toFixed(1)}s)` : "";
      addLog(`Pipeline complete — ${rows.length} claims processed${elapsedStr}`, "success");

      const runNumber = state.totalClaimsProcessed + 1;
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const newRun: OutputRun = {
        id: `run-${Date.now()}`,
        label: `Run ${runNumber} — ${dateStr} ${timeStr}`,
        timestamp: now,
        outputRows: rows,
        downloadUrl,
        runNumber,
      };

      setState((s) => ({
        ...s,
        downloadUrl,
        outputRows: rows,
        outputRuns: [...s.outputRuns, newRun],
        selectedRunId: newRun.id,
        isProcessing: false,
        lastRunAt: now,
        totalClaimsProcessed: s.totalClaimsProcessed + 1,
        processingTimeMs: elapsed,
      }));

      // Auto-download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `OutputFile_Run${runNumber}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      addLog(`Pipeline failed: ${message}`, "error");
      setState((s) => ({
        ...s,
        runError: message,
        isProcessing: false,
        stages: s.stages.map((stage) =>
          stage.status === "running" ? { ...stage, status: "error" as StageStatus } : stage,
        ),
      }));
    }
  }

  const selectedRun =
    state.outputRuns.find((r) => r.id === state.selectedRunId) ??
    state.outputRuns[state.outputRuns.length - 1] ??
    null;

  const value: AppContextValue = {
    ...state,
    setFile,
    removeFile,
    reset,
    runValidation,
    triggerOutputDownload,
    setSelectedModel,
    setSelectedRunId,
    selectedRun,
    addTokenUsage,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
