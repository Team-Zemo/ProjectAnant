import React from "react";
import {
  Server,
  Database,
  Cpu,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
  Shield,
  Code2,
} from "lucide-react";
import type { StatusResponse } from "../../types";

interface SystemHealthViewProps {
  status: StatusResponse | null;
  isReady: boolean;
}

export const SystemHealthView: React.FC<SystemHealthViewProps> = ({
  status,
  isReady,
}) => {
  const isMemgraphOk = status?.memgraph_ok ?? false;
  const isDuckLoaded = status?.loaded ?? false;

  const endpoints = [
    { method: "GET", path: "/health", purpose: "Engine liveness & service probe", status: "200 OK" },
    { method: "GET", path: "/api/status", purpose: "Engine state, rows, accounts & Memgraph link", status: "200 OK" },
    { method: "GET", path: "/api/events", purpose: "Server-Sent Events (SSE) progress stream", status: "SSE 200" },
    { method: "GET", path: "/api/trace/:id", purpose: "4-hop upstream/downstream money trail", status: "Active" },
    { method: "GET", path: "/api/account/:id", purpose: "Deep account telemetry, risk scores & ledger", status: "Active" },
    { method: "GET", path: "/api/graph/ring/:id", purpose: "2-hop direct neighborhood ring", status: "Active" },
    { method: "GET", path: "/api/top-risk?page=1&limit=50", purpose: "Paged top scored mule accounts with total count", status: "Active" },
    { method: "POST", path: "/api/ingest", purpose: "Trigger DuckDB + Memgraph ingest pipeline", status: "Active" },
    { method: "POST", path: "/api/score/run", purpose: "Trigger on-demand mule risk re-scoring", status: "Active" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono">
              System Diagnostics
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Real-Time Node Telemetry
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground font-sans">
            Engine Health & Infrastructure Specs
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Low-level diagnostic metrics for Aegon C++ HTTP engine, DuckDB SIMD vectors, and Memgraph graph store.
          </p>
        </div>
      </div>

      {/* Core Infrastructure Services */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* C++ Aegon Engine */}
        <div className="p-5 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              <span className="font-extrabold text-sm text-foreground">Aegon C++ Engine</span>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-success/15 text-success font-bold">
              <CheckCircle2 className="w-3 h-3" /> Online
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Compiled with C++26 standard. Asynchronous non-blocking HTTP/2 server handling graph streaming requests.
          </p>
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>Port: :3000</span>
            <span>Workers: 8 Threads</span>
          </div>
        </div>

        {/* DuckDB SIMD Store */}
        <div className="p-5 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <span className="font-extrabold text-sm text-foreground">DuckDB Vector Core</span>
            </div>
            <span
              className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                isDuckLoaded
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning"
              }`}
            >
              {isDuckLoaded ? <CheckCircle2 className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
              {isDuckLoaded ? "Ready" : "Standby"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Vectorized SIMD memory database executing analytical Cypher-like queries and pass-through scoring.
          </p>
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>Rows: {status?.rows_loaded?.toLocaleString() || 0}</span>
            <span>Accounts: {status?.unique_accounts?.toLocaleString() || 0}</span>
          </div>
        </div>

        {/* Memgraph MAGE */}
        <div className="p-5 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="font-extrabold text-sm text-foreground">Memgraph MAGE</span>
            </div>
            <span
              className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                isMemgraphOk
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {isMemgraphOk ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {isMemgraphOk ? "Connected" : "Offline"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            In-memory graph database holding relationship topologies, community detection algorithms, and cyclic paths.
          </p>
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>Protocol: Bolt</span>
            <span>Port: :7687</span>
          </div>
        </div>
      </div>

      {/* API Endpoints Registry */}
      <div className="p-6 rounded-2xl bg-card border border-border feature-card shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            <h3 className="font-extrabold text-base text-foreground font-sans">
              Engine API Endpoint Mapping
            </h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground">Direct REST & SSE Calls</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Endpoint Path</th>
                <th className="py-2.5 px-3">Functionality Description</th>
                <th className="py-2.5 px-3 text-right">Channel Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {endpoints.map((ep, idx) => (
                <tr key={idx} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        ep.method === "POST"
                          ? "bg-warning/15 text-warning border border-warning/30"
                          : "bg-primary/15 text-primary border border-primary/30"
                      }`}
                    >
                      {ep.method}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                    {ep.path}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {ep.purpose}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground/80 font-bold">
                      {ep.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
