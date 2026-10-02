import React, { useState } from "react";
import {
  Search,
  Activity,
  GitBranch,
  Radio,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Zap,
} from "lucide-react";
import TransactionGraph from "../../components/graph/TransactionGraph";
import { AccountInspector } from "./AccountInspector";
import type {
  GraphSnapshot,
  AccountStats,
  RiskAccount,
  TraceMode,
} from "../../types";

interface InvestigationViewProps {
  trailGraph: GraphSnapshot;
  selectedAccount: string | null;
  accountDetail: AccountStats | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  traceRunning: boolean;
  onTrace: (targetAccount?: string) => void;
  onRingTrace: (targetAccount: string) => void;
  onSnapshotTrace: () => void;
  onNodeClick: (nodeId: string) => void;
  highlightedNodes?: Set<string>;
  topRisk: RiskAccount[];
  isReady: boolean;
  onCloseDetail: () => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({
  trailGraph,
  selectedAccount,
  accountDetail,
  searchQuery,
  setSearchQuery,
  traceRunning,
  onTrace,
  onRingTrace,
  onSnapshotTrace,
  onNodeClick,
  highlightedNodes,
  topRisk,
  isReady,
  onCloseDetail,
}) => {
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [currentMode, setCurrentMode] = useState<TraceMode>("trail");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setCurrentMode("trail");
      onTrace(searchQuery.trim());
    }
  };

  const handleRingClick = () => {
    const acct = (selectedAccount || searchQuery).trim();
    if (acct) {
      setCurrentMode("ring");
      onRingTrace(acct);
    }
  };

  const handleSnapshotClick = () => {
    setCurrentMode("snapshot");
    onSnapshotTrace();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-3 landing-reveal">
      {/* Top Investigation Toolbar */}
      <div className="p-3.5 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        {/* Search Bar & Trigger */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Enter Account ID (e.g. KKBK10000000)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono outline-none focus:border-primary placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={traceRunning || !isReady}
            className="btn btn-sm rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{traceRunning ? "Tracing..." : "Trace Trail"}</span>
          </button>
        </form>

        {/* View Mode Filters & Graph Metadata */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Toggles */}
          <div className="p-1 rounded-xl bg-background border border-border flex items-center gap-1">
            <button
              onClick={() => {
                setCurrentMode("trail");
                onTrace();
              }}
              disabled={!isReady}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                currentMode === "trail"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              4-Hop Trail
            </button>
            <button
              onClick={handleRingClick}
              disabled={!isReady || (!selectedAccount && !searchQuery)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                currentMode === "ring"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground disabled:opacity-40"
              }`}
              title="2-Hop Direct Ring Neighborhood"
            >
              2-Hop Ring
            </button>
            <button
              onClick={handleSnapshotClick}
              disabled={!isReady}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                currentMode === "snapshot"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Cluster snapshot of top 300 high-risk accounts"
            >
              Global Snapshot
            </button>
          </div>

          {/* Node / Edge Telemetry Badge */}
          {trailGraph.nodes.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-mono">
              <span className="text-muted-foreground">Nodes:</span>
              <span className="font-bold text-primary">{trailGraph.nodes.length}</span>
              <span className="text-border">|</span>
              <span className="text-muted-foreground">Edges:</span>
              <span className="font-bold text-success">{trailGraph.edges.length}</span>
            </div>
          )}

          {/* Inspector Panel Toggle Button */}
          <button
            onClick={() => setInspectorOpen((prev) => !prev)}
            className="p-2 rounded-xl border border-border bg-background text-foreground hover:bg-muted transition-colors flex items-center justify-center cursor-pointer shadow-sm"
            title={inspectorOpen ? "Hide Account Inspector" : "Show Account Inspector"}
          >
            {inspectorOpen ? (
              <PanelRightClose className="w-4 h-4 text-foreground" />
            ) : (
              <PanelRightOpen className="w-4 h-4 text-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Main Graph Area & Collapsible Inspector Split */}
      <div className="flex-1 flex overflow-hidden gap-3 relative rounded-2xl">
        {/* Left: Graph Canvas with floating legend */}
        <div className="flex-1 relative h-full rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
          {/* Graph Legend Overlay */}
          {/* <div className="absolute top-3 left-3 z-10 p-2.5 rounded-xl bg-card/90 backdrop-blur-md border border-border shadow-md flex items-center gap-3 text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
              <span className="text-muted-foreground">Inflows</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
              <span className="text-muted-foreground">L1 Collector</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
              <span className="text-muted-foreground">L2 Distributor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
              <span className="text-muted-foreground">L3 Terminal</span>
            </div>
          </div> */}

          {/* Empty / Unloaded Canvas Prompt */}
          {trailGraph.nodes.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8 graph-grid">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-2">
                <GitBranch className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-foreground font-sans">
                Interactive Money Trail Visualizer
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Enter an account number above or trace the top suspect account to visualize up to 4 hops of funds flow.
              </p>
              {isReady && topRisk.length > 0 && (
                <button
                  onClick={() => onTrace(topRisk[0].account_id)}
                  className="mt-2 btn btn-sm rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Trace Top Risk Account ({topRisk[0].account_id})</span>
                </button>
              )}
            </div>
          )}

          {/* Sigma.js Graph Canvas */}
          {trailGraph.nodes.length > 0 && (
            <TransactionGraph
              nodes={trailGraph.nodes}
              edges={trailGraph.edges}
              onNodeClick={onNodeClick}
              highlightedNodes={highlightedNodes}
              sourceAccount={selectedAccount}
            />
          )}
        </div>

        {/* Right: Collapsible Account Intelligence Inspector */}
        {inspectorOpen && (
          <div className="w-80 lg:w-96 h-full flex-shrink-0 rounded-2xl overflow-hidden shadow-lg border border-border">
            <AccountInspector
              detail={accountDetail}
              onClose={() => {
                onCloseDetail();
                setInspectorOpen(false);
              }}
              onSelectAccount={(acct) => {
                setSearchQuery(acct);
                onTrace(acct);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
