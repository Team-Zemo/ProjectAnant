# Anant Engine: DuckDB OLAP & C++26 SIMD Core

> **Directory:** `anant-engine/`  
> **Key Files:** `src/ingest/DuckLoader.cpp`, `src/graph/MuleScorer.cpp`, `src/main.cpp`  
> **Language Standards:** C++26 · OpenMP · DuckDB Vectorized C API

---

## Architecture Overview

The Anant Engine serves as the analytical powerhouse of Project Anant. It is designed to handle **multi-million row financial transaction datasets** on standard laptops without requiring external database servers, distributed clusters, or cloud services.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                 ANANT ENGINE CORE                                │
├─────────────────────────────────────────┬────────────────────────────────────────┤
│ Ingestion Engine (DuckLoader)           │ Embedded DuckDB C API (Vectorized SIMD)│
│ Memory Constraint Enforced              │ Strictly capped at 1,500 MB RAM        │
│ Scoring Engine (MuleScorer)             │ Parallel C++26 Multi-Threaded Workers  │
│ Graph Mining (SyndicateDetector)        │ Weighted Label Propagation (LPA)       │
│ Web & Telemetry Core (Aegon)            │ Linux io_uring · HTTP/2 Server Core    │
└─────────────────────────────────────────┴────────────────────────────────────────┘
```

---

## 1. High-Speed Ingestion: `DuckLoader`

### Embedded DuckDB C API Configuration
Rather than launching an external database process or communicating over TCP sockets, the engine embeds DuckDB via its direct C API (`duckdb.h`).

```cpp
// anant-engine/src/ingest/DuckLoader.cpp
duckdb_config config;
duckdb_create_config(&config);
duckdb_set_config(config, "threads", "4");
duckdb_set_config(config, "max_memory", "1500MB");
duckdb_set_config(config, "preserve_insertion_order", "false");
duckdb_open_ext(nullptr, &db_, config, nullptr); // In-memory database
```

### Zero-Copy SIMD CSV Ingestion
The engine uses DuckDB's multi-threaded parallel CSV reader (`read_csv_auto`), which features SIMD-accelerated delimiter scanning and columnar block parsing:

```sql
CREATE TABLE txns AS
SELECT 
    txn_id,
    sender_account,
    receiver_account,
    CAST(amount AS DOUBLE) AS amount,
    CAST(epoch(strptime(timestamp, '%Y-%m-%d %H:%M:%S')) AS BIGINT) AS ts_unix,
    payment_mode,
    narration,
    ip_address,
    device_type,
    (ip_address LIKE '185.%' OR ip_address LIKE '194.%') AS foreign_ip,
    (narration LIKE '%CRYPTO%' OR narration LIKE '%P2P%' OR narration LIKE '%USDT%' 
     OR narration LIKE '%BINANCE%' OR narration LIKE '%WALLET%' OR narration LIKE '%OTC%') AS terminal_marker,
    (device_type IN ('Web_Emulator', 'Linux_Script')) AS script_device
FROM read_csv_auto('/path/to/transactions.csv', header=True);
```

#### Ingestion Performance:
- **Rows Loaded:** 2,000,000 rows
- **Execution Time:** ~2.71 seconds
- **Throughput:** ~738,000 rows / second

---

## 2. In-Memory Graph Aggregation: `accounts` Table

Immediately following CSV ingestion, the engine materializes the `accounts` summary table directly in columnar memory:

```sql
CREATE TABLE accounts AS
SELECT
    id AS account_id,
    COALESCE(i.in_vol, 0.0) AS total_in,
    COALESCE(o.out_vol, 0.0) AS total_out,
    COALESCE(i.in_deg, 0) AS in_degree,
    COALESCE(o.out_deg, 0) AS out_degree,
    (COALESCE(i.in_deg, 0) + COALESCE(o.out_deg, 0)) AS tx_count,
    COALESCE(c.has_foreign, false) AS has_foreign_ip,
    COALESCE(c.has_term, false) AS has_terminal_marker,
    COALESCE(c.has_script, false) AS has_script_device,
    b.bank,
    CAST(0.0 AS DOUBLE) AS mule_score,
    CAST(0 AS INTEGER) AS layer
FROM all_account_ids
...
```

---

## 3. Parallel Vectorized Scoring: `MuleScorer`

To maximize CPU cache locality, the scoring pass extracts the database columns into contiguous, memory-aligned C++ typed arrays:

```cpp
// Contiguous columnar arrays for optimal CPU cache prefetching
std::vector<int32_t> col_s_idx;    // Sender account indices
std::vector<int32_t> col_r_idx;    // Receiver account indices
std::vector<double>  col_amount;   // Transaction amounts
std::vector<int64_t> col_ts;       // Timestamps in unix seconds
std::vector<uint8_t> col_flags;    // Packed bitmask: foreign_ip | terminal | script
```

### Multi-Worker Concurrency Model
The 24,873 accounts are partitioned across worker threads:

```cpp
const size_t num_threads = std::max(1u, std::thread::hardware_concurrency());
const size_t chunk_size = (num_accounts + num_threads - 1) / num_threads;

std::vector<std::thread> workers;
for (size_t t = 0; t < num_threads; ++t) {
    size_t start = t * chunk_size;
    size_t end = std::min(start + chunk_size, num_accounts);
    workers.emplace_back([&, start, end]() {
        for (size_t i = start; i < end; ++i) {
            // Compute all 7 signals for account i
            // Evaluate Two-Stage Gate
            // Compute final calibrated mule_score
        }
    });
}
for (auto& w : workers) w.join();
```

---

## 4. Bulk DuckDB Score Persistence

Once worker threads complete the scoring pass, scores are bulk-written back into the DuckDB `accounts` table in a single atomic transaction via an in-memory CSV stream buffer:

```sql
UPDATE accounts SET
    mule_score     = s.mule_score,
    layer          = s.layer,
    score_velocity = s.score_velocity,
    score_terminal = s.score_terminal,
    score_fan_out  = s.score_fan_out,
    score_device   = s.score_device,
    score_pt       = s.score_pt,
    score_topo     = s.score_topo,
    score_burst    = s.score_burst
FROM temp_mule_scores s
WHERE accounts.account_id = s.account_id;
```

---

## State Synchronization & SSE Streaming

The engine state is coordinated by `AppState` (`anant-engine/src/api/Routes.h`), providing atomic progress counters:
- `ingest_pct`: Progress of CSV loading (0% &rarr; 100%)
- `score_pct`: Progress of 7-signal scoring (0% &rarr; 100%)
- `stage_num`: Current lifecycle stage (0: Init, 1: Loading, 2: Scoring, 3: Syndicates, 4: Ready)

Progress is streamed live to the React dashboard over **Server-Sent Events (SSE)** at `/api/events`, delivering a responsive, real-time UI during data loading.
