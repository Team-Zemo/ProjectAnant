#include "MuleScorer.h"
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>
#include <cmath>
#include <fstream>
#include <thread>
#include <chrono>

extern "C" {
#include "duckdb/duckdb.h"
}

namespace anant::graph {

// ─────────────────────────────────────────────────────────────────────────────
// V3 AccountScore — 7-signal Bayesian Noisy-OR fusion
// ─────────────────────────────────────────────────────────────────────────────

struct AccountScore {
    double mule_score{0.0};
    int32_t layer{0};

    // 7 independent probability signals (each 0.0 – 1.0)
    double p_turnover{0.0};    // Turnover conservation ratio
    double p_velocity{0.0};    // Multi-window temporal velocity
    double p_terminal{0.0};    // Terminal cashout ratio
    double p_cyber{0.0};       // Cyber automation fingerprint
    double p_asymmetry{0.0};   // Counterparty asymmetry
    double p_fan{0.0};         // Structural fan pattern
    double p_burst{0.0};       // Dormancy burst index

    // Legacy compat fields for API
    double pt_ratio{0.0};
    double terminal_ratio{0.0};
};

// Smooth sigmoid function: maps x to [0, 1] around threshold
static inline double sigmoid(double x, double threshold, double steepness) {
    return 1.0 / (1.0 + std::exp(-steepness * (x - threshold)));
}

void MuleScorer::score_all(std::function<void(int)> progress_cb) {
    std::cout << "[MuleScorer] Initiating Anant V3 Bayesian Noisy-OR Scoring Engine...\n";
    auto t0 = std::chrono::steady_clock::now();

    if (progress_cb) progress_cb(5);
    execute_scoring(progress_cb);

    if (progress_cb) progress_cb(90);
    sync_to_memgraph();

    if (progress_cb) progress_cb(100);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - t0).count();
    std::cout << "[MuleScorer] Full V3 scoring & Memgraph sync finished in " << ms << "ms.\n";
}

