export type FileKey =
  | "denial_records"
  | "contracts_data"
  | "customer_master"
  | "material_master"
  | "pricing_data"
  | "rules_brain";

export type FileSpec = {
  key: FileKey;
  label: string;
  description: string;
};

export type PipelineStageStatus = "idle" | "running" | "complete" | "error";

export type PipelineStage = {
  id: string;
  label: string;
  description: string;
  status: PipelineStageStatus;
};

export type LogEntry = {
  time: string;
  message: string;
  level: "info" | "success" | "error";
};

export type ValidationSummary = {
  totalClaims: number;
  invalidClaims: number;
  flaggedAnomalies: number;
};
