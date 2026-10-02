import React, { useState } from "react";
import { Zap, X, RefreshCw, FileText, Database, CheckCircle2 } from "lucide-react";
import type { StatusResponse } from "../../types";

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: StatusResponse | null;
  ingestRunning: boolean;
  ingestPct: number;
  onStartIngest: (csvPath?: string) => void;
  onTriggerRescore: () => void;
}

export const IngestModal: React.FC<IngestModalProps> = ({
  isOpen,
  onClose,
  status,
  ingestRunning,
  ingestPct,
  onStartIngest,
  onTriggerRescore,
}) => {
  const [csvPath, setCsvPath] = useState("");

  if (!isOpen) return null;

  const isLoaded = status?.loaded ?? false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartIngest(csvPath.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 landing-reveal">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground font-sans">
                Engine Pipeline Controls
              </h3>
              <p className="text-xs text-muted-foreground">
                DuckDB SIMD Loader · Mule Scorer · Memgraph Ingestion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-5">
          {/* Status Banner */}
          <div className="p-3.5 rounded-xl bg-background border border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Current Dataset State:</span>
            </div>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                isLoaded
                  ? "bg-success/20 text-success border border-success/30"
                  : ingestRunning
                  ? "bg-warning/20 text-warning border border-warning/30"
                  : "bg-destructive/20 text-destructive border border-destructive/30"
              }`}
            >
              {isLoaded
                ? `${status?.rows_loaded?.toLocaleString()} rows ready`
                : ingestRunning
                ? `Ingesting... ${ingestPct}%`
                : "Not Loaded"}
            </span>
          </div>

          {/* Ingest Progress bar if active */}
          {ingestRunning && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-foreground font-semibold">Pipeline Progress</span>
                <span className="text-primary font-bold">{ingestPct}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${ingestPct}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground">
                Phase: DuckDB CSV Ingest → Scoring Mule Indices → Memgraph Bulk Load
              </span>
            </div>
          )}

          {/* Ingestion Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              CSV Dataset Path (Optional):
            </label>
            <input
              type="text"
              placeholder="Leave empty to use server default 2M transactions dataset"
              value={csvPath}
              onChange={(e) => setCsvPath(e.target.value)}
              disabled={ingestRunning}
              className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground font-mono outline-none focus:border-primary disabled:opacity-50"
            />

            <div className="flex gap-2.5 mt-2">
              <button
                type="submit"
                disabled={ingestRunning}
                className="flex-1 btn btn-sm rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{ingestRunning ? "Ingesting..." : "Start Ingestion Pipeline"}</span>
              </button>

              {isLoaded && (
                <button
                  type="button"
                  onClick={() => {
                    onTriggerRescore();
                    onClose();
                  }}
                  disabled={ingestRunning}
                  className="btn btn-sm rounded-xl font-bold border border-border bg-secondary text-secondary-foreground hover:bg-muted flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Re-run Mule Risk Engine on existing database"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Score</span>
                </button>
              )}
            </div>
          </form>

          {/* Info Notes */}
          <div className="text-[11px] text-muted-foreground space-y-1">
            <p>• Ingestion leverages DuckDB SIMD vector parallel threads on host.</p>
            <p>• Exports intermediate CSV to tmpfs for fast Memgraph Cypher insertion.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
