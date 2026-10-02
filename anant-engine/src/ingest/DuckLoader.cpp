#include "DuckLoader.h"
#include <stdexcept>
#include <sstream>
#include <iostream>
#include <chrono>
#include <cstring>

namespace anant::ingest {

DuckLoader::DuckLoader() {
    duckdb_config config;
    duckdb_create_config(&config);
    duckdb_set_config(config, "threads", "4");
    duckdb_set_config(config, "max_memory", "1500MB");
    duckdb_set_config(config, "preserve_insertion_order", "false");

    if (duckdb_open_ext(nullptr, &db_, config, nullptr) != DuckDBSuccess) {
        duckdb_destroy_config(&config);
        throw std::runtime_error("Failed to initialize in-memory DuckDB");
    }
    duckdb_destroy_config(&config);

    if (duckdb_connect(db_, &conn_) != DuckDBSuccess) {
        throw std::runtime_error("Failed to open DuckDB connection");
    }
}

DuckLoader::~DuckLoader() {
    if (conn_) duckdb_disconnect(&conn_);
    if (db_)   duckdb_close(&db_);
}

void DuckLoader::exec(const std::string& sql) {
    duckdb_result res;
    if (duckdb_query(conn_, sql.c_str(), &res) != DuckDBSuccess) {
        std::string err = duckdb_result_error(&res) ? duckdb_result_error(&res) : "unknown";
        duckdb_destroy_result(&res);
        std::cerr << "[DuckDB] SQL error: " << err << "\n  Query: " << sql.substr(0, 120) << "...\n";
        return;
    }
    duckdb_destroy_result(&res);
}

uint64_t DuckLoader::load(const std::vector<std::string>& csv_paths,
                           std::function<void(int pct, uint64_t rows)> progress_cb)
{
    auto t0 = std::chrono::steady_clock::now();
    stats_.pct.store(5);
    if (progress_cb) progress_cb(5, 0);

    if (csv_paths.empty()) {
        throw std::runtime_error("DuckLoader: No CSV paths provided for ingestion.");
    }

    std::string paths_sql = "[";
    for (size_t i = 0; i < csv_paths.size(); ++i) {
        if (i > 0) paths_sql += ", ";
        paths_sql += "'" + csv_paths[i] + "'";
    }
    paths_sql += "]";

    // Clean previous session tables if any
    exec("DROP TABLE IF EXISTS accounts");
    exec("DROP TABLE IF EXISTS txns");

    // ── Step 1: Raw ingest via parallel SIMD CSV reader ───────────────────────
    exec(R"SQL(
        CREATE TABLE txns AS
        SELECT
            Transaction_ID                                              AS txn_id,
            Sender_Account                                              AS sender_account,
            Receiver_Account                                            AS receiver_account,
            Sender_IFSC                                                 AS sender_bank,
            Receiver_IFSC                                               AS receiver_bank,
            Amount                                                      AS amount,
            epoch(Timestamp)                                            AS ts_unix,
            Payment_Mode                                                AS payment_mode,
            Narration                                                   AS narration,
            IP_Address                                                  AS ip_address,
            Device_Type                                                 AS device_type,
            (IP_Address LIKE '185.%' OR IP_Address LIKE '194.%')        AS foreign_ip,
            (Narration LIKE '%CRYPTO%' OR Narration LIKE '%P2P%' 
             OR Narration LIKE '%WALLET%' OR Narration LIKE '%USDT%'
             OR Narration LIKE '%BINANCE%' OR Narration LIKE '%OTC%'
             OR Narration LIKE '%EXCHANGE%')                            AS terminal_marker,
            (Device_Type = 'Web_Emulator' 
             OR Device_Type = 'Linux_Script')                           AS script_device
        FROM read_csv_auto()SQL" + paths_sql + R"SQL(,
            parallel=true,
            header=true,
            union_by_name=true
        )
    )SQL");

    // Count rows loaded
    {
        DuckResult count_res(conn_, "SELECT COUNT(*) FROM txns");
        if (!count_res.has_error() && count_res.row_count() > 0)
            stats_.rows_loaded.store(static_cast<uint64_t>(count_res.get_int64(0, 0)));
    }

    if (progress_cb) progress_cb(40, stats_.rows_loaded.load());

    // ── Step 2: Indexes ───────────────────────────────────────────────────────
    exec("CREATE INDEX IF NOT EXISTS idx_sender   ON txns(sender_account)");
    exec("CREATE INDEX IF NOT EXISTS idx_receiver ON txns(receiver_account)");
    exec("CREATE INDEX IF NOT EXISTS idx_ts       ON txns(ts_unix)");
    if (progress_cb) progress_cb(60, stats_.rows_loaded.load());

    // ── Step 3: Account aggregate table ──────────────────────────────────────
    exec(R"SQL(
        CREATE TABLE accounts AS
        SELECT
            COALESCE(i.acct, o.acct)                     AS account_id,
            COALESCE(i.bank, o.bank)                     AS bank,
            COALESCE(i.in_deg, 0)                        AS in_degree,
            COALESCE(o.out_deg, 0)                       AS out_degree,
            COALESCE(i.total_in, 0.0)                    AS total_in,
            COALESCE(o.total_out, 0.0)                   AS total_out,
            (COALESCE(i.in_cnt, 0) + COALESCE(o.out_cnt, 0)) AS tx_count,
            COALESCE(i.first_seen, o.first_seen)         AS first_seen,
            COALESCE(o.last_seen, i.last_seen)           AS last_seen,
            (COALESCE(i.has_foreign, false) OR COALESCE(o.has_foreign, false)) AS has_foreign_ip,
            (COALESCE(i.has_term, false) OR COALESCE(o.has_term, false))       AS has_terminal_marker,
            (COALESCE(i.has_script, false) OR COALESCE(o.has_script, false))   AS has_script_device,
            CAST(0.0 AS DOUBLE)                          AS mule_score,
            CAST(0 AS INTEGER)                           AS layer,
            CAST(0.0 AS DOUBLE)                          AS score_velocity,
            CAST(0.0 AS DOUBLE)                          AS score_fan_in,
            CAST(0.0 AS DOUBLE)                          AS score_fan_out,
            CAST(0.0 AS DOUBLE)                          AS score_terminal,
            CAST(0.0 AS DOUBLE)                          AS score_device,
            CAST(0.0 AS DOUBLE)                          AS score_pt,
            CAST(0.0 AS DOUBLE)                          AS score_topo,
            CAST(0.0 AS DOUBLE)                          AS score_burst,
            CAST(0.0 AS DOUBLE)                          AS pt_ratio,
            CAST(0.0 AS DOUBLE)                          AS terminal_ratio,
            CAST(NULL AS VARCHAR)                        AS syndicate_id,
            CAST(NULL AS VARCHAR)                        AS syndicate_role,
            CAST(COALESCE(o.is_victim, false) AS BOOLEAN) AS is_victim
        FROM (
            SELECT receiver_account AS acct, ANY_VALUE(receiver_bank) AS bank,
                   COUNT(DISTINCT sender_account) AS in_deg,
                   SUM(amount) AS total_in, COUNT(*) AS in_cnt,
                   MIN(ts_unix) AS first_seen, MAX(ts_unix) AS last_seen,
                   BOOL_OR(foreign_ip) AS has_foreign, BOOL_OR(terminal_marker) AS has_term, BOOL_OR(script_device) AS has_script
            FROM txns GROUP BY receiver_account
        ) i
        FULL OUTER JOIN (
            SELECT sender_account AS acct, ANY_VALUE(sender_bank) AS bank,
                   COUNT(DISTINCT receiver_account) AS out_deg,
                   SUM(amount) AS total_out, COUNT(*) AS out_cnt,
                   MIN(ts_unix) AS first_seen, MAX(ts_unix) AS last_seen,
                   BOOL_OR(foreign_ip) AS has_foreign, BOOL_OR(terminal_marker) AS has_term, BOOL_OR(script_device) AS has_script,
                   BOOL_OR(narration LIKE '%TASK_EARNING_REFUND%') AS is_victim
            FROM txns GROUP BY sender_account
        ) o ON i.acct = o.acct
    )SQL");

    {
        DuckResult acnt(conn_, "SELECT COUNT(*) FROM accounts");
        if (!acnt.has_error() && acnt.row_count() > 0)
            stats_.unique_accounts.store(static_cast<uint64_t>(acnt.get_int64(0,0)));

        DuckResult vcnt(conn_, "SELECT COUNT(DISTINCT sender_account) FROM txns WHERE narration LIKE '%TASK_EARNING_REFUND%'");
        if (!vcnt.has_error() && vcnt.row_count() > 0)
            stats_.victim_accounts.store(static_cast<uint64_t>(vcnt.get_int64(0,0)));
    }

    if (progress_cb) progress_cb(85, stats_.rows_loaded.load());

    // ── Step 4: Edge export view (for Memgraph LOAD CSV) ─────────────────────
    exec(R"SQL(
        CREATE OR REPLACE VIEW edges AS
        SELECT txn_id, sender_account, receiver_account,
               sender_bank, receiver_bank,
               amount, ts_unix, payment_mode,
               foreign_ip, terminal_marker, script_device
        FROM txns ORDER BY ts_unix ASC
    )SQL");

    loaded_ = true;
    stats_.done.store(true);
    stats_.pct.store(100);
    if (progress_cb) progress_cb(100, stats_.rows_loaded.load());

    auto t1 = std::chrono::steady_clock::now();
    uint64_t ms = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();
    std::cout << "[DuckDB] Loaded " << stats_.rows_loaded.load()
              << " rows in " << ms << "ms (" << stats_.unique_accounts.load() << " unique accounts)\n";
    return ms;
}

std::string DuckLoader::query_json(const std::string& sql) {
    DuckResult res(conn_, sql);
    if (res.has_error()) {
        std::cerr << "[DuckDB] query_json error: " << res.error_msg() << "\n  SQL: " << sql.substr(0, 100) << "...\n";
        return "[]";
    }

    idx_t rows = res.row_count();
    idx_t cols = res.col_count();

    // Get column names
    std::vector<std::string> col_names(cols);
    for (idx_t c = 0; c < cols; c++) {
        const char* name = duckdb_column_name(&res.r, c);
        col_names[c] = name ? name : ("col_" + std::to_string(c));
    }

    std::ostringstream out;
    out << "[";
    for (idx_t r = 0; r < rows; r++) {
        if (r > 0) out << ",";
        out << "{";
        for (idx_t c = 0; c < cols; c++) {
            if (c > 0) out << ",";
            out << "\"" << col_names[c] << "\":";

            auto type = duckdb_column_type(&res.r, c);
            if (type == DUCKDB_TYPE_BOOLEAN) {
                out << (res.get_bool(c, r) ? "true" : "false");
            } else if (type == DUCKDB_TYPE_BIGINT || type == DUCKDB_TYPE_INTEGER ||
                       type == DUCKDB_TYPE_SMALLINT || type == DUCKDB_TYPE_TINYINT) {
                out << res.get_int64(c, r);
            } else if (type == DUCKDB_TYPE_DOUBLE || type == DUCKDB_TYPE_FLOAT) {
                out << res.get_double(c, r);
            } else {
                std::string s = res.get_string(c, r);
                // JSON string escape
                out << "\"";
                for (char ch : s) {
                    if (ch == '"')       out << "\\\"";
                    else if (ch == '\\') out << "\\\\";
                    else if (ch == '\n') out << "\\n";
                    else if (ch == '\r') out << "\\r";
                    else if (ch == '\t') out << "\\t";
                    else                 out << ch;
                }
                out << "\"";
            }
        }
        out << "}";
    }
    out << "]";
    return out.str();
}

DuckLoader::AccountStats DuckLoader::account_stats(const std::string& id) {
    AccountStats s;
    s.account_id = id;
    std::string safe_id;
    for (char c : id) { if (c=='\'') safe_id += "''"; else safe_id += c; }

    DuckResult res(conn_,
        "SELECT total_in, total_out, tx_count, first_seen, last_seen, bank, "
        "       has_foreign_ip, has_terminal_marker, has_script_device, mule_score, "
        "       in_degree, out_degree, layer, "
        "       COALESCE(score_pt, 0.0), COALESCE(score_terminal, 0.0), "
        "       COALESCE(score_topo, 0.0), COALESCE(score_burst, 0.0), "
        "       COALESCE(pt_ratio, 0.0), COALESCE(terminal_ratio, 0.0), "
        "       COALESCE(score_device, 0.0), "
        "       COALESCE(syndicate_id, ''), COALESCE(syndicate_role, ''), "
        "       COALESCE(is_victim, false) "
        "FROM accounts WHERE account_id = '" + safe_id + "'");

    if (!res.has_error() && res.row_count() > 0) {
        s.total_in            = res.get_double(0, 0);
        s.total_out           = res.get_double(1, 0);
        s.tx_count            = res.get_int64 (2, 0);
        s.first_seen          = res.get_int64 (3, 0);
        s.last_seen           = res.get_int64 (4, 0);
        s.bank                = res.get_string(5, 0);
        s.has_foreign_ip      = res.get_bool  (6, 0);
        s.has_terminal_marker = res.get_bool  (7, 0);
        s.has_script_device   = res.get_bool  (8, 0);
        s.mule_score          = res.get_double(9, 0);
        s.in_degree           = res.get_int64 (10, 0);
        s.out_degree          = res.get_int64 (11, 0);
        s.layer               = static_cast<int32_t>(res.get_int64(12, 0));
        if (res.col_count() >= 19) {
            s.score_pt        = res.get_double(13, 0);
            s.score_terminal  = res.get_double(14, 0);
            s.score_topo      = res.get_double(15, 0);
            s.score_burst     = res.get_double(16, 0);
            s.pt_ratio        = res.get_double(17, 0);
            s.terminal_ratio  = res.get_double(18, 0);
        }
        if (res.col_count() >= 20) {
            s.score_device    = res.get_double(19, 0);
        }
        if (res.col_count() >= 22) {
            s.syndicate_id    = res.get_string(20, 0);
            s.syndicate_role  = res.get_string(21, 0);
        }
        if (res.col_count() >= 23) {
            s.is_victim       = res.get_bool  (22, 0);
        }
    }
    return s;
}

std::vector<std::pair<std::string,double>> DuckLoader::top_risk_accounts(int n) {
    DuckResult res(conn_,
        "SELECT account_id, mule_score FROM accounts "
        "ORDER BY mule_score DESC LIMIT " + std::to_string(n));
    std::vector<std::pair<std::string,double>> out;
    if (res.has_error()) return out;
    for (idx_t r = 0; r < res.row_count(); r++)
        out.emplace_back(res.get_string(0, r), res.get_double(1, r));
    return out;
}

} // namespace anant::ingest
