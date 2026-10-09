# Quick Start & Setup Guide

This guide walks you through compiling, running, and testing Project Anant on Linux.

---

## Prerequisites

- **Operating System:** Linux (Ubuntu 22.04+, Debian 12+, Arch Linux, Fedora)
- **C++ Compiler:** GCC 13+ or Clang 17+ with C++26 support
- **Build System:** CMake 3.25+ and Ninja / GNU Make
- **Libraries:** DuckDB C library, OpenMP, `liburing` (for Aegon)
- **Node / JS Runtime:** Bun 1.1+ or Node.js 18+ (with npm)
- **Hardware:** Minimum 8 GB RAM (16 GB recommended), 4+ CPU cores

---

## One-Click Launch

The simplest way to start the complete stack is via the root launcher script:

```bash
# Clone the repository
git clone https://github.com/Team-Zemo/ProjectAnant.git
cd ProjectAnant

# Start all services (builds C++ engine, builds React dashboard, starts Aegon on :3000)
chmod +x start.sh
./start.sh
```

Once running:
- Open your browser at **`http://localhost:3000`** to access the interactive forensics studio.
- The engine automatically hosts the compiled React dashboard and REST/SSE API on port `3000`.

---

## Manual Step-by-Step Compilation

### 1. Build the Aegon Web Core & Anant Engine

```bash
cd anant-engine
cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_CXX_STANDARD=26

cmake --build build -j$(nproc)
cd ..
```

This compiles the high-performance binary at `anant-engine/build/anant-engine`.

### 2. Build the React 18 Dashboard

```bash
cd anant-dashboard
bun install       # Or: npm install
bun run build     # Or: npm run build
cd ..
```

The compiled bundle is output to `anant-dashboard/dist/`.

### 3. Run the Engine Daemon

```bash
./anant-engine/build/anant-engine --port 3000 --threads 8
```

---

## Ingesting & Scoring 2,000,000 Transactions

Once the engine is running, trigger the complete SIMD ingestion, Bayesian scoring, and syndicate detection pipeline:

```bash
curl -X POST http://localhost:3000/api/ingest
```

### Response Example

```json
{
  "status": "ok",
  "message": "Ingestion and scoring started in background."
}
```

### Checking Pipeline Status

```bash
curl http://localhost:3000/api/status
```

```json
{
  "loaded": true,
  "ingest_running": false,
  "ingest_pct": 100,
  "score_pct": 100,
  "stage_num": 4,
  "stage": "Pipeline Complete",
  "message": "All records processed, mule scores computed, and graph ready for investigation.",
  "elapsed_ms": 3848,
  "duck_time_ms": 2718,
  "score_time_ms": 1054,
  "syn_time_ms": 76,
  "rows_loaded": 2000000,
  "unique_accounts": 24873,
  "victim_accounts": 300,
  "critical_mules": 1073,
  "syndicates_count": 122
}
```

The entire 2,000,000 transaction dataset is parsed, scored, and clustered in **under 4 seconds**.

---

## Running Documentation Locally with VitePress

To run these documentation pages locally:

```bash
# In the project root:
bun run docs:dev    # Or: npm run docs:dev
```

Visit `http://localhost:5173` to explore the docs with live hot reload.

To build the static HTML documentation site:

```bash
bun run docs:build  # Generates static site in docs/.vitepress/dist
```
