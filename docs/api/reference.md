# REST & SSE API Reference

> **Server Implementation:** `anant-engine/src/api/Routes.h`  
> **Base URL:** `http://localhost:3000`  
> **Protocol:** HTTP/1.1 & HTTP/2 (Multiplexed) · Zero-Copy JSON Serialization

---

## Endpoint Summary Table

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ingest` | Triggers the 2M CSV ingestion and scoring pipeline |
| `GET` | `/api/status` | Current engine state, progress, and execution timers |
| `GET` | `/api/events` | Real-time Server-Sent Events (SSE) telemetry stream |
| `GET` | `/api/top-risk` | Paged list of highest-risk mule accounts with filters |
| `GET` | `/api/victims` | Paged list of defrauded victim accounts (Layer 0) |
| `GET` | `/api/account/:id` | Full account metrics, 7 signal breakdown & transactions |
| `GET` | `/api/trace/:account_id` | Multi-hop directed graph trail from an account |
| `GET` | `/api/graph/ring/:account_id` | 2-hop neighborhood ego-ring subgraph |
| `GET` | `/api/legal/summary/:account_id` | Structured forensic evidence for Section 91 notice |
| `POST` | `/api/syndicates/detect` | Runs Weighted Label Propagation syndicate clustering |
| `GET` | `/api/syndicates` | List of all detected crime syndicates with metrics |
| `GET` | `/api/syndicates/:id` | Full member list, roles, and internal transaction graph |
| `POST` | `/api/upload` | Multipart file upload for custom transaction CSVs |
| `POST` | `/api/reset` | Resets and clears all DuckDB tables and memory state |

---

## Endpoint Specifications

### 1. Ingest Dataset
- **`POST /api/ingest`**
- **Query / Body Parameters:**
  - `path` *(optional)*: Absolute path to custom CSV file (defaults to `VoidHacks8_MuleAccount_2M_Transactions.csv`).
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "message": "Ingestion and scoring started in background."
  }
  ```

---

### 2. Engine Pipeline Status
- **`GET /api/status`**
- **Response `200 OK`:**
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
    "syndicates_count": 122,
    "error": ""
  }
  ```

---

### 3. Server-Sent Events (SSE) Telemetry
- **`GET /api/events`**
- **Headers:** `Content-Type: text/event-stream`
- **Stream Output Example:**
  ```
  data: {"ingest_pct": 100, "score_pct": 100, "stage": "Pipeline Complete", "elapsed_ms": 3848}
  ```

---

### 4. Top-Risk Mule Accounts Registry
- **`GET /api/top-risk`**
- **Query Parameters:**
  - `page` *(integer, default: 1)*
  - `limit` *(integer, default: 50)*
  - `layer` *(string: `all`, `0`, `1`, `2`, `3`)*
  - `severity` *(string: `all`, `critical` [≥70], `high` [≥40], `low` [<40])*
  - `search` *(string, account ID prefix)*
  - `bank` *(string, bank name filter)*
- **Response `200 OK`:**
  ```json
  {
    "total": 1073,
    "page": 1,
    "limit": 50,
    "total_pages": 22,
    "items": [
      {
        "account_id": "IPOS10000616",
        "mule_score": 96.564,
        "layer": 3,
        "in_degree": 8,
        "out_degree": 8,
        "total_in": 1029400.0,
        "total_out": 988229.0,
        "bank": "IPOS0001616",
        "is_victim": false,
        "has_foreign_ip": true,
        "has_terminal_marker": true,
        "has_script_device": true,
        "syndicate_id": "SYN-003",
        "syndicate_role": "TERMINAL_CASHOUT"
      }
    ]
  }
  ```

---

### 5. Single Account Forensic Detail
- **`GET /api/account/:id`**
- **Response `200 OK`:**
  ```json
  {
    "account_id": "IPOS10000616",
    "is_victim": false,
    "bank": "IPOS0001616",
    "total_in": 1029400.0,
    "total_out": 988229.0,
    "tx_count": 16,
    "in_degree": 8,
    "out_degree": 8,
    "layer": 3,
    "mule_score": 96.564,
    "syndicate_id": "SYN-003",
    "syndicate_role": "TERMINAL_CASHOUT",
    "has_foreign_ip": true,
    "has_terminal_marker": true,
    "has_script_device": true,
    "score_pt": 0.838891,
    "score_terminal": 1.0,
    "score_topo": 0.5,
    "score_burst": 0.175687,
    "score_device": 0.95,
    "pt_ratio": 0.470657,
    "terminal_ratio": 1.0,
    "transactions": [...]
  }
  ```

---

### 6. Multi-Hop Graph Tracing
- **`GET /api/trace/:account_id`**
- **Query Parameters:**
  - `depth` *(integer, default: 2, max: 4)*: Traversal hop depth.
  - `direction` *(string: `downstream`, `upstream`, `both`)*
- **Response `200 OK`:**
  ```json
  {
    "nodes": [
      { "id": "IPOS10000616", "layer": 3, "mule_score": 96.6, "bank": "IPOS0001616" }
    ],
    "edges": [
      { "from": "ACC00123", "to": "IPOS10000616", "amount": 125000, "ts": 1727788800, "mode": "IMPS" }
    ]
  }
  ```

---

### 7. Crime Syndicate Endpoints
- **`GET /api/syndicates`**
  - Returns array of all 122 syndicates with member counts, total volume, and risk distribution.
- **`GET /api/syndicates/:id`**
  - Returns complete member list, internal edges, and assigned member roles for syndicate `:id`.
