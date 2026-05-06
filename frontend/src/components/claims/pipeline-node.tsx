import { CheckCircle2, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PipelineStage, PipelineStageStatus } from "./types";

export function PipelineNode({
  icon: Icon,
  stage,
  isLast,
}: {
  icon: LucideIcon;
  stage: PipelineStage;
  isLast: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
          stage.status === "idle" && "border-slate-200 bg-white text-slate-400",
          stage.status === "running" && "border-sky-200 bg-sky-50 text-sky-600",
          stage.status === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-600",
          stage.status === "error" && "border-red-200 bg-red-50 text-red-600",
        )}
      >
        <Icon className="h-4 w-4" />
        <StageAdornment status={stage.status} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{stage.label}</p>
        <p className="truncate text-xs text-slate-500">{stage.description}</p>
      </div>

      {!isLast ? (
        <div className="hidden h-px flex-1 bg-slate-200 lg:block">
          <div
            className={cn(
              "h-px transition-all duration-300",
              stage.status === "complete" ? "w-full bg-emerald-500" : "w-0",
              stage.status === "running" && "w-full bg-sky-500/60",
            )}
          />
        </div>
      ) : null}
    </div>
  );
}

function StageAdornment({ status }: { status: PipelineStageStatus }) {
  if (status === "complete") {
    return (
      <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 text-white">
        <CheckCircle2 className="h-4 w-4" />
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="absolute -right-1 -top-1 rounded-full bg-sky-500 p-0.5 text-white">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }

  return null;
}
