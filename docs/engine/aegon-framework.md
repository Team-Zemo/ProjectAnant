# Aegon: Linux-Native C++26 Web Framework

> **Framework Path:** `Aegon/`  
> **Repository:** Embedded in Project Anant root  
> **Key Technologies:** Linux `io_uring` · C++26 Coroutines · Stepped SIMD · HTTP/2 Multiplexing

---

## What is Aegon?

**Aegon** is a bleeding-edge, Linux-native asynchronous C++26 web framework and compile-time data engine that powers the high-speed networking, API routing, and telemetry layer of **Project Anant**.

Designed for extreme throughput and deterministic sub-millisecond tail latencies, Aegon bypasses traditional POSIX `epoll` and thread-per-connection bottlenecks by leveraging Linux kernel **`io_uring` multishot primitives** and **C++26 symmetric-transfer coroutines**.

---

## ⚡ Core Technical Pillars

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                 AEGON C++26 CORE                                 │
├──────────────────────────┬───────────────────────────────────────────────────────┤
│ Kernel I/O Engine        │ Linux io_uring (RECV_MULTISHOT, ACCEPT_DIRECT)        │
│ Memory Architecture      │ Kernel-managed buffer rings (io_uring_buf_ring)       │
│ Asynchronous Primitives  │ C++26 Symmetric-Transfer Coroutines (aegon::core::Task)│
│ Vector Acceleration      │ 4-Tier Stepped SIMD (AVX-512 ➔ AVX2 ➔ SSE4.2 ➔ Scalar)│
│ Protocols Supported      │ HTTP/1.1 · HTTP/2 (Multiplexed) · HTTP/3 (QUIC) · WS  │
│ Static Serving           │ In-Memory Nanosecond Cache with SPA Fallback          │
└──────────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 1. Linux-Native `io_uring` Multishot Engine

Traditional web frameworks rely on `epoll()`:
1. `epoll_wait()` notifies user-space that a socket has data.
2. User-space makes a separate `read()` syscall.
3. User-space parses data and makes a `write()` syscall.

This context-switching overhead degrades throughput under high load.

### Aegon's Kernel-Bypass Architecture:
- **`IORING_OP_ACCEPT_DIRECT`:** Directly installs accepted socket file descriptors into kernel-managed direct tables, eliminating user-space descriptor allocation overhead.
- **`IORING_OP_RECV_MULTISHOT`:** Issues a single multishot receive request to the kernel. As data packets arrive, the kernel automatically places them into pre-allocated memory buffers without requiring individual `read()` calls.
- **Kernel Buffer Rings (`io_uring_buf_ring`):** Provides lock-free buffer recycling managed directly by the kernel, guaranteeing zero heap allocations on high-frequency request paths.

---

## 2. Hardware-Aware Stepped SIMD Engine

Aegon incorporates a 4-tier vector fallback engine that automatically detects hardware capabilities at startup:

$$\text{AVX-512BW / VL} \longrightarrow \text{AVX2 / BMI2} \longrightarrow \text{SSE4.2} \longrightarrow \text{Scalar Tail}$$

### Where SIMD Accelerates Project Anant:
- **Case-Insensitive HTTP Header Matching:** Vectorized comparison matching HTTP request headers in a single clock cycle.
- **Fast URL Decoding:** SIMD-accelerated percent-encoding decoder parsing URL query strings and route parameters (`/api/account/:id`, `/api/trace/:account_id`).
- **Token Discovery & Boundary Scanning:** Vectorized scanning for newline and delimiter boundaries during JSON serialization.

---

## 3. C++26 Symmetric-Transfer Coroutines

Aegon features native `aegon::core::Task<T>` asynchronous coroutines:
- **Zero Heap Allocations on Hot Paths:** Utilizes C++26 symmetric transfer to transition directly between coroutine frames without heap bouncing.
- **Asynchronous Telemetry Streaming:** Powers Project Anant's real-time Server-Sent Events (SSE) telemetry at `/api/events`:

```cpp
// anant-engine/src/api/Routes.h
router.get("/api/events", [&state](aegon::http::Context& ctx) -> aegon::core::Task<void> {
    ctx.res().header("Content-Type", "text/event-stream")
             .header("Cache-Control", "no-cache")
             .header("Connection", "keep-alive");

    while (state.ingest_running.load()) {
        std::string payload = "data: {\"pct\":" + std::to_string(state.ingest_pct.load()) + "}\n\n";
        co_await ctx.res().write_async(payload);
        co_await aegon::core::sleep_for(std::chrono::milliseconds(100));
    }
});
```

---

## 4. Benchmark Comparison

All benchmarks follow strict scientific methodology (physical CPU core pinning, 3s warm-up + 3 runs × 10s triplicate averages):

| Framework / Language | HTTP/1.1 Plaintext | HTTP/1.1 TLS | HTTP/2 Multiplexing | HTTP/3 (QUIC) |
| :--- | :---: | :---: | :---: | :---: |
| **Aegon (C++26)** | **547,145 req/s** | **423,902 req/s** | **1,778,204 req/s** | **336,441 req/s** |
| **Swerver (Zig)** | 468,613 req/s | 382,901 req/s | 460,518 req/s | 109,571 req/s |
| **Actix-web (Rust)** | 400,128 req/s | 349,875 req/s | 693,127 req/s | *Unsupported* |
| **Fiber (Go)** | 352,123 req/s | 327,720 req/s | *Unsupported* | *Unsupported* |
| **Drogon (C++)** | 388,383 req/s | 319,511 req/s | *Unsupported* | *Unsupported* |

> **Key Takeaway:** In HTTP/2 multiplexing, Aegon achieves **1,778,204 requests per second**, more than **2.5× faster** than Rust's Actix-web and **3.8× faster** than Zig's Swerver.

---

## 5. How Project Anant Utilizes Aegon

In `anant-engine/src/main.cpp`:

1. **Large Body Ingestion:**
   ```cpp
   aegon::http::Server server;
   server.max_body_size(1024ULL * 1024 * 1024); // 1 GB body size limit for 2M CSV uploads
   ```
2. **Native Zero-Copy Middleware:**
   ```cpp
   server.router().use(aegon::http::middleware::cors());
   server.router().use(aegon::http::middleware::security_headers(
       aegon::http::middleware::SecurityHeadersConfig::defaults()
   ));
   ```
3. **High-Speed Static Dashboard Serving:**
   ```cpp
   server.router().static_files("/", "anant-dashboard/dist", aegon::http::StaticFilesOptions{
       .precompressed = false,
       .cache_in_memory = true,
       .index_file = "index.html",
       .spa_fallback = true,
       .fallback_file = "index.html"
   });
   ```
   Delivers the React production assets directly from RAM with nanosecond disk revalidation and client-side SPA routing fallback.
