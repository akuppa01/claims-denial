import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileSpreadsheet, RefreshCw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApp, FILE_SPECS, type FileKey } from "@/context/AppContext";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Upload Claims — McKesson Claims AI" }] }),
});

function UploadPage() {
  const { files, fileErrors, setFile, removeFile } = useApp();
  const navigate = useNavigate();
  const uploadedCount = FILE_SPECS.filter((spec) => files[spec.key]).length;
  const allUploaded = uploadedCount === FILE_SPECS.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Upload Claims Files</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload all 6 required Excel files to continue to validation.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white border border-border px-3 py-1.5 text-sm">
          <span className="font-medium text-foreground">{uploadedCount}</span>
          <span className="text-muted-foreground">/ {FILE_SPECS.length} uploaded</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${(uploadedCount / FILE_SPECS.length) * 100}%` }}
        />
      </div>

      {/* Upload cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FILE_SPECS.map((spec) => (
          <UploadCard
            key={spec.key}
            specKey={spec.key}
            label={spec.label}
            description={spec.description}
            required={spec.required}
            file={files[spec.key]}
            error={fileErrors[spec.key]}
            onSelect={(file) => setFile(spec.key, file)}
            onRemove={() => removeFile(spec.key)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        {!allUploaded && (
          <p className="text-sm text-muted-foreground">
            Upload all {FILE_SPECS.length} files to continue.
          </p>
        )}
        <div className="ml-auto flex items-center gap-3">
          {allUploaded && (
            <p className="text-sm font-medium text-green-600">All files ready!</p>
          )}
          <Button
            onClick={() => navigate({ to: "/validate" })}
            disabled={!allUploaded}
            className="gap-2"
          >
            Next: Review & Validate
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function UploadCard({
  specKey,
  label,
  description,
  required,
  file,
  error,
  onSelect,
  onRemove,
}: {
  specKey: FileKey;
  label: string;
  description: string;
  required: boolean;
  file?: File;
  error?: string;
  onSelect: (file: File | null) => void;
  onRemove: () => void;
}) {
  const inputId = `file-${specKey}`;
  const uploaded = !!file;
  const hasError = !!error;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 shadow-sm transition-colors",
        uploaded && !hasError && "border-green-200 bg-green-50/50",
        hasError && "border-red-200 bg-red-50/50",
        !uploaded && !hasError && "border-border",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              uploaded ? "bg-green-100 text-green-600" : "bg-blue-50 text-blue-600",
            )}
          >
            {uploaded ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {required && (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              Required
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              uploaded && "bg-green-100 text-green-700",
              hasError && "bg-red-100 text-red-700",
              !uploaded && !hasError && "bg-muted text-muted-foreground",
            )}
          >
            {uploaded ? "Uploaded" : hasError ? "Error" : "Missing"}
          </span>
        </div>
      </div>

      {file ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-green-600" />
            <span className="truncate text-xs text-foreground">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              ({(file.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          <div className="flex items-center">
            <label
              htmlFor={inputId}
              className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Replace file"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </label>
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
              title="Remove file"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
        >
          <Upload className="h-4 w-4" />
          Choose .xlsx file
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept=".xlsx"
        className="sr-only"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
