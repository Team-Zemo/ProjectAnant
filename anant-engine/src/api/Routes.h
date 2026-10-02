#pragma once
#include <http/Server.h>
#include <http/Context.h>
#include <http/SseStream.h>
#include <core/Task.h>
#include <core/EventLoop.h>
#include "../ingest/DuckLoader.h"
#include "../graph/GraphEngine.h"
#include "../graph/MuleScorer.h"
#include <memory>
#include <atomic>
#include <string>
#include <sstream>
#include <thread>
#include <mutex>
#include <iostream>

namespace anant::api {

// ─────────────────────────────────────────────────────────────────────────────
// AppState — shared singleton holding live engine references
// ─────────────────────────────────────────────────────────────────────────────

struct AppState {
    std::unique_ptr<ingest::DuckLoader> duck;
    std::unique_ptr<graph::GraphEngine> graph;
    std::unique_ptr<graph::MuleScorer>  scorer;

    std::atomic<bool>   ingest_running{false};
    std::atomic<int>    ingest_pct{0};
    std::atomic<int>    score_pct{0};
    std::string         last_error;
    std::mutex          err_mtx;

    explicit AppState(std::string memgraph_host = "127.0.0.1", uint16_t memgraph_port = 7687) {
        duck   = std::make_unique<ingest::DuckLoader>();
        graph  = std::make_unique<graph::GraphEngine>(memgraph_host, memgraph_port);
        scorer = std::make_unique<graph::MuleScorer>(*duck, *graph);
    }
};

inline std::string extract_json_string(const std::string& body, const std::string& key) {
    std::string search = "\"" + key + "\":\"";
    auto p = body.find(search);
    if (p == std::string::npos) return "";
    auto q1 = p + search.size();
    auto q2 = body.find('"', q1);
    if (q2 == std::string::npos) return "";
    return body.substr(q1, q2 - q1);
}

inline void register_routes(aegon::http::Server& server, AppState& state) {
    auto& router = server.router();

    // ── GET /health ────────────────────────────────────────────────────────────
    router.get("/health", [](aegon::http::Context& ctx) {
        ctx.res().json(std::string_view{"{\"status\":\"ok\",\"service\":\"anant-engine\"}"});
    });

    // ── POST /api/ingest — trigger full AML ingest & scoring pipeline ─────────
    router.post("/api/ingest", [&state](aegon::http::Context& ctx) {
        if (state.ingest_running.exchange(true)) {
            ctx.res().status(aegon::http::StatusCode::Conflict)
               .json(std::string_view{"{\"error\":\"ingest already running\"}"});
            return;
        }

        std::string csv_path = "/home/surendra/IdeaProjects/ProjectAnant/"
                               "VoidHacks8_MuleAccount_2M_Transactions.csv";
        auto body = std::string(ctx.req().body());
        auto p = extract_json_string(body, "path");
        if (!p.empty()) csv_path = p;

        std::thread([&state, csv_path]() {
            try {
                // Phase 1: DuckDB CSV ingest & accounts table build
                state.duck->load(csv_path, [&state](int pct, uint64_t) {
                    state.ingest_pct.store(pct * 30 / 100);
                });

                // Phase 2: Compute Mule Risk Index & Layers in DuckDB
                state.ingest_pct.store(35);
                state.scorer->score_all([&state](int pct) {
                    state.score_pct.store(pct);
                    state.ingest_pct.store(35 + pct * 25 / 100);
                });
                state.ingest_pct.store(60);

                // Phase 3: Export CSVs for Memgraph (mounted /tmp on host -> /data in container)
                std::cout << "[Anant] Exporting CSVs for Memgraph bulk load...\n";
                state.duck->exec(
                    "COPY (SELECT account_id, bank, mule_score, layer, in_degree, out_degree "
                    "FROM accounts) TO '/tmp/anant_accounts.csv' (HEADER TRUE)");

                state.duck->exec(
                    "COPY (SELECT txn_id, sender_account, receiver_account, "
                    "      sender_bank, receiver_bank, amount, ts_unix, "
                    "      payment_mode, foreign_ip, terminal_marker, script_device "
                    "FROM txns) TO '/tmp/anant_edges.csv' (HEADER TRUE)");
                state.ingest_pct.store(65);

                // Phase 4: Memgraph Ingestion
                if (state.graph->is_connected()) {
                    state.graph->feed_graph("/tmp/anant_edges.csv", [&state](int pct, uint64_t) {
                        state.ingest_pct.store(65 + pct * 25 / 100);
                    });

                    // Phase 5: Memgraph MAGE Community Detection
                    state.ingest_pct.store(92);
                    state.graph->run_community_detection();
                }

                // Free RAM disk memory (/tmp on tmpfs)
                std::remove("/tmp/anant_edges.csv");
                std::remove("/tmp/anant_accounts.csv");

                state.ingest_pct.store(100);
                std::cout << "[Anant] Pipeline complete! Dataset ready.\n";
            } catch (const std::exception& e) {
                std::lock_guard<std::mutex> lk(state.err_mtx);
                state.last_error = e.what();
                std::cerr << "[Anant] Pipeline error: " << e.what() << "\n";
            }
            state.ingest_running.store(false);
        }).detach();

        ctx.res().status(aegon::http::StatusCode::Accepted)
           .json(std::string_view{"{\"status\":\"started\"}"});
    });

    // ── POST /api/score/run — on-demand re-scoring ────────────────────────────
    router.post("/api/score/run", [&state](aegon::http::Context& ctx) {
        if (!state.duck->is_loaded()) {
            ctx.res().status(aegon::http::StatusCode::BadRequest)
               .json(std::string_view{"{\"error\":\"Database not loaded yet\"}"});
            return;
        }

        std::thread([&state]() {
            try {
                std::cout << "[Anant] Triggering on-demand MuleScorer run...\n";
                state.score_pct.store(5);
                state.scorer->score_all([&state](int pct) {
                    state.score_pct.store(pct);
                });
                state.score_pct.store(100);
                std::cout << "[Anant] Scoring engine run complete!\n";
            } catch (const std::exception& e) {
                std::lock_guard<std::mutex> lk(state.err_mtx);
                state.last_error = e.what();
                std::cerr << "[Anant] Scoring error: " << e.what() << "\n";
            }
        }).detach();

        ctx.res().status(aegon::http::StatusCode::Accepted)
           .json(std::string_view{"{\"status\":\"scoring_started\"}"});
    });

    // ── GET /api/status ────────────────────────────────────────────────────────
    router.get("/api/status", [&state](aegon::http::Context& ctx) {
        std::string err;
        { std::lock_guard<std::mutex> lk(state.err_mtx); err = state.last_error; }
        std::ostringstream j;
        j << "{"
          << "\"loaded\":"           << (state.duck->is_loaded() ? "true" : "false") << ","
          << "\"ingest_running\":"   << (state.ingest_running.load() ? "true" : "false") << ","
          << "\"ingest_pct\":"       << state.ingest_pct.load() << ","
          << "\"score_pct\":"        << state.score_pct.load() << ","
          << "\"memgraph_ok\":"      << (state.graph->is_connected() ? "true" : "false") << ","
          << "\"rows_loaded\":"      << state.duck->stats().rows_loaded.load() << ","
          << "\"unique_accounts\":"  << state.duck->stats().unique_accounts.load() << ","
          << "\"error\":\""          << err << "\""
          << "}";
        ctx.res().json(j.str());
    });

    // ── GET /api/events — SSE progress stream ─────────────────────────────────
    router.get("/api/events", [&state](aegon::http::Context& ctx) -> aegon::core::Task<void> {
        auto stream = co_await ctx.sse();

        for (int i = 0; i < 300; i++) {
            std::ostringstream data;
            data << "{\"pct\":"       << state.ingest_pct.load()
                 << ",\"rows\":"      << state.duck->stats().rows_loaded.load()
                 << ",\"accounts\":"  << state.duck->stats().unique_accounts.load()
                 << "}";
            co_await stream.data(data.str());

            if (state.ingest_pct.load() >= 100 && !state.ingest_running.load()) break;

            auto* loop = aegon::core::EventLoop::current();
            if (loop) {
                co_await loop->ring().timeout(1'000'000'000ULL);
            }
        }
    });

    // ── GET /api/graph/snapshot — immediate high-risk graph on load ───────────
    router.get("/api/graph/snapshot", [&state](aegon::http::Context& ctx) {
        if (!state.duck->is_loaded()) {
            ctx.res().json(std::string_view{"{\"nodes\":[],\"edges\":[]}"});
            return;
        }

        auto max_param = ctx.req().query_param("max");
        int max_nodes = 300;
        if (max_param) {
            try { max_nodes = std::stoi(std::string(*max_param)); } catch(...) {}
        }

        std::string nodes = state.duck->query_json(
            "SELECT account_id AS id, layer, mule_score, bank, in_degree, out_degree "
            "FROM accounts WHERE mule_score >= 40.0 "
            "ORDER BY mule_score DESC LIMIT " + std::to_string(max_nodes)
        );

        std::string edges = state.duck->query_json(
            "WITH top_accts AS ( "
            "    SELECT account_id FROM accounts WHERE mule_score >= 40.0 "
            "    ORDER BY mule_score DESC LIMIT " + std::to_string(max_nodes) + " "
            ") "
            "SELECT t.sender_account AS \"from\", t.receiver_account AS \"to\", "
            "       t.amount, t.ts_unix AS ts, t.payment_mode AS mode, t.txn_id "
            "FROM txns t "
            "JOIN top_accts s ON t.sender_account = s.account_id "
            "JOIN top_accts r ON t.receiver_account = r.account_id "
            "LIMIT " + std::to_string(max_nodes * 4)
        );

        std::string res = "{\"nodes\":" + nodes + ",\"edges\":" + edges + "}";
        ctx.res().json(res);
    });

    // ── GET /api/trace/:account_id — 4-hop money trail ────────────────────────
    router.get("/api/trace/:account_id", [&state](aegon::http::Context& ctx) {
        auto account_id_sv = ctx.req().param("account_id").value_or("");
        std::string account_id(account_id_sv);

        if (account_id.empty() || !state.duck->is_loaded()) {
            ctx.res().status(aegon::http::StatusCode::BadRequest)
               .json(std::string_view{"{\"error\":\"account_id required or not loaded\"}"});
            return;
        }

        std::string sid;
        for (char c : account_id) { if (c=='\'') sid += "''"; else sid += c; }

        // 1. Trace edges: Upstream Senders (Inflow) + Downstream Receivers (Outflow hops)
        std::string edges_json = state.duck->query_json(
            "WITH inflows AS ( "
            "    SELECT sender_account, receiver_account, amount, ts_unix, payment_mode, txn_id "
            "    FROM txns WHERE receiver_account = '" + sid + "' "
            "    ORDER BY amount DESC LIMIT 50 "
            "), "
            "hop1 AS ( "
            "    SELECT sender_account, receiver_account, amount, ts_unix, payment_mode, txn_id "
            "    FROM txns WHERE sender_account = '" + sid + "' "
            "    ORDER BY amount DESC LIMIT 50 "
            "), "
            "hop2 AS ( "
            "    SELECT t.sender_account, t.receiver_account, t.amount, t.ts_unix, t.payment_mode, t.txn_id "
            "    FROM txns t "
            "    WHERE t.sender_account IN (SELECT receiver_account FROM hop1) "
            "      AND t.receiver_account != '" + sid + "' "
            "    ORDER BY t.amount DESC LIMIT 200 "
            "), "
            "hop3 AS ( "
            "    SELECT t.sender_account, t.receiver_account, t.amount, t.ts_unix, t.payment_mode, t.txn_id "
            "    FROM txns t "
            "    WHERE t.sender_account IN (SELECT receiver_account FROM hop2) "
            "      AND t.receiver_account != '" + sid + "' "
            "    ORDER BY t.amount DESC LIMIT 200 "
            "), "
            "all_hops AS ( "
            "    SELECT * FROM inflows "
            "    UNION ALL SELECT * FROM hop1 "
            "    UNION ALL SELECT * FROM hop2 "
            "    UNION ALL SELECT * FROM hop3 "
            ") "
            "SELECT DISTINCT sender_account AS \"from\", receiver_account AS \"to\", amount, ts_unix AS ts, payment_mode AS mode, txn_id "
            "FROM all_hops"
        );

        // 2. Trace nodes (Inflow Senders + Target Account + Downstream Receivers)
        std::string nodes_json = state.duck->query_json(
            "WITH inflows AS ( "
            "    SELECT sender_account AS acct FROM txns WHERE receiver_account = '" + sid + "' ORDER BY amount DESC LIMIT 50 "
            "), "
            "hop1 AS ( "
            "    SELECT receiver_account AS acct FROM txns WHERE sender_account = '" + sid + "' ORDER BY amount DESC LIMIT 50 "
            "), "
            "hop2 AS ( "
            "    SELECT receiver_account AS acct FROM txns WHERE sender_account IN (SELECT acct FROM hop1) AND receiver_account != '" + sid + "' ORDER BY amount DESC LIMIT 200 "
            "), "
            "hop3 AS ( "
            "    SELECT receiver_account AS acct FROM txns WHERE sender_account IN (SELECT acct FROM hop2) AND receiver_account != '" + sid + "' ORDER BY amount DESC LIMIT 200 "
            "), "
            "all_nodes AS ( "
            "    SELECT '" + sid + "' AS id "
            "    UNION SELECT acct AS id FROM inflows "
            "    UNION SELECT acct AS id FROM hop1 "
            "    UNION SELECT acct AS id FROM hop2 "
            "    UNION SELECT acct AS id FROM hop3 "
            ") "
            "SELECT n.id, COALESCE(a.layer, 0) AS layer, COALESCE(a.mule_score, 0.0) AS mule_score, "
            "       COALESCE(a.bank, '') AS bank, COALESCE(a.in_degree, 0) AS in_degree, COALESCE(a.out_degree, 0) AS out_degree "
            "FROM all_nodes n "
            "LEFT JOIN accounts a ON n.id = a.account_id"
        );

        auto vstats = state.duck->account_stats(account_id);

        std::ostringstream j;
        j << "{\"victim\":\"" << account_id << "\","
          << "\"total_in\":" << vstats.total_in << ","
          << "\"total_out\":" << vstats.total_out << ","
          << "\"nodes\":" << nodes_json << ","
          << "\"edges\":" << edges_json << "}";
        ctx.res().json(j.str());
    });

    // ── GET /api/top-risk ──────────────────────────────────────────────────────
    router.get("/api/top-risk", [&state](aegon::http::Context& ctx) {
        if (!state.duck->is_loaded()) {
            ctx.res().json(std::string_view{"[]"});
            return;
        }

        int n = 50;
        auto np = ctx.req().query_param("n");
        if (np) { try { n = std::stoi(std::string(*np)); } catch(...) {} }

        auto result = state.duck->query_json(
            "SELECT account_id, mule_score, layer, in_degree, out_degree, "
            "       total_in, total_out, tx_count, bank, "
            "       has_foreign_ip, has_terminal_marker, has_script_device, "
            "       score_pt, score_terminal, score_topo, score_burst, score_device, "
            "       pt_ratio, terminal_ratio "
            "FROM accounts ORDER BY mule_score DESC LIMIT " + std::to_string(n));
        ctx.res().json(result);
    });

    // ── GET /api/account/:id — full account detail ────────────────────────────
    router.get("/api/account/:id", [&state](aegon::http::Context& ctx) {
        auto id_sv = ctx.req().param("id").value_or("");
        std::string id(id_sv);
        if (id.empty() || !state.duck->is_loaded()) {
            ctx.res().status(aegon::http::StatusCode::BadRequest)
               .json(std::string_view{"{\"error\":\"id required or not loaded\"}"});
            return;
        }

        auto stats = state.duck->account_stats(id);
        std::string sid;
        for (char c : id) { if (c=='\'') sid += "''"; else sid += c; }

        auto txns = state.duck->query_json(
            "SELECT txn_id, sender_account, receiver_account, amount, "
            "       ts_unix, payment_mode, narration, ip_address, device_type, "
            "       foreign_ip, terminal_marker, script_device "
            "FROM txns "
            "WHERE sender_account = '" + sid + "' OR receiver_account = '" + sid + "' "
            "ORDER BY ts_unix ASC LIMIT 200");

        std::ostringstream j;
        j << "{\"account_id\":\"" << id << "\","
          << "\"bank\":\"" << stats.bank << "\","
          << "\"total_in\":" << stats.total_in << ","
          << "\"total_out\":" << stats.total_out << ","
          << "\"tx_count\":" << stats.tx_count << ","
          << "\"in_degree\":" << stats.in_degree << ","
          << "\"out_degree\":" << stats.out_degree << ","
          << "\"layer\":" << stats.layer << ","
          << "\"mule_score\":" << stats.mule_score << ","
          << "\"has_foreign_ip\":" << (stats.has_foreign_ip ? "true" : "false") << ","
          << "\"has_terminal_marker\":" << (stats.has_terminal_marker ? "true" : "false") << ","
          << "\"has_script_device\":" << (stats.has_script_device ? "true" : "false") << ","
          << "\"score_pt\":" << stats.score_pt << ","
          << "\"score_terminal\":" << stats.score_terminal << ","
          << "\"score_topo\":" << stats.score_topo << ","
          << "\"score_burst\":" << stats.score_burst << ","
          << "\"score_device\":" << stats.score_device << ","
          << "\"pt_ratio\":" << stats.pt_ratio << ","
          << "\"terminal_ratio\":" << stats.terminal_ratio << ","
          << "\"transactions\":" << txns << "}";
        ctx.res().json(j.str());
    });

    // ── GET /api/graph/ring/:account_id ────────────────────────────────────────
    router.get("/api/graph/ring/:account_id", [&state](aegon::http::Context& ctx) {
        auto id_sv = ctx.req().param("account_id").value_or("");
        std::string id(id_sv);
        std::string sid;
        for (char c : id) { if (c=='\'') sid += "''"; else sid += c; }

        // Find 2-hop neighborhood of this account
        std::string edges = state.duck->query_json(
            "SELECT sender_account AS \"from\", receiver_account AS \"to\", amount, ts_unix AS ts, payment_mode AS mode, txn_id "
            "FROM txns "
            "WHERE sender_account = '" + sid + "' OR receiver_account = '" + sid + "' "
            "LIMIT 500"
        );

        std::string nodes = state.duck->query_json(
            "WITH accts AS ( "
            "    SELECT '" + sid + "' AS id "
            "    UNION "
            "    SELECT sender_account AS id FROM txns WHERE receiver_account = '" + sid + "' "
            "    UNION "
            "    SELECT receiver_account AS id FROM txns WHERE sender_account = '" + sid + "' "
            ") "
            "SELECT a.id, COALESCE(acc.layer, 0) AS layer, COALESCE(acc.mule_score, 0.0) AS mule_score, "
            "       COALESCE(acc.bank, '') AS bank "
            "FROM accts a "
            "LEFT JOIN accounts acc ON a.id = acc.account_id"
        );

        std::string res = "{\"ring_center\":\"" + id + "\",\"nodes\":" + nodes + ",\"edges\":" + edges + "}";
        ctx.res().json(res);
    });
}

} // namespace anant::api