void MuleScorer::execute_scoring(std::function<void(int)> progress_cb) {
    // ── 1. Ensure all score columns exist ────────────────────────────────────
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_velocity DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_fan_in   DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_fan_out  DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_terminal DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_device   DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_pt       DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_topo     DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_burst    DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pt_ratio       DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS terminal_ratio DOUBLE DEFAULT 0.0");

    if (progress_cb) progress_cb(10);

    // ── 2. Create account index mapping table ────────────────────────────────
    duck_.exec(R"SQL(
        CREATE TEMP TABLE acct_map AS
        SELECT
            ROW_NUMBER() OVER() - 1 AS acct_idx,
            account_id,
            COALESCE(bank, '') AS bank,
            COALESCE(total_in, 0.0) AS total_in,
            COALESCE(total_out, 0.0) AS total_out,
            COALESCE(in_degree, 0) AS in_degree,
            COALESCE(out_degree, 0) AS out_degree,
            COALESCE(first_seen, 0) AS first_seen,
            COALESCE(last_seen, 0) AS last_seen,
            COALESCE(has_terminal_marker, false) AS has_terminal_marker,
            COALESCE(has_foreign_ip, false) AS has_foreign_ip,
            COALESCE(has_script_device, false) AS has_script_device,
            COALESCE(tx_count, 0) AS tx_count
        FROM accounts
        ORDER BY account_id;
    )SQL");

    anant::ingest::DuckResult acct_res(duck_.conn(),
        "SELECT acct_idx, account_id, total_in, total_out, first_seen, last_seen, "
        "       has_terminal_marker, has_foreign_ip, has_script_device, "
        "       in_degree, out_degree, tx_count FROM acct_map ORDER BY acct_idx ASC");

    const idx_t num_accounts = acct_res.row_count();
    std::cout << "[MuleScorer V3] Mapping " << num_accounts << " accounts...\n";

    std::vector<std::string> acct_names(num_accounts);
    std::vector<double>  acct_total_in(num_accounts, 0.0);
    std::vector<double>  acct_total_out(num_accounts, 0.0);
    std::vector<int64_t> acct_first_seen(num_accounts, 0);
    std::vector<int64_t> acct_last_seen(num_accounts, 0);
    std::vector<uint8_t> acct_has_term(num_accounts, 0);
    std::vector<uint8_t> acct_has_foreign(num_accounts, 0);
    std::vector<uint8_t> acct_has_script(num_accounts, 0);
    std::vector<int32_t> acct_in_degree(num_accounts, 0);
    std::vector<int32_t> acct_out_degree(num_accounts, 0);
    std::vector<int32_t> acct_tx_count(num_accounts, 0);

    for (idx_t r = 0; r < num_accounts; ++r) {
        int64_t idx = acct_res.get_int64(0, r);
        if (idx >= 0 && (size_t)idx < num_accounts) {
            acct_names[idx]       = acct_res.get_string(1, r);
            acct_total_in[idx]    = acct_res.get_double(2, r);
            acct_total_out[idx]   = acct_res.get_double(3, r);
            acct_first_seen[idx]  = acct_res.get_int64(4, r);
            acct_last_seen[idx]   = acct_res.get_int64(5, r);
            acct_has_term[idx]    = acct_res.get_bool(6, r) ? 1 : 0;
            acct_has_foreign[idx] = acct_res.get_bool(7, r) ? 1 : 0;
            acct_has_script[idx]  = acct_res.get_bool(8, r) ? 1 : 0;
            acct_in_degree[idx]   = static_cast<int32_t>(acct_res.get_int64(9, r));
            acct_out_degree[idx]  = static_cast<int32_t>(acct_res.get_int64(10, r));
            acct_tx_count[idx]    = static_cast<int32_t>(acct_res.get_int64(11, r));
        }
    }

    if (progress_cb) progress_cb(20);

    // ── 3. Build sorted columnar transaction table ───────────────────────────
    duck_.exec(R"SQL(
        CREATE TEMP TABLE sorted_txns AS
        SELECT
            CAST(s.acct_idx AS BIGINT) AS s_idx,
            CAST(r.acct_idx AS BIGINT) AS r_idx,
            CAST(t.amount AS DOUBLE) AS amount,
            CAST(t.ts_unix AS BIGINT) AS ts_unix,
            CAST(CASE WHEN t.terminal_marker THEN 1 ELSE 0 END AS TINYINT) AS is_terminal,
            CAST(CASE WHEN t.script_device THEN 1 ELSE 0 END AS TINYINT) AS is_script,
            CAST(CASE WHEN t.foreign_ip THEN 1 ELSE 0 END AS TINYINT) AS is_foreign
        FROM txns t
        JOIN acct_map s ON t.sender_account = s.account_id
        JOIN acct_map r ON t.receiver_account = r.account_id
        ORDER BY t.ts_unix ASC;
    )SQL");

    if (progress_cb) progress_cb(35);

    // ── 4. Extract into raw contiguous typed arrays ──────────────────────────
    duckdb_result txn_res;
    if (duckdb_query(duck_.conn(), "SELECT s_idx, r_idx, amount, ts_unix, is_terminal, is_script, is_foreign FROM sorted_txns", &txn_res) != DuckDBSuccess) {
        std::cerr << "[MuleScorer] Failed to query sorted_txns: "
                  << (duckdb_result_error(&txn_res) ? duckdb_result_error(&txn_res) : "unknown") << "\n";
        duckdb_destroy_result(&txn_res);
        return;
    }

    idx_t total_rows = duckdb_row_count(&txn_res);
    idx_t num_chunks = duckdb_result_chunk_count(txn_res);
    std::cout << "[MuleScorer V3] Ingesting " << total_rows << " transactions (" << num_chunks << " chunks)...\n";

    std::vector<int32_t> col_s_idx;
    std::vector<int32_t> col_r_idx;
    std::vector<double>  col_amount;
    std::vector<int64_t> col_ts;
    std::vector<int8_t>  col_terminal;
    std::vector<int8_t>  col_script;
    std::vector<int8_t>  col_foreign;

    col_s_idx.reserve(total_rows);
    col_r_idx.reserve(total_rows);
    col_amount.reserve(total_rows);
    col_ts.reserve(total_rows);
    col_terminal.reserve(total_rows);
    col_script.reserve(total_rows);
    col_foreign.reserve(total_rows);

    std::vector<std::vector<uint32_t>> in_txns(num_accounts);
    std::vector<std::vector<uint32_t>> out_txns(num_accounts);

    for (idx_t c = 0; c < num_chunks; ++c) {
        duckdb_data_chunk chunk = duckdb_result_get_chunk(txn_res, c);
        idx_t sz = duckdb_data_chunk_get_size(chunk);

        auto* p_s = (int64_t*)duckdb_vector_get_data(duckdb_data_chunk_get_vector(chunk, 0));
        auto* p_r = (int64_t*)duckdb_vector_get_data(duckdb_data_chunk_get_vector(chunk, 1));
        auto* p_a = (double*)duckdb_vector_get_data(duckdb_data_chunk_get_vector(chunk, 2));
        auto* p_t = (int64_t*)duckdb_vector_get_data(duckdb_data_chunk_get_vector(chunk, 3));
        auto* p_term = (int8_t*)duckdb_vector_get_data(duckdb_data_chunk_get_vector(chunk, 4));
        auto* p_script = (int8_t*)duckdb_vector_get_data(duckdb_data_chunk_get_vector(chunk, 5));
        auto* p_foreign = (int8_t*)duckdb_vector_get_data(duckdb_data_chunk_get_vector(chunk, 6));

        for (idx_t i = 0; i < sz; ++i) {
            uint32_t cur_id = static_cast<uint32_t>(col_s_idx.size());
            int64_t s = p_s[i];
            int64_t r = p_r[i];
            col_s_idx.push_back(static_cast<int32_t>(s));
            col_r_idx.push_back(static_cast<int32_t>(r));
            col_amount.push_back(p_a[i]);
            col_ts.push_back(p_t[i]);
            col_terminal.push_back(p_term[i]);
            col_script.push_back(p_script[i]);
            col_foreign.push_back(p_foreign[i]);

            if (s >= 0 && (size_t)s < num_accounts) out_txns[s].push_back(cur_id);
            if (r >= 0 && (size_t)r < num_accounts) in_txns[r].push_back(cur_id);
        }
        duckdb_destroy_data_chunk(&chunk);
    }
    duckdb_destroy_result(&txn_res);

    duck_.exec("DROP TABLE sorted_txns; DROP TABLE acct_map;");

    if (progress_cb) progress_cb(50);

    // ── 5. Multi-threaded V3 Bayesian Scoring Pass ───────────────────────────
    std::cout << "[MuleScorer V3] Running 7-signal Noisy-OR fusion across " << num_accounts << " accounts...\n";
    std::vector<AccountScore> scores(num_accounts);
    const unsigned int hw_threads = std::thread::hardware_concurrency();
    const unsigned int num_threads = std::max(1u, hw_threads ? hw_threads : 4u);
    std::vector<std::thread> workers;
    workers.reserve(num_threads);

    // Temporal velocity half-life: 30 minutes (1800 seconds)
    constexpr double TAU = 1800.0;

    for (unsigned int tid = 0; tid < num_threads; ++tid) {
        workers.emplace_back([&, tid]() {
            size_t start = (num_accounts * tid) / num_threads;
            size_t end   = (num_accounts * (tid + 1)) / num_threads;

            for (size_t i = start; i < end; ++i) {
                auto& my_in = in_txns[i];
                auto& my_out = out_txns[i];
                const size_t n_in = my_in.size();
                const size_t n_out = my_out.size();

                if (n_in == 0 && n_out == 0) continue;

                double total_in = acct_total_in[i];
                double total_out = acct_total_out[i];
                int64_t first_seen = acct_first_seen[i];
                int64_t last_seen = acct_last_seen[i];
                int32_t in_deg = acct_in_degree[i];
                int32_t out_deg = acct_out_degree[i];

                // Sort per-account transaction lists by timestamp
                std::sort(my_in.begin(), my_in.end(), [&](uint32_t a, uint32_t b) {
                    return col_ts[a] < col_ts[b];
                });
                std::sort(my_out.begin(), my_out.end(), [&](uint32_t a, uint32_t b) {
                    return col_ts[a] < col_ts[b];
                });

                // ═══════════════════════════════════════════════════════════
                // SIGNAL 1: Turnover Conservation Ratio (P_turnover)
                // ═══════════════════════════════════════════════════════════
                double p_turnover = 0.0;
                if (total_in > 0.0 && total_out > 0.0) {
                    double tcr = std::min(total_out, total_in) / std::max(total_out, total_in);
                    // sigmoid centered at 0.85, steepness 15
                    p_turnover = sigmoid(tcr, 0.85, 15.0);
                }

                // ═══════════════════════════════════════════════════════════
                // SIGNAL 2: Temporal Velocity (P_velocity)
                //   Multi-window continuous decay, no hard cutoff
                // ═══════════════════════════════════════════════════════════
                double p_velocity = 0.0;
                if (n_in > 0 && n_out > 0) {
                    double velocity_sum = 0.0;
                    double matched_vol = 0.0;
                    std::vector<uint8_t> out_used(n_out, 0);

                    for (size_t k = 0; k < n_in; ++k) {
                        uint32_t in_id = my_in[k];
                        double a_in = col_amount[in_id];
                        int64_t t_in = col_ts[in_id];

                        // Find the closest unused outgoing txn after this incoming
                        double best_score = 0.0;
                        size_t best_j = SIZE_MAX;
                        for (size_t j = 0; j < n_out; ++j) {
                            if (out_used[j]) continue;
                            uint32_t out_id = my_out[j];
                            int64_t t_out = col_ts[out_id];
                            int64_t dt = t_out - t_in;
                            if (dt < 0) continue;  // outgoing before incoming
                            if (dt > 7200) break;  // 2-hour absolute max (sorted, can break)

                            double amount_match = 1.0 - std::abs(col_amount[out_id] - a_in) / std::max(a_in, 1.0);
                            if (amount_match < 0.0) amount_match = 0.0;
                            double time_score = std::exp(-(double)dt / TAU);
                            double combined = time_score * (0.3 + 0.7 * amount_match);
                            if (combined > best_score) {
                                best_score = combined;
                                best_j = j;
                            }
                        }

                        if (best_j != SIZE_MAX && best_score > 0.05) {
                            out_used[best_j] = 1;
                            velocity_sum += a_in * best_score;
                            matched_vol += a_in;
                        }
                    }

                    double coverage = (total_in > 0.0) ? (matched_vol / total_in) : 0.0;
                    double avg_vel = (matched_vol > 0.0) ? (velocity_sum / matched_vol) : 0.0;
                    p_velocity = avg_vel * std::min(1.0, coverage / 0.6);
                }

                // ═══════════════════════════════════════════════════════════
                // SIGNAL 3: Terminal Cashout Ratio (P_terminal)
                //   Ungated — crypto cashout is suspicious regardless of timing
                // ═══════════════════════════════════════════════════════════
                double term_volume = 0.0;
                for (uint32_t out_id : my_out) {
                    if (col_terminal[out_id]) {
                        term_volume += col_amount[out_id];
                    }
                }
                double p_terminal = (total_out > 0.0) ? (term_volume / total_out) : 0.0;
                double terminal_ratio = p_terminal;

                // ═══════════════════════════════════════════════════════════
                // SIGNAL 4: Cyber Automation Fingerprint (P_cyber)
                // ═══════════════════════════════════════════════════════════
                double script_count = 0.0;
                double foreign_count = 0.0;
                double total_txns_d = (double)(n_in + n_out);
                if (total_txns_d > 0.0) {
                    for (uint32_t in_id : my_in) {
                        if (col_script[in_id]) script_count += 1.0;
                        if (col_foreign[in_id]) foreign_count += 1.0;
                    }
                    for (uint32_t out_id : my_out) {
                        if (col_script[out_id]) script_count += 1.0;
                        if (col_foreign[out_id]) foreign_count += 1.0;
                    }
                }
                double script_ratio = (total_txns_d > 0.0) ? (script_count / total_txns_d) : 0.0;
                double foreign_ratio = (total_txns_d > 0.0) ? (foreign_count / total_txns_d) : 0.0;
                double p_cyber = std::max(script_ratio, foreign_ratio);
                // Boost when both are high
                if (script_ratio > 0.4 && foreign_ratio > 0.4) {
                    p_cyber = std::min(1.0, p_cyber * 1.25);
                }

                // ═══════════════════════════════════════════════════════════
                // SIGNAL 5: Counterparty Asymmetry (P_asymmetry)
                //   Mules receive from set A, forward to completely disjoint set B
                //   Only meaningful for low-degree accounts (high-degree accounts
                //   naturally have disjoint sender/receiver sets)
                // ═══════════════════════════════════════════════════════════
                double p_asymmetry = 0.0;
                if (n_in > 0 && n_out > 0 && (in_deg + out_deg) <= 40) {
                    std::unordered_set<int32_t> senders;
                    std::unordered_set<int32_t> receivers;
                    for (uint32_t in_id : my_in) senders.insert(col_s_idx[in_id]);
                    for (uint32_t out_id : my_out) receivers.insert(col_r_idx[out_id]);

                    // Remove self from both sets
                    senders.erase(static_cast<int32_t>(i));
                    receivers.erase(static_cast<int32_t>(i));

                    if (!senders.empty() || !receivers.empty()) {
                        size_t overlap = 0;
                        for (int32_t s : senders) {
                            if (receivers.count(s)) overlap++;
                        }
                        size_t union_sz = senders.size() + receivers.size() - overlap;
                        double jaccard = (union_sz > 0) ? (double)overlap / (double)union_sz : 0.0;
                        p_asymmetry = (1.0 - jaccard);
                        // Scale down: asymmetry alone is a weak signal
                        p_asymmetry *= 0.5;
                    }
                }

                // ═══════════════════════════════════════════════════════════
                // SIGNAL 6: Structural Fan Pattern (P_fan)
                //   Relay nodes have balanced in/out degree and moderate degree product
                // ═══════════════════════════════════════════════════════════
                double p_fan = 0.0;
                if (in_deg > 0 && out_deg > 0) {
                    double fan_balance = (double)std::min(in_deg, out_deg) / (double)std::max(in_deg, out_deg);
                    double degree_prod = (double)in_deg * (double)out_deg;
                    // sigmoid: degree product of 4+ is suspicious for relay nodes
                    double degree_sig = sigmoid(degree_prod, 4.0, 0.5);
                    p_fan = degree_sig * fan_balance;

                    // Suppress for high-volume merchants (>30 degree both sides, no flags)
                    if (in_deg > 30 && out_deg > 30 &&
                        !acct_has_script[i] && !acct_has_foreign[i] && !acct_has_term[i]) {
                        p_fan *= 0.1;
                    }
                }

                // ═══════════════════════════════════════════════════════════
                // SIGNAL 7: Dormancy Burst Index (P_burst)
                // ═══════════════════════════════════════════════════════════
                double p_burst = 0.0;
                int64_t span = last_seen - first_seen;
                size_t total_txn_count = n_in + n_out;

                if (total_txn_count >= 2) {
                    if (span <= 86400 && total_txn_count >= 3) {
                        // Short-lived throwaway account (all activity within 1 day)
                        p_burst = 0.7;
                    } else if (span >= 604800) {
                        // Long-lived: check for 24h concentration
                        std::vector<std::pair<int64_t, double>> events;
                        events.reserve(total_txn_count);
                        for (uint32_t in_id : my_in)
                            events.emplace_back(col_ts[in_id], col_amount[in_id]);
                        for (uint32_t out_id : my_out)
                            events.emplace_back(col_ts[out_id], col_amount[out_id]);
                        std::sort(events.begin(), events.end());

                        double peak_24h = 0.0;
                        double cur_window = 0.0;
                        size_t left = 0;
                        for (size_t right = 0; right < events.size(); ++right) {
                            cur_window += events[right].second;
                            while (events[right].first - events[left].first > 86400) {
                                cur_window -= events[left].second;
                                left++;
                            }
                            if (cur_window > peak_24h) peak_24h = cur_window;
                        }
                        double total_vol = total_in + total_out;
                        if (total_vol > 0.0) {
                            p_burst = sigmoid(peak_24h / total_vol, 0.6, 10.0);
                        }
                    }
                }

                // ═══════════════════════════════════════════════════════════
                // FINAL: Weighted Noisy-OR Fusion + Layer Classification
                // ═══════════════════════════════════════════════════════════
                //
                // Each signal has a reliability weight that controls how much
                // it contributes to the final score. Strong signals (terminal,
                // cyber, turnover) have high weight. Weak/ambient signals
                // (asymmetry, fan, burst) have low weight.
                //
                // Weighted Noisy-OR: P = 1 - product((1 - P_i)^w_i)

                struct WeightedSignal { double p; double w; };
                WeightedSignal signals[] = {
                    { std::clamp(p_turnover,  0.0, 1.0), 0.30 },   // Strong: turnover conservation
                    { std::clamp(p_velocity,  0.0, 1.0), 0.20 },   // Medium: temporal flow matching
                    { std::clamp(p_terminal,  0.0, 1.0), 0.35 },   // Strong: crypto/wallet cashout
                    { std::clamp(p_cyber,     0.0, 1.0), 0.35 },   // Strong: bot/proxy fingerprint
                    { std::clamp(p_asymmetry, 0.0, 1.0), 0.10 },   // Weak: counterparty disjointness
                    { std::clamp(p_fan,       0.0, 1.0), 0.10 },   // Weak: structural relay pattern
                    { std::clamp(p_burst,     0.0, 1.0), 0.15 },   // Medium: dormancy burst
                };

                double survive = 1.0;
                for (const auto& s : signals) {
                    double p = std::clamp(s.p, 0.0, 1.0);
                    if (p >= 1.0) {
                        survive = 0.0;
                        break;
                    }
                    if (p > 0.0 && s.w > 0.0) {
                        survive *= std::pow(1.0 - p, s.w);
                    }
                }
                double mule_prob = 1.0 - survive;
                if (std::isnan(mule_prob)) mule_prob = 1.0;
                double mule_score = std::min(100.0, std::max(0.0, 100.0 * mule_prob));

                // Layer classification (structural, not score-dependent)
                int32_t layer = 0;
                if (p_terminal >= 0.5) {
                    layer = 3; // Terminal / Cash-Out
                } else if (out_deg > in_deg * 1.5 && p_turnover >= 0.3) {
                    layer = 2; // Distributor / Layering
                } else if (in_deg > out_deg * 1.5 && p_turnover >= 0.3) {
                    layer = 1; // Collector / Aggregator
                } else if (p_turnover >= 0.5 && (n_in > 0 && n_out > 0)) {
                    // Balanced relay
                    layer = 2;
                }

                scores[i] = AccountScore{
                    .mule_score = mule_score,
                    .layer = layer,
                    .p_turnover = p_turnover,
                    .p_velocity = p_velocity,
                    .p_terminal = p_terminal,
                    .p_cyber = p_cyber,
                    .p_asymmetry = p_asymmetry,
                    .p_fan = p_fan,
                    .p_burst = p_burst,
                    .pt_ratio = p_velocity,
                    .terminal_ratio = terminal_ratio
                };
            }
        });
    }

    for (auto& w : workers) {
        w.join();
    }

    if (progress_cb) progress_cb(75);

    // ── 6. Bulk write scores back into DuckDB ────────────────────────────────
    std::cout << "[MuleScorer V3] Writing scores to DuckDB...\n";
    const std::string scores_csv = "/tmp/anant_mule_scores.csv";
    {
        std::ofstream csv(scores_csv);
        csv << "account_id,mule_score,layer,score_velocity,score_terminal,score_fan_out,"
               "score_device,score_pt,score_topo,score_burst,pt_ratio,terminal_ratio\n";
        for (size_t i = 0; i < num_accounts; ++i) {
            const auto& s = scores[i];
            csv << acct_names[i] << ","
                << s.mule_score << ","
                << s.layer << ","
                << s.p_velocity << ","   // score_velocity = p_velocity
                << s.p_terminal << ","   // score_terminal = p_terminal
                << s.p_fan << ","        // score_fan_out = p_fan
                << s.p_cyber << ","      // score_device = p_cyber
                << s.p_turnover << ","   // score_pt = p_turnover
                << s.p_asymmetry << ","  // score_topo = p_asymmetry
                << s.p_burst << ","      // score_burst = p_burst
                << s.pt_ratio << ","
                << s.terminal_ratio << "\n";
        }
    }

    duck_.exec("CREATE TEMP TABLE temp_mule_scores ("
               "  account_id VARCHAR, mule_score DOUBLE, layer INTEGER, "
               "  score_velocity DOUBLE, score_terminal DOUBLE, score_fan_out DOUBLE, "
               "  score_device DOUBLE, score_pt DOUBLE, score_topo DOUBLE, score_burst DOUBLE, "
               "  pt_ratio DOUBLE, terminal_ratio DOUBLE)");
    duck_.exec("COPY temp_mule_scores FROM '" + scores_csv + "' (HEADER TRUE)");
    duck_.exec(
        "UPDATE accounts SET "
        "  mule_score     = s.mule_score, "
        "  layer          = s.layer, "
        "  score_velocity = s.score_velocity, "
        "  score_terminal = s.score_terminal, "
        "  score_fan_out  = s.score_fan_out, "
        "  score_device   = s.score_device, "
        "  score_pt       = s.score_pt, "
        "  score_topo     = s.score_topo, "
        "  score_burst    = s.score_burst, "
        "  pt_ratio       = s.pt_ratio, "
        "  terminal_ratio = s.terminal_ratio "
        "FROM temp_mule_scores s "
        "WHERE accounts.account_id = s.account_id");
    duck_.exec("DROP TABLE temp_mule_scores");
    std::remove(scores_csv.c_str());

    auto flagged = duck_.query_json("SELECT COUNT(*) AS cnt FROM accounts WHERE mule_score >= 50");
    std::cout << "[MuleScorer V3] High-risk accounts (≥50): " << flagged << "\n";
}

