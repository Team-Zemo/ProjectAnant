import React, { useState, useEffect, useRef, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import {
  api,
  type StatusResponse,
  type GraphSnapshot,
  type RiskAccount,
  type AccountStats,
} from "./api/client";
import { Navbar } from "./components/common/Navbar";
import { Sidebar } from "./components/common/Sidebar";
import { OverviewDashboard } from "./features/overview/OverviewDashboard";
import { InvestigationView } from "./features/investigation/InvestigationView";
import { MuleRegistryView } from "./features/mules/MuleRegistryView";
import { PipelineView } from "./features/pipeline/PipelineView";
import { SystemHealthView } from "./features/system/SystemHealthView";
import { QuickTraceModal } from "./components/modals/QuickTraceModal";
import { IngestModal } from "./components/modals/IngestModal";
import type { TraceMode } from "./types";

export default function App() {
  const location = useLocation();

  // Navigation & UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickTraceOpen, setQuickTraceOpen] = useState(false);
  const [ingestModalOpen, setIngestModalOpen] = useState(false);

  // Engine & telemetry state
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [ingestRunning, setIngestRunning] = useState(false);
  const [ingestPct, setIngestPct] = useState(0);

  // Graph and investigation data state
  const [traceMode, setTraceMode] = useState<TraceMode>("trail");
  const [trailGraph, setTrailGraph] = useState<GraphSnapshot>({ nodes: [], edges: [] });
  const [topRisk, setTopRisk] = useState<RiskAccount[]>([]);
  const [totalRiskCount, setTotalRiskCount] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [accountDetail, setAccountDetail] = useState<AccountStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("KKBK10000000");
  const [traceRunning, setTraceRunning] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string> | undefined>(undefined);

  const eventSourceRef = useRef<EventSource | null>(null);

  // ── Trace 4-Hop Money Trail with smooth transition ─────────────────────────
  const handleTrace = useCallback(async (targetAccount?: string) => {
    const acct = (targetAccount || searchQuery).trim();
    if (!acct) return;
    setTraceMode("trail");
    setTraceRunning(true);
    setSelectedAccount(acct);
    setSearchQuery(acct);
    const startTime = Date.now();

    try {
      const [result, detail] = await Promise.all([
        api.trace(acct),
        api.account(acct),
      ]);

      if (result && result.nodes && result.nodes.length > 0) {
        setTrailGraph({ nodes: result.nodes, edges: result.edges || [] });
        const ids = new Set<string>(
          result.nodes.map((n: any) => n.id || n["n.id"] || n["a.id"] || "")
        );
        setHighlightedNodes(ids);
      }
      setAccountDetail(detail);
    } catch (e) {
      console.error("Trace failed:", e);
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 280) {
        await new Promise((r) => setTimeout(r, 280 - elapsed));
      }
      setTraceRunning(false);
    }
  }, [searchQuery]);

  // ── 2-Hop Direct Ring Neighborhood with smooth transition ───────────────────
  const handleRingTrace = useCallback(async (targetAccount: string) => {
    const acct = targetAccount.trim();
    if (!acct) return;
    setTraceMode("ring");
    setTraceRunning(true);
    setSelectedAccount(acct);
    setSearchQuery(acct);
    const startTime = Date.now();

    try {
      const [ringData, detail] = await Promise.all([
        api.ring(acct),
        api.account(acct),
      ]);

      if (ringData && ringData.nodes) {
        setTrailGraph({ nodes: ringData.nodes, edges: ringData.edges || [] });
        const ids = new Set<string>(
          ringData.nodes.map((n: any) => n.id || n["n.id"] || n["a.id"] || "")
        );
        setHighlightedNodes(ids);
      }
      setAccountDetail(detail);
    } catch (e) {
      console.error("Ring trace failed:", e);
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 280) {
        await new Promise((r) => setTimeout(r, 280 - elapsed));
      }
      setTraceRunning(false);
    }
  }, []);

  // ── Node click → trace that account & update detail ─────────────────────────
  const handleNodeClick = (nodeId: string) => {
    setSelectedAccount(nodeId);
    setSearchQuery(nodeId);
    handleTrace(nodeId);
  };

  // ── Refresh Top Risk Accounts List ─────────────────────────────────────────
  const fetchTopRisk = useCallback(async () => {
    try {
      const paged = await api.topRisk(50);
      if (paged && paged.items && paged.items.length > 0) {
        setTopRisk(paged.items);
        setTotalRiskCount(paged.total);
        return paged.items;
      }
    } catch (err) {
      console.warn("Could not fetch top risk accounts:", err);
    }
    return [];
  }, []);

  // ── Trigger On-Demand Mule Scorer Run ───────────────────────────────────────
  const handleTriggerRescore = async () => {
    try {
      await fetch("/api/score/run", { method: "POST" });
      setTimeout(() => {
        fetchTopRisk();
      }, 1500);
    } catch (err) {
      console.error("Rescore trigger error:", err);
    }
  };

  // ── Start Ingest Pipeline via SSE ───────────────────────────────────────────
  const handleStartIngest = async (csvPath?: string) => {
    setIngestRunning(true);
    setIngestPct(0);
    try {
      await api.startIngest(csvPath);
      const es = api.eventsStream((pct) => {
        setIngestPct(pct);
        if (pct >= 100) {
          es.close();
          setIngestRunning(false);
          fetchTopRisk().then((risk) => {
            if (risk && risk.length > 0) {
              const topAcct = risk[0].account_id;
              setSelectedAccount(topAcct);
              setSearchQuery(topAcct);
              handleTrace(topAcct);
            }
          });
        }
      });
      eventSourceRef.current = es;
    } catch (e) {
      setIngestRunning(false);
      console.error("Ingest pipeline failed:", e);
    }
  };

  // ── Poll engine status & auto-trace top risk account on load ────────────────
  useEffect(() => {
    let mounted = true;
    const fetchStatusAndData = async () => {
      try {
        const s = await api.status();
        if (!mounted) return;
        setStatus(s);
        setIngestRunning(s.ingest_running);
        if (s.ingest_pct > 0) setIngestPct(s.ingest_pct);

        if (s.loaded && topRisk.length === 0) {
          const paged = await api.topRisk(50);
          if (!mounted) return;
          if (paged && paged.items && paged.items.length > 0) {
            setTopRisk(paged.items);
            setTotalRiskCount(paged.total);
            if (trailGraph.nodes.length === 0) {
              const targetAcct = selectedAccount || paged.items[0].account_id;
              setSelectedAccount(targetAcct);
              setSearchQuery(targetAcct);
              handleTrace(targetAcct);
            }
          }
        }
      } catch {}
    };

    fetchStatusAndData();
    const intervalId = setInterval(fetchStatusAndData, 2500);
    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, [trailGraph.nodes.length, selectedAccount, topRisk.length, handleTrace]);

  // ── Keyboard shortcut: Ctrl+K / Cmd+K for Quick Trace Modal ────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickTraceOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isReady = status?.loaded ?? false;
  const isInvestigationRoute = location.pathname.startsWith("/investigation");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-soft-orange selection:text-foreground">
      {/* Top Navigation Bar */}
      <Navbar
        status={status}
        ingestRunning={ingestRunning}
        ingestPct={ingestPct}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onOpenIngest={() => setIngestModalOpen(true)}
        onOpenQuickTrace={() => setQuickTraceOpen(true)}
      />

      {/* Main Workspace Layout with Sidebar and Content Outlet */}
      <div className="flex-1 flex overflow-hidden">
        {/* Module Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          topRiskCount={totalRiskCount || topRisk.length}
          selectedAccount={selectedAccount}
          onTraceAccount={(acct) => {
            handleTrace(acct);
          }}
        />

        {/* Content View Outlet */}
        <main
          className={`flex-1 lg:ml-64 p-4 lg:p-6 overflow-y-auto w-full ${
            isInvestigationRoute ? "max-w-none" : "max-w-7xl mx-auto"
          }`}
        >
          {/* React Router Routes */}
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route
              path="/overview"
              element={
                <OverviewDashboard
                  status={status}
                  topRisk={topRisk}
                  onTraceAccount={handleTrace}
                  onOpenIngest={() => setIngestModalOpen(true)}
                  isReady={isReady}
                />
              }
            />
            <Route
              path="/investigation"
              element={
                <InvestigationView
                  trailGraph={trailGraph}
                  selectedAccount={selectedAccount}
                  accountDetail={accountDetail}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  traceRunning={traceRunning}
                  traceMode={traceMode}
                  setTraceMode={setTraceMode}
                  onTrace={handleTrace}
                  onRingTrace={handleRingTrace}
                  onNodeClick={handleNodeClick}
                  highlightedNodes={highlightedNodes}
                  topRisk={topRisk}
                  isReady={isReady}
                  onCloseDetail={() => {
                    setAccountDetail(null);
                    setSelectedAccount(null);
                    setHighlightedNodes(undefined);
                  }}
                />
              }
            />
            <Route
              path="/investigation/:accountId"
              element={
                <InvestigationView
                  trailGraph={trailGraph}
                  selectedAccount={selectedAccount}
                  accountDetail={accountDetail}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  traceRunning={traceRunning}
                  traceMode={traceMode}
                  setTraceMode={setTraceMode}
                  onTrace={handleTrace}
                  onRingTrace={handleRingTrace}
                  onNodeClick={handleNodeClick}
                  highlightedNodes={highlightedNodes}
                  topRisk={topRisk}
                  isReady={isReady}
                  onCloseDetail={() => {
                    setAccountDetail(null);
                    setSelectedAccount(null);
                    setHighlightedNodes(undefined);
                  }}
                />
              }
            />
            <Route
              path="/mules"
              element={
                <MuleRegistryView
                  topRisk={topRisk}
                  totalRiskCount={totalRiskCount}
                  onTraceAccount={handleTrace}
                  onRefreshTopRisk={fetchTopRisk}
                  isReady={isReady}
                />
              }
            />
            <Route
              path="/pipeline"
              element={
                <PipelineView
                  status={status}
                  ingestRunning={ingestRunning}
                  ingestPct={ingestPct}
                  onStartIngest={handleStartIngest}
                  onTriggerRescore={handleTriggerRescore}
                  isReady={isReady}
                />
              }
            />
            <Route
              path="/system"
              element={<SystemHealthView status={status} isReady={isReady} />}
            />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </main>
      </div>

      {/* Global Modals */}
      <QuickTraceModal
        isOpen={quickTraceOpen}
        onClose={() => setQuickTraceOpen(false)}
        onTrace={(acct) => {
          handleTrace(acct);
        }}
        topRiskAccounts={topRisk}
      />

      <IngestModal
        isOpen={ingestModalOpen}
        onClose={() => setIngestModalOpen(false)}
        status={status}
        ingestRunning={ingestRunning}
        ingestPct={ingestPct}
        onStartIngest={handleStartIngest}
        onTriggerRescore={handleTriggerRescore}
      />
    </div>
  );
}
