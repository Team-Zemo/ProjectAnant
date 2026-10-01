import React, { useState, useEffect, useRef } from "react";
import { api, type StatusResponse, type GraphSnapshot, type RiskAccount, type AccountStats } from "./api/client";
import TransactionGraph from "./components/TransactionGraph";
import { Search, Shield, Zap, AlertTriangle, FileText, Activity, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [ingestRunning, setIngestRunning] = useState(false);
  const [ingestPct, setIngestPct] = useState(0);

  const [trailGraph, setTrailGraph] = useState<GraphSnapshot>({ nodes: [], edges: [] });
  const [topRisk, setTopRisk] = useState<RiskAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [accountDetail, setAccountDetail] = useState<AccountStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("KKBK10000000");
  const [traceRunning, setTraceRunning] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string> | undefined>(undefined);

  const [legalOpen, setLegalOpen] = useState(false);
  const [legalGenerating, setLegalGenerating] = useState(false);
  const [legalResult, setLegalResult] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // ── Trace 4-Hop Money Trail ────────────────────────────────────────────────
  const handleTrace = async (targetAccount?: string) => {
    const acct = (targetAccount || searchQuery).trim();
    if (!acct) return;
    setTraceRunning(true);
    setSelectedAccount(acct);
    try {
      const [result, detail] = await Promise.all([
        api.trace(acct),
        api.account(acct)
      ]);

      if (result && result.nodes && result.nodes.length > 0) {
        setTrailGraph({ nodes: result.nodes, edges: result.edges || [] });
        const ids = new Set<string>(result.nodes.map((n: any) => n.id || n["n.id"] || n["a.id"] || ""));
        setHighlightedNodes(ids);
      }
      setAccountDetail(detail);
    } catch (e) {
      console.error("Trace failed:", e);
    }
    setTraceRunning(false);
  };

  // ── Poll system status & auto-trace top risk account on load ────────────────
  useEffect(() => {
    let mounted = true;
    const fetchStatusAndData = async () => {
      try {
        const s = await api.status();
        if (!mounted) return;
        setStatus(s);
        setIngestRunning(s.ingest_running);
        if (s.ingest_pct > 0) setIngestPct(s.ingest_pct);

        if (s.loaded && trailGraph.nodes.length === 0) {
          const risk = await api.topRisk(50);
          if (!mounted) return;
          if (risk && risk.length > 0) {
            setTopRisk(risk);
            const targetAcct = selectedAccount || risk[0].account_id;
            setSelectedAccount(targetAcct);
            setSearchQuery(targetAcct);
            handleTrace(targetAcct);
          }
        }
      } catch {}
    };

    fetchStatusAndData();
    const id = setInterval(fetchStatusAndData, 2000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [trailGraph.nodes.length, selectedAccount]);

  // ── Start Ingest Pipeline ───────────────────────────────────────────────────
  const handleIngest = async () => {
    setIngestRunning(true);
    setIngestPct(0);
    try {
      await api.startIngest();
      const es = api.eventsStream((pct) => {
        setIngestPct(pct);
        if (pct >= 100) {
          es.close();
          setIngestRunning(false);
          // Auto trace highest risk mule account
          api.topRisk(50).then((risk) => {
            setTopRisk(risk);
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
      console.error(e);
    }
  };

  // ── Node click → trace that account & update detail ───────────────────────
  const handleNodeClick = async (nodeId: string) => {
    setSelectedAccount(nodeId);
    setSearchQuery(nodeId);
    handleTrace(nodeId);
  };

  // ── Legal generation ───────────────────────────────────────────────────────
  const handleGenerate = async (type: "fir" | "freeze") => {
    if (!selectedAccount) return;
    setLegalGenerating(true);
    setLegalResult(null);
    try {
      const result = await api.generateLegal(selectedAccount, type);
      setLegalResult(result.pdf_url);
    } catch (e) {
      console.error(e);
    }
    setLegalGenerating(false);
  };

  const riskColor = (score: number) =>
    score >= 70 ? "red" : score >= 40 ? "amber" : "green";

  const formatINR = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const isReady = status?.loaded ?? false;

  return (
    <div className="app-layout">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-logo">
          <Shield size={20} />
          Project Anant · Abhedya-Chakra
        </div>

        <div style={{ fontSize: 12, color: "var(--text-muted)", borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
          VoidHacks 8.0 · In-Memory AML Graph & Mule Detection
        </div>

        <div className="header-status">
          <span className={`status-dot ${status?.memgraph_ok ? "" : "red"}`} />
          Memgraph {status?.memgraph_ok ? "Connected" : "Offline"}

          <span style={{ margin: "0 8px", color: "var(--border)" }}>|</span>

          <span className={`status-dot ${isReady ? "" : ingestRunning ? "amber" : "red"}`} />
          {isReady ? (
            <>{status?.rows_loaded?.toLocaleString()} rows · {status?.unique_accounts?.toLocaleString()} accounts</>
          ) : ingestRunning ? (
            `Ingesting... ${ingestPct}%`
          ) : (
            "Not loaded"
          )}

          {!isReady && (
            <button
              className="btn btn-primary"
              style={{ marginLeft: 12, padding: "5px 12px" }}
              onClick={handleIngest}
              disabled={ingestRunning}
            >
              <Zap size={12} />
              {ingestRunning ? "Loading..." : "Load Dataset"}
            </button>
          )}
        </div>
      </header>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className="sidebar">

        {/* Search / Trace Box */}
        <div className="card">
          <div className="card-title"><Search size={12} /> Victim Account 4-Hop Trail</div>
          <div className="search-wrap" style={{ marginBottom: 8 }}>
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder="e.g. KKBK10000000"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTrace()}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => handleTrace()}
            disabled={traceRunning || !isReady}
          >
            <Activity size={12} />
            {traceRunning ? "Tracing Money Trail..." : "Trace 4-Hop Trail"}
          </button>
        </div>

        {/* Ingest progress bar */}
        {ingestRunning && (
          <div className="card fade-in">
            <div className="card-title"><RefreshCw size={12} /> Ingestion & Scoring</div>
            <div className="progress-wrap">
              <div className="progress-label">
                <span>DuckDB + Memgraph</span>
                <span>{ingestPct}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${ingestPct}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* High Risk Accounts List */}
        <div className="card" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span><AlertTriangle size={12} /> High Risk Accounts</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Score ≥ 50</span>
          </div>
          <div style={{ overflow: "auto", flex: 1 }}>
            {topRisk.map(a => {
              const score = Number(a.mule_score ?? 0);
              const layer = Number(a.layer ?? 0);
              const layerClass = layer === 1 ? "l1" : layer === 2 ? "l2" : layer === 3 ? "l3" : "clean";
              const layerText = layer === 1 ? "L1" : layer === 2 ? "L2" : layer === 3 ? "L3" : "—";

              return (
                <div
                  key={a.account_id}
                  className={`account-item ${selectedAccount === a.account_id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedAccount(a.account_id);
                    setSearchQuery(a.account_id);
                    handleTrace(a.account_id);
                  }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                    <span className={`layer-badge ${layerClass}`} style={{ fontSize: 9, padding: "1px 5px" }}>
                      {layerText}
                    </span>
                    <span className="account-id" style={{ fontSize: 11 }}>{a.account_id}</span>
                  </div>

                  <span style={{
                    fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 700,
                    color: score >= 70 ? "var(--l1-color)" : score >= 40 ? "var(--l2-color)" : "var(--risk-low)"
                  }}>
                    {score.toFixed(1)}
                  </span>
                </div>
              );
            })}
            {topRisk.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 20 }}>
                {isReady ? "Calculating risk scores..." : "Click 'Load Dataset' to start"}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── GRAPH VIEW ────────────────────────────────────────────────────────── */}
      <main className="graph-area">
        {/* Loading overlay */}
        {ingestRunning && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-blue)" }}>
                Processing 2,000,000 Transactions
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
                DuckDB SIMD Ingest → Mule Risk Scoring → Memgraph MAGE
              </div>
              <div style={{ marginTop: 20, width: 280 }}>
                <div className="progress-wrap">
                  <div className="progress-label">
                    <span>Progress</span><span>{ingestPct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${ingestPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!ingestRunning && trailGraph.nodes.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", gap: 16,
            color: "var(--text-muted)"
          }}>
            <Shield size={64} strokeWidth={1} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-secondary)" }}>
              No money trail loaded
            </div>
            <div style={{ fontSize: 13 }}>
              Enter an account ID or click "Load Dataset" to trace money flow
            </div>
            {isReady && (
              <button
                className="btn btn-primary"
                onClick={() => handleTrace(topRisk[0]?.account_id || searchQuery)}
                style={{ marginTop: 12 }}
              >
                <Zap size={14} style={{ marginRight: 6 }} />
                Trace Top Mule Account
              </button>
            )}
          </div>
        )}

        {trailGraph.nodes.length > 0 && (
          <TransactionGraph
            nodes={trailGraph.nodes}
            edges={trailGraph.edges}
            onNodeClick={handleNodeClick}
            highlightedNodes={highlightedNodes}
            sourceAccount={selectedAccount}
          />
        )}

        {/* Stats overlay */}
        {trailGraph.nodes.length > 0 && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(10,15,30,0.88)",
            border: "1px solid rgba(56,139,253,0.25)",
            borderRadius: 10, padding: "8px 16px",
            display: "flex", alignItems: "center", gap: 16, backdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            zIndex: 10
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Nodes</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono", color: "var(--accent-blue)" }}>
                {trailGraph.nodes.length.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Edges</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono", color: "var(--accent-cyan)" }}>
                {trailGraph.edges.length.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── RIGHT PANEL: MULE RISK INDEX & METRICS ──────────────────────────── */}
      <aside className="right-panel">

        {accountDetail ? (
          <>
            {/* Account Header */}
            <div className="panel-section">
              <div className="panel-section-title">
                <span>Account Intelligence</span>
                <button className="btn btn-ghost" style={{ padding: "2px 6px" }}
                  onClick={() => { setAccountDetail(null); setSelectedAccount(null); setHighlightedNodes(undefined); }}>
                  ✕
                </button>
              </div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 14, fontWeight: 700, color: "var(--text-code)", wordBreak: "break-all", marginBottom: 8 }}>
                {accountDetail.account_id}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="layer-badge l1">{accountDetail.bank || "BANK"}</span>
                {accountDetail.has_foreign_ip && <span className="layer-badge l3">Foreign IP (185.x / 194.x)</span>}
                {accountDetail.has_terminal_marker && <span className="layer-badge l3">Crypto/P2P Terminal</span>}
                {accountDetail.has_script_device && <span className="layer-badge l2">Emulator/Script</span>}
              </div>
            </div>

            {/* Mule Risk Index Meter */}
            <div className="panel-section">
              <div className="panel-section-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Mule Risk Index</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  color: (accountDetail.mule_score ?? 0) >= 70 ? "var(--l1-color)" : (accountDetail.mule_score ?? 0) >= 40 ? "var(--l2-color)" : "var(--clean-color)"
                }}>
                  {(accountDetail.mule_score ?? 0) >= 70 ? "CRITICAL MULE" : (accountDetail.mule_score ?? 0) >= 40 ? "SUSPECT MULE" : "LOW RISK"}
                </span>
              </div>
              <div className="risk-score-bar" style={{ marginBottom: 12 }}>
                <div className={`risk-score-value ${riskColor(accountDetail.mule_score ?? 0)}`} style={{ fontSize: 28 }}>
                  {(accountDetail.mule_score ?? 0).toFixed(1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>/ 100 Risk Score</div>
                  <div className="progress-bar" style={{ marginTop: 6, height: 6 }}>
                    <div className="progress-fill" style={{
                      width: `${Math.min(100, Math.max(0, accountDetail.mule_score ?? 0))}%`,
                      background: (accountDetail.mule_score ?? 0) >= 70
                        ? "linear-gradient(90deg, #ff4444, #ff2200)"
                        : (accountDetail.mule_score ?? 0) >= 40
                        ? "linear-gradient(90deg, #ff9900, #ff5500)"
                        : "linear-gradient(90deg, #388bfd, #00d4aa)"
                    }} />
                  </div>
                </div>
              </div>

              {/* Risk Scoring Factors Breakdown */}
              <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Pass-Through Velocity:</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {accountDetail.total_in > 0 ? `${((accountDetail.total_out / accountDetail.total_in) * 100).toFixed(1)}%` : "0%"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>In-Degree (Collector):</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {accountDetail.in_degree ? `${accountDetail.in_degree} distinct senders` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Out-Degree (Distributor):</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {accountDetail.out_degree ? `${accountDetail.out_degree} distinct receivers` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Terminal Exit Marker:</span>
                  <span style={{ fontWeight: 600, color: accountDetail.has_terminal_marker ? "var(--l3-color)" : "var(--text-muted)" }}>
                    {accountDetail.has_terminal_marker ? "DETECTED" : "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Activity Summary */}
            <div className="panel-section">
              <div className="panel-section-title">Financial Flow</div>
              <div className="stat-row">
                <div className="stat-item">
                  <div className="stat-label">Total Inflow</div>
                  <div className="stat-value green">{formatINR(accountDetail.total_in)}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Total Outflow</div>
                  <div className="stat-value red">{formatINR(accountDetail.total_out)}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Transactions</div>
                  <div className="stat-value">{accountDetail.tx_count?.toLocaleString()}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Turnover Ratio</div>
                  <div className="stat-value">
                    {accountDetail.total_in > 0
                      ? `${((accountDetail.total_out / accountDetail.total_in) * 100).toFixed(1)}%`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Transaction Ledger */}
            {accountDetail.transactions && accountDetail.transactions.length > 0 && (
              <div className="panel-section" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div className="panel-section-title">Recent Transactions ({accountDetail.transactions.length})</div>
                <div style={{ overflow: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {accountDetail.transactions.slice(0, 15).map((t: any) => {
                    const isOut = t.sender_account === accountDetail.account_id;
                    return (
                      <div key={t.txn_id} style={{
                        background: "var(--bg-elevated)", padding: "8px 10px", borderRadius: 6,
                        display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11
                      }}>
                        <div>
                          <div style={{ fontFamily: "JetBrains Mono", color: "var(--text-code)", fontSize: 10 }}>{t.txn_id}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 9 }}>
                            {isOut ? `→ ${t.receiver_account}` : `← ${t.sender_account}`} · {t.payment_mode}
                          </div>
                        </div>
                        <div style={{
                          fontFamily: "JetBrains Mono", fontWeight: 700,
                          color: isOut ? "var(--l1-color)" : "var(--accent-cyan)"
                        }}>
                          {isOut ? "-" : "+"}{formatINR(t.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legal Documents (Collapsed / Optional as requested) */}
            <div className="panel-section" style={{ borderBottom: "none" }}>
              <div 
                className="panel-section-title" 
                style={{ cursor: "pointer", display: "flex", justifyContent: "space-between" }}
                onClick={() => setLegalOpen(!legalOpen)}
              >
                <span><FileText size={12} style={{ display: "inline", marginRight: 4 }} />Legal Generation (Optional)</span>
                {legalOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {legalOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <button
                    className="btn btn-danger"
                    style={{ justifyContent: "center" }}
                    onClick={() => handleGenerate("freeze")}
                    disabled={legalGenerating}
                  >
                    <FileText size={12} />
                    {legalGenerating ? "Generating..." : "Section 91 Freeze Notice"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ justifyContent: "center", border: "1px solid var(--border)" }}
                    onClick={() => handleGenerate("fir")}
                    disabled={legalGenerating}
                  >
                    <FileText size={12} />
                    {legalGenerating ? "Generating..." : "Police Case Diary"}
                  </button>
                  {legalResult && (
                    <a
                      href={legalResult}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                      style={{ justifyContent: "center" }}
                    >
                      Download Notice PDF
                    </a>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            <Activity size={32} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
              Select an Account
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Click any node in the graph or select from the High Risk list to view Mule Risk breakdown
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
