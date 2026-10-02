import React from "react";

const nodes = [
  { x: 50, y: 47, r: 5.8, level: "origin", label: "KKBK · 0000", amount: "ORIGIN" },
  { x: 27, y: 25, r: 3.8, level: "risk", label: "HDFC · 9012", amount: "₹18.4L" },
  { x: 74, y: 23, r: 4.1, level: "risk", label: "SBIN · 4820", amount: "₹12.1L" },
  { x: 18, y: 65, r: 3.2, level: "warn", label: "UTIB · 1149", amount: "₹9.8L" },
  { x: 82, y: 62, r: 3.5, level: "warn", label: "ICIC · 6721", amount: "₹7.2L" },
  { x: 37, y: 81, r: 2.8, level: "safe", label: "KKBK · 2331", amount: "HOP 03" },
  { x: 66, y: 84, r: 3, level: "safe", label: "YESB · 8310", amount: "HOP 04" },
  { x: 8, y: 37, r: 2.2, level: "quiet", label: "", amount: "" },
  { x: 92, y: 36, r: 2.2, level: "quiet", label: "", amount: "" },
];

const edges = [
  [50, 47, 27, 25], [50, 47, 74, 23], [50, 47, 18, 65], [50, 47, 82, 62],
  [20, 64, 36, 79], [79, 62, 66, 82], [28, 28, 9, 39], [73, 27, 91, 39],
  [28, 28, 20, 64], [73, 27, 79, 62], [36, 79, 66, 82],
];

export function FraudGraph({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`graph-grid relative overflow-hidden bg-graph ${compact ? "h-80" : "h-[26rem] sm:h-[30rem]"}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-label="Four-hop mule account transaction graph" role="img">
        {edges.map(([x1, y1, x2, y2], index) => (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="graph-edge"
            style={{ animationDelay: `${index * 110}ms` }}
          />
        ))}
        {nodes.map((node, index) => (
          <g key={`${node.label}-${index}`} className="graph-node" style={{ animationDelay: `${index * 90}ms` }}>
            <circle cx={node.x} cy={node.y} r={node.r + 3.8} className={`node-halo node-${node.level}`} />
            <circle cx={node.x} cy={node.y} r={node.r} className={`node-core node-${node.level}`} />
            {node.label && (
              <>
                <text x={node.x} y={node.y + node.r + 6} textAnchor="middle" className="graph-label">
                  {node.label}
                </text>
                <text x={node.x} y={node.y + node.r + 9.5} textAnchor="middle" className="graph-value">
                  {node.amount}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-graph-border bg-graph-surface px-3 py-1.5 font-mono text-[10px] text-graph-muted shadow-sm">
        <span className="size-1.5 animate-pulse rounded-full bg-success" /> LIVE TRACE · 4 HOPS
      </div>
      <div className="absolute right-4 top-4 hidden items-center gap-3 font-mono text-[9px] text-graph-muted sm:flex">
        <span className="flex items-center gap-1.5">
          <i className="size-1.5 rounded-full bg-primary" />Origin
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-1.5 rounded-full bg-warning" />Linked
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-1.5 rounded-full bg-success" />Terminal
        </span>
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-lg border border-graph-border bg-graph-surface/95 p-3 shadow-lg backdrop-blur">
        <div>
          <p className="font-mono text-[10px] uppercase text-graph-muted">Victim account</p>
          <p className="mt-1 font-mono text-xs font-semibold text-graph-foreground">KKBK10000000</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase text-graph-muted">Trace time</p>
          <p className="mt-1 font-mono text-xs font-semibold text-primary">&lt;10ms</p>
        </div>
      </div>
    </div>
  );
}
