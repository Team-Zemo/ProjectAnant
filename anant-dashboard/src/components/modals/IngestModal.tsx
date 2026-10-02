import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  X,
  RefreshCw,
  FileText,
  Database,
  Upload,
  Plus,
  Trash2,
  FolderUp,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  HardDrive,
  Layers,
  Clock,
  Gauge,
  Activity,
  Check,
  RotateCcw
} from "lucide-react";
import type { StatusResponse } from "../../types";
import { api, type IngestProgressEvent } from "../../api/client";

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: StatusResponse | null;
  ingestRunning: boolean;
  ingestPct: number;
  onStartIngest: (csvPaths?: string[] | string) => void;
  onTriggerRescore: () => void;
}

export interface FileQueueItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  serverPath?: string;
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
  const [activeMode, setActiveMode] = useState<"upload" | "path">("upload");
  const [fileList, setFileList] = useState<FileQueueItem[]>([]);
  const [customPath, setCustomPath] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDurationMs, setUploadDurationMs] = useState<number | null>(null);
  const [uploadSpeedMbps, setUploadSpeedMbps] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [telemetry, setTelemetry] = useState<IngestProgressEvent | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to live SSE events stream while ingest is active
  useEffect(() => {
    if (!isOpen || !ingestRunning) return;
    const es = api.eventsStream((evt) => {
      setTelemetry(evt);
    });
    return () => {
      es.close();
    };
  }, [isOpen, ingestRunning]);

  if (!isOpen) return null;

  const isLoaded = status?.loaded ?? false;

  // Add files to queue (preserving existing files)
  const addFilesToQueue = (files: FileList | File[]) => {
    setUploadError(null);
    const newItems: FileQueueItem[] = Array.from(files)
      .filter((f) => f.name.toLowerCase().endsWith(".csv"))
      .map((f) => ({
        id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        name: f.name,
        size: f.size,
      }));

    if (newItems.length === 0 && files.length > 0) {
      setUploadError("Only CSV files (.csv) are currently supported.");
      return;
    }

    setFileList((prev) => [...prev, ...newItems]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Remove individual file by id and purge from server buffer if uploaded
  const handleRemoveFile = async (idToRemove: string) => {
    const item = fileList.find((f) => f.id === idToRemove);
    if (item && item.serverPath) {
      try {
        await api.deleteUploadedFile({ path: item.serverPath, filename: item.name });
      } catch (err) {
        console.warn("Could not remove file from server buffer:", err);
      }
    }
    setFileList((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  // Clear all staged files and purge buffer
  const handleClearAll = async () => {
    for (const item of fileList) {
      if (item.serverPath) {
        try {
          await api.deleteUploadedFile({ path: item.serverPath, filename: item.name });
        } catch {}
      }
    }
    setFileList([]);
    setUploadError(null);
  };

  // Reset database entries
  const handleResetDatabase = async () => {
    if (
      !window.confirm(
        "Are you sure you want to drop all loaded accounts, transactions, and syndicates from the database? This resets the engine to a clean state."
      )
    ) {
      return;
    }
    setResetting(true);
    setResetSuccess(null);
    try {
      await api.resetDatabase();
      setResetSuccess("All database entries removed and tables reset successfully.");
      setTimeout(() => setResetSuccess(null), 4000);
    } catch (e: any) {
      setUploadError(`Failed to reset database: ${e.message}`);
    } finally {
      setResetting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const totalSize = fileList.reduce((acc, f) => acc + f.size, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadDurationMs(null);
    setUploadSpeedMbps(null);

    if (activeMode === "upload") {
      if (fileList.length === 0) {
        // Fallback to default server 2M dataset if none staged
        onStartIngest();
        return;
      }

      // Check if files need to be uploaded to server first
      const rawFiles = fileList.map((item) => item.file).filter(Boolean) as File[];
      if (rawFiles.length > 0) {
        setIsUploading(true);
        const t0 = performance.now();
        try {
          const res = await api.uploadFiles(rawFiles);
          const t1 = performance.now();
          const durMs = Math.round(t1 - t0);
          setUploadDurationMs(durMs);
          const totalMB = totalSize / (1024 * 1024);
          const speed = durMs > 0 ? totalMB / (durMs / 1000) : 0;
          setUploadSpeedMbps(speed);

          // Update file items with server paths
          setFileList((prev) =>
            prev.map((item, idx) => ({
              ...item,
              serverPath: res.files[idx]?.path || item.serverPath,
            }))
          );

          setIsUploading(false);
          const uploadedPaths = res.files.map((f) => f.path);
          onStartIngest(uploadedPaths);
        } catch (err: any) {
          setIsUploading(false);
          setUploadError(`Failed to upload files: ${err.message}`);
          return;
        }
      } else {
        const paths = fileList.map((f) => f.serverPath).filter(Boolean) as string[];
        onStartIngest(paths.length > 0 ? paths : undefined);
      }
    } else {
      // Path mode
      const paths = customPath
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      onStartIngest(paths.length > 0 ? paths : undefined);
    }
  };

  const stagesList = [
    {
      num: 1,
      title: "DuckDB SIMD Parallel Ingest",
      desc: "Multi-CSV schema unification & AVX-512 SIMD parsing",
      time: telemetry?.duck_time_ms,
    },
    {
      num: 2,
      title: "OLAP Aggregation & Indexing",
      desc: "Building accounts ledger & sender/receiver B-Tree indexes",
      time: null,
    },
    {
      num: 3,
      title: "Anant V3 Bayesian Mule Scoring",
      desc: "7-signal Bayesian Noisy-OR fusion across unique accounts",
      time: telemetry?.score_time_ms,
    },
    {
      num: 4,
      title: "Fraud Syndicate Clustering",
      desc: "Weighted Label Propagation graph community detection",
      time: telemetry?.syn_time_ms,
    },
    {
      num: 5,
      title: "Memgraph Graph Bulk Load",
      desc: "Tmpfs Cypher buffer ingestion & topology materialization",
      time: telemetry?.graph_time_ms,
    },
  ];

  const currentStageNum = telemetry?.stage_num || (ingestRunning ? 1 : isLoaded ? 5 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden z-10 landing-reveal">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground font-sans">
                Dataset Ingest & Processing Engine
              </h3>
              <p className="text-xs text-muted-foreground">
                DuckDB SIMD Parallel Reader · Mule Scorer V3 · Memgraph Ingestion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5">
          {/* Status & Database Clear Bar */}
          <div className="p-3.5 rounded-2xl bg-background border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Database State:</span>
              <span
                className={`font-mono font-bold px-2.5 py-0.5 rounded-lg text-[11px] ${
                  isLoaded
                    ? "bg-success/20 text-success border border-success/30"
                    : ingestRunning || isUploading
                    ? "bg-warning/20 text-warning border border-warning/30"
                    : "bg-destructive/20 text-destructive border border-destructive/30"
                }`}
              >
                {isLoaded
                  ? `${status?.rows_loaded?.toLocaleString()} transactions active`
                  : isUploading
                  ? "Uploading files..."
                  : ingestRunning
                  ? `Processing... ${ingestPct}%`
                  : "Database Empty / Not Loaded"}
              </span>
            </div>

            {/* Clear Database Entries Button */}
            {isLoaded && !ingestRunning && (
              <button
                type="button"
                onClick={handleResetDatabase}
                disabled={resetting}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Wipe and clear all transactions and accounts from DuckDB & Memgraph"
              >
                <RotateCcw className={`w-3 h-3 ${resetting ? "animate-spin" : ""}`} />
                <span>{resetting ? "Resetting..." : "Clear Database Entries"}</span>
              </button>
            )}
          </div>

          {/* Reset Success Alert */}
          {resetSuccess && (
            <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{resetSuccess}</span>
            </div>
          )}

          {/* Upload Success Telemetry Banner */}
          {uploadDurationMs !== null && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs flex items-center justify-between text-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>
                  <strong>Upload Finished:</strong> Transfer completed in{" "}
                  <span className="font-mono text-primary font-bold">{uploadDurationMs}ms</span>
                </span>
              </div>
              {uploadSpeedMbps !== null && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  Velocity: <strong>{uploadSpeedMbps.toFixed(1)} MB/s</strong>
                </span>
              )}
            </div>
          )}

          {/* Live Ingest Telemetry & Processing HUD (Active or Finished) */}
          {(ingestRunning || isUploading || telemetry) && (
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Activity className={`w-4 h-4 text-primary ${ingestRunning ? "animate-pulse" : ""}`} />
                  <span className="font-bold text-foreground font-sans">
                    {telemetry?.stage || (isUploading ? "Uploading Datasets" : "Processing Pipeline")}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  {telemetry?.elapsed_ms ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Elapsed: {(telemetry.elapsed_ms / 1000).toFixed(1)}s</span>
                    </span>
                  ) : null}
                  <span className="font-bold text-primary px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                    {isUploading ? "Uploading" : `${ingestPct}%`}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted/60 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`bg-primary h-full transition-all duration-300 rounded-full ${
                    isUploading ? "w-1/2 animate-pulse" : ""
                  }`}
                  style={!isUploading ? { width: `${ingestPct}%` } : undefined}
                />
              </div>

              {/* Live Status Message */}
              <p className="text-[11px] font-mono text-muted-foreground">
                {telemetry?.message ||
                  (isUploading
                    ? "Buffering multipart CSV streams to local tmpfs memory..."
                    : "Executing DuckDB SIMD Reader → Bayesian Mule Scorer → Memgraph...")}
              </p>

              {/* 5-Stage Visual Stepper */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Pipeline Processing Stages:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
                  {stagesList.map((st) => {
                    const isDone = currentStageNum > st.num || (ingestPct === 100 && !ingestRunning);
                    const isCurrent = currentStageNum === st.num && ingestRunning;
                    return (
                      <div
                        key={st.num}
                        className={`p-2 rounded-xl border text-[10px] transition-all flex flex-col justify-between ${
                          isDone
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : isCurrent
                            ? "bg-primary/10 border-primary text-primary shadow-sm"
                            : "bg-muted/10 border-border/40 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold font-mono">Stage {st.num}</span>
                          {isDone ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : isCurrent ? (
                            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                          ) : null}
                        </div>
                        <div className="font-semibold text-foreground/90 leading-tight truncate" title={st.title}>
                          {st.title.split(" ")[0]} {st.title.split(" ")[1]}
                        </div>
                        {st.time ? (
                          <div className="font-mono text-[9px] text-emerald-400/90 mt-1 font-bold">
                            {st.time}ms
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Processing Telemetry Metrics HUD */}
              {telemetry && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 text-center font-mono">
                  <div className="p-2 rounded-xl bg-background border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Rows Parsed</span>
                    <span className="text-xs font-bold text-foreground">
                      {telemetry.rows ? telemetry.rows.toLocaleString() : "..."}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-background border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Unique Accounts</span>
                    <span className="text-xs font-bold text-primary">
                      {telemetry.accounts ? telemetry.accounts.toLocaleString() : "..."}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-background border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Total Ingest Time</span>
                    <span className="text-xs font-bold text-foreground">
                      {telemetry.elapsed_ms ? `${(telemetry.elapsed_ms / 1000).toFixed(2)}s` : "..."}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-background border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Throughput</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {telemetry.rows && telemetry.elapsed_ms
                        ? `${Math.round((telemetry.rows / Math.max(1, telemetry.elapsed_ms)) * 1000).toLocaleString()} tx/s`
                        : "SIMD 8-Core"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border text-xs">
            <button
              type="button"
              onClick={() => setActiveMode("upload")}
              className={`flex-1 py-1.5 rounded-lg font-bold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === "upload"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>Multi-File Upload</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("path")}
              className={`flex-1 py-1.5 rounded-lg font-bold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === "path"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Server File Path</span>
            </button>
          </div>

          {/* Upload Error Alert */}
          {uploadError && (
            <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Ingestion Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {activeMode === "upload" ? (
              <div className="space-y-3">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={ingestRunning || isUploading}
                />

                {/* Drag and Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${
                    isDragOver
                      ? "border-primary bg-primary/10 scale-[1.01]"
                      : "border-border hover:border-primary/60 bg-muted/10 hover:bg-muted/20"
                  }`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Click to browse or drag & drop CSV files
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Select single or multiple bank datasets · DuckDB unifies schemas automatically
                    </p>
                  </div>
                </div>

                {/* Staged Files List */}
                {fileList.length > 0 && (
                  <div className="space-y-2 rounded-2xl bg-background border border-border p-3.5">
                    {/* Queue Header with Total Size & Clear All */}
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        <span className="font-bold text-foreground">
                          Staged Datasets ({fileList.length})
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                          Total: {formatFileSize(totalSize)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearAll}
                        disabled={ingestRunning || isUploading}
                        className="text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        title="Remove all files from the queue and purge buffer"
                      >
                        Clear All
                      </button>
                    </div>

                    {/* Scrollable File Items */}
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {fileList.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-card border border-border text-xs group hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <p className="font-bold text-foreground truncate">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {formatFileSize(item.size)} · File #{idx + 1}
                              </p>
                            </div>
                          </div>

                          {/* Remove button for individual file */}
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(item.id)}
                            disabled={ingestRunning || isUploading}
                            className="p-1 rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors cursor-pointer"
                            title="Remove file and delete server buffer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* "+ Add More Files" Secondary Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={ingestRunning || isUploading}
                      className="w-full py-1.5 rounded-xl border border-dashed border-border hover:border-primary/50 text-xs font-semibold text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add More CSV Files</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Server File Path(s):
                </label>
                <input
                  type="text"
                  placeholder="Enter path(s) comma-separated, or leave empty for default 2M dataset"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  disabled={ingestRunning || isUploading}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground font-mono outline-none focus:border-primary disabled:opacity-50"
                />
                <p className="text-[11px] text-muted-foreground">
                  Default:{" "}
                  <span className="font-mono text-foreground/80">
                    VoidHacks8_MuleAccount_2M_Transactions.csv
                  </span>
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 mt-2">
              <button
                type="submit"
                disabled={ingestRunning || isUploading}
                className="flex-1 btn btn-sm rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {isUploading
                    ? "Uploading Files..."
                    : ingestRunning
                    ? "Processing Pipeline..."
                    : fileList.length > 0
                    ? `Ingest ${fileList.length} CSV File${fileList.length > 1 ? "s" : ""}`
                    : "Start Ingestion Pipeline"}
                </span>
              </button>

              {isLoaded && !ingestRunning && (
                <button
                  type="button"
                  onClick={() => {
                    onTriggerRescore();
                    onClose();
                  }}
                  disabled={ingestRunning || isUploading}
                  className="btn btn-sm rounded-xl font-bold border border-border bg-secondary text-secondary-foreground hover:bg-muted flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Re-run Mule Risk Engine on existing database"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Score</span>
                </button>
              )}
            </div>
          </form>

          {/* Processing Highlights */}
          <div className="text-[11px] text-muted-foreground space-y-1 bg-muted/15 p-3 rounded-xl border border-border/40">
            <p className="font-semibold text-foreground/90">Multi-File Processing Highlights:</p>
            <p>• Removing any file immediately purges it from the upload list and deletes its server buffer.</p>
            <p>• During ingest, DuckDB drops earlier session tables and only loads currently selected files.</p>
            <p>• To wipe all loaded entries from memory and start from scratch, click <strong>Clear Database Entries</strong>.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
