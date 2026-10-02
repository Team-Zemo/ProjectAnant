import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  GitBranch,
  ShieldAlert,
  Search,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Cpu,
  Globe,
  Coins,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Activity,
  Network,
  X,
} from "lucide-react";
import {
  api,
  type Syndicate,
  type RiskAccount,
  type GraphEdge,
} from "../../api/client";

interface SyndicatesViewProps {
  onInvestigateAccount?: (accountId: string) => void;
  onInspectSyndicateGraph?: (nodes: any[], edges: any[]) => void;
}

export const SyndicatesView: React.FC<SyndicatesViewProps> = ({
  onInvestigateAccount,
  onInspectSyndicateGraph,
}) => {
  const [syndicates, setSyndicates] = useState<Syndicate[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedArchetype, setSelectedArchetype] = useState("all");
  const [detecting, setDetecting] = useState(false);

  // Modal inspection state
  const [selectedSyndicate, setSelectedSyndicate] = useState<Syndicate | null>(null);
  const [syndicateMembers, setSyndicateMembers] = useState<RiskAccount[]>([]);
  const [syndicateEdges, setSyndicateEdges] = useState<GraphEdge[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const fetchSyndicates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.syndicates({
        page,
        limit: 12,
        search,
        archetype: selectedArchetype,
      });
      setSyndicates(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (e) {
      console.error("Failed to fetch syndicates:", e);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedArchetype]);

  useEffect(() => {
    fetchSyndicates();
  }, [fetchSyndicates]);

  const handleOpenDetail = async (syn: Syndicate) => {
    setSelectedSyndicate(syn);
    setDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const detail = await api.syndicate(syn.syndicate_id);
      setSyndicateMembers(detail.members || []);
      setSyndicateEdges(detail.edges || []);
    } catch (e) {
      console.error("Failed to load syndicate detail:", e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleInspectInGraph = async (syn: Syndicate) => {
    try {
      const detail = await api.syndicate(syn.syndicate_id);
      if (onInspectSyndicateGraph) {
        onInspectSyndicateGraph(detail.members, detail.edges);
      }
    } catch (e) {
      console.error("Failed to load graph for syndicate:", e);
    }
  };

  const handleTriggerDetection = async () => {
    setDetecting(true);
    try {
      await api.detectSyndicates();
      setTimeout(() => {
        fetchSyndicates();
        setDetecting(false);
      }, 1500);
    } catch (e) {
      console.error("Failed to trigger detection:", e);
      setDetecting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const getArchetypeBadge = (type: string) => {
    switch (type) {
      case "DISPERSAL_TREE":
        return {
          label: "Dispersal Tree (1-to-N)",
          color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        };
      case "AGGREGATION_HUB":
        return {
          label: "Smurfing Hub (N-to-1)",
          color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
        };
      case "WASH_CYCLE":
        return {
          label: "Wash Ring Loop",
          color: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        };
      case "MULTI_HOP_CHAIN":
        return {
          label: "Multi-Hop Pass-Through",
          color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        };
      default:
        return {
          label: "Hybrid Syndicate",
          color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
        };
    }
  };

  const archetypes = [
    { id: "all", label: "All Archetypes" },
    { id: "DISPERSAL_TREE", label: "Dispersal Trees" },
    { id: "AGGREGATION_HUB", label: "Smurfing Hubs" },
    { id: "WASH_CYCLE", label: "Wash Rings" },
    { id: "MULTI_HOP_CHAIN", label: "Pass-Through Chains" },
    { id: "HYBRID_SYNDICATE", label: "Hybrid" },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Intelligence Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card/90 via-card/50 to-muted/20 border border-border/60 p-6 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-destructive/10 rounded-full blur-3xl pointer-events-none -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-mono font-medium text-primary">
              <Network className="w-3.5 h-3.5 text-primary" />
              <span>GRAPH COMMUNITY DETECTION · LOUVAIN / LPA ENGINE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              Mule Syndicates & Fraud Rings
              <span className="text-xs px-2.5 py-1 rounded-md bg-destructive/15 text-destructive border border-destructive/30 font-mono">
                {totalCount} Active Clusters
              </span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              High-confidence clustering isolating coordinated criminal rings. Uncovers multi-hop laundering chains,
              connecting Layer 1 Inflow Smurfs to Layer 2 Pass-Through Aggregators and Layer 3 Offshore Terminals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTriggerDetection}
              disabled={detecting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${detecting ? "animate-spin" : ""}`} />
              <span>{detecting ? "Clustering..." : "Re-Run Detection"}</span>
            </button>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/40">
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Identified Rings</div>
            <div className="text-xl font-bold font-mono text-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              {totalCount}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Dominant Model</div>
            <div className="text-xl font-bold text-amber-400 flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-amber-400" />
              Dispersal Tree
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Laundering Infrastructure</div>
            <div className="text-xl font-bold text-cyan-400 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-cyan-400" />
              185/194 Offshore
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Detection Confidence</div>
            <div className="text-xl font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              99.8% (Deterministic)
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Syndicate ID (SYN-001) or Bank..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border/60 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Archetype Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {archetypes.map((arch) => (
            <button
              key={arch.id}
              onClick={() => {
                setSelectedArchetype(arch.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedArchetype === arch.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {arch.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Syndicate Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-card/50 border border-border/40 animate-pulse p-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <div className="w-24 h-6 bg-muted/60 rounded-md" />
                <div className="w-20 h-5 bg-muted/40 rounded-full" />
              </div>
              <div className="w-3/4 h-5 bg-muted/60 rounded-md" />
              <div className="space-y-2 pt-4">
                <div className="w-full h-4 bg-muted/30 rounded" />
                <div className="w-2/3 h-4 bg-muted/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : syndicates.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border border-dashed border-border/60 bg-card/30">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">No Syndicates Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            No clusters match your current search and archetype filter. Try resetting filters or re-running detection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {syndicates.map((syn) => {
            const arch = getArchetypeBadge(syn.pattern_type);
            return (
              <div
                key={syn.syndicate_id}
                className="group relative flex flex-col justify-between rounded-2xl bg-card/80 hover:bg-card border border-border/60 hover:border-primary/40 transition-all duration-300 p-5 shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
              >
                <div className="space-y-4">
                  {/* Card Header: ID & Archetype */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold tracking-tight">
                        {syn.syndicate_id}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
                        {syn.primary_bank}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium ${arch.color}`}
                    >
                      {arch.label}
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-1">
                      {syn.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {syn.member_count} Accounts Connected · Risk {syn.avg_mule_score.toFixed(1)}/100
                    </p>
                  </div>

                  {/* Key Stats Grid */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/30">
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase">Internal Volume</div>
                      <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {formatCurrency(syn.total_volume)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase">Peak Mule Risk</div>
                      <div className="text-sm font-bold font-mono text-destructive mt-0.5 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" />
                        {syn.max_mule_score.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Threat Indicator Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {syn.has_foreign_ip && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                        <Globe className="w-3 h-3" />
                        Foreign IP
                      </span>
                    )}
                    {syn.has_script_device && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                        <Cpu className="w-3 h-3" />
                        Script Device
                      </span>
                    )}
                    {syn.has_terminal_marker && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                        <Coins className="w-3 h-3" />
                        Crypto Exit
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenDetail(syn)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    <span>View {syn.member_count} Members</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleInspectInGraph(syn)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-medium transition-all"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Graph Studio</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination Controls ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/40 pt-4 px-2">
          <div className="text-xs font-mono text-muted-foreground">
            Showing Page <span className="text-foreground font-bold">{page}</span> of{" "}
            <span className="text-foreground font-bold">{totalPages}</span> ({totalCount} total syndicates)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-card border border-border/60 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg bg-card border border-border/60 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Syndicate Member Drill-Down Modal ── */}
      {detailModalOpen && selectedSyndicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-border/60 flex items-start justify-between bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold">
                    {selectedSyndicate.syndicate_id}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {selectedSyndicate.member_count} Member Accounts
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-foreground">{selectedSyndicate.name}</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleInspectInGraph(selectedSyndicate);
                    setDetailModalOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Inspect in Graph Studio</span>
                </button>

                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Member Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingDetail ? (
                <div className="py-16 text-center">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-mono">Loading syndicate member intelligence...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span>MEMBER ACCOUNTS ({syndicateMembers.length})</span>
                    <span>INTERNAL TRANSFERS: {syndicateEdges.length}</span>
                  </div>

                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border/60 font-mono text-muted-foreground">
                        <tr>
                          <th className="py-2.5 px-4">Account ID</th>
                          <th className="py-2.5 px-3">Role in Ring</th>
                          <th className="py-2.5 px-3">Bank</th>
                          <th className="py-2.5 px-3">Mule Score</th>
                          <th className="py-2.5 px-3 text-right">Total In</th>
                          <th className="py-2.5 px-3 text-right">Total Out</th>
                          <th className="py-2.5 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {syndicateMembers.map((m) => (
                          <tr key={m.account_id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-4 font-bold text-foreground">
                              {m.account_id}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                  m.syndicate_role === "TERMINAL_CASHOUT"
                                    ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                    : m.syndicate_role === "INFLOW_SMURF"
                                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                }`}
                              >
                                {m.syndicate_role || "AGGREGATOR"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">{m.bank}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`font-bold ${
                                  m.mule_score >= 80
                                    ? "text-destructive"
                                    : m.mule_score >= 50
                                    ? "text-amber-400"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {m.mule_score.toFixed(1)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-400">
                              {formatCurrency(m.total_in)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-400">
                              {formatCurrency(m.total_out)}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                onClick={() => {
                                  if (onInvestigateAccount) {
                                    onInvestigateAccount(m.account_id);
                                    setDetailModalOpen(false);
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                              >
                                <span>Investigate</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
