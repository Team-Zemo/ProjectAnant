import React, { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import { Sigma } from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { GraphNode, GraphEdge } from "../../api/client";
import { ZoomIn, ZoomOut, Maximize2, Play, Pause, Compass } from "lucide-react";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  highlightedNodes?: Set<string>;
  sourceAccount?: string | null;
}

// Layer → color mapping aligned with OKLCH AML tokens
const LAYER_COLORS: Record<number, string> = {
  0: "#38bdf8",   // Clean Senders / Inflows — sky blue
  1: "#ef4444",   // L1 Collector — bright red
  2: "#f59e0b",   // L2 Layering / Distributor — amber
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
        x = x * 0.7;
        y = y * 0.7;
      } else if (senders.has(node)) {
        x = x + (-220 - x) * 0.15;
      } else if (receivers.has(node)) {
        x = x + (220 - x) * 0.15;
      } else if (downstream.has(node)) {
        x = x + (400 - x) * 0.15;
      }

      g.setNodeAttribute(node, "x", x);
      g.setNodeAttribute(node, "y", y);
    });
  };

  useEffect(() => {
    // Reset live physics simulation state whenever graph data or target account changes
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPhysicsRunning(false);

    if (!containerRef.current || nodes.length === 0) return;

    // Create graphology directed multi-graph
    const g = new Graph({ type: "directed", multi: true });

    const targetId = sourceAccount || (nodes[0]?.id ?? nodes[0]?.["a.id"] ?? nodes[0]?.account_id ?? "");

    // 1. CLASSIFY NODES (INCOMING SENDERS VS OUTGOING RECEIVERS)
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

    // 2. FREE-FLOATING 2D PLACEMENT WITH DIRECTIONAL TENDENCY
    if (targetNode) {
      const id = targetNode.id ?? targetNode["a.id"] ?? targetNode.account_id ?? "";
      g.addNode(id, {
        label: `${id} ★`,
        x: 0,
        y: 0,
        size: 16,
        color: "#38bdf8",
        bank: targetNode.bank ?? "",
        layer: targetNode.layer ?? 2,
        isTarget: true,
      });
    }

    // Inflow Senders in Left Half-Plane (X < 0)
    senderList.forEach((n, idx) => {
      const id = n.id ?? n["a.id"] ?? n.account_id ?? "";
      if (!id || g.hasNode(id)) return;
      const count = senderList.length;
      const angle = Math.PI - 0.7 + (idx / Math.max(1, count - 1 || 1)) * 1.4 + (Math.random() - 0.5) * 0.2;
      const r = 160 + (Math.random() - 0.5) * 60;

      g.addNode(id, {
        label: `${id}`,
        x: Math.cos(angle) * r - 40,
        y: Math.sin(angle) * r,
        size: 11,
        color: "#38bdf8",
        bank: n.bank ?? "",
        layer: 0,
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

    // Other connected nodes
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

    // 3. ADD DIRECTED EDGES
    for (const e of edges) {
      const from = e.from ?? e["a.id"] ?? e.sender_account ?? "";
      const to   = e.to   ?? e["b.id"] ?? e.receiver_account ?? "";

      if (!from || !to || !g.hasNode(from) || !g.hasNode(to)) continue;

      const amt = Number(e.amount ?? 0);
      const isIncoming = (to === targetId);
      const isOutgoing = (from === targetId);

      const prefix = isIncoming ? "+" : isOutgoing ? "-" : "";
      const amtStr = `${prefix}${formatAmount(amt)}`;

      const edgeColor = isIncoming
        ? "rgba(16, 185, 129, 0.88)"   // Inflows: Vibrant Emerald Green
        : isOutgoing
        ? "rgba(239, 68, 68, 0.88)"    // Outflows: Intense Crimson Red
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

    // 4. RELAX WITH FORCEATLAS2 + DIRECTIONAL BIAS
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

    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }

    // 5. INITIALIZE SIGMA
    const sigma = new Sigma(g, containerRef.current, {
      renderEdgeLabels: true,
      defaultEdgeType: "arrow",
      defaultNodeType: "circle",
      stagePadding: 70,
      itemSizesReference: "screen",
      zoomToSizeRatioFunction: (x) => Math.sqrt(x),
      labelFont: "JetBrains Mono, monospace",
      labelSize: 11,
      labelColor: { color: "#ffffff" },
      labelDensity: 0.8,
      labelGridCellSize: 50,
      defaultEdgeColor: "rgba(56, 189, 248, 0.5)",
      edgeLabelFont: "Plus Jakarta Sans, sans-serif",
      edgeLabelSize: 9,
      edgeLabelColor: { color: "#e2e8f0" },
    });

    // 6. INTERACTIVE NODE DRAGGING
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

    sigma.on("enterNode", ({ node }) => setHoveredNode(node));
    sigma.on("leaveNode", () => setHoveredNode(null));

    sigma.on("clickNode", ({ node }) => {
      onNodeClick?.(node);
    });

    sigma.getCamera().animatedReset({ duration: 400 });
    sigmaRef.current = sigma;

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [nodes, edges, sourceAccount]);

  // 7. LIVE PHYSICS TOGGLE
  const toggleLivePhysics = () => {
    if (!graphRef.current) return;
    const nextState = !isPhysicsRunning;
    setIsPhysicsRunning(nextState);

    const targetId = sourceAccount || (nodes[0]?.id ?? nodes[0]?.["a.id"] ?? nodes[0]?.account_id ?? "");

    if (nextState) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
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
        color: neighbors.has(node) ? data.color : "#0f172a",
        size:  neighbors.has(node) ? data.size * 1.25 : data.size * 0.45,
        label: neighbors.has(node) ? data.label : "",
      }));
      sigmaRef.current.setSetting("edgeReducer", (edge, data) => {
        const src = g.source(edge), tgt = g.target(edge);
        const active = neighbors.has(src) && neighbors.has(tgt);
        return {
          ...data,
          color: active ? "rgba(16, 185, 129, 0.95)" : "rgba(148, 163, 184, 0.05)",
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
    <div className="w-full h-full relative overflow-hidden bg-transparent">
      {/* Floating Canvas Controls with OKLCH card styling */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        <button
          title={isPhysicsRunning ? "Pause Live Floating Simulation" : "Start Live Floating Simulation"}
          onClick={toggleLivePhysics}
          className={`p-2.5 rounded-xl border backdrop-blur-md transition-all shadow-md cursor-pointer ${
            isPhysicsRunning
              ? "bg-primary text-primary-foreground border-primary shadow-primary/30"
              : "bg-card/90 text-foreground border-border hover:bg-muted"
          }`}
        >
          {isPhysicsRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          title="Float / Re-Relax Physics Layout"
          onClick={relaxGraphOnce}
          className="p-2.5 rounded-xl border border-border bg-card/90 backdrop-blur-md text-foreground hover:bg-muted transition-all shadow-md cursor-pointer"
        >
          <Compass className="w-4 h-4" />
        </button>
        <button
          title="Zoom In"
          onClick={() => sigmaRef.current?.getCamera().animatedZoom({ factor: 1.4, duration: 250 })}
          className="p-2.5 rounded-xl border border-border bg-card/90 backdrop-blur-md text-foreground hover:bg-muted transition-all shadow-md cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          title="Zoom Out"
          onClick={() => sigmaRef.current?.getCamera().animatedUnzoom({ factor: 1.4, duration: 250 })}
          className="p-2.5 rounded-xl border border-border bg-card/90 backdrop-blur-md text-foreground hover:bg-muted transition-all shadow-md cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          title="Reset Camera View"
          onClick={() => sigmaRef.current?.getCamera().animatedReset({ duration: 400 })}
          className="p-2.5 rounded-xl border border-border bg-card/90 backdrop-blur-md text-foreground hover:bg-muted transition-all shadow-md cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div ref={containerRef} className="w-full h-full cursor-default" />
    </div>
  );
}
