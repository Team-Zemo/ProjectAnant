#include "MuleScorer.h"
#include <iostream>

namespace anant::graph {

void MuleScorer::score_all(std::function<void(int)> progress_cb) {
    std::cout << "[MuleScorer] Calculating Mule Risk Index for all accounts...\n";

    // ── 1. Ensure columns exist with correct types ───────────────────────────
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_velocity DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_fan_in   DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_fan_out  DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_terminal DOUBLE DEFAULT 0.0");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_device   DOUBLE DEFAULT 0.0");

    if (progress_cb) progress_cb(10);
    score_velocity(progress_cb);
    if (progress_cb) progress_cb(35);
    score_degree(progress_cb);
    if (progress_cb) progress_cb(60);
    score_terminal(progress_cb);
    if (progress_cb) progress_cb(80);
    finalize(progress_cb);
    if (progress_cb) progress_cb(90);
    sync_to_memgraph();
    if (progress_cb) progress_cb(100);
}

void MuleScorer::score_velocity(std::function<void(int)>&) {
    // Pass-through ratio (max 30 pts)
    duck_.exec(R"SQL(
        UPDATE accounts SET score_velocity = CASE 
            WHEN total_in >= 1000.0 AND total_out >= 1000.0 THEN
                CASE
                    WHEN (total_out / total_in) BETWEEN 0.80 AND 1.20 THEN 30.0
                    WHEN (total_out / total_in) BETWEEN 0.60 AND 1.50 THEN 18.0
                    WHEN (total_out / total_in) BETWEEN 0.40 AND 2.00 THEN 10.0
                    ELSE 2.0
                END
            ELSE 0.0
        END
    )SQL");
}

void MuleScorer::score_degree(std::function<void(int)>&) {
    // Fan-in / Collector Degree (max 25 pts)
    duck_.exec(R"SQL(
        UPDATE accounts SET score_fan_in = CASE
            WHEN in_degree >= 50 THEN 25.0
            WHEN in_degree >= 15 THEN 20.0
            WHEN in_degree >= 5  THEN 12.0
            WHEN in_degree >= 2  THEN 5.0
            ELSE 0.0
        END
    )SQL");

    // Fan-out / Layering Degree (max 20 pts)
    duck_.exec(R"SQL(
        UPDATE accounts SET score_fan_out = CASE
            WHEN out_degree BETWEEN 3 AND 25 THEN 20.0
            WHEN out_degree > 25             THEN 15.0
            WHEN out_degree >= 2             THEN 10.0
            ELSE 0.0
        END
    )SQL");
}

void MuleScorer::score_terminal(std::function<void(int)>&) {
    // Terminal marker: 15 pts
    duck_.exec(R"SQL(
        UPDATE accounts SET score_terminal = CASE 
            WHEN has_terminal_marker THEN 15.0 
            ELSE 0.0 
        END
    )SQL");

    // Cyber flags: Foreign IP (5 pts) + Script Device (5 pts)
    duck_.exec(R"SQL(
        UPDATE accounts SET score_device = 
            (CASE WHEN has_foreign_ip THEN 5.0 ELSE 0.0 END) +
            (CASE WHEN has_script_device THEN 5.0 ELSE 0.0 END)
    )SQL");
}

void MuleScorer::finalize(std::function<void(int)>&) {
    // Composite Mule Risk Index, clamped to [0, 100]
    duck_.exec(R"SQL(
        UPDATE accounts SET mule_score = LEAST(100.0,
            score_velocity + score_fan_in + score_fan_out +
            score_terminal + score_device
        )
    )SQL");

    // Classify Layers:
    // L3 Terminal: Terminal marker OR Foreign IP
    // L1 Collector: In-degree >= 5
    // L2 Distributor: Out-degree >= 3
    duck_.exec(R"SQL(
        UPDATE accounts SET layer = CASE
            WHEN has_terminal_marker OR has_foreign_ip THEN 3
            WHEN in_degree >= 5 AND (out_degree < 3 OR mule_score >= 50) THEN 1
            WHEN out_degree >= 3 THEN 2
            ELSE 0
        END
    )SQL");

    auto flagged = duck_.query_json("SELECT COUNT(*) AS cnt FROM accounts WHERE mule_score >= 50");
    std::cout << "[MuleScorer] High-risk accounts (≥50): " << flagged << "\n";
}

void MuleScorer::sync_to_memgraph() {
    if (!graph_.is_connected()) {
        std::cout << "[MuleScorer] Memgraph not connected, skipping score sync\n";
        return;
    }

    // Export scored accounts CSV for Memgraph LOAD CSV (/data in container maps to /tmp on host)
    duck_.exec("COPY (SELECT account_id, bank, mule_score, layer, in_degree, out_degree "
               "FROM accounts) TO '/tmp/anant_accounts.csv' (HEADER TRUE)");

    // Update Memgraph nodes with scores and layers
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
