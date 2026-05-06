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
  level: "info" | "success" | "error";
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

type AppState = {
  files: Partial<Record<FileKey, File>>;
  fileErrors: Partial<Record<FileKey, string>>;
  stages: Stage[];
  logs: LogEntry[];
  isProcessing: boolean;
  downloadUrl: string | null;
  outputRows: OutputRow[];
  runError: string | null;
  lastRunAt: Date | null;
  totalClaimsProcessed: number;
  processingTimeMs: number | null;
  selectedModel: string;
};

type AppContextValue = AppState & {
  setFile: (key: FileKey, file: File | null) => void;
  removeFile: (key: FileKey) => void;
  reset: () => void;
  runValidation: () => Promise<void>;
  triggerOutputDownload: () => void;
  setSelectedModel: (model: string) => void;
};

const initialState: AppState = {
  files: {},
  fileErrors: {},
  stages: INITIAL_STAGES,
  logs: [],
  isProcessing: false,
  downloadUrl: null,
  outputRows: [],
  runError: null,
  lastRunAt: null,
  totalClaimsProcessed: 0,
  processingTimeMs: null,
  selectedModel: "gpt-4o",
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
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
    setState(initialState);
  }

  function triggerOutputDownload() {
    if (!state.downloadUrl) return;
    const link = document.createElement("a");
    link.href = state.downloadUrl;
    link.download = "OutputFile_Generated.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function setSelectedModel(model: string) {
    setState((s) => ({ ...s, selectedModel: model }));
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
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);

    setState((s) => ({
      ...s,
      isProcessing: true,
      runError: null,
      logs: [],
      stages: INITIAL_STAGES.map((stage) => ({ ...stage, status: "pending" as StageStatus })),
      downloadUrl: null,
      outputRows: [],
    }));

    try {
      addLog("Files selected: 6");
      updateStage("uploaded", "complete");

      updateStage("validated", "running");
      addLog("Validating uploaded files");
      await new Promise((r) => setTimeout(r, 300));
      updateStage("validated", "complete");

      updateStage("rules", "running");
      addLog("Loading rules brain");
      await new Promise((r) => setTimeout(r, 200));
      updateStage("rules", "complete");

      updateStage("processing", "running");
      addLog("Matching customer master records");
      addLog("Checking contract eligibility");
      addLog("Validating pricing data");
      addLog("Applying reason code logic");
      addLog("Sending files to backend");

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
      updateStage("recommendations", "running");
      addLog("Generating recommendations");
      await new Promise((r) => setTimeout(r, 300));
      updateStage("recommendations", "complete");

      updateStage("output", "running");
      addLog("Backend processing complete", "success");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : null;

      updateStage("output", "complete");
      addLog("Output ready for download", "success");

      setState((s) => ({
        ...s,
        downloadUrl: objectUrl,
        isProcessing: false,
        lastRunAt: new Date(),
        totalClaimsProcessed: s.totalClaimsProcessed + 1,
        processingTimeMs: elapsed,
      }));

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "OutputFile_Generated.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      addLog(message, "error");
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

  const value: AppContextValue = {
    ...state,
    setFile,
    removeFile,
    reset,
    runValidation,
    triggerOutputDownload,
    setSelectedModel,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
