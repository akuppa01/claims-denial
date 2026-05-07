import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  HelpCircle,
  Key,
  LayoutDashboard,
  MessageSquare,
  Play,
  Settings,
  Table2,
  Upload,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import { FILE_SPECS } from "@/context/AppContext";

type NavItem = {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
};

const MAIN_NAV: NavItem[] = [
  { to: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" },
  { to: "/upload", icon: <Upload className="h-4 w-4" />, label: "Upload Claims" },
  { to: "/validate", icon: <Play className="h-4 w-4" />, label: "Validation Runs" },
  { to: "/output", icon: <Table2 className="h-4 w-4" />, label: "Output Viewer" },
  { to: "/ai-analyst", icon: <Bot className="h-4 w-4" />, label: "AI Analyst", badge: "Beta" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/settings", icon: <Settings className="h-4 w-4" />, label: "Configuration" },
  { to: "/settings/models", icon: <Zap className="h-4 w-4" />, label: "LLM Models" },
  { to: "/settings/api-keys", icon: <Key className="h-4 w-4" />, label: "API Keys" },
  { to: "/settings/usage", icon: <BarChart3 className="h-4 w-4" />, label: "Usage / Tokens" },
];

function NavSection({
  title,
  items,
  collapsed,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
}) {
  return (
    <div className="mb-2">
      {!collapsed && (
        <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {title}
        </div>
      )}
      {collapsed && <div className="my-2 border-t border-slate-700" />}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to as "/"}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white",
                collapsed && "justify-center px-2",
              )}
              activeProps={{
                className: cn(
                  "!bg-blue-600 !text-white shadow-sm",
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-2",
                ),
              }}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sidebar({
  mobileSidebarOpen,
  onMobileClose,
}: {
  mobileSidebarOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { files } = useApp();
  const uploadedCount = FILE_SPECS.filter((spec) => files[spec.key]).length;

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col bg-slate-900 transition-all duration-200",
        "fixed inset-y-0 left-0 z-50 lg:static lg:z-auto",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        collapsed ? "w-14" : "w-60",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-slate-700",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600">
          <FileSpreadsheet className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white">
              McKesson
            </div>
            <div className="truncate text-[10px] text-slate-400">Claims AI</div>
          </div>
        )}
      </div>

      {/* Upload status pill */}
      {!collapsed && uploadedCount > 0 && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-xs text-slate-300">
            {uploadedCount}/{FILE_SPECS.length} files ready
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <NavSection title="Main" items={MAIN_NAV} collapsed={collapsed} />
        <NavSection title="Admin" items={ADMIN_NAV} collapsed={collapsed} />
      </nav>

      {/* Help & Feedback — compact bottom links */}
      {!collapsed && (
        <div className="border-t border-slate-700 px-4 py-2.5 space-y-1">
          <div className="flex items-center gap-3">
            <Link
              to="/help"
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <HelpCircle className="h-3 w-3 shrink-0" />
              Help
            </Link>
            <span className="text-slate-700">·</span>
            <Link
              to="/feedback"
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <MessageSquare className="h-3 w-3 shrink-0" />
              Feedback
            </Link>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className={cn("border-t border-slate-700 p-2", !collapsed && "border-t-0")}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-white",
            collapsed && "justify-center",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <>
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
