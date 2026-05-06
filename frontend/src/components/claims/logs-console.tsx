import { Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

import type { LogEntry } from "./types";

export function LogsConsole({
  logs,
  activeStageLabel,
}: {
  logs: LogEntry[];
  activeStageLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-slate-500" />
          <div>
            <p className="text-sm font-medium text-slate-900">Run log</p>
            <p className="text-xs text-slate-500">
              {activeStageLabel ? `Current stage: ${activeStageLabel}` : "Waiting to run"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            Activity will appear here during validation.
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={`${log.time}-${index}`}
              className={cn(
                "flex items-start gap-2 text-slate-600",
                log.level === "success" && "text-emerald-700",
                log.level === "error" && "text-red-700",
              )}
            >
              <span className="shrink-0 text-slate-400">{log.time}</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
