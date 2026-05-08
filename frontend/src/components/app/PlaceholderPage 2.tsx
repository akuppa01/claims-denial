import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  children?: ReactNode;
  className?: string;
};

export function PlaceholderPage({
  icon,
  title,
  description,
  badge = "Coming Soon",
  children,
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        {icon}
      </div>
      <div className="mb-2 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        {badge}
      </div>
      <h2 className="mt-2 text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
