import React from "react";
import { Shield, Activity, Database, Zap, Menu, Search, RefreshCw } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import type { StatusResponse } from "../../types";

interface NavbarProps {
  status: StatusResponse | null;
  ingestRunning: boolean;
  ingestPct: number;
  onToggleSidebar: () => void;
  onOpenIngest: () => void;
  onOpenQuickTrace: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  ingestRunning,
  ingestPct,
  onToggleSidebar,
  onOpenIngest,
  onOpenQuickTrace,
}) => {
  const isLoaded = status?.loaded ?? false;
  const isMemgraphOk = status?.memgraph_ok ?? false;

  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-card/85 border-b border-border transition-colors">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16 gap-3">
        {/* Left: Mobile hamburger & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg border border-border text-foreground hover:bg-muted lg:hidden cursor-pointer"
            aria-label="Toggle Navigation Drawer"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-foreground flex items-center gap-1.5 font-sans">
                ANANT <span className="text-primary font-bold text-xs font-mono">AML CHAKRA</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono -mt-1 hidden sm:inline">
                Abhedya-Chakra · VoidHacks 8.0 In-Memory Graph Engine
              </span>
            </div>
          </div>
        </div>

        {/* Center/Search Quick Trigger */}
        <div className="hidden md:flex items-center flex-1 max-w-xs mx-4">
          <button
            onClick={onOpenQuickTrace}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-border bg-background/80 hover:bg-muted/60 text-muted-foreground text-xs font-sans transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
              <span>Trace money trail by account...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border text-foreground/70">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right: Telemetry, Ingest CTA, Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Memgraph Indicator */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border text-xs font-mono"
            title={isMemgraphOk ? "Memgraph MAGE In-Memory Graph DB Connected" : "Memgraph Offline"}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isMemgraphOk ? "bg-success animate-pulse" : "bg-destructive"
              }`}
            />
            <Database className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground/80 font-medium hidden md:inline">
              Memgraph {isMemgraphOk ? "Active" : "Offline"}
            </span>
          </div>

          {/* Dataset Status Pill */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border text-xs font-mono"
            title="DuckDB SIMD Transaction & Mule Risk Index Status"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLoaded
                  ? "bg-success"
                  : ingestRunning
                  ? "bg-warning animate-pulse"
                  : "bg-destructive"
              }`}
            />
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground/80 font-medium">
              {isLoaded ? (
                <>
                  <span className="hidden lg:inline">{status?.rows_loaded?.toLocaleString()} rows · </span>
                  {status?.unique_accounts?.toLocaleString()} accts
                </>
              ) : ingestRunning ? (
                `Ingesting ${ingestPct}%`
              ) : (
                "Unloaded"
              )}
            </span>
          </div>

          {/* Quick Load Dataset / Re-Score Button */}
          {!isLoaded ? (
            <button
              onClick={onOpenIngest}
              disabled={ingestRunning}
              className="btn btn-sm rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{ingestRunning ? "Ingesting..." : "Load Dataset"}</span>
            </button>
          ) : (
            <button
              onClick={onOpenIngest}
              className="p-2 rounded-xl border border-border bg-card text-card-foreground hover:bg-muted transition-colors flex items-center justify-center shadow-sm cursor-pointer"
              title="Pipeline Controls & Rescore"
            >
              <RefreshCw className="w-4 h-4 text-foreground/80" />
            </button>
          )}

          {/* Theme Selector */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
