import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Activity,
  AlertTriangle,
  GitBranch,
  Search,
  Zap,
  ArrowRight,
  Shield,
  Layers,
  Database,
  ExternalLink,
} from "lucide-react";
import { StatCard } from "../../components/common/StatCard";
import type { StatusResponse, RiskAccount, NavTabId } from "../../types";

interface OverviewDashboardProps {
  status: StatusResponse | null;
  topRisk: RiskAccount[];
  onTraceAccount: (accountId: string) => void;
  onNavigateTab?: (tab: NavTabId) => void;
  onOpenIngest: () => void;
  isReady: boolean;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  status,
  topRisk,
  onTraceAccount,
  onNavigateTab,
  onOpenIngest,
  isReady,
}) => {
  const [quickSearch, setQuickSearch] = useState("");
  const navigate = useNavigate();

  const criticalCount = topRisk.filter((a) => (a.mule_score ?? 0) >= 70).length;
  const l1Count = topRisk.filter((a) => a.layer === 1).length;
  const l2Count = topRisk.filter((a) => a.layer === 2).length;
  const l3Count = topRisk.filter((a) => a.layer === 3).length;

  const handleQuickTrace = (e: React.FormEvent) => {
    e.preventDefault();
    const acct = quickSearch.trim();
    if (acct) {
      onTraceAccount(acct);
      navigate(`/investigation/${encodeURIComponent(acct)}`);
    }
  };

  const formatINR = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner / Hero */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
              AML Intelligence Center
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Abhedya-Chakra 8.0 Live
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground font-sans">
            Money Laundering & Mule Network Detection
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time graph analytics, multi-hop money flow tracing, and behavioral mule risk scoring.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate("/investigation")}
            className="btn btn-sm rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Launch Graph Studio</span>
          </button>
          {!isReady && (
            <button
              onClick={onOpenIngest}
              className="btn btn-sm rounded-xl font-bold border border-border bg-secondary text-secondary-foreground hover:bg-muted flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Load Dataset</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monitored Accounts"
          value={status?.unique_accounts ? status.unique_accounts.toLocaleString() : "—"}
          description="In-memory accounts indexed"
          icon={Users}
          badgeText={isReady ? "Indexed" : "Pending"}
          badgeType={isReady ? "success" : "warning"}
          colorClass="text-primary"
        />
        <StatCard
          title="Total Transactions"
          value={status?.rows_loaded ? status.rows_loaded.toLocaleString() : "—"}
          description="DuckDB SIMD vector load"
          icon={Activity}
          badgeText="SIMD Engine"
          badgeType="primary"
          colorClass="text-primary"
        />
        <StatCard
          title="Critical Mule Accounts"
          value={topRisk.length > 0 ? criticalCount : "—"}
          description="Risk score ≥ 70/100"
          icon={AlertTriangle}
          badgeText="High Severity"
          badgeType="destructive"
          colorClass="text-destructive"
        />
        <StatCard
          title="Graph Database"
          value={status?.memgraph_ok ? "Connected" : "Offline"}
          description="Memgraph MAGE Cypher"
          icon={Database}
          badgeText={status?.memgraph_ok ? "Live" : "Standby"}
          badgeType={status?.memgraph_ok ? "success" : "destructive"}
          colorClass="text-primary"
        />
      </div>

      {/* Main Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: High Priority Mule Suspects Queue (8 cols) */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-foreground font-sans">
                  High-Priority Mule Suspects
                </h3>
                <span className="text-xs text-muted-foreground">
                  Accounts flagged with highest money laundering risk score
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate("/mules")}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Registry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Suspects Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
                  <th className="py-2.5 px-3">Account / Bank</th>
                  <th className="py-2.5 px-3">Layer</th>
                  <th className="py-2.5 px-3">Risk Score</th>
                  <th className="py-2.5 px-3">Turnover Ratio</th>
                  <th className="py-2.5 px-3">Signals</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topRisk.slice(0, 8).map((a) => {
                  const score = Number(a.mule_score ?? 0);
                  const layer = Number(a.layer ?? 0);
                  const badgeClass =
                    layer === 1 ? "badge-l1" : layer === 2 ? "badge-l2" : layer === 3 ? "badge-l3" : "badge-clean";
                  const passThrough = a.total_in > 0 ? (a.total_out / a.total_in) * 100 : 0;

                  return (
                    <tr key={a.account_id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-foreground">
                            {a.account_id}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {a.bank || "BANK"} · {a.tx_count} txns
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${badgeClass}`}>
                          {layer === 1 ? "L1 Collector" : layer === 2 ? "L2 Layering" : layer === 3 ? "L3 Terminal" : "Clean"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-mono font-bold text-sm ${
                            score >= 70
                              ? "text-destructive"
                              : score >= 40
                              ? "text-warning"
                              : "text-success"
                          }`}
                        >
                          {score.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        {passThrough > 0 ? `${passThrough.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {a.has_foreign_ip && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-mono">
                              Foreign IP
                            </span>
                          )}
                          {a.has_terminal_marker && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
                              Terminal
                            </span>
                          )}
                          {a.has_script_device && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 font-mono">
                              Script
                            </span>
                          )}
                          {!a.has_foreign_ip && !a.has_terminal_marker && !a.has_script_device && (
                            <span className="text-[10px] text-muted-foreground font-mono">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            onTraceAccount(a.account_id);
                            navigate(`/investigation/${encodeURIComponent(a.account_id)}`);
                          }}
                          className="btn btn-xs rounded-lg font-bold bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary border border-primary/20 transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>Trace</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {topRisk.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {isReady ? "Calculating risk scores..." : "Dataset not loaded. Click 'Load Dataset' to start."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Quick Trace Box & Layer Architecture (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Quick Trace Card */}
          <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              <h3 className="font-extrabold text-sm text-foreground font-sans">
                Quick Money Trail Search
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Directly input any account number to render its 4-hop money flow graph.
            </p>

            <form onSubmit={handleQuickTrace} className="flex flex-col gap-2.5">
              <input
                type="text"
                placeholder="e.g. KKBK10000000"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground font-mono outline-none focus:border-primary placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="btn btn-sm rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Investigate Money Trail</span>
              </button>
            </form>
          </div>

          {/* Layer Hierarchy Breakdown */}
          <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="font-extrabold text-sm text-foreground font-sans">
                  AML Layer Hierarchy
                </h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                4-Stage Model
              </span>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                  <span className="font-medium text-foreground">Clean Senders / Inflows</span>
                </div>
                <span className="font-mono text-muted-foreground text-[11px]">Upstream Source</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                  <span className="font-medium text-foreground">L1 Collector Mules</span>
                </div>
                <span className="font-mono text-destructive text-[11px] font-bold">
                  {l1Count > 0 ? `${l1Count} accts` : "Aggregator"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="font-medium text-foreground">L2 Layering / Distributors</span>
                </div>
                <span className="font-mono text-warning text-[11px] font-bold">
                  {l2Count > 0 ? `${l2Count} accts` : "Pass-Through"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
                  <span className="font-medium text-foreground">L3 Terminal Exit Mules</span>
                </div>
                <span className="font-mono text-primary text-[11px] font-bold">
                  {l3Count > 0 ? `${l3Count} accts` : "Crypto / P2P"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
