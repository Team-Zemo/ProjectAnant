import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleAlert,
  Cpu,
  Database,
  FileText,
  Network,
  ScanLine,
} from "lucide-react";

import { Eyebrow, SiteFooter, SiteHeader } from "./components/SiteShell";

const stages = [
  {
    icon: Database,
    label: "01 · INGEST",
    title: "DuckDB",
    detail: "Embedded columnar store",
    metric: "3–6s",
    note: "2M rows · researched",
  },
  {
    icon: Network,
    label: "02 · CONNECT",
    title: "Memgraph",
    detail: "In-memory graph engine",
    metric: "<10ms",
    note: "4-hop BFS · expected",
  },
  {
    icon: Cpu,
    label: "03 · SERVE",
    title: "Aegon C++26",
    detail: "Multi-protocol API",
    metric: "#1 × 4",
    note: "HttpArena composite",
  },
  {
    icon: FileText,
    label: "04 · ACT",
    title: "llama.cpp",
    detail: "Grammar-bound local AI",
    metric: "100%",
    note: "structured output",
  },
];

export function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-soft-orange selection:text-foreground">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 lg:px-8 lg:pb-24 lg:pt-24">
          <Eyebrow>Research-backed architecture</Eyebrow>
          <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.04] sm:text-6xl lg:text-7xl">
              Fast enough for the trail.<br />
              <span className="text-primary">Private enough for the case.</span>
            </h1>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground lg:pb-2">
              Every layer was selected against real alternatives for throughput, memory, licensing, and the ability to run entirely on an investigator’s machine.
            </p>
          </div>
        </section>

        {/* Local Execution Path Section */}
        <section className="border-y border-border bg-card py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-[10px] uppercase text-primary">Local execution path</p>
                <h2 className="mt-3 text-3xl font-semibold">One evidence chain. Four purpose-built layers.</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Raw transactions move left to right; verified case fields remain traceable at every boundary.
              </p>
            </div>

            <div className="architecture-rail relative grid gap-7 lg:grid-cols-4 lg:gap-3">
              {stages.map(({ icon: Icon, label, title, detail, metric, note }, index) => (
                <div
                  key={title}
                  className="group relative z-10 rounded-xl border border-border bg-background p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-primary">{label}</span>
                    <span className="grid size-9 place-items-center rounded-lg bg-soft-orange text-primary transition-transform duration-300 group-hover:rotate-6">
                      <Icon className="size-4" />
                    </span>
                  </div>
                  <h2 className="mt-8 text-xl font-semibold">{title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                  <div className="mt-8 border-t border-border pt-5">
                    <p className="font-mono text-3xl font-semibold transition-colors group-hover:text-primary">
                      {metric}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{note}</p>
                  </div>
                  {index < stages.length - 1 && (
                    <span className="absolute -bottom-5 left-1/2 z-20 grid size-8 -translate-x-1/2 place-items-center rounded-full border border-border bg-card text-primary shadow-sm lg:-right-5 lg:bottom-auto lg:left-auto lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0">
                      <ArrowDown className="size-3.5 lg:-rotate-90" />
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 rounded-lg border border-border bg-muted/50 p-4 font-mono text-[10px] text-muted-foreground sm:grid-cols-3">
              <span>
                <b className="text-foreground">INPUT</b> · CSV transaction records
              </span>
              <span>
                <b className="text-foreground">BOUNDARY</b> · Investigator device only
              </span>
              <span>
                <b className="text-foreground">OUTPUT</b> · Verified notice package
              </span>
            </div>
          </div>
        </section>

        {/* Decision Record Section */}
        <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
          <div className="grid gap-16 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <Eyebrow>Decision record</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight">Chosen for the constraint—not the hype.</h2>
              <p className="mt-5 leading-7 text-muted-foreground">
                Each winner clears a specific bottleneck while keeping the complete evidence chain local.
              </p>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {[
                ["CSV ingestion", "DuckDB", "250 MB/s", "No Python IPC, out-of-core execution"],
                ["Live graph", "Memgraph", "1M edges/s", "C++ core, openCypher, MAGE algorithms"],
                ["Batch scoring", "graph-tool", "OpenMP", "Parallel Mule Risk Index computation"],
                ["Visualization", "Sigma.js", "WebGL", "Smooth graphs with pre-laid coordinates"],
                ["Legal documents", "llama.cpp", "GBNF", "Token-level schema enforcement"],
              ].map(([role, choice, signal, reason]) => (
                <div
                  key={role}
                  className="grid gap-4 py-6 sm:grid-cols-[1fr_1fr_.7fr_1.6fr] sm:items-center"
                >
                  <p className="text-sm text-muted-foreground">{role}</p>
                  <p className="font-semibold text-foreground">{choice}</p>
                  <p className="font-mono text-xs text-primary">{signal}</p>
                  <p className="text-sm text-muted-foreground">{reason}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Performance Budget Section */}
        <section className="bg-foreground py-24 text-background lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase text-primary">Performance budget</p>
              <h2 className="mt-5 text-4xl font-semibold">Targets made explicit.</h2>
              <p className="mt-4 text-background/60">
                Research estimates are marked as such. The architecture stays usable while slower batch risk scoring completes asynchronously.
              </p>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-background/15 bg-background/15 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["CSV ingest", "3–6s", "High confidence"],
                ["4-hop trace", "<10ms", "Very high confidence"],
                ["Hot lookup", "<1ms", "Very high confidence"],
                ["Legal document", "15–30s", "Medium confidence"],
              ].map(([label, value, confidence]) => (
                <div key={label} className="bg-foreground p-6">
                  <p className="text-sm text-background/55">{label}</p>
                  <p className="mt-8 font-mono text-3xl font-semibold">{value}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-background/55">
                    <Check className="size-3.5 text-success" />
                    {confidence}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-4 rounded-xl border border-warning/30 bg-warning/10 p-5">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-background">Two-phase ingest, handled openly</p>
                <p className="mt-1 text-sm leading-6 text-background/60">
                  The dashboard becomes usable after graph loading. Mule Risk scores then populate progressively through a streamed status update while the 30–60 second batch finishes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mx-auto max-w-7xl px-5 py-24 text-center lg:px-8 lg:py-28">
          <ScanLine className="mx-auto size-8 text-primary" />
          <h2 className="mx-auto mt-6 max-w-2xl text-4xl font-semibold">
            See the architecture become an investigation.
          </h2>
          <Link
            to="/overview"
            className="mt-8 inline-flex items-center gap-2 h-12 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <span>Open dashboard</span>
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
