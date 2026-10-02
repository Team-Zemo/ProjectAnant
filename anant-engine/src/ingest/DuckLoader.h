#pragma once

// DuckDB C API (prebuilt release ships duckdb.h, not the C++ duckdb.hpp)
extern "C" {
#include "duckdb/duckdb.h"
}

#include <string>
#include <string_view>
#include <vector>
#include <optional>
#include <functional>
#include <chrono>
#include <atomic>
#include <stdexcept>

namespace anant::ingest {

// ─────────────────────────────────────────────────────────────────────────────
// IngestStats — reported via SSE during loading
// ─────────────────────────────────────────────────────────────────────────────

struct IngestStats {
    std::atomic<uint64_t> rows_loaded{0};
    std::atomic<uint64_t> unique_accounts{0};
    std::atomic<uint64_t> victim_accounts{0};
    std::atomic<bool>     done{false};
    std::atomic<int>      pct{0};
    std::string           error;
    std::chrono::steady_clock::time_point started_at;
};

// ─────────────────────────────────────────────────────────────────────────────
// DuckResult — RAII wrapper for duckdb_result
// ─────────────────────────────────────────────────────────────────────────────

struct DuckResult {
    mutable duckdb_result r{};
    bool ok{false};

    explicit DuckResult(duckdb_connection conn, const std::string& sql) {
        ok = (duckdb_query(conn, sql.c_str(), &r) == DuckDBSuccess);
    }
    ~DuckResult() { duckdb_destroy_result(&r); }

    bool has_error() const { return !ok; }
    std::string error_msg() const {
        if (ok) return "";
        const char* err = duckdb_result_error(&r);
        return err ? err : "";
    }
    idx_t row_count() const { return duckdb_row_count(&r); }
    idx_t col_count() const { return duckdb_column_count(&r); }

    int64_t get_int64(idx_t col, idx_t row) {
        return duckdb_value_int64(&r, col, row);
    }
    double get_double(idx_t col, idx_t row) {
        return duckdb_value_double(&r, col, row);
    }
    std::string get_string(idx_t col, idx_t row) {
        auto* v = duckdb_value_varchar(&r, col, row);
        std::string s = v ? v : "";
        duckdb_free(v);
        return s;
    }
    bool get_bool(idx_t col, idx_t row) {
        return duckdb_value_boolean(&r, col, row);
    }

    // Disallow copy
    DuckResult(const DuckResult&) = delete;
    DuckResult& operator=(const DuckResult&) = delete;
};

// ─────────────────────────────────────────────────────────────────────────────
// DuckLoader — streams CSV into DuckDB (C API), builds OLAP tables
// ─────────────────────────────────────────────────────────────────────────────

class DuckLoader {
public:
    DuckLoader();
    ~DuckLoader();

    DuckLoader(const DuckLoader&)            = delete;
    DuckLoader& operator=(const DuckLoader&) = delete;

    /// Load one or more CSV files into DuckDB.
    /// Returns elapsed milliseconds.
    uint64_t load(const std::vector<std::string>& csv_paths,
                  std::function<void(int pct, uint64_t rows)> progress_cb = {});

    uint64_t load(const std::string& csv_path,
                  std::function<void(int pct, uint64_t rows)> progress_cb = {}) {
        return load(std::vector<std::string>{csv_path}, std::move(progress_cb));
    }

    /// Run SQL and return JSON string array
    std::string query_json(const std::string& sql);

    /// Account summary stats
    struct AccountStats {
        std::string account_id;
        double total_in{0};
        double total_out{0};
        int64_t tx_count{0};
        int64_t in_degree{0};
        int64_t out_degree{0};
        int32_t layer{0};
        int64_t first_seen{0};
        int64_t last_seen{0};
        std::string bank;
        bool has_foreign_ip{false};
        bool has_terminal_marker{false};
        bool has_script_device{false};
        double mule_score{0};
        double score_pt{0};
        double score_terminal{0};
        double score_topo{0};
        double score_burst{0};
        double score_device{0};
        double pt_ratio{0};
        double terminal_ratio{0};
        std::string syndicate_id;
        std::string syndicate_role;
    };
    AccountStats account_stats(const std::string& account_id);

    /// Top N accounts by mule_score
    std::vector<std::pair<std::string,double>> top_risk_accounts(int n = 50);

    bool is_loaded() const { return loaded_ && stats_.rows_loaded.load() > 0; }
    void reset() {
        loaded_ = false;
        stats_.rows_loaded.store(0);
        stats_.unique_accounts.store(0);
        stats_.done.store(false);
        stats_.pct.store(0);
    }
    IngestStats& stats() { return stats_; }

    /// Execute any SQL (void return)
    void exec(const std::string& sql);

    /// Return raw connection (for advanced use)
    duckdb_connection conn() const { return conn_; }

private:
    duckdb_database   db_{nullptr};
    duckdb_connection conn_{nullptr};
    bool              loaded_{false};
    IngestStats       stats_;
};

// ─────────────────────────────────────────────────────────────────────────────
// Normalizer utilities
// ─────────────────────────────────────────────────────────────────────────────

namespace normalize {

inline bool is_foreign_ip(std::string_view ip) noexcept {
    if (ip.size() < 4) return false;
    return (ip[0]=='1' && ip[1]=='8' && ip[2]=='5' && ip[3]=='.') ||
           (ip[0]=='1' && ip[1]=='9' && ip[2]=='4' && ip[3]=='.');
}

inline bool is_terminal_narration(std::string_view n) noexcept {
    return n.find("CRYPTO") != std::string_view::npos ||
           n.find("P2P")    != std::string_view::npos ||
           n.find("WALLET") != std::string_view::npos;
}

inline bool is_script_device(std::string_view d) noexcept {
    return d == "Web_Emulator" || d == "Linux_Script";
}

} // namespace normalize
} // namespace anant::ingest
