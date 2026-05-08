import { useRouterState } from "@tanstack/react-router";
import { Bell, Menu, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useApp } from "@/context/AppContext";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/upload": "Upload Claims",
  "/validate": "Validation Runs",
  "/output": "Output Viewer",
  "/ai-analyst": "AI Analyst",
  "/settings/models": "LLM Models",
  "/settings/api-keys": "API Keys",
  "/settings/usage": "Usage & Tokens",
  "/help": "Help",
  "/feedback": "Feedback",
};

export function TopBar({ onMobileMenuClick }: { onMobileMenuClick?: () => void }) {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const title = ROUTE_TITLES[pathname] ?? "Claims AI";
  const { lastRunAt, isProcessing, downloadUrl } = useApp();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMobileMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {isProcessing && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            Processing…
          </span>
        )}
        {!isProcessing && downloadUrl && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Output ready
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {lastRunAt && (
          <span className="hidden text-xs text-muted-foreground sm:block">
            Last run: {lastRunAt.toLocaleTimeString()}
          </span>
        )}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        <Link
          to="/settings/models"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 text-slate-700">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            AK
          </div>
          <span className="hidden text-xs font-medium sm:block">User Access</span>
        </div>
      </div>
    </header>
  );
}
