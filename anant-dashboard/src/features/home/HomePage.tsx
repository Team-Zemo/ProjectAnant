import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  FileCheck2,
  Gauge,
  Network,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { FraudGraph } from "./components/FraudGraph";
import { Eyebrow, SiteFooter, SiteHeader } from "./components/SiteShell";

const proof = [
  ["2M", "transactions analyzed"],
  ["<10ms", "4-hop trace target"],
  ["100%", "offline processing"],
  ["<1ms", "hot account lookup"],
];

export function HomePage() {
  const [activeTab, setActiveTab] = useState<"ingest" | "trace" | "notice">("ingest");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-soft-orange selection:text-foreground">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
          <div className="landing-reveal">
            <Eyebrow>Built for VoidHacks 8.0</Eyebrow>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
              Trace the money.<br />
              <span className="text-primary">Surface the network.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              Anant turns millions of transactions into clear, defensible evidence—revealing mule rings in milliseconds and preparing verified legal notices without sending data off-device.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/overview"
                className="inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <span>Open dashboard</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/architecture"
                className="inline-flex items-center justify-center gap-2 h-12 rounded-lg border border-border bg-card px-6 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer shadow-none"
              >
                <span>Explore architecture</span>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Local-first", "No cloud dependency", "Evidence grounded"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-success" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-xl border border-graph-border shadow-xl transition-transform duration-500 hover:-translate-y-1">
            <div className="flex items-center justify-between border-b border-graph-border bg-graph-surface px-4 py-3 text-graph-foreground">
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="size-2 rounded-full bg-primary" />
                CASE AN-2048
              </div>
              <span className="font-mono text-[9px] text-graph-muted">28 ACCOUNTS · 41 TRANSFERS</span>
            </div>
            <FraudGraph />
          </div>
        </section>

        {/* Proof Statistics Strip */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-7xl grid-cols-2 px-5 lg:grid-cols-4 lg:px-8">
            {proof.map(([value, label], i) => (
              <div
                key={label}
                className={`group py-8 transition-colors lg:py-10 ${
                  i % 2 ? "pl-6" : ""
                } ${i > 0 ? "lg:border-l lg:border-border lg:pl-8" : ""}`}
              >
                <p className="font-mono text-2xl font-semibold text-foreground transition-transform duration-300 group-hover:-translate-y-1 group-hover:text-primary sm:text-3xl">
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Investigator Capabilities (Dark Mode Section) */}
        <section className="overflow-hidden bg-foreground py-24 text-background lg:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
              <div>
                <div className="mb-5 font-mono text-xs uppercase text-primary">
                  Investigator capabilities
                </div>
                <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
                  Every signal becomes usable evidence.
                </h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-background/60 lg:justify-self-end">
                Move from a suspicious account to a defensible case with tools designed to reveal context, preserve provenance, and keep sensitive data local.
              </p>
            </div>

            <div className="mt-14 grid gap-4 lg:grid-cols-12">
              <article className="feature-card group relative min-h-[420px] overflow-hidden rounded-2xl border border-background/15 bg-background/[.04] p-6 sm:p-8 lg:col-span-7">
                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-primary">Live trace canvas</p>
                    <h3 className="mt-3 text-2xl font-semibold">See the network form, hop by hop.</h3>
                  </div>
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-background/15 bg-background/[.06] text-primary transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
                    <Network className="size-5" />
                  </span>
                </div>
                <div className="feature-grid relative mt-8 h-56 overflow-hidden rounded-xl border border-background/10">
                  <svg viewBox="0 0 620 220" className="h-full w-full" aria-hidden="true">
                    <path className="kinetic-edge" d="M72 110 L214 58 L360 116 L518 52" />
                    <path className="kinetic-edge kinetic-edge-delay" d="M72 110 L220 172 L360 116 L522 170" />
                    {[
                      [72, 110],
                      [214, 58],
                      [220, 172],
                      [360, 116],
                      [518, 52],
                      [522, 170],
                    ].map(([cx, cy], i) => (
                      <g
                        key={`${cx}-${cy}`}
                        className="kinetic-node"
                        style={{ animationDelay: `${i * 140}ms` }}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={i === 0 ? 12 : 8}
                          className={
                            i === 0 ? "fill-primary" : i > 3 ? "fill-success" : "fill-warning"
                          }
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={i === 0 ? 24 : 16}
                          className={i === 0 ? "fill-primary/15" : "fill-background/10"}
                        />
                      </g>
                    ))}
                  </svg>
                  <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-background/15 bg-foreground/80 px-3 py-2 font-mono text-[9px] text-background/70 backdrop-blur">
                    <span className="size-1.5 animate-pulse rounded-full bg-success" />
                    TRACE ACTIVE · HOP 04
                  </div>
                </div>
              </article>

              <div className="grid gap-4 lg:col-span-5">
                {[
                  {
                    Icon: ScanSearch,
                    label: "Account intelligence",
                    title: "Search once. Reveal the full context.",
                    body: "Risk, counterparties, transaction velocity, and linked communities resolve into one investigator view.",
                    metric: "<1ms lookup",
                  },
                  {
                    Icon: ShieldCheck,
                    label: "Evidence integrity",
                    title: "Every claim points back to source.",
                    body: "Matched fields and transaction references remain attached through notice preparation.",
                    metric: "12 / 12 matched",
                  },
                ].map(({ Icon, label, title, body, metric }) => (
                  <article
                    key={label}
                    className="feature-card group rounded-2xl border border-background/15 bg-background/[.04] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-background/[.07] sm:p-7"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid size-11 place-items-center rounded-lg bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                        <Icon className="size-5" />
                      </span>
                      <span className="font-mono text-[9px] uppercase text-background/45 transition-colors group-hover:text-primary">
                        {metric}
                      </span>
                    </div>
                    <p className="mt-7 font-mono text-[10px] uppercase text-primary">{label}</p>
                    <h3 className="mt-2 text-xl font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-background/55">{body}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                {
                  Icon: Zap,
                  title: "Offline by default",
                  text: "Analysis stays on-device, even when connectivity does not.",
                },
                {
                  Icon: Sparkles,
                  title: "Constrained notices",
                  text: "Grammar-bound output prevents invented fields and loose formats.",
                },
                {
                  Icon: FileCheck2,
                  title: "Case-ready exports",
                  text: "Turn verified trails into a concise action package.",
                },
              ].map(({ Icon, title, text }, i) => (
                <article
                  key={title}
                  className="feature-card group relative overflow-hidden rounded-2xl border border-background/15 bg-background/[.04] p-6 transition-all duration-300 hover:border-primary/50"
                >
                  <span className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100" />
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg border border-background/15 text-primary transition-transform duration-300 group-hover:-rotate-6">
                      <Icon className="size-4" />
                    </span>
                    <span className="font-mono text-[9px] text-background/35">0{i + 1}</span>
                  </div>
                  <h3 className="mt-7 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-background/55">{text}</p>
                  <ArrowRight className="mt-6 size-4 text-background/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* From Signal to Action */}
        <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <Eyebrow>From signal to action</Eyebrow>
            <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
              One investigation flow.<br />No broken handoffs.
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            {[
              {
                Icon: ScanSearch,
                n: "01",
                title: "Ingest at full speed",
                body: "DuckDB streams a 274 MB, 2M-row dataset into an analysis-ready local store in a researched 3–6 seconds.",
              },
              {
                Icon: Network,
                n: "02",
                title: "Expose every hop",
                body: "Memgraph follows four levels of transfers and isolates related mule communities before leads go cold.",
              },
              {
                Icon: FileCheck2,
                n: "03",
                title: "Generate grounded action",
                body: "Local AI produces structured notices constrained by grammar and verified against source records.",
              },
            ].map(({ Icon, n, title, body }) => (
              <article
                key={n}
                className="group bg-card p-7 transition-colors hover:bg-soft-orange/35 lg:p-9"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-lg bg-soft-orange text-primary transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-3">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground transition-colors group-hover:text-primary">
                    {n}
                  </span>
                </div>
                <h3 className="mt-10 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Engine Benchmark Section */}
        <section className="bg-foreground py-24 text-background lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
            <div>
              <div className="mb-5 font-mono text-xs uppercase text-primary">
                Evidence, not promises
              </div>
              <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
                Built on an engine that leads every protocol.
              </h2>
              <p className="mt-6 max-w-md text-base leading-7 text-background/65">
                Aegon powers the API layer with independently measured performance across HTTP/1.1, HTTP/2, HTTP/3, and WebSocket.
              </p>
              <p className="mt-5 font-mono text-[10px] leading-5 text-background/45">
                Composite ranks calculated with HttpArena’s published scoring script; official publication pending review.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["HTTP/1.1", "#1 / 100", "92.5%"],
                ["HTTP/2", "#1 / 33", "80.8%"],
                ["HTTP/3", "#1 / 17", "86.1%"],
                ["WebSocket", "#1 / 29", "100%"],
              ].map(([protocol, rank, score]) => (
                <div
                  key={protocol}
                  className="rounded-xl border border-background/15 bg-background/[.05] p-5 sm:p-6"
                >
                  <div className="flex items-center justify-between font-mono text-[10px] text-background/50">
                    <span>{protocol}</span>
                    <Gauge className="size-4" />
                  </div>
                  <p className="mt-8 font-mono text-2xl font-semibold">{rank}</p>
                  <p className="mt-1 text-sm text-primary">{score} composite</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Proof in Layers with Tab Switcher */}
        <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div>
              <Eyebrow>Proof in layers</Eyebrow>
              <h2 className="text-4xl font-semibold leading-tight">Every decision has a reason.</h2>
              <p className="mt-5 leading-7 text-muted-foreground">
                The stack was selected by comparing real alternatives against speed, memory, licensing, and offline operation.
              </p>
              <Link
                to="/architecture"
                className="mt-7 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <span>View full architecture</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="w-full">
              <div className="grid h-auto w-full grid-cols-3 rounded-lg border border-border bg-muted p-1">
                {(["ingest", "trace", "notice"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                      activeTab === tab
                        ? "bg-card text-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "ingest"
                      ? "01 Ingest"
                      : tab === "trace"
                      ? "02 Trace"
                      : "03 Notice"}
                  </button>
                ))}
              </div>

              {activeTab === "ingest" && (
                <div className="mt-3 rounded-xl border border-border bg-card p-7 transition-all">
                  <ProofDetail
                    metric="250 MB/s"
                    title="DuckDB, embedded in Aegon"
                    body="Columnar, out-of-core ingestion without a Python process or IPC boundary."
                  />
                </div>
              )}
              {activeTab === "trace" && (
                <div className="mt-3 rounded-xl border border-border bg-card p-7 transition-all">
                  <ProofDetail
                    metric="<10ms"
                    title="Memgraph in analytical mode"
                    body="In-memory openCypher traversal, with MAGE algorithms for community and centrality analysis."
                  />
                </div>
              )}
              {activeTab === "notice" && (
                <div className="mt-3 rounded-xl border border-border bg-card p-7 transition-all">
                  <ProofDetail
                    metric="0 fields invented"
                    title="llama.cpp + GBNF constraints"
                    body="Grammar-constrained JSON is cross-checked against source records before rendering."
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8 lg:pb-32">
          <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-16 text-primary-foreground sm:px-12 lg:px-16">
            <div className="relative z-10 max-w-2xl">
              <p className="font-mono text-xs uppercase opacity-75">Investigation ready</p>
              <h2 className="mt-5 text-4xl font-semibold sm:text-5xl">
                Follow the funds before the trail goes cold.
              </h2>
              <p className="mt-5 max-w-xl text-primary-foreground/75">
                Explore a sample case across the same workflow designed for investigators.
              </p>
              <Link
                to="/overview"
                className="mt-8 inline-flex items-center gap-2 h-12 rounded-lg bg-foreground text-background px-6 text-sm font-medium hover:bg-foreground/90 transition-colors"
              >
                <span>Open dashboard</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="absolute -right-16 -top-16 size-72 rounded-full border-[50px] border-primary-foreground/10" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function ProofDetail({
  metric,
  title,
  body,
}: {
  metric: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p className="font-mono text-3xl font-semibold text-primary">{metric}</p>
      <h3 className="mt-7 text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-3 leading-7 text-muted-foreground">{body}</p>
    </div>
  );
}
