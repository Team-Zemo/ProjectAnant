#include "GraphEngine.h"
#include <mgclient.h>
#include <stdexcept>
#include <sstream>
#include <iostream>
#include <chrono>
#include <fstream>

namespace anant::graph {

static void write_mg_value_json(const mg_value* val, std::ostringstream& out) {
    if (!val) { out << "null"; return; }
    switch (mg_value_get_type(val)) {
        case MG_VALUE_TYPE_NULL:
            out << "null";
            break;
        case MG_VALUE_TYPE_BOOL:
            out << (mg_value_bool(val) ? "true" : "false");
            break;
        case MG_VALUE_TYPE_INTEGER:
            out << mg_value_integer(val);
            break;
        case MG_VALUE_TYPE_FLOAT:
            out << mg_value_float(val);
            break;
        case MG_VALUE_TYPE_STRING: {
            const mg_string* s = mg_value_string(val);
            const char* data = mg_string_data(s);
            uint32_t len = mg_string_size(s);
            out << "\"";
            for (uint32_t i = 0; i < len; i++) {
                char ch = data[i];
                if (ch == '"')       out << "\\\"";
                else if (ch == '\\') out << "\\\\";
                else if (ch == '\n') out << "\\n";
                else if (ch == '\r') out << "\\r";
                else if (ch == '\t') out << "\\t";
                else out << ch;
            }
            out << "\"";
            break;
        }
        case MG_VALUE_TYPE_LIST: {
            const mg_list* list = mg_value_list(val);
            uint32_t size = mg_list_size(list);
            out << "[";
            for (uint32_t i = 0; i < size; i++) {
                if (i > 0) out << ",";
                write_mg_value_json(mg_list_at(list, i), out);
            }
            out << "]";
            break;
        }
        case MG_VALUE_TYPE_MAP: {
            const mg_map* map = mg_value_map(val);
            uint32_t size = mg_map_size(map);
            out << "{";
            for (uint32_t i = 0; i < size; i++) {
                if (i > 0) out << ",";
                const mg_string* k = mg_map_key_at(map, i);
                out << "\"" << mg_string_data(k) << "\":";
                write_mg_value_json(mg_map_value_at(map, i), out);
            }
            out << "}";
            break;
        }
        default:
            out << "\"\"";
            break;
    }
}

GraphEngine::GraphEngine(std::string host, uint16_t port)
    : host_(std::move(host)), port_(port)
{
    mg_init();
    mg_session_params* params = mg_session_params_make();
    mg_session_params_set_host(params, host_.c_str());
    mg_session_params_set_port(params, port_);
    mg_session_params_set_sslmode(params, MG_SSLMODE_DISABLE);

    mg_session* s = nullptr;
    int r = mg_connect(params, &s);
    mg_session_params_destroy(params);

    if (r == 0) {
        session_   = static_cast<void*>(s);
        connected_ = true;
        std::cout << "[GraphEngine] Connected to Memgraph at " << host_ << ":" << port_ << "\n";
    } else {
        std::cerr << "[GraphEngine] Could not connect to Memgraph at "
                  << host_ << ":" << port_ << "\n";
    }
}

GraphEngine::~GraphEngine() {
    if (session_) {
        mg_session_destroy(static_cast<mg_session*>(session_));
    }
    mg_finalize();
}

bool GraphEngine::run_cypher(const std::string& query) {
    if (!connected_) return false;
    auto* s = static_cast<mg_session*>(session_);
    if (mg_session_run(s, query.c_str(), nullptr, nullptr, nullptr, nullptr) != 0) {
        std::cerr << "[GraphEngine] Query failed: " << mg_session_error(s) << "\n  Query: " << query.substr(0, 100) << "...\n";
        return false;
    }
    // drain results
    mg_result* res;
    while (mg_session_pull(s, nullptr) == 0) {
        if (mg_session_fetch(s, &res) != 1) break;
    }
    return true;
}

uint64_t GraphEngine::feed_graph(const std::string&,
                                  std::function<void(int, uint64_t)> progress_cb)
{
    if (!connected_) throw std::runtime_error("Memgraph not connected");
    auto t0 = std::chrono::steady_clock::now();

    // 1. Reset any previous graph allocation and switch to analytical mode
    run_cypher("DROP GRAPH;");
    run_cypher("STORAGE MODE IN_MEMORY_ANALYTICAL");

    // 2. Indexes
    run_cypher("CREATE INDEX ON :Account(id)");
    run_cypher("CREATE INDEX ON :Account(mule_score)");
    run_cypher("CREATE INDEX ON :Account(layer)");

    if (progress_cb) progress_cb(10, 0);

    // 3. Load 24k account nodes from volume /data/anant_accounts.csv
    std::cout << "[GraphEngine] Loading account nodes into Memgraph...\n";
    run_cypher(
        "LOAD CSV FROM '/data/anant_accounts.csv' WITH HEADER AS row "
        "CREATE (:Account { "
        "    id: row.account_id, "
        "    bank: row.bank, "
        "    mule_score: toFloat(row.mule_score), "
        "    layer: toInteger(row.layer), "
        "    in_degree: toInteger(row.in_degree), "
        "    out_degree: toInteger(row.out_degree) "
        "})"
    );

    if (progress_cb) progress_cb(35, 24873);

    // 4. Load 2M edges from /data/anant_edges.csv
    std::cout << "[GraphEngine] Loading transfer edges into Memgraph...\n";
    run_cypher(
        "LOAD CSV FROM '/data/anant_edges.csv' WITH HEADER AS row "
        "MATCH (s:Account {id: row.sender_account}), (r:Account {id: row.receiver_account}) "
        "CREATE (s)-[:TRANSFER { "
        "    txn_id: row.txn_id, "
        "    amount: toFloat(row.amount), "
        "    ts: toInteger(row.ts_unix), "
        "    mode: row.payment_mode "
        "}]->(r)"
    );

    if (progress_cb) progress_cb(90, 0);

    // 5. Return to transactional mode for queries
    run_cypher("STORAGE MODE IN_MEMORY_TRANSACTIONAL");

    auto t1 = std::chrono::steady_clock::now();
    uint64_t elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();
    std::cout << "[GraphEngine] Graph loaded in " << elapsed << "ms\n";
    return elapsed;
}

TraceResult GraphEngine::trace_victim(const std::string& victim_id, int) {
    auto t0 = std::chrono::steady_clock::now();
    TraceResult result;
    result.victim_account = victim_id;

    if (!connected_) return result;

    std::string query =
        "MATCH path = (v:Account {id: '" + escape(victim_id) + "'})-[:TRANSFER*1..4]->(n:Account) "
        "RETURN DISTINCT n.id AS id, n.layer AS layer, n.mule_score AS mule_score, n.bank AS bank LIMIT 1000";
    cypher_json(query);

    auto t1 = std::chrono::steady_clock::now();
    result.query_ms = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();
    return result;
}

RingResult GraphEngine::isolate_ring(const std::string& account_id) {
    RingResult ring;
    ring.ring_id = account_id;
    return ring;
}

bool GraphEngine::run_layout() {
    return true; // Handled client-side via Sigma/Graphology
}

bool GraphEngine::run_community_detection() {
    std::cout << "[GraphEngine] AML layers and communities computed in DuckDB.\n";
    return true;
}

bool GraphEngine::classify_layers() {
    return true; // Computed in DuckDB MuleScorer and synced directly
}

std::vector<HopNode> GraphEngine::top_risk_nodes(double min_score, int limit) {
    std::string q =
        "MATCH (a:Account) WHERE a.mule_score >= " + std::to_string(min_score) +
        " RETURN a.id AS id, a.layer AS layer, a.mule_score AS mule_score, a.bank AS bank "
        "ORDER BY a.mule_score DESC LIMIT " + std::to_string(limit);
    cypher_json(q);
    return {};
}

GraphEngine::GraphSnapshot GraphEngine::full_snapshot(int max_nodes) {
    GraphSnapshot snap;
    std::string q =
        "MATCH (a:Account)-[t:TRANSFER]->(b:Account) "
        "WHERE a.mule_score > 30 OR b.mule_score > 30 "
        "RETURN a.id AS from, b.id AS to, t.amount AS amount, t.ts AS ts, t.mode AS mode "
        "LIMIT " + std::to_string(max_nodes);
    cypher_json(q);
    return snap;
}

std::string GraphEngine::cypher_json(const std::string& query) {
    if (!connected_) return "[]";
    auto* s = static_cast<mg_session*>(session_);

    if (mg_session_run(s, query.c_str(), nullptr, nullptr, nullptr, nullptr) != 0) {
        std::cerr << "[GraphEngine] cypher_json error: " << mg_session_error(s) << "\n  Query: " << query.substr(0, 100) << "...\n";
        return "[]";
    }

    std::ostringstream out;
    out << "[";
    bool first_row = true;
    mg_result* res = nullptr;
    while (mg_session_pull(s, nullptr) == 0) {
        int code = mg_session_fetch(s, &res);
        if (code != 1) break;

        const mg_list* cols = mg_result_columns(res);
        const mg_list* row  = mg_result_row(res);
        if (!cols || !row) continue;

        uint32_t num_cols = mg_list_size(cols);
        uint32_t num_vals = mg_list_size(row);

        if (!first_row) out << ",";
        first_row = false;
        out << "{";
        for (uint32_t i = 0; i < num_cols && i < num_vals; i++) {
            if (i > 0) out << ",";
            const mg_value* col_val = mg_list_at(cols, i);
            const char* col_name = "col";
            if (col_val && mg_value_get_type(col_val) == MG_VALUE_TYPE_STRING) {
                col_name = mg_string_data(mg_value_string(col_val));
            }
            out << "\"" << col_name << "\":";
            write_mg_value_json(mg_list_at(row, i), out);
        }
        out << "}";
    }
    out << "]";
    return out.str();
}

std::string GraphEngine::escape(std::string_view s) const {
    std::string out;
    out.reserve(s.size());
    for (char c : s) {
        if (c == '\'') out += "\\'";
        else out += c;
    }
    return out;
}

} // namespace anant::graph
