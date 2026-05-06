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
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_18px_45px_rgba(2,6,23,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sky-200">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Decision telemetry</p>
            <p className="text-xs text-slate-400">
              {activeStageLabel ? `Streaming ${activeStageLabel.toLowerCase()}` : "Awaiting run"}
            </p>
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
          Live
        </div>
      </div>

      <div className="mt-4 h-[240px] space-y-2 overflow-y-auto rounded-2xl border border-white/8 bg-black/30 p-4 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            Pipeline logs will appear as the engine validates the intake.
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={`${log.time}-${index}`}
              className={cn(
                "flex items-start gap-3 rounded-xl px-3 py-2 transition-colors",
                index === logs.length - 1 && "bg-white/[0.03]",
              )}
            >
              <span className="shrink-0 text-slate-500">{log.time}</span>
              <span
                className={cn(
                  "leading-5 text-slate-300",
                  log.level === "success" && "text-emerald-300",
                  log.level === "error" && "text-red-300",
                )}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
