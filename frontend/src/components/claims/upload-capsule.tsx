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
        "rounded-2xl border bg-white p-4 transition-colors",
        status === "uploaded" && "border-emerald-200 bg-emerald-50/60",
        status === "error" && "border-red-200 bg-red-50/80",
        status === "missing" && "border-slate-200",
        isDragging && "border-sky-300 bg-sky-50",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {status === "uploaded" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-500" />
            )}
            <p className="truncate text-sm font-medium text-slate-900">{spec.label}</p>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{spec.description}</p>
        </div>

        <span
          className={cn(
            "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
            status === "uploaded" && "bg-emerald-100 text-emerald-700",
            status === "error" && "bg-red-100 text-red-700",
            status === "missing" && "bg-slate-100 text-slate-500",
          )}
        >
          {status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-700">
            {file?.name ?? "Choose or drop a .xlsx file"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPicker}
            className="h-8 rounded-lg border-slate-200 bg-white px-3 text-slate-700"
          >
            {file ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {file ? "Replace" : "Upload"}
          </Button>

          {file ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

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
