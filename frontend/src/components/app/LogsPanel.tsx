import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/context/AppContext";

const LEVEL_STYLES: Record<LogEntry["level"], { text: string; icon: string; indent: string; dot: string }> = {
  phase: {
    text: "text-blue-300 font-semibold",
    icon: "▶",
    indent: "ml-0",
    dot: "bg-blue-500",
  },
  step: {
    text: "text-slate-200",
    icon: "├─",
    indent: "ml-4",
    dot: "bg-slate-400",
  },
  detail: {
    text: "text-slate-400",
    icon: "│ ",
    indent: "ml-8",
    dot: "bg-slate-600",
  },
  info: {
    text: "text-slate-300",
    icon: "  ",
    indent: "ml-4",
    dot: "bg-slate-500",
  },
  success: {
    text: "text-emerald-400 font-medium",
    icon: "✓",
    indent: "ml-0",
    dot: "bg-emerald-500",
  },
  error: {
    text: "text-red-400 font-medium",
    icon: "✗",
    indent: "ml-0",
    dot: "bg-red-500",
  },
  warn: {
    text: "text-amber-400",
    icon: "⚠",
    indent: "ml-4",
    dot: "bg-amber-500",
  },
};

const PHASE_SEPARATORS = new Set(["phase", "success", "error"]);

type Props = {
  logs: LogEntry[];
};

export function LogsPanel({ logs }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const successCount = logs.filter((l) => l.level === "success").length;
  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <div className="rounded-xl border border-border bg-slate-950 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 opacity-80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 opacity-80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 opacity-80" />
        </div>
        <span className="ml-2 text-xs font-medium text-slate-400">System Logs</span>
        {logs.length > 0 && (
          <div className="ml-auto flex items-center gap-3 text-[10px]">
            {successCount > 0 && (
              <span className="text-emerald-500">{successCount} ok</span>
            )}
            {warnCount > 0 && (
              <span className="text-amber-500">{warnCount} warn</span>
            )}
            {errorCount > 0 && (
              <span className="text-red-500">{errorCount} error</span>
            )}
            <span className="text-slate-500">{logs.length} entries</span>
          </div>
        )}
      </div>

      {/* Log body */}
      <div className="max-h-80 overflow-y-auto p-4 font-mono text-[11px] leading-5 space-y-px scroll-smooth">
        {logs.length === 0 ? (
          <p className="text-slate-600 italic">No activity yet. Run validation to see logs.</p>
        ) : (
          logs.map((log, i) => {
            const style = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info;
            const showSep = i > 0 && PHASE_SEPARATORS.has(log.level) && !PHASE_SEPARATORS.has(logs[i - 1].level);

            return (
              <div key={`${log.time}-${i}`}>
                {showSep && (
                  <div className="my-2 border-t border-slate-800 opacity-50" />
                )}
                <div className={cn("flex items-start gap-2", style.indent)}>
                  <span className="shrink-0 text-slate-600 tabular-nums w-16">{log.time}</span>
                  <span className={cn("shrink-0 w-4 text-center", style.text)}>{style.icon}</span>
                  <span className={cn("flex-1 break-words", style.text)}>
                    {log.message}
                  </span>
                  {log.count !== undefined && log.count > 0 && (
                    <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 tabular-nums">
                      ×{log.count}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
