import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  ShieldCheck,
  ChevronDown,
  Network,
  Share2,
  Scale,
} from "lucide-react";
import TransactionGraph from "../../components/graph/TransactionGraph";
import { AccountInspector } from "./AccountInspector";
import { TemporalPlaybackSlider } from "./TemporalPlaybackSlider";
import { LegalNoticeModal } from "./LegalNoticeModal";
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
  traceMode: TraceMode;
  setTraceMode: (mode: TraceMode) => void;
  onTrace: (targetAccount?: string) => void;
  onRingTrace: (targetAccount: string) => void;
  onSyndicateTrace?: (syndicateId: string) => void;
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
  traceMode,
  setTraceMode,
  onTrace,
  onRingTrace,
  onSyndicateTrace,
  onNodeClick,
  highlightedNodes,
  topRisk,
  isReady,
  onCloseDetail,
}) => {
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [filterTimestamp, setFilterTimestamp] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTargetAccount, setLegalTargetAccount] = useState<string>("");
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const { accountId } = useParams<{ accountId?: string }>();
  const navigate = useNavigate();

  // Close export dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // URL deep-linking: If URL has accountId, automatically load that account on mount/change
  useEffect(() => {
    setFilterTimestamp(null);
    if (accountId) {
      const decoded = decodeURIComponent(accountId);
      if (decoded !== selectedAccount) {
        setTraceMode("trail");
        onTrace(decoded);
      }
    } else if (traceMode !== "trail") {
      setTraceMode("trail");
      onTrace(selectedAccount || searchQuery);
    }
  }, [accountId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const acct = searchQuery.trim();
    if (acct) {
      setFilterTimestamp(null);
      setTraceMode("trail");
      navigate(`/investigation/${encodeURIComponent(acct)}`);
      onTrace(acct);
    }
  };

  const handleRingClick = () => {
    const acct = (selectedAccount || searchQuery).trim();
    if (acct) {
      setFilterTimestamp(null);
      setTraceMode("ring");
      onRingTrace(acct);
    }
  };

  const handleSyndicateClick = () => {
    if (accountDetail?.syndicate_id && onSyndicateTrace) {
      setFilterTimestamp(null);
      setTraceMode("syndicate");
      onSyndicateTrace(accountDetail.syndicate_id);
    }
  };

  const handleNodeClickInternal = (nodeId: string) => {
    navigate(`/investigation/${encodeURIComponent(nodeId)}`);
    onNodeClick(nodeId);
  };

  // ── One-Click Sub-Dataset Export Handlers (Module C Requirement) ───────────
  const exportTransactionsCsv = () => {
    if (!trailGraph.edges.length) return;
    const headers = ["Transaction_ID", "Sender_Account", "Receiver_Account", "Amount_INR", "Timestamp_Unix", "Timestamp_ISO", "Payment_Mode"];
    const rows = trailGraph.edges.map((e) => [
      e.txn_id ?? e["t.txn_id"] ?? "TXN_UNKNOWN",
      e.from ?? e["a.id"] ?? e.sender_account ?? "",
      e.to ?? e["b.id"] ?? e.receiver_account ?? "",
      e.amount ?? 0,
      e.ts ?? "",
      e.ts ? new Date(e.ts * 1000).toISOString() : "",
      e.mode ?? "IMPS",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `subdataset_transactions_${selectedAccount || "trail"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMenuOpen(false);
  };

  const exportAccountsCsv = () => {
    if (!trailGraph.nodes.length) return;
    const headers = ["Account_ID", "Bank", "Layer", "Mule_Score", "In_Degree", "Out_Degree", "Syndicate_ID", "Syndicate_Role"];
    const rows = trailGraph.nodes.map((n) => [
      n.id ?? n["a.id"] ?? n.account_id ?? "",
      n.bank ?? "",
      n.layer ?? 0,
      n.mule_score ?? 0,
      n.in_degree ?? 0,
      n.out_degree ?? 0,
      n.syndicate_id ?? "",
      n.syndicate_role ?? "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `subdataset_accounts_${selectedAccount || "trail"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMenuOpen(false);
  };

  const exportEvidenceBundleJson = () => {
    const data = {
      investigation_case: "Operation Abhedya-Chakra",
      theme: "Cyber Security & Digital Forensics · Indore Police",
      target_account: selectedAccount,
      mode: traceMode,
      exported_at: new Date().toISOString(),
      nodes_count: trailGraph.nodes.length,
      edges_count: trailGraph.edges.length,
      nodes: trailGraph.nodes,
      edges: trailGraph.edges,
      officer_notes: "Court-ready sub-dataset generated under Section 91 CrPC / BNSS guidelines.",
    };

    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonStr);
    link.setAttribute("download", `forensics_subdataset_${selectedAccount || "trail"}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMenuOpen(false);
  };

  const exportAllEvidencePackage = () => {
    exportTransactionsCsv();
    setTimeout(() => exportAccountsCsv(), 180);
    setTimeout(() => exportEvidenceBundleJson(), 360);
    setExportMenuOpen(false);
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-6rem)] gap-3 ${legalModalOpen ? "print:hidden" : ""}`}>
      {/* Top Investigation Toolbar */}
      <div className="p-3.5 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-wrap items-center justify-between gap-3 flex-shrink-0 print:hidden">
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
                setFilterTimestamp(null);
                setTraceMode("trail");
                const target = selectedAccount || searchQuery;
                if (target) {
                  navigate(`/investigation/${encodeURIComponent(target)}`);
                }
                onTrace();
              }}
              disabled={!isReady || traceRunning}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                traceMode === "trail"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              4-Hop Trail
            </button>

            <button
              onClick={handleRingClick}
              disabled={!isReady || traceRunning || (!selectedAccount && !searchQuery)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                traceMode === "ring"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground disabled:opacity-40"
              }`}
              title="2-Hop Direct Ring Neighborhood"
            >
              2-Hop Ring
            </button>

            {accountDetail?.syndicate_id && (
              <>
                <button
                  onClick={handleSyndicateClick}
                  disabled={!isReady || traceRunning}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1 ${
                    traceMode === "syndicate"
                      ? "bg-amber-500 text-black shadow-sm font-bold"
                      : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                  }`}
                  title={`Isolate full ${accountDetail.syndicate_id} syndicate network`}
                >
                  <Network className="w-3 h-3" />
                  <span>Isolate {accountDetail.syndicate_id}</span>
                </button>

                <button
                  onClick={() => {
                    handleSyndicateClick();
                    setTimeout(() => {
                      exportEvidenceBundleJson();
                    }, 300);
                  }}
                  disabled={!isReady || traceRunning}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold font-sans bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Isolate syndicate ring and immediately export court-ready evidence bundle in 1 click"
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Isolate & Export</span>
                </button>
              </>
            )}
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

          {/* Sub-Dataset Export Dropdown (Module C Requirement) */}
          {trailGraph.nodes.length > 0 && (
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                title="Export Associated Sub-Dataset"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Export Sub-Dataset</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground uppercase border-b border-border/40">
                    Court-Ready Sub-Dataset
                  </div>

                  <button
                    onClick={exportTransactionsCsv}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary flex items-center gap-2.5 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-bold">Transactions CSV</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {trailGraph.edges.length} transfers with amounts & timestamps
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={exportAccountsCsv}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary flex items-center gap-2.5 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    <div>
                      <div className="font-bold">Accounts & Mules CSV</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {trailGraph.nodes.length} accounts with risk scores & layers
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={exportEvidenceBundleJson}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary flex items-center gap-2.5 transition-colors border-t border-border/40 pt-2"
                  >
                    <FileJson className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-bold">Evidence Bundle JSON</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Full digital forensics payload for Section 91
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={exportAllEvidencePackage}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-2.5 transition-colors border-t border-border/40 pt-2"
                  >
                    <Zap className="w-4 h-4 text-primary" />
                    <div>
                      <div className="font-bold text-primary">Download All Forensics (CSV + JSON)</div>
                      <div className="text-[10px] text-primary/80 font-mono">
                        One-click export of complete court evidence package
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Legal AI Officer Button (Module D Requirement) */}
          {(selectedAccount || searchQuery) && (
            <button
              onClick={() => {
                setLegalTargetAccount(selectedAccount || searchQuery);
                setLegalModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-primary/20 cursor-pointer"
              title="Generate Court-Ready Section 91 Notice & Police Case Diary"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Legal AI Officer</span>
            </button>
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
        {/* Left: Graph Canvas with Darker Background & Blur Transition */}
        <div className="flex-1 relative h-full rounded-2xl overflow-hidden border border-border/80 graph-studio-canvas shadow-inner">
          {/* Smooth Blur Wrapper for the Graph Canvas */}
          <div
            className={`w-full h-full ${
              traceRunning ? "graph-canvas-blurred" : "graph-canvas-clear"
            }`}
          >
            {/* Empty / Unloaded Canvas Prompt */}
            {trailGraph.nodes.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
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
                    onClick={() => {
                      const topAcct = topRisk[0].account_id;
                      navigate(`/investigation/${encodeURIComponent(topAcct)}`);
                      onTrace(topAcct);
                    }}
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
                onNodeClick={handleNodeClickInternal}
                highlightedNodes={highlightedNodes}
                sourceAccount={selectedAccount}
                filterTimestamp={filterTimestamp}
              />
            )}

            {/* Temporal Playback Slider (Module C Requirement) */}
            {trailGraph.edges.length > 0 && (
              <TemporalPlaybackSlider
                edges={trailGraph.edges}
                nodes={trailGraph.nodes}
                currentTimestamp={filterTimestamp}
                onTimestampChange={setFilterTimestamp}
                sourceAccount={selectedAccount}
              />
            )}
          </div>

          {/* Minimalist Loading Indicator when Switching Views (No Text) */}
          {traceRunning && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-200">
              <div className="p-3.5 rounded-2xl bg-card/85 backdrop-blur-xl border border-primary/30 shadow-2xl flex items-center justify-center">
                <div className="relative flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <Activity className="w-4 h-4 text-primary absolute animate-pulse" />
                </div>
              </div>
            </div>
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
                navigate(`/investigation/${encodeURIComponent(acct)}`);
                onTrace(acct);
              }}
              onIsolateSyndicate={(synId) => {
                if (onSyndicateTrace) {
                  setFilterTimestamp(null);
                  setTraceMode("syndicate");
                  onSyndicateTrace(synId);
                }
              }}
              onIsolateRing={(acct) => {
                setFilterTimestamp(null);
                setTraceMode("ring");
                onRingTrace(acct);
              }}
              onExportSubdataset={exportEvidenceBundleJson}
              onOpenLegalNotice={(acct) => {
                setLegalTargetAccount(acct);
                setLegalModalOpen(true);
              }}
            />
          </div>
        )}
      </div>

      {/* Module D: Local Legal AI Notice & Police Case Diary Modal */}
      {legalModalOpen && (
        <LegalNoticeModal
          isOpen={legalModalOpen}
          onClose={() => setLegalModalOpen(false)}
          accountId={legalTargetAccount || selectedAccount || searchQuery}
        />
      )}
    </div>
  );
};
