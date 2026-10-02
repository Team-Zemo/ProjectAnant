import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  AlertTriangle,
  Zap,
  Server,
  Layers,
  ChevronRight,
  ShieldAlert,
  Network,
} from "lucide-react";
import type { NavTabId } from "../../types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  topRiskCount?: number;
  syndicatesCount?: number;
  selectedAccount?: string | null;
  onTraceAccount?: (accountId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  topRiskCount,
  syndicatesCount,
  selectedAccount,
  onTraceAccount,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      id: "overview" as NavTabId,
      path: "/overview",
      label: "Overview",
      icon: LayoutDashboard,
      badge: null,
      badgeClass: "",
    },
    {
      id: "investigation" as NavTabId,
      path: "/investigation",
      label: "Graph Studio",
      icon: GitBranch,
      badge: "4-Hop",
      badgeClass: "bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold",
    },
    {
      id: "syndicates" as NavTabId,
      path: "/syndicates",
      label: "Fraud Syndicates",
      icon: Network,
      badge: typeof syndicatesCount === "number" && syndicatesCount > 0 ? `${syndicatesCount}` : "122 Rings",
      badgeClass: "bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold",
    },
    {
      id: "mules" as NavTabId,
      path: "/mules",
      label: "Mule Registry",
      icon: AlertTriangle,
      badge: typeof topRiskCount === "number" && topRiskCount > 0 ? `${topRiskCount}` : "Active",
      badgeClass: "bg-destructive/20 text-destructive border border-destructive/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold",
    },
    {
      id: "system" as NavTabId,
      path: "/system",
      label: "System Diagnostics",
      icon: Server,
      badge: null,
      badgeClass: "",
    },
  ];

  const isItemActive = (path: string) => {
    if (path === "/overview") {
      return location.pathname === "/overview" || location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col justify-between p-4 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-6">
          {/* Main Navigation Modules */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2 flex items-center gap-1.5 font-mono">
              <Layers className="w-3.5 h-3.5" />
              <span>AML Modules</span>
            </div>
            <ul className="flex flex-col gap-1 w-full">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.path);
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        navigate(item.path);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-sm"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-sans">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={item.badgeClass}>{item.badge}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Architecture Badge */}
          <div className="p-3.5 rounded-xl bg-card border border-border text-xs text-card-foreground flex flex-col gap-1.5 shadow-sm">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5 text-foreground font-sans">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                Abhedya-Chakra
              </span>
              <span className="text-[10px] font-mono uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                In-Memory
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              DuckDB SIMD vectorization + Memgraph MAGE Cypher graph multi-hop money trail tracer.
            </p>
          </div>
        </div>

        {/* Selected Account Quick Access Card at Bottom */}
        {selectedAccount && (
          <div
            onClick={() => {
              navigate(`/investigation/${encodeURIComponent(selectedAccount)}`);
              onTraceAccount?.(selectedAccount);
              onClose();
            }}
            className="p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors flex items-center justify-between shadow-sm cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0 group-hover:scale-105 transition-transform">
                <GitBranch className="w-4 h-4" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">
                  Active Suspect
                </span>
                <span className="text-xs font-bold text-foreground font-mono truncate">
                  {selectedAccount}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </div>
        )}
      </aside>
    </>
  );
};