void MuleScorer::sync_to_memgraph() {
    if (!graph_.is_connected()) {
        std::cout << "[MuleScorer] Memgraph not connected, skipping score sync\n";
        return;
    }

    std::cout << "[MuleScorer] Exporting updated scores to Memgraph...\n";
    duck_.exec("COPY (SELECT account_id, bank, mule_score, layer, in_degree, out_degree "
               "FROM accounts) TO '/tmp/anant_accounts.csv' (HEADER TRUE)");

    graph_.run_cypher("CREATE INDEX ON :Account(id)");
    graph_.run_cypher("CREATE INDEX ON :Account(mule_score)");
    graph_.run_cypher("CREATE INDEX ON :Account(layer)");

    graph_.run_cypher(
        "LOAD CSV FROM '/data/anant_accounts.csv' WITH HEADER AS row "
        "MERGE (a:Account {id: row.account_id}) "
        "SET a.bank       = row.bank, "
        "    a.mule_score = toFloat(row.mule_score), "
        "    a.layer      = toInteger(row.layer), "
        "    a.in_degree  = toInteger(row.in_degree), "
        "    a.out_degree = toInteger(row.out_degree)"
    );

    std::cout << "[MuleScorer] Score sync to Memgraph complete\n";
}

} // namespace anant::graph
