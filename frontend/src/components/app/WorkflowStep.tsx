import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageStatus } from "@/context/AppContext";

type Props = {
  label: string;
  status: StageStatus;
  index: number;
};

export function WorkflowStep({ label, status, index }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
        status === "complete" && "border-green-200 bg-green-50",
        status === "running" && "border-blue-200 bg-blue-50",
        status === "error" && "border-red-200 bg-red-50",
        status === "pending" && "border-border bg-white",
      )}
    >
      <StatusIcon status={status} index={index} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p
          className={cn(
            "text-xs capitalize",
            status === "complete" && "text-green-600",
            status === "running" && "text-blue-600",
            status === "error" && "text-red-600",
            status === "pending" && "text-muted-foreground",
          )}
        >
          {status === "running" ? "In progress…" : status}
        </p>
      </div>
    </div>
  );
}

function StatusIcon({ status, index }: { status: StageStatus; index: number }) {
  if (status === "complete") return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />;
  if (status === "running") return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-500" />;
  if (status === "error") return <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />;
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
      {index}
    </div>
  );
}
