import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "info" | "danger";

type Props = {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
};

const toneClasses: Record<Tone, { icon: string; value: string }> = {
  default: { icon: "bg-blue-50 text-blue-600", value: "text-foreground" },
  success: { icon: "bg-green-50 text-green-600", value: "text-green-700" },
  warning: { icon: "bg-amber-50 text-amber-600", value: "text-amber-700" },
  info: { icon: "bg-indigo-50 text-indigo-600", value: "text-indigo-700" },
  danger: { icon: "bg-red-50 text-red-600", value: "text-red-700" },
};

export function StatCard({ label, value, subtext, icon, tone = "default", className }: Props) {
  const tc = toneClasses[tone];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && (
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tc.icon)}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className={cn("text-2xl font-bold tabular-nums", tc.value)}>{value}</p>
        {subtext && <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>}
      </div>
    </div>
  );
}
