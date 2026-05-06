import { ArrowUpRight, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { ValidationSummary } from "./types";

export function ResultsPanel({
  visible,
  summary,
  onDownload,
  onOpenPowerBi,
}: {
  visible: boolean;
  summary: ValidationSummary | null;
  onDownload: () => void;
  onOpenPowerBi: () => void;
}) {
  if (!visible || !summary) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Validation Complete
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Output is ready</h2>
          <p className="mt-1 text-sm text-slate-600">
            Claims were processed successfully and the workbook is ready to review.
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={onDownload} className="h-10 rounded-xl bg-primary px-4 text-white">
            <Download className="mr-2 h-4 w-4" />
            View Excel
          </Button>
          <Button
            variant="outline"
            onClick={onOpenPowerBi}
            className="h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700"
          >
            <ArrowUpRight className="mr-2 h-4 w-4" />
            View in Power BI
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <StatCard label="Total claims processed" value={summary.totalClaims} />
        <StatCard label="Invalid claims" value={summary.invalidClaims} />
        <StatCard label="Flagged anomalies" value={summary.flaggedAnomalies} />
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-none">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value.toLocaleString()}</p>
    </Card>
  );
}
