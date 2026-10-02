import React, { useState } from "react";
import {
  Zap,
  RefreshCw,
  Database,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  Server,
} from "lucide-react";
import { StatCard } from "../../components/common/StatCard";
import type { StatusResponse } from "../../types";

interface PipelineViewProps {
  status: StatusResponse | null;
  ingestRunning: boolean;
  ingestPct: number;
  onStartIngest: (csvPath?: string) => void;
  onTriggerRescore: () => void;
  isReady: boolean;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  status,
  ingestRunning,
  ingestPct,
  onStartIngest,
  onTriggerRescore,
  isReady,
}) => {
  const [csvPath, setCsvPath] = useState("");

  const handleStartIngest = (e: React.FormEvent) => {
    e.preventDefault();
    onStartIngest(csvPath.trim() || undefined);
  };

  const getPhaseStatus = (phase: number) => {
    if (!ingestRunning && isReady) return "completed";
    if (!ingestRunning && !isReady) return "idle";

    // Progress ranges mapped to pipeline phases
    if (phase === 1) return ingestPct >= 35 ? "completed" : "active";
    if (phase === 2) return ingestPct >= 60 ? "completed" : ingestPct >= 35 ? "active" : "idle";
    if (phase === 3) return ingestPct >= 90 ? "completed" : ingestPct >= 60 ? "active" : "idle";
    if (phase === 4) return ingestPct >= 100 ? "completed" : ingestPct >= 90 ? "active" : "idle";
    return "idle";
  };

  return (
    <div className="flex flex-col gap-6 landing-reveal">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono">
              Engine Pipeline
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              SIMD Ingest & Graph Feed
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground font-sans">
            DuckDB SIMD Loader & Mule Scoring Pipeline
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Ultra-fast vectorized transaction parsing, composite Mule Risk indexing, and Memgraph MAGE synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isReady && (
            <button
              onClick={onTriggerRescore}
              disabled={ingestRunning}
              className="btn btn-sm rounded-xl font-bold border border-border bg-secondary text-secondary-foreground hover:bg-muted flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-Run Mule Scorer</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Pipeline State"
          value={ingestRunning ? "Processing" : isReady ? "Operational" : "Idle"}
          description={ingestRunning ? `Running at ${ingestPct}%` : isReady ? "2M rows indexed" : "Awaiting ingest"}
          icon={Activity}
          badgeText={ingestRunning ? "Active" : isReady ? "Ready" : "Pending"}
          badgeType={ingestRunning ? "warning" : isReady ? "success" : "secondary"}
          colorClass="text-primary"
        />
        <StatCard
          title="Vector Ingestion"
          value={status?.rows_loaded ? `${(status.rows_loaded / 1000000).toFixed(1)}M Rows` : "0 Rows"}
          description="DuckDB parallel column reader"
          icon={Cpu}
          badgeText="SIMD C++"
          badgeType="primary"
          colorClass="text-primary"
        />
        <StatCard
          title="Memgraph MAGE"
          value={status?.memgraph_ok ? "Synchronized" : "Disconnected"}
          description="Cypher bolt://localhost:7687"
          icon={Database}
          badgeText={status?.memgraph_ok ? "Connected" : "Offline"}
          badgeType={status?.memgraph_ok ? "success" : "destructive"}
          colorClass="text-primary"
        />
      </div>

      {/* Active Pipeline Visualizer */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-6">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="font-extrabold text-base text-foreground font-sans">
              4-Stage Ingestion Pipeline
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-primary">
            {ingestRunning ? `Pipeline Running: ${ingestPct}%` : isReady ? "Pipeline Completed 100%" : "Standby"}
          </span>
        </div>

        {/* Global Progress Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs font-mono text-muted-foreground">
            <span>Overall Progress</span>
            <span className="text-foreground font-bold">{ingestRunning ? `${ingestPct}%` : isReady ? "100%" : "0%"}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${ingestRunning ? ingestPct : isReady ? 100 : 0}%` }}
            />
          </div>
        </div>

        {/* 4 Pipeline Stages */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Phase 1 */}
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
              getPhaseStatus(1) === "active"
                ? "bg-primary/10 border-primary shadow-sm"
                : getPhaseStatus(1) === "completed"
                ? "bg-background border-success/40"
                : "bg-background/50 border-border opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Phase 1</span>
              {getPhaseStatus(1) === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : getPhaseStatus(1) === "active" ? (
                <Activity className="w-4 h-4 text-primary animate-pulse" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              )}
            </div>
            <h4 className="text-xs font-bold text-foreground">DuckDB SIMD Ingestion</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Parallel vector parsing of 2M transaction CSV records into memory.
            </p>
          </div>

          {/* Phase 2 */}
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
              getPhaseStatus(2) === "active"
                ? "bg-primary/10 border-primary shadow-sm"
                : getPhaseStatus(2) === "completed"
                ? "bg-background border-success/40"
                : "bg-background/50 border-border opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Phase 2</span>
              {getPhaseStatus(2) === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : getPhaseStatus(2) === "active" ? (
                <Activity className="w-4 h-4 text-primary animate-pulse" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              )}
            </div>
            <h4 className="text-xs font-bold text-foreground">Mule Risk Indexing</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Pass-through velocity, terminal markers, burst velocity & layer assignment.
            </p>
          </div>

          {/* Phase 3 */}
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
              getPhaseStatus(3) === "active"
                ? "bg-primary/10 border-primary shadow-sm"
                : getPhaseStatus(3) === "completed"
                ? "bg-background border-success/40"
                : "bg-background/50 border-border opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Phase 3</span>
              {getPhaseStatus(3) === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : getPhaseStatus(3) === "active" ? (
                <Activity className="w-4 h-4 text-primary animate-pulse" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              )}
            </div>
            <h4 className="text-xs font-bold text-foreground">Memgraph Bulk Load</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Export to tmpfs and ingest into Memgraph MAGE in-memory graph engine.
            </p>
          </div>

          {/* Phase 4 */}
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
              getPhaseStatus(4) === "active"
                ? "bg-primary/10 border-primary shadow-sm"
                : getPhaseStatus(4) === "completed"
                ? "bg-background border-success/40"
                : "bg-background/50 border-border opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Phase 4</span>
              {getPhaseStatus(4) === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : getPhaseStatus(4) === "active" ? (
                <Activity className="w-4 h-4 text-primary animate-pulse" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              )}
            </div>
            <h4 className="text-xs font-bold text-foreground">MAGE Community Detection</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Louvain graph modularity clustering and syndicate isolation.
            </p>
          </div>
        </div>
      </div>

      {/* Manual Ingest Trigger Form */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-extrabold text-base text-foreground font-sans">
            Trigger Dataset Ingestion Pipeline
          </h3>
        </div>

        <form onSubmit={handleStartIngest} className="flex flex-col gap-3">
          <label className="text-xs text-muted-foreground">
            Enter CSV Path on Server (leave empty for default VoidHacks 2M dataset):
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              placeholder="/home/surendra/IdeaProjects/ProjectAnant/VoidHacks8_MuleAccount_2M_Transactions.csv"
              value={csvPath}
              onChange={(e) => setCsvPath(e.target.value)}
              disabled={ingestRunning}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground font-mono outline-none focus:border-primary disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={ingestRunning}
              className="btn btn-sm rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{ingestRunning ? "Pipeline Running..." : "Execute Pipeline"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
