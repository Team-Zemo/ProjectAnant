import React, { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import { Sigma } from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { GraphNode, GraphEdge } from "../api/client";
import { ZoomIn, ZoomOut, Maximize2, Play, Pause, Compass } from "lucide-react";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  highlightedNodes?: Set<string>;
  sourceAccount?: string | null;
}

// Layer → color mapping
const LAYER_COLORS: Record<number, string> = {
  0: "#38bdf8",   // Clean Senders / Inflows — sky blue
  1: "#ef4444",   // L1 Collector — bright red
  2: "#eab308",   // L2 Layering / Distributor — amber
  3: "#a855f7",   // L3 Terminal (Crypto/P2P) — purple
};


function formatAmount(amt: number): string {
  if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
  if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
  if (amt >= 1000) return `₹${(amt / 1000).toFixed(0)}K`;
  return `₹${amt.toFixed(0)}`;
}

export default function TransactionGraph({
  nodes,
  edges,
  onNodeClick,
  highlightedNodes,
  sourceAccount,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef     = useRef<Sigma | null>(null);
  const graphRef     = useRef<Graph | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isPhysicsRunning, setIsPhysicsRunning] = useState<boolean>(false);
  const animFrameRef = useRef<number | null>(null);

  // Helper: Apply directional horizontal force (Inflows -> Left, Outflows -> Right)
  const applyDirectionalForces = (g: Graph, targetId: string) => {
    const senders = new Set<string>();
    const receivers = new Set<string>();
    const downstream = new Set<string>();

    for (const e of edges) {
      const u = e.from ?? e["a.id"] ?? e.sender_account ?? "";
      const v = e.to   ?? e["b.id"] ?? e.receiver_account ?? "";
      if (v === targetId) senders.add(u);
      else if (u === targetId) receivers.add(v);
    }

    for (const e of edges) {
      const u = e.from ?? e["a.id"] ?? e.sender_account ?? "";
      const v = e.to   ?? e["b.id"] ?? e.receiver_account ?? "";
      if (receivers.has(u) && v !== targetId) downstream.add(v);
    }

    // Apply soft horizontal magnetic attraction
    g.forEachNode((node, attr) => {
      let x = attr.x ?? 0;
      let y = attr.y ?? 0;

      if (node === targetId) {
        // Target anchored near center
        x = x * 0.7;
        y = y * 0.7;
      } else if (senders.has(node)) {
        // Tend toward left (-200)
        x = x + (-220 - x) * 0.15;
      } else if (receivers.has(node)) {
        // Tend toward right (+220)
        x = x + (220 - x) * 0.15;
      } else if (downstream.has(node)) {
        // Tend further right (+400)
        x = x + (400 - x) * 0.15;
      }

      g.setNodeAttribute(node, "x", x);
      g.setNodeAttribute(node, "y", y);
    });
  };

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    // Create graphology directed multi-graph
    const g = new Graph({ type: "directed", multi: true });

    const targetId = sourceAccount || (nodes[0]?.id ?? nodes[0]?.["a.id"] ?? nodes[0]?.account_id ?? "");

    // ─────────────────────────────────────────────────────────────────────────
    // 1. CLASSIFY NODES (INCOMING SENDERS VS OUTGOING RECEIVERS)
    // ─────────────────────────────────────────────────────────────────────────
    const senders = new Set<string>();
    const directReceivers = new Set<string>();
    const downstreamReceivers = new Set<string>();

    for (const e of edges) {
      const u = e.from ?? e["a.id"] ?? e.sender_account ?? "";
      const v = e.to   ?? e["b.id"] ?? e.receiver_account ?? "";
      if (v === targetId) {
        senders.add(u);
      } else if (u === targetId) {
        directReceivers.add(v);
      }
    }

    for (const e of edges) {
      const u = e.from ?? e["a.id"] ?? e.sender_account ?? "";
      const v = e.to   ?? e["b.id"] ?? e.receiver_account ?? "";
      if (directReceivers.has(u) && v !== targetId) {
        downstreamReceivers.add(v);
      }
    }

    const senderList = nodes.filter(n => senders.has(n.id ?? n["a.id"] ?? n.account_id ?? ""));
    const receiverList = nodes.filter(n => directReceivers.has(n.id ?? n["a.id"] ?? n.account_id ?? ""));
    const downstreamList = nodes.filter(n => downstreamReceivers.has(n.id ?? n["a.id"] ?? n.account_id ?? ""));
    const otherList = nodes.filter(n => {
      const id = n.id ?? n["a.id"] ?? n.account_id ?? "";
      return id !== targetId && !senders.has(id) && !directReceivers.has(id) && !downstreamReceivers.has(id);
    });
    const targetNode = nodes.find(n => (n.id ?? n["a.id"] ?? n.account_id ?? "") === targetId);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. FREE-FLOATING 2D PLACEMENT WITH DIRECTIONAL TENDENCY
    // ─────────────────────────────────────────────────────────────────────────
    // Target Account in Center (0, 0)
    if (targetNode) {
      const id = targetNode.id ?? targetNode["a.id"] ?? targetNode.account_id ?? "";
      const isVictim = Boolean(targetNode.is_victim || (targetNode.layer === 0 && targetNode.is_victim));
      g.addNode(id, {
        label: isVictim ? `${id} (Victim) ★` : `${id} ★`,
        x: 0,
        y: 0,
        size: 16,
        color: isVictim ? "#f97316" : (LAYER_COLORS[targetNode.layer ?? 1] ?? "#38bdf8"),
        bank: targetNode.bank ?? "",
        layer: targetNode.layer ?? (isVictim ? 0 : 2),
        isTarget: true,
        isVictim,
      });
    }

    // Inflow Senders in Left Half-Plane (X < 0)
    senderList.forEach((n, idx) => {
      const id = n.id ?? n["a.id"] ?? n.account_id ?? "";
      if (!id || g.hasNode(id)) return;
      const count = senderList.length;
      const angle = Math.PI - 0.7 + (idx / Math.max(1, count - 1 || 1)) * 1.4 + (Math.random() - 0.5) * 0.2;
      const r = 160 + (Math.random() - 0.5) * 60;
      const isVictim = Boolean(n.is_victim || (n.layer === 0 && n.is_victim));

      g.addNode(id, {
        label: isVictim ? `[Victim] ${id}` : `${id}`,
        x: Math.cos(angle) * r - 40,
        y: Math.sin(angle) * r,
        size: isVictim ? 13 : 11,
        color: isVictim ? "#f97316" : "#38bdf8",
        bank: n.bank ?? "",
        layer: 0,
        isVictim,
      });
    });

    // Outflow Receivers in Right Half-Plane (X > 0)
    receiverList.forEach((n, idx) => {
      const id = n.id ?? n["a.id"] ?? n.account_id ?? "";
      if (!id || g.hasNode(id)) return;
      const count = receiverList.length;
      const angle = -0.7 + (idx / Math.max(1, count - 1 || 1)) * 1.4 + (Math.random() - 0.5) * 0.2;
      const r = 160 + (Math.random() - 0.5) * 60;
      const score = Number(n.mule_score ?? 0);
      const layer = Number(n.layer ?? 3);

      g.addNode(id, {
        label: `${id}`,
        x: Math.cos(angle) * r + 40,
        y: Math.sin(angle) * r,
        size: 9 + (score / 100) * 4,
        color: LAYER_COLORS[layer] ?? "#a855f7",
        bank: n.bank ?? "",
        layer,
      });
    });

    // Downstream Receivers (Far Right)
    downstreamList.forEach((n, idx) => {
      const id = n.id ?? n["a.id"] ?? n.account_id ?? "";
      if (!id || g.hasNode(id)) return;
      const count = downstreamList.length;
      const angle = -0.6 + (idx / Math.max(1, count - 1 || 1)) * 1.2 + (Math.random() - 0.5) * 0.3;
      const r = 320 + (Math.random() - 0.5) * 80;
      const score = Number(n.mule_score ?? 0);
      const layer = Number(n.layer ?? 3);

      g.addNode(id, {
        label: `${id}`,
        x: Math.cos(angle) * r + 60,
        y: Math.sin(angle) * r,
        size: 8 + (score / 100) * 3,
        color: LAYER_COLORS[layer] ?? "#a855f7",
        bank: n.bank ?? "",
        layer,
      });
    });

    // Any remaining connected nodes
    otherList.forEach((n, idx) => {
      const id = n.id ?? n["a.id"] ?? n.account_id ?? "";
      if (!id || g.hasNode(id)) return;
      const angle = (idx / Math.max(1, otherList.length)) * 2 * Math.PI;
      const r = 250 + (Math.random() - 0.5) * 50;

      g.addNode(id, {
        label: id,
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        size: 8,
        color: "#64748b",
        bank: n.bank ?? "",
        layer: 0,
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ADD DIRECTED EDGES
    // ─────────────────────────────────────────────────────────────────────────
    for (const e of edges) {
      const from = e.from ?? e["a.id"] ?? e.sender_account ?? "";
      const to   = e.to   ?? e["b.id"] ?? e.receiver_account ?? "";

      if (!from || !to || !g.hasNode(from) || !g.hasNode(to)) continue;

      const amt = Number(e.amount ?? 0);
      const isIncoming = (to === targetId);
      const isOutgoing = (from === targetId);

      const prefix = isIncoming ? "+" : isOutgoing ? "-" : "";
      const amtStr = `${prefix}${formatAmount(amt)}`;

      // Distinct edge colors
      const edgeColor = isIncoming
        ? "rgba(0, 212, 170, 0.85)"   // Inflows: Vibrant Emerald Green
        : isOutgoing
        ? "rgba(239, 68, 68, 0.85)"    // Outflows: Intense Crimson Red
        : "rgba(168, 85, 247, 0.65)";  // Downstream: Purple

      try {
        g.addEdge(from, to, {
          label: amtStr,
          size: 2.2,
          color: edgeColor,
          type: "arrow",
          amount: amt,
          ts: e.ts,
          mode: e.mode,
        });
      } catch {}
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. RELAX WITH FORCEATLAS2 + DIRECTIONAL BIAS (FREE-FLOATING YET TENDED)
    // ─────────────────────────────────────────────────────────────────────────
    if (g.order > 1) {
      try {
        for (let iter = 0; iter < 4; iter++) {
          forceAtlas2.assign(g, {
            iterations: 25,
            settings: {
              gravity: 0.55,
              scalingRatio: 24,
              adjustSizes: true,
              barnesHutOptimize: true,
              strongGravityMode: false,
              outboundAttractionDistribution: true,
              slowDown: 1.8,
            },
          });
          applyDirectionalForces(g, targetId);
        }
      } catch (err) {
        console.warn("ForceAtlas2 error:", err);
      }
    }

    graphRef.current = g;

    // Destroy previous Sigma instance if existing
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. INITIALIZE SIGMA
    // ─────────────────────────────────────────────────────────────────────────
    const sigma = new Sigma(g, containerRef.current, {
      renderEdgeLabels: true,
      defaultEdgeType: "arrow",
      defaultNodeType: "circle",
      stagePadding: 70,
      itemSizesReference: "screen", // Screen pixel sizes
      zoomToSizeRatioFunction: (x) => Math.sqrt(x),
      labelFont: "JetBrains Mono, monospace",
      labelSize: 11,
      labelColor: { color: "#f8fafc" },
      labelDensity: 0.8,
      labelGridCellSize: 50,
      defaultEdgeColor: "rgba(56, 189, 248, 0.5)",
      edgeLabelFont: "Plus Jakarta Sans, sans-serif",
      edgeLabelSize: 9,
      edgeLabelColor: { color: "#cbd5e1" },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 6. INTERACTIVE NODE DRAGGING (CLICK & DRAG ANY NODE FREELY)
    // ─────────────────────────────────────────────────────────────────────────
    let draggedNode: string | null = null;
    let isDragging = false;

    sigma.on("downNode", (e) => {
      isDragging = true;
      draggedNode = e.node;
      if (containerRef.current) containerRef.current.style.cursor = "grabbing";
    });

    sigma.getMouseCaptor().on("mousemovebody", (e) => {
      if (!isDragging || !draggedNode) return;
      const pos = sigma.viewportToGraph(e);
      g.setNodeAttribute(draggedNode, "x", pos.x);
      g.setNodeAttribute(draggedNode, "y", pos.y);

      // Prevent camera from panning while dragging node
      e.preventSigmaDefault();
      e.original.preventDefault();
      e.original.stopPropagation();
    });

    sigma.getMouseCaptor().on("mouseup", () => {
      if (draggedNode) {
        isDragging = false;
        draggedNode = null;
        if (containerRef.current) containerRef.current.style.cursor = "default";
      }
    });

    // Hover interactions
    sigma.on("enterNode", ({ node }) => setHoveredNode(node));
    sigma.on("leaveNode", () => setHoveredNode(null));

    // Click node → select & re-trace
    sigma.on("clickNode", ({ node }) => {
      onNodeClick?.(node);
    });

    // Auto-fit camera view
    sigma.getCamera().animatedReset({ duration: 400 });

    sigmaRef.current = sigma;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [nodes, edges, sourceAccount]);

  // ─────────────────────────────────────────────────────────────────────────
  // 7. LIVE PHYSICS TOGGLE
  // ─────────────────────────────────────────────────────────────────────────
  const toggleLivePhysics = () => {
    if (!graphRef.current) return;
    const nextState = !isPhysicsRunning;
    setIsPhysicsRunning(nextState);

    const targetId = sourceAccount || (nodes[0]?.id ?? nodes[0]?.["a.id"] ?? nodes[0]?.account_id ?? "");

    if (nextState) {
      const step = () => {
        if (!graphRef.current) return;
        try {
          forceAtlas2.assign(graphRef.current, {
            iterations: 1,
            settings: {
              gravity: 0.45,
              scalingRatio: 22,
              barnesHutOptimize: true,
              slowDown: 3.2,
            },
          });
          applyDirectionalForces(graphRef.current, targetId);
          sigmaRef.current?.refresh();
        } catch {}
        animFrameRef.current = requestAnimationFrame(step);
      };
      animFrameRef.current = requestAnimationFrame(step);
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    }
  };

  // Re-relax physics once
  const relaxGraphOnce = () => {
    if (!graphRef.current) return;
    const targetId = sourceAccount || (nodes[0]?.id ?? nodes[0]?.["a.id"] ?? nodes[0]?.account_id ?? "");
    try {
      for (let iter = 0; iter < 3; iter++) {
        forceAtlas2.assign(graphRef.current, {
          iterations: 20,
          settings: {
            gravity: 0.55,
            scalingRatio: 24,
            barnesHutOptimize: true,
            slowDown: 1.8,
          },
        });
        applyDirectionalForces(graphRef.current, targetId);
      }
      sigmaRef.current?.refresh();
      sigmaRef.current?.getCamera().animatedReset({ duration: 300 });
    } catch {}
  };

  // Hover highlighting: dim non-neighbors
  useEffect(() => {
    if (!sigmaRef.current || !graphRef.current) return;
    const g = graphRef.current;

    if (hoveredNode && g.hasNode(hoveredNode)) {
      const neighbors = new Set(g.neighbors(hoveredNode));
      neighbors.add(hoveredNode);
      sigmaRef.current.setSetting("nodeReducer", (node, data) => ({
        ...data,
        color: neighbors.has(node) ? data.color : "#151d2f",
        size:  neighbors.has(node) ? data.size * 1.25 : data.size * 0.45,
        label: neighbors.has(node) ? data.label : "",
      }));
      sigmaRef.current.setSetting("edgeReducer", (edge, data) => {
        const src = g.source(edge), tgt = g.target(edge);
        const active = neighbors.has(src) && neighbors.has(tgt);
        return {
          ...data,
          color: active ? "rgba(0, 212, 170, 0.95)" : "rgba(56, 139, 253, 0.05)",
          size: active ? 3.0 : 0.5,
          hidden: !active,
        };
      });
    } else {
      sigmaRef.current.setSetting("nodeReducer", null);
      sigmaRef.current.setSetting("edgeReducer", null);
    }

    sigmaRef.current.refresh();
  }, [hoveredNode]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>

      {/* Floating Canvas Controls */}
      <div style={{
        position: "absolute", bottom: 16, right: 16,
        display: "flex", flexDirection: "column", gap: 6, zIndex: 10
      }}>
        <button
          title={isPhysicsRunning ? "Pause Live Floating Simulation" : "Start Live Floating Simulation"}
          onClick={toggleLivePhysics}
          style={{
            background: isPhysicsRunning ? "rgba(0, 212, 170, 0.25)" : "rgba(15, 23, 42, 0.85)",
            border: isPhysicsRunning ? "1px solid #00d4aa" : "1px solid rgba(255,255,255,0.12)",
            color: isPhysicsRunning ? "#00d4aa" : "#e2e8f0",
            borderRadius: 8, padding: 8, cursor: "pointer", display: "flex",
            backdropFilter: "blur(12px)"
          }}
        >
          {isPhysicsRunning ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          title="Float / Re-Relax Physics Layout"
          onClick={relaxGraphOnce}
          style={{
            background: "rgba(15, 23, 42, 0.85)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#e2e8f0", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex",
            backdropFilter: "blur(12px)"
          }}
        >
          <Compass size={16} />
        </button>
        <button
          title="Zoom In"
          onClick={() => sigmaRef.current?.getCamera().animatedZoom({ factor: 1.4, duration: 250 })}
          style={{
            background: "rgba(15, 23, 42, 0.85)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#e2e8f0", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex",
            backdropFilter: "blur(12px)"
          }}
        >
          <ZoomIn size={16} />
        </button>
        <button
          title="Zoom Out"
          onClick={() => sigmaRef.current?.getCamera().animatedUnzoom({ factor: 1.4, duration: 250 })}
          style={{
            background: "rgba(15, 23, 42, 0.85)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#e2e8f0", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex",
            backdropFilter: "blur(12px)"
          }}
        >
          <ZoomOut size={16} />
        </button>
        <button
          title="Reset View"
          onClick={() => sigmaRef.current?.getCamera().animatedReset({ duration: 400 })}
          style={{
            background: "rgba(15, 23, 42, 0.85)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#e2e8f0", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex",
            backdropFilter: "blur(12px)"
          }}
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
