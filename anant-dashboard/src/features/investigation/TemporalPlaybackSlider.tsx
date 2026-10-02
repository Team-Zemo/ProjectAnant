import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Clock,
  Activity,
  Layers,
  Sparkles,
  Eye,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { GraphEdge, GraphNode } from "../../api/client";

interface TemporalPlaybackSliderProps {
  edges: GraphEdge[];
  nodes: GraphNode[];
  currentTimestamp: number | null;
  onTimestampChange: (ts: number | null) => void;
  sourceAccount?: string | null;
}

export const TemporalPlaybackSlider: React.FC<TemporalPlaybackSliderProps> = ({
  edges,
  nodes,
  currentTimestamp,
  onTimestampChange,
  sourceAccount,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(5); // 1x, 5x, 20x, 60x
  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Extract min and max timestamp from edges
  const { minTs, maxTs, validEdges } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    const valid: GraphEdge[] = [];

    for (const e of edges) {
      const ts = Number(e.ts ?? 0);
      if (ts > 0) {
        valid.push(e);
        if (ts < min) min = ts;
        if (ts > max) max = ts;
      }
    }

    if (min === Infinity || max === -Infinity) {
      return { minTs: 0, maxTs: 0, validEdges: [] };
    }

    return { minTs: min, maxTs: max, validEdges: valid };
  }, [edges]);

  const hasTimeline = minTs > 0 && maxTs > minTs;

  // Active timestamp (fallback to maxTs if null, representing "Show All")
  const activeTs = currentTimestamp ?? maxTs;

  // Calculate statistics up to activeTs
  const stats = useMemo(() => {
    let volume = 0;
    let txCount = 0;
    const activeNodes = new Set<string>();

    for (const e of validEdges) {
      const ts = Number(e.ts ?? 0);
      if (ts <= activeTs) {
        volume += Number(e.amount ?? 0);
        txCount++;
        const u = e.from ?? e["a.id"] ?? e.sender_account ?? "";
        const v = e.to ?? e["b.id"] ?? e.receiver_account ?? "";
        if (u) activeNodes.add(u);
        if (v) activeNodes.add(v);
      }
    }

    const totalVolume = validEdges.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    const progressPct = validEdges.length > 0 ? (txCount / validEdges.length) * 100 : 100;

    return {
      volume,
      totalVolume,
      txCount,
      totalTx: validEdges.length,
      activeNodesCount: activeNodes.size,
      progressPct,
    };
  }, [validEdges, activeTs]);

  // Formatter for timestamp
  const formatDateTime = (ts: number) => {
    if (!ts) return "—";
    const date = new Date(ts * 1000);
    return date.toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatRelativeTime = (ts: number) => {
    if (!ts || !minTs) return "Initial Inflow";
    const diffSec = ts - minTs;
    if (diffSec <= 0) return "T+0m (Theft Genesis)";
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `T+${days}d ${hours % 24}h ${mins}m`;
    }
    if (hours > 0) {
      return `T+${hours}h ${mins}m`;
    }
    return `T+${mins}m ${diffSec % 60}s`;
  };

  const formatCurrency = (amt: number) => {
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(2)} L`;
    return `₹${Math.round(amt).toLocaleString("en-IN")}`;
  };

  // Animation Loop for Playback
  useEffect(() => {
    if (!isPlaying || !hasTimeline) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTickRef.current = Date.now();

    const tick = () => {
      const now = Date.now();
      const elapsedMs = now - lastTickRef.current;
      lastTickRef.current = now;

      // Span duration in seconds across the 15-day window
      const totalSpan = maxTs - minTs;
      // Advance by (totalSpan / 25 seconds) * multiplier
      const stepSec = Math.max(30, (totalSpan / 30) * (elapsedMs / 1000) * (speedMultiplier / 5));

      const nextTs = (currentTimestamp ?? minTs) + stepSec;

      if (nextTs >= maxTs) {
        onTimestampChange(maxTs);
        setIsPlaying(false);
      } else {
        onTimestampChange(nextTs);
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, currentTimestamp, minTs, maxTs, speedMultiplier, hasTimeline, onTimestampChange]);

  if (!hasTimeline) return null;

  const isFiltered = currentTimestamp !== null && currentTimestamp < maxTs;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onTimestampChange(val >= maxTs ? null : val);
  };

  const handleResetToStart = () => {
    setIsPlaying(false);
    onTimestampChange(minTs);
  };

  const handleShowAll = () => {
    setIsPlaying(false);
    onTimestampChange(null);
  };

  const handleStep = (direction: -1 | 1) => {
    const cur = currentTimestamp ?? maxTs;
    // Step by 1/20th of timeline or at least 10 minutes
    const stepSize = Math.max(600, (maxTs - minTs) / 20);
    const next = Math.max(minTs, Math.min(maxTs, cur + direction * stepSize));
    onTimestampChange(next >= maxTs ? null : next);
  };

  if (isCollapsed) {
    return (
      <div className="absolute bottom-3 left-3 z-20 pointer-events-auto">
        <button
          onClick={() => setIsCollapsed(false)}
          className="px-3 py-2 rounded-xl bg-card/95 hover:bg-card backdrop-blur-xl border border-border shadow-xl text-xs font-mono font-semibold flex items-center gap-2.5 transition-all text-foreground cursor-pointer group"
          title="Expand Temporal Propagation Slider"
        >
          <div className="p-1 rounded-md bg-primary/15 text-primary group-hover:scale-105 transition-transform">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span>Temporal Scrubber</span>
          <span className="text-primary font-bold">{formatRelativeTime(activeTs)}</span>
          <span className="text-muted-foreground text-[10px]">({stats.progressPct.toFixed(0)}%)</span>
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-auto">
      <div className="rounded-2xl bg-card/90 hover:bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl p-3 sm:p-4 space-y-3 transition-all duration-300">
        {/* Top Header: Title, Telemetry & Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/15 text-primary border border-primary/20">
              <Clock className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground font-mono">
                  TEMPORAL PROPAGATION SLIDER
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                    isFiltered
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  }`}
                >
                  {isFiltered ? "SCRUBBING ACTIVE" : "FULL TIMELINE LIVE"}
                </span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{formatDateTime(activeTs)}</span>
                <span className="text-border">·</span>
                <span className="text-primary font-bold">{formatRelativeTime(activeTs)}</span>
              </div>
            </div>
          </div>

          {/* Running Propagation Stats & Controls */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="hidden sm:block text-right">
              <div className="text-[10px] uppercase text-muted-foreground">Volume Laundered</div>
              <div className="font-bold text-emerald-400">
                {formatCurrency(stats.volume)}{" "}
                <span className="text-muted-foreground text-[10px]">
                  / {formatCurrency(stats.totalVolume)}
                </span>
              </div>
            </div>

            <div className="hidden md:block text-right">
              <div className="text-[10px] uppercase text-muted-foreground">Hops Executed</div>
              <div className="font-bold text-foreground">
                {stats.txCount} <span className="text-muted-foreground text-[10px]">/ {stats.totalTx} txns</span>
              </div>
            </div>

            {isFiltered ? (
              <button
                onClick={handleShowAll}
                className="px-2.5 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Show All</span>
              </button>
            ) : (
              <button
                onClick={handleResetToStart}
                className="px-2.5 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Start Replay</span>
              </button>
            )}

            {/* Minimize / Collapse Button */}
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-border/60"
              title="Minimize Temporal Scrubber"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Slider Bar */}
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <input
              type="range"
              min={minTs}
              max={maxTs}
              step={Math.max(60, (maxTs - minTs) / 200)}
              value={activeTs}
              onChange={handleSliderChange}
              className="w-full h-2 rounded-lg bg-muted appearance-none cursor-pointer accent-primary focus:outline-none transition-all"
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground px-0.5">
            <span>{formatDateTime(minTs)} (Theft Start)</span>
            <span className="text-primary font-bold">
              {stats.progressPct.toFixed(0)}% Propagation Complete
            </span>
            <span>{formatDateTime(maxTs)} (Latest Cashout)</span>
          </div>
        </div>

        {/* Bottom Bar: Player Controls & Speed Selector */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* Controls: Play/Pause/Steps */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleStep(-1)}
              className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Step Backward (1 hr)"
            >
              <Rewind className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (!isPlaying && activeTs >= maxTs) {
                  onTimestampChange(minTs);
                }
                setIsPlaying(!isPlaying);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>{activeTs >= maxTs ? "Replay" : "Play Trail"}</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleStep(1)}
              className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Step Forward (1 hr)"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Multiplier Pills */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/30">
            <span className="text-[10px] font-mono text-muted-foreground px-1.5 hidden sm:inline">
              Speed:
            </span>
            {[1, 5, 20, 60].map((s) => (
              <button
                key={s}
                onClick={() => setSpeedMultiplier(s)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all ${
                  speedMultiplier === s
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
