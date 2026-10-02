import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  RefreshCw,
  GitBranch,
  Globe,
  Radio,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
  ArrowUpDown,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import type { RiskAccount, LayerFilter, RiskSeverityFilter, NavTabId } from "../../types";
import { api } from "../../api/client";

interface MuleRegistryViewProps {
  topRisk?: RiskAccount[];
  totalRiskCount?: number;
  onTraceAccount: (accountId: string) => void;
  onNavigateTab?: (tab: NavTabId) => void;
  onRefreshTopRisk: () => void;
  isReady: boolean;
}

export const MuleRegistryView: React.FC<MuleRegistryViewProps> = ({
  topRisk = [],
  totalRiskCount = 0,
  onTraceAccount,
  onNavigateTab,
  onRefreshTopRisk,
  isReady,
}) => {
  const navigate = useNavigate();

  // ── Pagination State ────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(totalRiskCount || (topRisk.length ? 24873 : 0));
  const [totalPages, setTotalPages] = useState(1);
  const [accounts, setAccounts] = useState<RiskAccount[]>(topRisk);
  const [loading, setLoading] = useState(false);

  // ── Filter State ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState<LayerFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<RiskSeverityFilter>("all");
  const [onlyForeignIp, setOnlyForeignIp] = useState(false);
  const [onlyTerminal, setOnlyTerminal] = useState(false);
  const [onlyScript, setOnlyScript] = useState(false);

  // ── Auto Scroll State ──────────────────────────────────────────────────────
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<"1x" | "2x" | "3x">("1x");
  const [isHovered, setIsHovered] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState("");

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableTopRef = useRef<HTMLDivElement>(null);

  // Debounce search input by 250ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
  const handleLayerChange = (lvl: LayerFilter) => {
    setLayerFilter(lvl);
    setPage(1);
  };

  const handleSeverityChange = (sev: RiskSeverityFilter) => {
    setSeverityFilter(sev);
    setPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  // ── Fetch paged accounts from backend ──────────────────────────────────────
  const fetchPage = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    try {
      let min_score: number | undefined;
      let max_score: number | undefined;
      if (severityFilter === "critical") {
        min_score = 70.0;
      } else if (severityFilter === "high") {
        min_score = 40.0;
        max_score = 69.99;
      } else if (severityFilter === "low") {
        max_score = 39.99;
      }

      const res = await api.topRisk({
        page,
        limit: pageSize,
        search: debouncedSearch,
        layer: layerFilter !== "all" ? layerFilter : undefined,
        min_score,
        max_score,
        foreign_ip: onlyForeignIp || undefined,
        terminal: onlyTerminal || undefined,
        script: onlyScript || undefined,
      });

      if (res && res.items) {
        setAccounts(res.items);
        setTotalCount(res.total);
        setTotalPages(res.total_pages || Math.ceil(res.total / pageSize) || 1);
      }
    } catch (e) {
      console.warn("Failed to fetch paged risk accounts:", e);
    } finally {
      setLoading(false);
    }
  }, [
    isReady,
    page,
    pageSize,
    debouncedSearch,
    layerFilter,
    severityFilter,
    onlyForeignIp,
    onlyTerminal,
    onlyScript,
  ]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // ── Smooth auto-scroll to top when page changes ────────────────────────────
  const scrollToTableTop = useCallback(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const changePage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    scrollToTableTop();
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      changePage(p);
      setJumpPageInput("");
    }
  };

  // ── Interactive Auto Scroll Loop ───────────────────────────────────────────
  useEffect(() => {
    if (!autoScroll || isHovered) return;

    const speedMap = { "1x": 28, "2x": 65, "3x": 130 };
    const pxPerSec = speedMap[scrollSpeed];

    let lastTime = performance.now();
    let animId: number;

    const step = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const container = tableContainerRef.current;
      if (container) {
        container.scrollTop += pxPerSec * dt;

        // Check if reached bottom of the scroll container
        const atBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 8;

        if (atBottom) {
          setPage((prevPage) => {
            if (prevPage < totalPages) {
              container.scrollTop = 0;
              return prevPage + 1;
            } else {
              // Loop back to page 1 when reaching last page
              container.scrollTop = 0;
              return 1;
            }
          });
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [autoScroll, scrollSpeed, isHovered, totalPages]);

  // Currency formatter
  const formatINR = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  // Pagination range calculations
  const startRow = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endRow = Math.min(page * pageSize, totalCount);

  // Generate numeric page pills (window of 5 around current)
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col gap-6" ref={tableTopRef}>
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-destructive/20 text-destructive border border-destructive/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono">
              Risk Registry
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Live DuckDB Paged Index
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground font-sans">
            Mule Account Registry & Behavioral Profiling
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Classified mule syndicate accounts sorted by composite AML risk score. Browse full index with live pagination & auto-scroll.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Auto Scroll Toggle */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background border border-border shadow-sm">
            <button
              onClick={() => setAutoScroll((p) => !p)}
              className={`btn btn-xs rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                autoScroll
                  ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
              title={autoScroll ? "Pause continuous auto-scroll" : "Start continuous auto-scroll"}
            >
              {autoScroll ? (
                <>
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Auto-Scroll: ON</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping ml-0.5" />
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Auto-Scroll</span>
                </>
              )}
            </button>

            {autoScroll && (
              <div className="flex items-center gap-1 pl-1 border-l border-border">
                {(["1x", "2x", "3x"] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setScrollSpeed(spd)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${
                      scrollSpeed === spd
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {spd}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              onRefreshTopRisk();
              fetchPage();
            }}
            disabled={loading}
            className="btn btn-sm rounded-xl font-bold border border-border bg-secondary text-secondary-foreground hover:bg-muted flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh High Risk List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
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

          {/* Real Total Count Badges */}
          <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-background border border-border text-muted-foreground">
              Showing <strong className="text-foreground">{startRow}–{endRow}</strong> of{" "}
              <strong className="text-primary">{totalCount.toLocaleString()}</strong> accounts
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-background border border-border text-muted-foreground">
              Page <strong className="text-foreground">{page}</strong> of{" "}
              <strong className="text-foreground">{totalPages.toLocaleString()}</strong>
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
                onClick={() => handleLayerChange(lvl)}
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
                onClick={() => handleSeverityChange(sev)}
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
          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            <button
              onClick={() => {
                setOnlyForeignIp((p) => !p);
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border transition-all cursor-pointer ${
                onlyForeignIp
                  ? "bg-destructive/20 border-destructive/40 text-destructive font-bold"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-3 h-3" /> Foreign IP
            </button>
            <button
              onClick={() => {
                setOnlyTerminal((p) => !p);
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border transition-all cursor-pointer ${
                onlyTerminal
                  ? "bg-primary/20 border-primary/40 text-primary font-bold"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Radio className="w-3 h-3" /> Terminal Exit
            </button>
            <button
              onClick={() => {
                setOnlyScript((p) => !p);
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border transition-all cursor-pointer ${
                onlyScript
                  ? "bg-warning/20 border-warning/40 text-warning font-bold"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cpu className="w-3 h-3" /> Script Device
            </button>
          </div>

          {/* Hover Status Indicator for Auto Scroll */}
          {autoScroll && isHovered && (
            <div className="ml-auto text-[11px] font-mono text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
              <span>Auto-scroll paused (hovering table)</span>
            </div>
          )}
        </div>
      </div>

      {/* Mule Registry Table Container */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-4">
        {/* Table scroll container */}
        <div
          ref={tableContainerRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="overflow-x-auto max-h-[620px] overflow-y-auto scroll-smooth relative rounded-xl border border-border/40"
        >
          {loading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border shadow-lg text-xs font-mono text-primary font-bold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading page {page}...</span>
              </div>
            </div>
          )}

          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 border-b border-border">
              <tr className="text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
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
              {accounts.map((a) => {
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
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-foreground">
                            {a.account_id}
                          </span>
                          {a.syndicate_id && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              {a.syndicate_id}
                            </span>
                          )}
                        </div>
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

              {!loading && accounts.length === 0 && (
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

        {/* ── Proper Pagination Navigation Bar ─────────────────────────────── */}
        <div className="pt-2 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono">
          {/* Left: Rows Per Page & Range */}
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              Rows per page:
            </span>
            <div className="flex items-center gap-1">
              {[25, 50, 100, 200].map((sz) => (
                <button
                  key={sz}
                  onClick={() => handlePageSizeChange(sz)}
                  className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition-all cursor-pointer ${
                    pageSize === sz
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-background border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
            <span className="text-border">|</span>
            <span className="text-muted-foreground">
              Total: <strong className="text-foreground">{totalCount.toLocaleString()}</strong>
            </span>
          </div>

          {/* Center: Numeric Page Navigation */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              onClick={() => changePage(1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-background cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Prev Page */}
            <button
              onClick={() => changePage(page - 1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-background cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Page Number Pills */}
            <div className="flex items-center gap-1 px-1">
              {pageNumbers.map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <button
                    key={`page-${p}`}
                    onClick={() => changePage(p)}
                    disabled={loading}
                    className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      page === p
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            {/* Next Page */}
            <button
              onClick={() => changePage(page + 1)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-background cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => changePage(totalPages)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-background cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Direct Jump to Page */}
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px]">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              placeholder={String(page)}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              className="w-14 px-2 py-1 text-xs rounded-lg bg-background border border-border text-foreground font-mono outline-none focus:border-primary text-center"
            />
            <button
              type="submit"
              disabled={!jumpPageInput || loading}
              className="px-2.5 py-1 text-xs rounded-lg font-bold bg-secondary text-secondary-foreground hover:bg-muted border border-border transition-colors cursor-pointer disabled:opacity-40"
            >
              Go
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
