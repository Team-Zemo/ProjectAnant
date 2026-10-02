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

        int64_t critical_mules = 0;
        if (state.duck->is_loaded()) {
            ingest::DuckResult cr(state.duck->conn(), "SELECT count(*) FROM accounts WHERE mule_score >= 70.0");
            if (cr.ok && cr.row_count() > 0) critical_mules = cr.get_int64(0, 0);
        }

        std::ostringstream j;
        j << "{"
          << "\"loaded\":"           << (state.duck->is_loaded() ? "true" : "false") << ","
          << "\"ingest_running\":"   << (state.ingest_running.load() ? "true" : "false") << ","
          << "\"ingest_pct\":"       << state.ingest_pct.load() << ","
          << "\"score_pct\":"        << state.score_pct.load() << ","
          << "\"memgraph_ok\":"      << (state.graph->is_connected() ? "true" : "false") << ","
          << "\"rows_loaded\":"      << state.duck->stats().rows_loaded.load() << ","
          << "\"unique_accounts\":"  << state.duck->stats().unique_accounts.load() << ","
          << "\"critical_mules\":"   << critical_mules << ","
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

    // ── GET /api/top-risk (paged with total count & filtering) ────────────────
    router.get("/api/top-risk", [&state](aegon::http::Context& ctx) {
        if (!state.duck->is_loaded()) {
            ctx.res().json(std::string_view{"{\"total\":0,\"page\":1,\"limit\":50,\"total_pages\":0,\"items\":[]}"});
            return;
        }

        int limit = 50;
        auto lp = ctx.req().query_param("limit");
        if (!lp) lp = ctx.req().query_param("n");
        if (lp) { try { limit = std::stoi(std::string(*lp)); } catch(...) {} }
        if (limit <= 0) limit = 50;
        if (limit > 500) limit = 500;

        int page = 1;
        auto pp = ctx.req().query_param("page");
        if (pp) { try { page = std::stoi(std::string(*pp)); } catch(...) {} }
        if (page < 1) page = 1;

        int offset = (page - 1) * limit;
        auto op = ctx.req().query_param("offset");
        if (op) { try { offset = std::stoi(std::string(*op)); } catch(...) {} }
        if (offset < 0) offset = 0;

        // Build filtering conditions
        std::vector<std::string> conditions;

        auto sp = ctx.req().query_param("search");
        if (sp && !sp->empty()) {
            std::string s(std::string_view{*sp});
            std::string esc;
            for (char c : s) { if (c == '\'') esc += "''"; else esc += c; }
            conditions.push_back("(account_id ILIKE '%" + esc + "%' OR bank ILIKE '%" + esc + "%')");
        }

        auto layer_p = ctx.req().query_param("layer");
        if (layer_p && *layer_p != "all" && !layer_p->empty()) {
            try {
                int layer = std::stoi(std::string(*layer_p));
                conditions.push_back("layer = " + std::to_string(layer));
            } catch(...) {}
        }

        auto min_sp = ctx.req().query_param("min_score");
        if (min_sp) {
            try {
                double min_s = std::stod(std::string(*min_sp));
                conditions.push_back("mule_score >= " + std::to_string(min_s));
            } catch(...) {}
        }

        auto max_sp = ctx.req().query_param("max_score");
        if (max_sp) {
            try {
                double max_s = std::stod(std::string(*max_sp));
                conditions.push_back("mule_score <= " + std::to_string(max_s));
            } catch(...) {}
        }

        auto f_ip = ctx.req().query_param("foreign_ip");
        if (f_ip && (*f_ip == "true" || *f_ip == "1")) {
            conditions.push_back("has_foreign_ip = true");
        }

        auto term = ctx.req().query_param("terminal");
        if (term && (*term == "true" || *term == "1")) {
            conditions.push_back("has_terminal_marker = true");
        }

        auto scr = ctx.req().query_param("script");
        if (scr && (*scr == "true" || *scr == "1")) {
            conditions.push_back("has_script_device = true");
        }

        std::string where_sql;
        if (!conditions.empty()) {
            where_sql = " WHERE ";
            for (size_t i = 0; i < conditions.size(); ++i) {
                if (i > 0) where_sql += " AND ";
                where_sql += conditions[i];
            }
        }

        // Count total matching accounts
        ingest::DuckResult count_res(state.duck->conn(), "SELECT count(*) FROM accounts" + where_sql);
        int64_t total = (count_res.ok && count_res.row_count() > 0) ? count_res.get_int64(0, 0) : 0;
        int total_pages = total > 0 ? static_cast<int>((total + limit - 1) / limit) : 0;

        std::string items = state.duck->query_json(
            "SELECT account_id, mule_score, layer, in_degree, out_degree, "
            "       total_in, total_out, tx_count, bank, "
            "       has_foreign_ip, has_terminal_marker, has_script_device, "
            "       score_pt, score_terminal, score_topo, score_burst, score_device, "
            "       pt_ratio, terminal_ratio "
            "FROM accounts" + where_sql +
            " ORDER BY mule_score DESC LIMIT " + std::to_string(limit) +
            " OFFSET " + std::to_string(offset)
        );

        std::string res = "{\"total\":" + std::to_string(total) +
                          ",\"page\":" + std::to_string(page) +
                          ",\"limit\":" + std::to_string(limit) +
                          ",\"total_pages\":" + std::to_string(total_pages) +
                          ",\"items\":" + items + "}";
        ctx.res().json(res);
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
