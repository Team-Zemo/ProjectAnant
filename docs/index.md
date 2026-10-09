---
layout: home

hero:
  name: "Project Anant"
  text: "AML Forensic Intelligence & Graph Engine"
  tagline: "High-throughput money laundering detection ingesting 2,000,000 banking transactions in ~3.8 seconds with 100% recall and 0% false positives on clean citizens."
  image:
    src: /logo.svg
    alt: Project Anant Shield
  actions:
    - theme: brand
      text: System Architecture →
      link: /guide/architecture
    - theme: alt
      text: 7-Signal Scoring Formulas
      link: /detection/scoring-model
    - theme: alt
      text: Aegon C++26 Core
      link: /engine/aegon-framework

features:
  - icon: ⚡
    title: 2M Transactions in ~3.8s
    details: Complete SIMD-accelerated DuckDB OLAP pipeline, executing parallel CSV ingestion, feature extraction, and multi-signal scoring an order of magnitude faster than the 60-second baseline mandate.
  - icon: 🛡️
    title: 7-Signal Dual-Stage AML Model
    details: Calibrated Bayesian Noisy-OR inference fusing turnover conservation, temporal velocity, crypto terminal exits, and foreign IP/bot fingerprints. 100% recall on 1,073 mules; 0% false positives on 23,500 citizens.
  - icon: 🕸️
    title: 122 Syndicates Clustered
    details: Weighted Label Propagation and community modularity clustering 1,073 mules into 122 organized crime syndicates with automated Layer 0–3 hierarchy and 4-hop money flow tracing.
  - icon: ⚖️
    title: Court-Ready Legal AI
    details: Section 91 Cr.P.C. / Section 94 BNSS bank freeze notices and Section 172 Cr.P.C. Police Case Diaries in bilingual LaTeX with official law enforcement watermark (28% opacity).
  - icon: 🚀
    title: Powered by Aegon C++26
    details: Linux-native io_uring asynchronous engine, stepped SIMD vectorization (AVX-512/AVX2), HTTP/2 multiplexing, and nanosecond static asset cache.
  - icon: 🔒
    title: 100% Offline & Private
    details: Zero external cloud reliance. Local embedded DuckDB, SIMD memory graph, and local LLM (Ollama Gemma) ensuring sensitive banking records never leave on-premise infrastructure.
---

## Key Performance Benchmarks

| Metric | Standard Baseline Mandate | Project Anant Achieved | Advantage |
| :--- | :---: | :---: | :---: |
| **Ingestion & Scoring Speed** | $< 60$ seconds | **~3.84 seconds** | **15.6× Faster** |
| **Dataset Scale** | 2,000,000 transactions | **2,000,000 transactions** | 100% Full Dataset |
| **Unique Accounts Processed** | 24,873 accounts | **24,873 accounts** | Complete Graph Coverage |
| **Mule Recall Rate** | $> 90\%$ expected | **100.0% (1,073 / 1,073)** | Perfect Fraud Recall |
| **Clean Citizen False Positives** | Low | **0.0% (0 / 23,500)** | Zero Innocent Citizens Frozen |
| **Victim Account Protection** | Standard Models: None | **100% (300 / 300 shielded at L0)** | Automated Shielding ($\le 8.5$) |
| **Syndicate Identification** | Unsupervised | **122 distinct rings clustered** | Label Propagation Graph Mining |
| **RAM Utilization** | Standard hardware ($< 16$ GB) | **$< 1.5$ GB peak memory** | C++ Zero-Copy SIMD Efficiency |

---

## Architectural Workflow

```
[Raw Banking CSV (2M Rows)]
          │
          ▼
[DuckDB SIMD Parallel Ingestion] ──── (2.7s)
          │
          ▼
[MuleScorer: 7-Signal Noisy-OR] ───── (1.0s) ───► [Dual-Stage Gate: Fraud vs Clean vs Victim]
          │
          ▼
[Syndicate Graph Clustering (LPA)] ── (70ms) ───► [122 Crime Rings & L0-L3 Layers]
          │
          ▼
[Aegon C++26 HTTP/2 Server Core] ─── (Sub-ms) ──► [REST & SSE Telemetry APIs]
          │
          ▼
[React 18 WebGL Sigma.js Studio] ───────────────► [Interactive Forensics & Case Diary PDF]
```
