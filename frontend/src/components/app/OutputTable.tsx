import { useState } from "react";
import { Download, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { OutputRow } from "@/context/AppContext";

type Filter = "all" | "Valid" | "Invalid" | "Review";

const MOCK_ROWS: OutputRow[] = [
  {
    claimId: "CLM-10042",
    customer: "Acme Health Systems",
    material: "MAT-2301",
    denialReason: "Pricing Mismatch",
    validationStatus: "Invalid",
    recommendation: "Verify contract pricing — billed amount exceeds contract rate",
    confidence: "High",
    notes: "Contract: $45.00 | Billed: $52.00",
  },
  {
    claimId: "CLM-10043",
    customer: "Midwest Medical Group",
    material: "MAT-4410",
    denialReason: "Contract Expired",
    validationStatus: "Invalid",
    recommendation: "Renew contract before resubmitting claim",
    confidence: "High",
    notes: "Contract expired 2024-03-31",
  },
  {
    claimId: "CLM-10044",
    customer: "Regional Care Partners",
    material: "MAT-0982",
    denialReason: "Eligibility Check",
    validationStatus: "Review",
    recommendation: "Manual review required — customer record incomplete",
    confidence: "Medium",
    notes: "Missing DEA number in customer master",
  },
  {
    claimId: "CLM-10045",
    customer: "National Pharmacy Chain",
    material: "MAT-1155",
    denialReason: "N/A",
    validationStatus: "Valid",
    recommendation: "Approve — all criteria met",
    confidence: "High",
    notes: "Fully validated",
  },
  {
    claimId: "CLM-10046",
    customer: "Summit Hospital Group",
    material: "MAT-3309",
    denialReason: "Tier Mismatch",
    validationStatus: "Review",
    recommendation: "Verify product tier assignment with contracts team",
    confidence: "Medium",
    notes: "Product tier 2 vs contract tier 3",
  },
  {
    claimId: "CLM-10047",
    customer: "Valley Health Network",
    material: "MAT-7701",
    denialReason: "N/A",
    validationStatus: "Valid",
    recommendation: "Approve — all criteria met",
    confidence: "High",
    notes: "Fully validated",
  },
];

const STATUS_COLORS: Record<OutputRow["validationStatus"], string> = {
  Valid: "bg-green-100 text-green-700",
  Invalid: "bg-red-100 text-red-700",
  Review: "bg-amber-100 text-amber-700",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  High: "text-green-600",
  Medium: "text-amber-600",
  Low: "text-red-600",
};

type Props = {
  rows?: OutputRow[];
  onDownload: () => void;
  hasDownload: boolean;
};

export function OutputTable({ rows, onDownload, hasDownload }: Props) {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const displayRows = rows && rows.length > 0 ? rows : MOCK_ROWS;

  const filtered =
    activeFilter === "all" ? displayRows : displayRows.filter((r) => r.validationStatus === activeFilter);

  const counts = {
    all: displayRows.length,
    Valid: displayRows.filter((r) => r.validationStatus === "Valid").length,
    Invalid: displayRows.filter((r) => r.validationStatus === "Invalid").length,
    Review: displayRows.filter((r) => r.validationStatus === "Review").length,
  };

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter results</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "Valid", "Invalid", "Review"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeFilter === f
                  ? "bg-blue-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {f === "all" ? "All" : f}{" "}
              <span className="opacity-70">({counts[f]})</span>
            </button>
          ))}
        </div>
        {hasDownload && (
          <Button variant="outline" size="sm" onClick={onDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Download Excel
          </Button>
        )}
      </div>

      {/* Preview note */}
      {(!rows || rows.length === 0) && (
        <div className="border-b border-border bg-amber-50 px-5 py-2">
          <p className="text-xs text-amber-700">
            Preview showing sample data. Download Excel for actual validation results.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Claim ID", "Customer", "Material", "Denial Reason", "Status", "Recommendation", "Confidence"].map(
                (col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((row) => (
              <tr key={row.claimId} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                  {row.claimId}
                </td>
                <td className="px-4 py-3 text-xs text-foreground">{row.customer}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.material}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{row.denialReason}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      STATUS_COLORS[row.validationStatus],
                    )}
                  >
                    {row.validationStatus}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                  {row.recommendation}
                </td>
                <td className={cn("px-4 py-3 text-xs font-medium", CONFIDENCE_COLORS[row.confidence])}>
                  {row.confidence}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No rows match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
