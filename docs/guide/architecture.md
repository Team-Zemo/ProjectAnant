# System Architecture & Data Pipeline

Project Anant is engineered as a unified, high-throughput digital forensics platform. It bridges ultra-low latency columnar OLAP databases with asynchronous kernel-bypass web servers and GPU-accelerated WebGL graph visualization.

---

## High-Level Architectural Diagram

![Project Anant High-Level Architecture](/architecture_diagram.jpg)

---

## End-to-End Pipeline Overview

The system processes banking datasets through a five-stage pipeline:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STAGE 1: PARALLEL SIMD INGESTION                          │
│  DuckDB C API · Multi-threaded read_csv_auto · Normalization & Cyber Feature Parsing   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Memory-mapped columnar arrays
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STAGE 2: VECTORIZED MULE SCORER                           │
│  C++26 OpenMP Engine · 7-Signal Bayesian Noisy-OR Fusion · Dual-Stage Calibrated Gates │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Scores written to DuckDB
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STAGE 3: SYNDICATE GRAPH MINING                           │
│  In-Memory Bipartite Graph · Weighted Label Propagation (LPA) · 122 Crime Syndicates  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ In-memory state & query cache
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STAGE 4: AEGON ASYNC SERVER CORE                          │
│  Linux io_uring Multishot Engine · HTTP/2 Multiplexing · SSE Telemetry Streaming       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP/2 + Server-Sent Events
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STAGE 5: INVESTIGATION STUDIO                             │
│  React 18 + TS · WebGL GPU ForceAtlas2 (Sigma.js) · Legal AI Case Diary & LaTeX Notice │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Breakdown

### 1. Ingestion Engine: `DuckLoader`
- **Location:** `anant-engine/src/ingest/DuckLoader.h`, `DuckLoader.cpp`
- **Engine:** Embedded DuckDB C API with strict hardware bounds (`max_memory = 1500MB`, `threads = 4`).
- **SIMD Streaming:** Employs DuckDB's SIMD-accelerated `read_csv_auto` to stream 2,000,000 rows in **~2.7 seconds**.
- **On-the-Fly Feature Extraction:**
  - Extracts timestamp Unix seconds (`ts_unix`).
  - Matches regex patterns on transaction narrations to flag high-risk terminal cash-out endpoints (`%CRYPTO%`, `%P2P%`, `%USDT%`, `%BINANCE%`, `%WALLET%`, `%OTC%`, `%EXCHANGE%`).
  - Normalizes IP addresses to flag foreign offshore ranges (`185.x.x.x` and `194.x.x.x` used by cyber scam syndicates).
  - Evaluates user-agent and device strings to flag automated headless emulators (`Web_Emulator`, `Linux_Script`).

---

### 2. Bayesian Scoring Engine: `MuleScorer`
- **Location:** `anant-engine/src/graph/MuleScorer.h`, `MuleScorer.cpp`
- **Zero-Copy Memory Layout:** Rather than traversing pointer graphs or row-oriented database records, DuckDB columnar vectors are mapped into contiguous C++ arrays (`col_s_idx`, `col_r_idx`, `col_amount`, `col_ts`).
- **Parallel Worker Threads:** Divides accounts across all available CPU cores using `std::thread::hardware_concurrency()`.
- **7-Signal Evaluation:** Simultaneously computes turnover conservation, temporal velocity, terminal cash-out ratio, cyber fingerprint, counterparty asymmetry, structural fan balance, and dormancy burst index.
- **Dual-Stage Gate Model:** Applies the calibrated fraud gate threshold, ensuring 0% false positives on clean citizens and automated protection for defrauded victims.

---

### 3. Syndicate Detection Engine: `SyndicateDetector`
- **Location:** `anant-engine/src/graph/SyndicateDetector.h`, `SyndicateDetector.cpp`
- **Graph Representation:** Builds an in-memory bipartite transaction graph of high-risk laundering flows.
- **Weighted Label Propagation:** Clusters interconnected money mules into cohesive fraud rings based on transactional volume and edge velocity.
- **Syndicate Roles:** Designates member roles within each syndicate (`COLLECTOR`, `DISTRIBUTOR`, `TERMINAL_CASHOUT`).

---

### 4. High-Performance Web Core: `Aegon`
- **Location:** `Aegon/`, linked as `Aegon::http`, `Aegon::core`, `Aegon::config`
- **Kernel Architecture:** Utilizes Linux `io_uring` multishot primitives (`IORING_OP_RECV_MULTISHOT`, `IORING_OP_ACCEPT_DIRECT`) for zero-syscall event loops.
- **Protocols:** Native HTTP/1.1 pipelining, HTTP/2 multiplexing, and Server-Sent Events (SSE).
- **Static File Cache:** Delivers the pre-built React production bundle with nanosecond in-memory disk-following revalidation and client-side SPA routing fallback.

---

### 5. Frontend & Forensic Studio: `anant-dashboard`
- **Location:** `anant-dashboard/src/`
- **Rendering Stack:** React 18, TypeScript, TailwindCSS, DaisyUI.
- **Graph Engine:** **Sigma.js v3** and **Graphology** utilizing hardware-accelerated WebGL shaders and GPU-assisted ForceAtlas2 layout algorithms.
- **Features:**
  - Interactive multi-hop transaction trail tracing (up to 4 hops).
  - Dynamic Ego-Ring isolation.
  - Live virtualized registry filtering 24,873 accounts in real-time.
  - Interactive 7-Signal Score Explainer Modal.
  - Police Case Diary & Section 91 Notice generator with 28% MP Police watermark.

---

## Memory Budgeting & Offline Guarantees

| Component | Target Allocation | Peak Allocation Observed |
| :--- | :---: | :---: |
| **DuckDB In-Memory OLAP** | 1,500 MB (Capped) | ~1,150 MB |
| **MuleScorer Columnar Buffers** | 256 MB | ~180 MB |
| **Aegon Server & Buffer Rings** | 64 MB | ~35 MB |
| **Total Engine Resident Memory (RSS)** | **< 2,048 MB** | **~1,365 MB** |

The entire platform fits comfortably within 2 GB of RAM, leaving over 14 GB of memory free on a standard 16 GB laptop. All processing is 100% offline with zero network connectivity required.
