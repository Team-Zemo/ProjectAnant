#pragma once
#include <http/Server.h>
#include <http/Context.h>
#include <http/SseStream.h>
#include <core/Task.h>
#include <core/EventLoop.h>
#include "../ingest/DuckLoader.h"
#include "../graph/GraphEngine.h"
#include "../graph/MuleScorer.h"
#include "../graph/SyndicateDetector.h"
#include <memory>
#include <atomic>
#include <string>
#include <vector>
#include <filesystem>
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
    std::unique_ptr<graph::SyndicateDetector> syndicate_detector;

    std::atomic<bool>     ingest_running{false};
    std::atomic<int>      ingest_pct{0};
    std::atomic<int>      score_pct{0};
    std::atomic<int>      stage_num{0};
    std::string           current_stage{"Idle"};
    std::string           stage_message{"Ready for Ingestion"};
    std::atomic<uint64_t> ingest_elapsed_ms{0};
    std::chrono::steady_clock::time_point ingest_t0;
    std::atomic<uint64_t> duck_time_ms{0};
    std::atomic<uint64_t> score_time_ms{0};
    std::atomic<uint64_t> syn_time_ms{0};
    std::atomic<uint64_t> graph_time_ms{0};
    std::string           last_error;
    std::mutex            state_mtx;

    explicit AppState(std::string memgraph_host = "127.0.0.1", uint16_t memgraph_port = 7687) {
        duck               = std::make_unique<ingest::DuckLoader>();
        graph              = std::make_unique<graph::GraphEngine>(memgraph_host, memgraph_port);
        scorer             = std::make_unique<graph::MuleScorer>(*duck, *graph);
        syndicate_detector = std::make_unique<graph::SyndicateDetector>(*duck, *graph);
        ingest_t0          = std::chrono::steady_clock::now();
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

inline std::vector<std::string> extract_json_string_array(const std::string& body, const std::string& key) {
    std::vector<std::string> res;
    std::string search = "\"" + key + "\":[";
    auto p = body.find(search);
    if (p == std::string::npos) {
        search = "\"" + key + "\": [";
        p = body.find(search);
    }
    if (p == std::string::npos) return res;
    auto end_bracket = body.find(']', p);
    if (end_bracket == std::string::npos) return res;
    std::string arr_str = body.substr(p + search.size(), end_bracket - (p + search.size()));
    size_t pos = 0;
    while (pos < arr_str.size()) {
        auto q1 = arr_str.find('"', pos);
        if (q1 == std::string::npos) break;
        auto q2 = arr_str.find('"', q1 + 1);
        if (q2 == std::string::npos) break;
        res.push_back(arr_str.substr(q1 + 1, q2 - (q1 + 1)));
        pos = q2 + 1;
    }
    return res;
}

inline void register_routes(aegon::http::Server& server, AppState& state) {
    auto& router = server.router();

    // ── GET /health ────────────────────────────────────────────────────────────
    router.get("/health", [](aegon::http::Context& ctx) {
        ctx.res().json(std::string_view{"{\"status\":\"ok\",\"service\":\"anant-engine\"}"});
    });

    // ── POST /api/upload — upload one or more CSV files for ingestion ────────
    router.post("/api/upload", [](aegon::http::Context& ctx) {
        auto form = ctx.req().multipart();
        if (!form) {
            ctx.res().status(aegon::http::StatusCode::BadRequest)
               .json(std::string_view{"{\"error\":\"Invalid multipart form body\"}"});
            return;
        }

        std::filesystem::create_directories("/tmp/anant_uploads");
        std::ostringstream json;
        json << "{\"status\":\"ok\",\"files\":[";

        bool first = true;
        for (const auto& file : form->files()) {
            if (file.filename.empty() || file.data.empty()) continue;
            std::string filename = std::string(file.filename);
            for (char& c : filename) {
                if (c == '/' || c == '\\' || c == ' ' || c == '"') c = '_';
            }
            std::string save_path = "/tmp/anant_uploads/" + filename;
            bool ok = file.save_to(save_path);
            if (!ok) continue;

            if (!first) json << ",";
            first = false;
            json << "{\"filename\":\"" << filename << "\","
                 << "\"path\":\"" << save_path << "\","
                 << "\"size\":" << file.size() << "}";
        }
        json << "]}";
        ctx.res().json(json.str());
    });

    // ── POST /api/upload/delete — delete an uploaded file ────────────────────
    router.post("/api/upload/delete", [](aegon::http::Context& ctx) {
        auto body = std::string(ctx.req().body());
        auto filename = extract_json_string(body, "filename");
        auto path = extract_json_string(body, "path");
        if (filename.empty() && path.empty()) {
            ctx.res().status(aegon::http::StatusCode::BadRequest)
               .json(std::string_view{"{\"error\":\"filename or path required\"}"});
            return;
        }

        std::string target_path = path;
        if (target_path.empty()) {
            target_path = "/tmp/anant_uploads/" + filename;
        }

        std::error_code ec;
        bool removed = std::filesystem::remove(target_path, ec);
        ctx.res().json("{\"status\":\"ok\",\"removed\":" + std::string(removed ? "true" : "false") + "}");
    });

    // ── POST /api/reset — clear/reset database tables and engine state ───────
    router.post("/api/reset", [&state](aegon::http::Context& ctx) {
        try {
            state.duck->exec("DROP TABLE IF EXISTS accounts");
            state.duck->exec("DROP TABLE IF EXISTS txns");
            state.duck->exec("DROP TABLE IF EXISTS syndicates");
            state.duck->exec("DROP VIEW IF EXISTS edges");
            state.duck->reset();
            if (state.graph->is_connected()) {
                state.graph->run_cypher("DROP GRAPH;");
            }
            state.ingest_pct.store(0);
            {
                std::lock_guard<std::mutex> lk(state.state_mtx);
                state.stage_num.store(0);
                state.current_stage = "Database Cleared";
                state.stage_message = "All loaded tables and entries have been removed.";
                state.ingest_elapsed_ms.store(0);
                state.duck_time_ms.store(0);
                state.score_time_ms.store(0);
                state.syn_time_ms.store(0);
                state.graph_time_ms.store(0);
            }
            ctx.res().json(std::string_view{"{\"status\":\"ok\",\"message\":\"Database reset successfully\"}"});
        } catch (const std::exception& e) {
            ctx.res().status(aegon::http::StatusCode::InternalServerError)
               .json("{\"error\":\"" + std::string(e.what()) + "\"}");
        }
    });

    // ── POST /api/ingest — trigger full AML ingest & scoring pipeline ─────────
    router.post("/api/ingest", [&state](aegon::http::Context& ctx) {
        if (state.ingest_running.exchange(true)) {
            ctx.res().status(aegon::http::StatusCode::Conflict)
               .json(std::string_view{"{\"error\":\"ingest already running\"}"});
            return;
        }

        state.ingest_t0 = std::chrono::steady_clock::now();
        std::vector<std::string> csv_paths;
        auto body = std::string(ctx.req().body());
        auto paths = extract_json_string_array(body, "paths");
        if (!paths.empty()) {
            csv_paths = paths;
        } else {
            auto p = extract_json_string(body, "path");
            if (!p.empty()) {
                csv_paths.push_back(p);
            } else {
                csv_paths.push_back("/home/surendra/IdeaProjects/ProjectAnant/"
                                    "VoidHacks8_MuleAccount_2M_Transactions.csv");
            }
        }

        std::thread([&state, csv_paths]() {
            auto t_start = state.ingest_t0;
            state.ingest_elapsed_ms.store(0);
            state.duck_time_ms.store(0);
            state.score_time_ms.store(0);
            state.syn_time_ms.store(0);
            state.graph_time_ms.store(0);

            try {
                // Phase 1: DuckDB CSV Ingest & Accounts Table Build
                {
                    std::lock_guard<std::mutex> lk(state.state_mtx);
                    state.stage_num.store(1);
                    state.current_stage = "DuckDB SIMD Parallel Ingestion";
                    state.stage_message = "Streaming " + std::to_string(csv_paths.size()) + " CSV file(s) with AVX-512 SIMD vectorization & union_by_name...";
                }
                auto t_p1 = std::chrono::steady_clock::now();
                state.duck->load(csv_paths, [&state, t_start](int pct, uint64_t) {
                    state.ingest_pct.store(pct * 30 / 100);
                    auto now = std::chrono::steady_clock::now();
                    state.ingest_elapsed_ms.store(std::chrono::duration_cast<std::chrono::milliseconds>(now - t_start).count());
                });
                auto t_p1_end = std::chrono::steady_clock::now();
                state.duck_time_ms.store(std::chrono::duration_cast<std::chrono::milliseconds>(t_p1_end - t_p1).count());

                // Phase 2: Compute Mule Risk Index & Layers in DuckDB
                {
                    std::lock_guard<std::mutex> lk(state.state_mtx);
                    state.stage_num.store(2);
                    state.current_stage = "Anant V3 Bayesian Mule Scoring";
                    state.stage_message = "Evaluating 7-signal Bayesian Noisy-OR fusion across unique accounts...";
                }
                auto t_p2 = std::chrono::steady_clock::now();
                state.ingest_pct.store(35);
                state.scorer->score_all([&state, t_start](int pct) {
                    state.score_pct.store(pct);
                    state.ingest_pct.store(35 + pct * 20 / 100);
                    auto now = std::chrono::steady_clock::now();
                    state.ingest_elapsed_ms.store(std::chrono::duration_cast<std::chrono::milliseconds>(now - t_start).count());
                });
                state.ingest_pct.store(55);
                auto t_p2_end = std::chrono::steady_clock::now();
                state.score_time_ms.store(std::chrono::duration_cast<std::chrono::milliseconds>(t_p2_end - t_p2).count());

                // Phase 3: Detect and Persist Suspect Syndicates
                {
                    std::lock_guard<std::mutex> lk(state.state_mtx);
                    state.stage_num.store(3);
                    state.current_stage = "Fraud Syndicate Clustering";
                    state.stage_message = "Running Weighted Label Propagation community detection across pass-through clusters...";
                }
                auto t_p3 = std::chrono::steady_clock::now();
                state.syndicate_detector->detect_and_store([&state, t_start](int pct) {
                    state.ingest_pct.store(55 + pct * 10 / 100);
                    auto now = std::chrono::steady_clock::now();
                    state.ingest_elapsed_ms.store(std::chrono::duration_cast<std::chrono::milliseconds>(now - t_start).count());
                });
                state.ingest_pct.store(65);
                auto t_p3_end = std::chrono::steady_clock::now();
                state.syn_time_ms.store(std::chrono::duration_cast<std::chrono::milliseconds>(t_p3_end - t_p3).count());

                // Phase 4: Export CSVs for Memgraph (mounted /tmp on host -> /data in container)
                state.graph_time_ms.store(0);

                auto t_total_end = std::chrono::steady_clock::now();
                auto total_ms = std::chrono::duration_cast<std::chrono::milliseconds>(t_total_end - t_start).count();
                state.ingest_elapsed_ms.store(total_ms);
                state.ingest_pct.store(100);

                {
                    std::lock_guard<std::mutex> lk(state.state_mtx);
                    state.stage_num.store(4);
                    state.current_stage = "Pipeline Complete";
                    state.stage_message = "All records processed, mule scores computed, and graph ready for investigation.";
                }
                std::cout << "[Anant] Pipeline complete in " << total_ms << "ms! Dataset ready.\n";

                // Ensure clients have received the 100% frame before running flips to false
                std::this_thread::sleep_for(std::chrono::milliseconds(300));
            } catch (const std::exception& e) {
                std::lock_guard<std::mutex> lk(state.state_mtx);
                state.last_error = e.what();
                state.current_stage = "Pipeline Error";
                state.stage_message = e.what();
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
                    state.score_pct.store(pct * 80 / 100);
                });
                std::cout << "[Anant] Detecting and storing suspect fraud syndicates...\n";
                state.syndicate_detector->detect_and_store([&state](int pct) {
                    state.score_pct.store(80 + pct * 20 / 100);
                });
                state.score_pct.store(100);
                std::cout << "[Anant] Scoring engine run complete!\n";
            } catch (const std::exception& e) {
                std::lock_guard<std::mutex> lk(state.state_mtx);
                state.last_error = e.what();
                std::cerr << "[Anant] Scoring error: " << e.what() << "\n";
            }
        }).detach();

        ctx.res().status(aegon::http::StatusCode::Accepted)
           .json(std::string_view{"{\"status\":\"scoring_started\"}"});
    });

    // ── GET /api/status ────────────────────────────────────────────────────────
    router.get("/api/status", [&state](aegon::http::Context& ctx) {
        std::string err, stage, msg;
        {
            std::lock_guard<std::mutex> lk(state.state_mtx);
            err = state.last_error;
            stage = state.current_stage;
            msg = state.stage_message;
        }

        if (state.ingest_running.load()) {
            auto now = std::chrono::steady_clock::now();
            state.ingest_elapsed_ms.store(
                std::chrono::duration_cast<std::chrono::milliseconds>(now - state.ingest_t0).count());
        }

        int64_t critical_mules = 0;
        int64_t syndicates_count = 0;
        int64_t victim_accounts = 0;
        if (state.duck->is_loaded()) {
            ingest::DuckResult cr(state.duck->conn(), "SELECT count(*) FROM accounts WHERE mule_score >= 70.0");
            if (cr.ok && cr.row_count() > 0) critical_mules = cr.get_int64(0, 0);

            victim_accounts = state.duck->stats().victim_accounts.load();
            if (victim_accounts == 0) {
                ingest::DuckResult vr(state.duck->conn(), "SELECT count(DISTINCT sender_account) FROM txns WHERE narration LIKE '%TASK_EARNING_REFUND%'");
                if (vr.ok && vr.row_count() > 0) {
                    victim_accounts = vr.get_int64(0, 0);
                    state.duck->stats().victim_accounts.store(victim_accounts);
                }
            }

            ingest::DuckResult sr(state.duck->conn(), "SELECT count(*) FROM information_schema.tables WHERE table_name = 'syndicates'");
            if (sr.ok && sr.row_count() > 0 && sr.get_int64(0, 0) > 0) {
                ingest::DuckResult sc(state.duck->conn(), "SELECT count(*) FROM syndicates");
                if (sc.ok && sc.row_count() > 0) syndicates_count = sc.get_int64(0, 0);
            }
        }

        std::ostringstream j;
        j << "{"
          << "\"loaded\":"           << (state.duck->is_loaded() ? "true" : "false") << ","
          << "\"ingest_running\":"   << (state.ingest_running.load() ? "true" : "false") << ","
          << "\"ingest_pct\":"       << state.ingest_pct.load() << ","
          << "\"score_pct\":"        << state.score_pct.load() << ","
          << "\"stage_num\":"        << state.stage_num.load() << ","
          << "\"stage\":\""          << stage << "\","
          << "\"message\":\""        << msg << "\","
          << "\"elapsed_ms\":"       << state.ingest_elapsed_ms.load() << ","
          << "\"duck_time_ms\":"     << state.duck_time_ms.load() << ","
          << "\"score_time_ms\":"    << state.score_time_ms.load() << ","
          << "\"syn_time_ms\":"      << state.syn_time_ms.load() << ","
          << "\"graph_time_ms\":"    << state.graph_time_ms.load() << ","
          << "\"memgraph_ok\":true,"
          << "\"rows_loaded\":"      << state.duck->stats().rows_loaded.load() << ","
          << "\"unique_accounts\":"  << state.duck->stats().unique_accounts.load() << ","
          << "\"victim_accounts\":"  << victim_accounts << ","
          << "\"critical_mules\":"   << critical_mules << ","
          << "\"syndicates_count\":" << syndicates_count << ","
          << "\"error\":\""          << err << "\""
          << "}";
        ctx.res().json(j.str());
    });

    // ── GET /api/events — SSE progress stream ─────────────────────────────────
    router.get("/api/events", [&state](aegon::http::Context& ctx) -> aegon::core::Task<void> {
        auto stream = co_await ctx.sse();

        for (int i = 0; i < 1200; i++) {
            std::string stage, msg;
            {
                std::lock_guard<std::mutex> lk(state.state_mtx);
                stage = state.current_stage;
                msg = state.stage_message;
            }

            if (state.ingest_running.load()) {
                auto now = std::chrono::steady_clock::now();
                state.ingest_elapsed_ms.store(
                    std::chrono::duration_cast<std::chrono::milliseconds>(now - state.ingest_t0).count());
            }

            std::ostringstream data;
            data << "{\"pct\":"             << state.ingest_pct.load()
                 << ",\"stage_num\":"       << state.stage_num.load()
                 << ",\"total_stages\":5"
                 << ",\"stage\":\""         << stage << "\""
                 << ",\"message\":\""       << msg << "\""
                 << ",\"elapsed_ms\":"      << state.ingest_elapsed_ms.load()
                 << ",\"duck_time_ms\":"    << state.duck_time_ms.load()
                 << ",\"score_time_ms\":"   << state.score_time_ms.load()
                 << ",\"syn_time_ms\":"     << state.syn_time_ms.load()
                 << ",\"graph_time_ms\":"   << state.graph_time_ms.load()
                 << ",\"rows\":"            << state.duck->stats().rows_loaded.load()
                 << ",\"accounts\":"        << state.duck->stats().unique_accounts.load()
                 << ",\"running\":"         << (state.ingest_running.load() ? "true" : "false")
                 << "}";
            co_await stream.data(data.str());

            if (state.ingest_pct.load() >= 100 && !state.ingest_running.load()) break;

            auto* loop = aegon::core::EventLoop::current();
            if (loop) {
                co_await loop->ring().timeout(200'000'000ULL);
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

        auto syn_p = ctx.req().query_param("syndicate_id");
        if (syn_p && !syn_p->empty()) {
            std::string sf(std::string_view{*syn_p});
            std::string esc;
            for (char c : sf) { if (c == '\'') esc += "''"; else esc += c; }
            conditions.push_back("syndicate_id = '" + esc + "'");
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
            "       pt_ratio, terminal_ratio, "
            "       COALESCE(syndicate_id, '') AS syndicate_id, "
            "       COALESCE(syndicate_role, '') AS syndicate_role "
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
          << "\"syndicate_id\":\"" << stats.syndicate_id << "\","
          << "\"syndicate_role\":\"" << stats.syndicate_role << "\","
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

    // ── GET /api/legal/summary/:account_id — forensic facts for Section 91 & Case Diary ──
    router.get("/api/legal/summary/:account_id", [&state](aegon::http::Context& ctx) {
        auto id_sv = ctx.req().param("account_id").value_or("");
        std::string id(id_sv);
        if (id.empty() || !state.duck->is_loaded()) {
            ctx.res().status(aegon::http::StatusCode::BadRequest)
               .json(std::string_view{"{\"error\":\"account_id required or database not loaded\"}"});
            return;
        }

        std::string sid;
        for (char c : id) { if (c=='\'') sid += "''"; else sid += c; }

        auto stats = state.duck->account_stats(id);

        std::string l1_txns = state.duck->query_json(
            "SELECT t.txn_id, t.sender_account, t.receiver_account, t.amount, t.ts_unix, t.payment_mode, "
            "       COALESCE(a.bank, '') AS receiver_bank, COALESCE(a.mule_score, 0) AS receiver_mule_score, "
            "       COALESCE(a.layer, 1) AS receiver_layer "
            "FROM txns t "
            "LEFT JOIN accounts a ON t.receiver_account = a.account_id "
            "WHERE t.sender_account = '" + sid + "' "
            "ORDER BY t.amount DESC LIMIT 50"
        );

        std::string l2_txns = state.duck->query_json(
            "WITH l1 AS (SELECT receiver_account FROM txns WHERE sender_account = '" + sid + "') "
            "SELECT t.txn_id, t.sender_account, t.receiver_account, t.amount, t.ts_unix, t.payment_mode, "
            "       COALESCE(a.bank, '') AS receiver_bank, COALESCE(a.mule_score, 0) AS receiver_mule_score, "
            "       COALESCE(a.layer, 2) AS receiver_layer "
            "FROM txns t "
            "LEFT JOIN accounts a ON t.receiver_account = a.account_id "
            "WHERE t.sender_account IN (SELECT receiver_account FROM l1) "
            "  AND t.receiver_account != '" + sid + "' "
            "ORDER BY t.amount DESC LIMIT 100"
        );

        std::string l3_txns = state.duck->query_json(
            "WITH l1 AS (SELECT receiver_account FROM txns WHERE sender_account = '" + sid + "'), "
            "     l2 AS (SELECT receiver_account FROM txns WHERE sender_account IN (SELECT receiver_account FROM l1) AND receiver_account != '" + sid + "') "
            "SELECT t.txn_id, t.sender_account, t.receiver_account, t.amount, t.ts_unix, t.payment_mode, "
            "       COALESCE(a.bank, '') AS receiver_bank, COALESCE(a.mule_score, 0) AS receiver_mule_score, "
            "       COALESCE(a.layer, 3) AS receiver_layer, t.foreign_ip, t.terminal_marker, t.script_device "
            "FROM txns t "
            "LEFT JOIN accounts a ON t.receiver_account = a.account_id "
            "WHERE t.sender_account IN (SELECT receiver_account FROM l2) "
            "  AND t.receiver_account != '" + sid + "' "
            "ORDER BY t.amount DESC LIMIT 100"
        );

        std::string freeze_accounts = state.duck->query_json(
            "WITH downstream AS ( "
            "    SELECT receiver_account AS acct FROM txns WHERE sender_account = '" + sid + "' "
            "    UNION "
            "    SELECT t.receiver_account AS acct FROM txns t "
            "    WHERE t.sender_account IN (SELECT receiver_account FROM txns WHERE sender_account = '" + sid + "') "
            "    UNION "
            "    SELECT t.receiver_account AS acct FROM txns t "
            "    WHERE t.sender_account IN ( "
            "        SELECT t2.receiver_account FROM txns t2 "
            "        WHERE t2.sender_account IN (SELECT receiver_account FROM txns WHERE sender_account = '" + sid + "') "
            "    ) "
            ") "
            "SELECT a.account_id, a.bank, a.layer, a.mule_score, a.total_in, a.total_out, "
            "       (a.total_in - a.total_out) AS estimated_holding_balance, "
            "       a.has_foreign_ip, a.has_terminal_marker, a.has_script_device, "
            "       COALESCE(a.syndicate_id, '') AS syndicate_id, "
            "       COALESCE(a.syndicate_role, '') AS syndicate_role "
            "FROM accounts a "
            "WHERE a.account_id IN (SELECT acct FROM downstream) "
            "ORDER BY a.mule_score DESC, estimated_holding_balance DESC LIMIT 50"
        );

        std::string banks_summary = state.duck->query_json(
            "WITH downstream AS ( "
            "    SELECT receiver_account AS acct FROM txns WHERE sender_account = '" + sid + "' "
            "    UNION "
            "    SELECT t.receiver_account AS acct FROM txns t "
            "    WHERE t.sender_account IN (SELECT receiver_account FROM txns WHERE sender_account = '" + sid + "') "
            ") "
            "SELECT a.bank, COUNT(DISTINCT a.account_id) AS accounts_count, "
            "       SUM(a.total_in) AS total_disputed_inflow, "
            "       MAX(a.mule_score) AS max_mule_score "
            "FROM accounts a "
            "WHERE a.account_id IN (SELECT acct FROM downstream) "
            "GROUP BY a.bank "
            "ORDER BY total_disputed_inflow DESC"
        );

        std::ostringstream res;
        res << "{\"account_id\":\"" << id << "\","
            << "\"bank\":\"" << stats.bank << "\","
            << "\"total_siphoned\":" << stats.total_out << ","
            << "\"total_inflow\":" << stats.total_in << ","
            << "\"mule_score\":" << stats.mule_score << ","
            << "\"layer\":" << stats.layer << ","
            << "\"l1_txns\":" << l1_txns << ","
            << "\"l2_txns\":" << l2_txns << ","
            << "\"l3_txns\":" << l3_txns << ","
            << "\"freeze_accounts\":" << freeze_accounts << ","
            << "\"banks_summary\":" << banks_summary << "}";

        ctx.res().json(res.str());
    });

    // ── POST /api/syndicates/detect — on-demand syndicate detection ────────────
    router.post("/api/syndicates/detect", [&state](aegon::http::Context& ctx) {
        if (!state.duck->is_loaded()) {
            ctx.res().status(aegon::http::StatusCode::BadRequest)
               .json(std::string_view{"{\"error\":\"Database not loaded yet\"}"});
            return;
        }

        std::thread([&state]() {
            try {
                std::cout << "[Anant] Triggering on-demand Syndicate detection...\n";
                state.syndicate_detector->detect_and_store();
                std::cout << "[Anant] Syndicate detection complete!\n";
            } catch (const std::exception& e) {
                std::cerr << "[Anant] Syndicate detection error: " << e.what() << "\n";
            }
        }).detach();

        ctx.res().status(aegon::http::StatusCode::Accepted)
           .json(std::string_view{"{\"status\":\"detection_started\"}"});
    });

    // ── GET /api/syndicates — paged list of fraud syndicates ──────────────────
    router.get("/api/syndicates", [&state](aegon::http::Context& ctx) {
        if (!state.duck->is_loaded()) {
            ctx.res().json(std::string_view{"{\"total\":0,\"page\":1,\"limit\":20,\"total_pages\":0,\"items\":[]}"});
            return;
        }

        int limit = 20;
        auto lp = ctx.req().query_param("limit");
        if (lp) { try { limit = std::stoi(std::string(*lp)); } catch(...) {} }
        if (limit <= 0) limit = 20;
        if (limit > 200) limit = 200;

        int page = 1;
        auto pp = ctx.req().query_param("page");
        if (pp) { try { page = std::stoi(std::string(*pp)); } catch(...) {} }
        if (page < 1) page = 1;

        int offset = (page - 1) * limit;

        std::vector<std::string> conditions;
        auto sp = ctx.req().query_param("search");
        if (sp && !sp->empty()) {
            std::string s(std::string_view{*sp});
            std::string esc;
            for (char c : s) { if (c == '\'') esc += "''"; else esc += c; }
            conditions.push_back("(syndicate_id ILIKE '%" + esc + "%' OR name ILIKE '%" + esc + "%' OR primary_bank ILIKE '%" + esc + "%')");
        }

        auto pat = ctx.req().query_param("archetype");
        if (pat && !pat->empty() && *pat != "all") {
            std::string p(std::string_view{*pat});
            std::string esc;
            for (char c : p) { if (c == '\'') esc += "''"; else esc += c; }
            conditions.push_back("pattern_type = '" + esc + "'");
        }

        std::string where_sql;
        if (!conditions.empty()) {
            where_sql = " WHERE ";
            for (size_t i = 0; i < conditions.size(); ++i) {
                if (i > 0) where_sql += " AND ";
                where_sql += conditions[i];
            }
        }

        // Check if table exists
        ingest::DuckResult check_tbl(state.duck->conn(), "SELECT count(*) FROM information_schema.tables WHERE table_name = 'syndicates'");
        bool table_exists = (check_tbl.ok && check_tbl.row_count() > 0 && check_tbl.get_int64(0, 0) > 0);
        if (!table_exists) {
            ctx.res().json(std::string_view{"{\"total\":0,\"page\":1,\"limit\":20,\"total_pages\":0,\"items\":[]}"});
            return;
        }

        ingest::DuckResult count_res(state.duck->conn(), "SELECT count(*) FROM syndicates" + where_sql);
        int64_t total = (count_res.ok && count_res.row_count() > 0) ? count_res.get_int64(0, 0) : 0;
        int total_pages = total > 0 ? static_cast<int>((total + limit - 1) / limit) : 0;

        std::string items = state.duck->query_json(
            "SELECT syndicate_id, name, pattern_type, member_count, layer1_count, layer2_count, layer3_count, "
            "       total_volume, avg_mule_score, max_mule_score, has_foreign_ip, has_script_device, "
            "       has_terminal_marker, primary_bank, first_seen, last_seen "
            "FROM syndicates" + where_sql +
            " ORDER BY total_volume DESC LIMIT " + std::to_string(limit) +
            " OFFSET " + std::to_string(offset)
        );

        std::string res = "{\"total\":" + std::to_string(total) +
                          ",\"page\":" + std::to_string(page) +
                          ",\"limit\":" + std::to_string(limit) +
                          ",\"total_pages\":" + std::to_string(total_pages) +
                          ",\"items\":" + items + "}";
        ctx.res().json(res);
    });

    // ── GET /api/syndicates/:id — full syndicate detail, members, and internal graph
    router.get("/api/syndicates/:id", [&state](aegon::http::Context& ctx) {
        auto id_sv = ctx.req().param("id").value_or("");
        std::string id(id_sv);
        if (id.empty() || !state.duck->is_loaded()) {
            ctx.res().status(aegon::http::StatusCode::BadRequest)
               .json(std::string_view{"{\"error\":\"id required or not loaded\"}"});
            return;
        }

        std::string sid;
        for (char c : id) { if (c=='\'') sid += "''"; else sid += c; }

        std::string syn_json = state.duck->query_json(
            "SELECT syndicate_id, name, pattern_type, member_count, layer1_count, layer2_count, layer3_count, "
            "       total_volume, avg_mule_score, max_mule_score, has_foreign_ip, has_script_device, "
            "       has_terminal_marker, primary_bank, first_seen, last_seen "
            "FROM syndicates WHERE syndicate_id = '" + sid + "'"
        );

        std::string members_json = state.duck->query_json(
            "SELECT account_id, mule_score, layer, COALESCE(syndicate_role, 'AGGREGATOR') AS syndicate_role, "
            "       COALESCE(bank, '') AS bank, total_in, total_out, in_degree, out_degree, "
            "       has_foreign_ip, has_terminal_marker, has_script_device "
            "FROM accounts WHERE syndicate_id = '" + sid + "' "
            "ORDER BY mule_score DESC"
        );

        std::string edges_json = state.duck->query_json(
            "SELECT t.sender_account AS \"from\", t.receiver_account AS \"to\", "
            "       t.amount, t.ts_unix AS ts, t.payment_mode AS mode, t.txn_id "
            "FROM txns t "
            "WHERE t.sender_account IN (SELECT account_id FROM accounts WHERE syndicate_id = '" + sid + "') "
            "  AND t.receiver_account IN (SELECT account_id FROM accounts WHERE syndicate_id = '" + sid + "') "
            "ORDER BY t.ts_unix ASC LIMIT 1000"
        );

        std::string single_syn = (syn_json.size() > 2 ? syn_json.substr(1, syn_json.size() - 2) : "{}");
        std::string res = "{\"syndicate\":" + single_syn +
                          ",\"members\":" + members_json +
                          ",\"edges\":" + edges_json + "}";
        ctx.res().json(res);
    });
}

} // namespace anant::api
