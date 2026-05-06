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
    <div className="flex min-w-[220px] flex-1 items-center gap-4">
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-500",
            stage.status === "idle" && "border-white/10 bg-white/[0.04] text-slate-400",
            stage.status === "running" &&
              "border-sky-400/50 bg-sky-500/15 text-sky-200 shadow-[0_0_0_10px_rgba(59,130,246,0.08)] animate-pulse",
            stage.status === "complete" &&
              "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_10px_rgba(34,197,94,0.08)]",
            stage.status === "error" && "border-red-400/40 bg-red-500/15 text-red-200",
          )}
        >
          <Icon className="h-5 w-5" />
          <StageAdornment status={stage.status} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100">{stage.label}</p>
        <p className="mt-1 text-xs text-slate-400">{stage.description}</p>
      </div>

      {!isLast ? (
        <div className="hidden h-px flex-1 overflow-hidden rounded-full bg-white/10 lg:block">
          <div
            className={cn(
              "h-full origin-left rounded-full transition-all duration-700",
              stage.status === "complete" ? "w-full bg-emerald-400" : "w-0 bg-sky-400",
              stage.status === "running" && "w-full animate-shimmer-horizontal bg-sky-400/90",
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
      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-400 text-slate-950">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }

  return null;
}
