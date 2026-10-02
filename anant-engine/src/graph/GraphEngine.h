#pragma once

#include <string>
#include <string_view>
#include <vector>
#include <optional>
#include <functional>
#include <memory>
#include <unordered_map>

// Forward declaration for Memgraph C++ Bolt client
// We use mgclient (the official Memgraph C client) wrapped in C++
struct mg_session;
struct mg_value;

namespace anant::graph {

// ─────────────────────────────────────────────────────────────────────────────
// HopNode — a node in a multi-hop trace result
// ─────────────────────────────────────────────────────────────────────────────

struct HopNode {
    std::string account_id;
    int         layer{0};      // 1=Collector, 2=Distributor, 3=Terminal, 0=Victim
    double      mule_score{0};
    double      total_in{0};
    double      total_out{0};
    bool        has_foreign_ip{false};
    bool        has_terminal_marker{false};
    bool        has_script_device{false};
    std::string bank;
    double      x{0}, y{0};   // layout coordinates (ForceAtlas2 from MAGE)
};

struct HopEdge {
    std::string txn_id;
    std::string from_account;
    std::string to_account;
    double      amount{0};
    int64_t     timestamp{0};
    std::string payment_mode;
    bool        is_suspicious{false};
};

struct TraceResult {
    std::string victim_account;
    std::vector<HopNode> nodes;
    std::vector<HopEdge> edges;
    int         max_depth_reached{0};
    double      total_siphoned{0};
    uint64_t    query_ms{0};
};

// ─────────────────────────────────────────────────────────────────────────────
// RingResult — isolated subgraph for one suspect community
// ─────────────────────────────────────────────────────────────────────────────

struct RingResult {
    std::string ring_id;
    std::vector<HopNode> nodes;
    std::vector<HopEdge> edges;
    double total_amount{0};
    int    l1_count{0}, l2_count{0}, l3_count{0};
};

// ─────────────────────────────────────────────────────────────────────────────
// GraphEngine — Memgraph Bolt client with AML query builders
// ─────────────────────────────────────────────────────────────────────────────

class GraphEngine {
public:
    GraphEngine(std::string host = "127.0.0.1", uint16_t port = 7687);
    ~GraphEngine();

    GraphEngine(const GraphEngine&)            = delete;
    GraphEngine& operator=(const GraphEngine&) = delete;

    bool is_connected();
    bool reconnect();

    /// Feed edges from DuckDB into Memgraph (called after DuckDB load).
    /// Batches edges in chunks for throughput.
    /// progress_cb receives (pct, edges_sent)
    uint64_t feed_graph(const std::string& duckdb_json_edges_path,
                        std::function<void(int, uint64_t)> progress_cb = {});

    /// Core: 4-hop BFS money trail from victim account
    /// Returns within ≤ 2s (Memgraph in-memory guarantee)
    TraceResult trace_victim(const std::string& victim_account_id, int max_hops = 4);

    /// Isolate the full syndicate ring containing a given account
    RingResult isolate_ring(const std::string& account_id);

    /// Run ForceAtlas2 layout on the full graph (called once after feed)
    /// Writes x,y coordinates to each Account node
    bool run_layout();

    /// Run community detection (Louvain) to tag ring memberships
    bool run_community_detection();

    /// Classify accounts into L1/L2/L3 layers based on degree + markers
    bool classify_layers();

    /// Get all Account nodes with mule_score above threshold
    std::vector<HopNode> top_risk_nodes(double min_score = 50.0, int limit = 200);

    /// Get full graph edge list (for initial dashboard render)
    struct GraphSnapshot {
        std::vector<HopNode> nodes;
        std::vector<HopEdge> edges;
    };
    GraphSnapshot full_snapshot(int max_nodes = 2000);

    /// Raw Cypher query → JSON string
    std::string cypher_json(const std::string& query);

    bool run_cypher(const std::string& query);

private:
    std::string escape(std::string_view s) const;

    std::string host_;
    uint16_t    port_;
    bool        connected_{false};
    void*       session_{nullptr};  // mg_session* (opaque to avoid header dep)
};

} // namespace anant::graph
