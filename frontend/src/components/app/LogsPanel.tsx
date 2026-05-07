import { cn } from "@/lib/utils";
import type { LogEntry } from "@/context/AppContext";

type Props = {
  logs: LogEntry[];
};

export function LogsPanel({ logs }: Props) {
  return (
    <div className="rounded-xl border border-border bg-slate-950 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-400" />
        <span className="text-xs font-medium text-slate-400">System Logs</span>
        {logs.length > 0 && (
          <span className="ml-auto text-xs text-slate-500">{logs.length} entries</span>
        )}
      </div>
      {logs.length === 0 ? (
        <p className="text-xs text-slate-500">No activity yet. Run validation to see logs.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto font-mono text-xs">
          {logs.map((log, i) => (
            <li key={`${log.time}-${i}`} className="flex gap-3">
              <span className="shrink-0 text-slate-500">{log.time}</span>
              <span
                className={cn(
                  log.level === "error" && "text-red-400",
                  log.level === "success" && "text-green-400",
                  log.level === "info" && "text-slate-300",
                )}
              >
                {log.level === "error" ? "✗ " : log.level === "success" ? "✓ " : "  "}
                {log.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
