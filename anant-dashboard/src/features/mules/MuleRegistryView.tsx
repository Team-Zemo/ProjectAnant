import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  Shield,
  Layers,
  Globe,
  Radio,
  Cpu,
  RefreshCw,
  GitBranch,
} from "lucide-react";
import type { RiskAccount, LayerFilter, RiskSeverityFilter, NavTabId } from "../../types";

interface MuleRegistryViewProps {
  topRisk: RiskAccount[];
  onTraceAccount: (accountId: string) => void;
  onNavigateTab?: (tab: NavTabId) => void;
  onRefreshTopRisk: () => void;
  isReady: boolean;
}

export const MuleRegistryView: React.FC<MuleRegistryViewProps> = ({
  topRisk,
  onTraceAccount,
  onNavigateTab,
  onRefreshTopRisk,
  isReady,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState<LayerFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<RiskSeverityFilter>("all");
  const [onlyForeignIp, setOnlyForeignIp] = useState(false);
  const [onlyTerminal, setOnlyTerminal] = useState(false);
  const [onlyScript, setOnlyScript] = useState(false);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return topRisk.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        a.account_id.toLowerCase().includes(q) ||
        (a.bank && a.bank.toLowerCase().includes(q));

      const matchesLayer =
        layerFilter === "all" || String(a.layer ?? 0) === layerFilter;

      const score = Number(a.mule_score ?? 0);
      const matchesSeverity =
        severityFilter === "all"
          ? true
          : severityFilter === "critical"
          ? score >= 70
          : severityFilter === "high"
          ? score >= 40 && score < 70
          : score < 40;

      const matchesForeign = !onlyForeignIp || a.has_foreign_ip;
      const matchesTerminal = !onlyTerminal || a.has_terminal_marker;
      const matchesScript = !onlyScript || a.has_script_device;

      return (
        matchesSearch &&
        matchesLayer &&
        matchesSeverity &&
        matchesForeign &&
        matchesTerminal &&
        matchesScript
      );
    });
  }, [
    topRisk,
    search,
    layerFilter,
    severityFilter,
    onlyForeignIp,
    onlyTerminal,
    onlyScript,
  ]);

  const criticalCount = topRisk.filter((a) => (a.mule_score ?? 0) >= 70).length;
  const highCount = topRisk.filter(
    (a) => (a.mule_score ?? 0) >= 40 && (a.mule_score ?? 0) < 70
  ).length;

  const formatINR = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-destructive/20 text-destructive border border-destructive/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono">
              Risk Registry
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Live DuckDB Index
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground font-sans">
            Mule Account Registry & Behavioral Profiling
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Classified mule syndicate accounts categorized by topological layer and composite AML risk score.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefreshTopRisk}
            className="btn btn-sm rounded-xl font-bold border border-border bg-secondary text-secondary-foreground hover:bg-muted flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Refresh High Risk List"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by account ID or bank..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono outline-none focus:border-primary placeholder:text-muted-foreground"
            />
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-background border border-border text-muted-foreground">
              Showing <strong className="text-foreground">{filteredAccounts.length}</strong> of {topRisk.length}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 font-bold">
              Critical: {criticalCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-warning/10 text-warning border border-warning/20 font-bold">
              High: {highCount}
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
          {/* Layer Filter */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[11px] font-mono mr-1">Layer:</span>
            {(["all", "1", "2", "3"] as LayerFilter[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLayerFilter(lvl)}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition-all cursor-pointer ${
                  layerFilter === lvl
                    ? "bg-primary text-primary-foreground font-bold"
                    : "bg-background border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {lvl === "all" ? "All Layers" : `L${lvl}`}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Severity Filter */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[11px] font-mono mr-1">Score:</span>
            {(["all", "critical", "high"] as RiskSeverityFilter[]).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition-all cursor-pointer capitalize ${
                  severityFilter === sev
                    ? "bg-primary text-primary-foreground font-bold"
                    : "bg-background border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Signal Checkboxes */}
          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={() => setOnlyForeignIp((p) => !p)}
              className={`px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border transition-all cursor-pointer ${
                onlyForeignIp
                  ? "bg-destructive/20 border-destructive/40 text-destructive font-bold"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-3 h-3" /> Foreign IP
            </button>
            <button
              onClick={() => setOnlyTerminal((p) => !p)}
              className={`px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border transition-all cursor-pointer ${
                onlyTerminal
                  ? "bg-primary/20 border-primary/40 text-primary font-bold"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Radio className="w-3 h-3" /> Terminal Exit
            </button>
            <button
              onClick={() => setOnlyScript((p) => !p)}
              className={`px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border transition-all cursor-pointer ${
                onlyScript
                  ? "bg-warning/20 border-warning/40 text-warning font-bold"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cpu className="w-3 h-3" /> Script Device
            </button>
          </div>
        </div>
      </div>

      {/* Mule Registry Table */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
                <th className="py-2.5 px-3">Account ID / Bank</th>
                <th className="py-2.5 px-3">Topology Layer</th>
                <th className="py-2.5 px-3">Mule Score</th>
                <th className="py-2.5 px-3">Inflow / Outflow</th>
                <th className="py-2.5 px-3">Turnover Ratio</th>
                <th className="py-2.5 px-3">In / Out Degree</th>
                <th className="py-2.5 px-3">Behavior Signals</th>
                <th className="py-2.5 px-3 text-right">Investigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAccounts.map((a) => {
                const score = Number(a.mule_score ?? 0);
                const layer = Number(a.layer ?? 0);
                const badgeClass =
                  layer === 1
                    ? "badge-l1"
                    : layer === 2
                    ? "badge-l2"
                    : layer === 3
                    ? "badge-l3"
                    : "badge-clean";

                const passThrough =
                  a.total_in > 0 ? (a.total_out / a.total_in) * 100 : 0;

                return (
                  <tr key={a.account_id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-foreground">
                          {a.account_id}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
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
                      <div className="flex items-center gap-2">
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
                        <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full ${
                              score >= 70
                                ? "bg-destructive"
                                : score >= 40
                                ? "bg-warning"
                                : "bg-success"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-emerald-500 font-semibold">
                          +{formatINR(a.total_in)}
                        </span>
                        <span className="text-rose-500 font-semibold">
                          -{formatINR(a.total_out)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-muted-foreground">
                      {passThrough > 0 ? (
                        <span className={passThrough > 85 ? "text-destructive font-bold" : "text-foreground"}>
                          {passThrough.toFixed(1)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono text-muted-foreground text-[11px]">
                      {a.in_degree ?? 0} in · {a.out_degree ?? 0} out
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
                        className="btn btn-xs rounded-lg font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                      >
                        <GitBranch className="w-3 h-3" />
                        <span>Trace Graph</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    {isReady
                      ? "No accounts match the current filter criteria."
                      : "Dataset not loaded. Click 'Load Dataset' to start."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
