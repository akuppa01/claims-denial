import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, RefreshCw, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { FileSpec } from "./types";

export function UploadCapsule({
  spec,
  file,
  error,
  onSelect,
  onRemove,
}: {
  spec: FileSpec;
  file?: File;
  error?: string;
  onSelect: (file: File | null) => void;
  onRemove: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const status = error ? "error" : file ? "uploaded" : "missing";

  function openPicker() {
    inputRef.current?.click();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    onSelect(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border px-5 py-5 transition-all duration-300",
        "bg-white/[0.03] shadow-[0_18px_45px_rgba(2,6,23,0.18)] backdrop-blur-sm hover:-translate-y-0.5",
        status === "uploaded" && "border-emerald-400/30 bg-emerald-500/[0.08]",
        status === "error" && "border-red-400/30 bg-red-500/[0.08]",
        status === "missing" && "border-white/10 hover:border-sky-400/30",
        isDragging && "border-sky-400 bg-sky-500/[0.12]",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_45%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                status === "uploaded"
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 bg-slate-950/50 text-slate-200",
              )}
            >
              {status === "uploaded" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <FileSpreadsheet className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{spec.label}</p>
              <p className="truncate text-xs text-slate-400">{spec.description}</p>
            </div>
          </div>
        </div>

        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
            status === "uploaded" && "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
            status === "error" && "border-red-400/20 bg-red-500/10 text-red-300",
            status === "missing" && "border-white/10 bg-white/5 text-slate-400",
          )}
        >
          {status}
        </span>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-100">
            {file?.name ?? "Drag and drop or choose an Excel file"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Required .xlsx source"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPicker}
            className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
          >
            {file ? <RefreshCw className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
            {file ? "Replace" : "Upload"}
          </Button>

          {file ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="text-slate-400 hover:bg-white/10 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="relative mt-3 text-xs text-red-300">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="sr-only"
        onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
