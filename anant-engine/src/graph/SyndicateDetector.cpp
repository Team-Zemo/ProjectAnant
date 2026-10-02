#include "SyndicateDetector.h"
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <numeric>
#include <algorithm>
#include <iostream>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <cmath>

namespace anant::graph {

namespace {

struct SuspectNode {
    std::string id;
    double      mule_score{0.0};
    int         layer{0};
    bool        has_foreign{false};
    bool        has_term{false};
    bool        has_script{false};
    std::string bank;
    double      total_in{0.0};
    double      total_out{0.0};
    int         internal_in_deg{0};
    int         internal_out_deg{0};
    std::string role{"AGGREGATOR"};
};

struct InternalEdge {
    int         from_idx;
    int         to_idx;
    double      amount;
    int64_t     ts;
    std::string mode;
    std::string txn_id;
};

struct SyndicateRecord {
    std::string syndicate_id;
    std::string name;
    std::string pattern_type;
    int         member_count{0};
    int         layer1_count{0};
    int         layer2_count{0};
    int         layer3_count{0};
    double      total_volume{0.0};
    double      avg_mule_score{0.0};
    double      max_mule_score{0.0};
    bool        has_foreign_ip{false};
    bool        has_script_device{false};
    bool        has_terminal_marker{false};
    std::string primary_bank;
    int64_t     first_seen{0};
    int64_t     last_seen{0};
    double      priority{0.0};
    std::vector<int> member_indices;
};

bool has_cycle_dfs(int u,
                   const std::vector<std::vector<int>>& adj,
                   std::vector<int>& state)
{
    state[u] = 1; // 1 = in current recursion stack
    for (int v : adj[u]) {
        if (state[v] == 1) return true; // back edge found
        if (state[v] == 0 && has_cycle_dfs(v, adj, state)) return true;
    }
    state[u] = 2; // 2 = completed
    return false;
}

} // namespace

void SyndicateDetector::detect_and_store(std::function<void(int)> progress_cb) {
    std::cout << "[SyndicateDetector] Starting suspect group identification via Graph Community Detection...\n";
    if (progress_cb) progress_cb(5);

    // ── 1. Ensure table schema ────────────────────────────────────────────────
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS syndicate_id VARCHAR DEFAULT NULL");
    duck_.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS syndicate_role VARCHAR DEFAULT NULL");

    // ── 2. Load laundering transactions (Ground truth flags + High-confidence transfers)
    std::cout << "[SyndicateDetector] Querying laundering transactions...\n";
    anant::ingest::DuckResult txn_res(duck_.conn(),
        "SELECT t.sender_account, t.receiver_account, t.amount, t.ts_unix, "
        "       COALESCE(t.payment_mode, 'UNKNOWN'), t.txn_id, "
        "       t.foreign_ip, t.terminal_marker, t.script_device "
        "FROM txns t "
        "WHERE (t.foreign_ip = true OR t.terminal_marker = true OR t.script_device = true) "
        "   OR (t.sender_account IN (SELECT account_id FROM accounts WHERE mule_score >= 70.0) "
        "       AND t.receiver_account IN (SELECT account_id FROM accounts WHERE mule_score >= 70.0))"
    );

    const idx_t num_txns = txn_res.row_count();
    std::cout << "[SyndicateDetector] Loaded " << num_txns << " laundering transfers.\n";

    if (num_txns == 0) {
        std::cout << "[SyndicateDetector] No laundering transactions found.\n";
        return;
    }

    // ── 3. Index all participating accounts ───────────────────────────────────
    std::unordered_map<std::string, int> acct_to_idx;
    std::vector<std::string> idx_to_acct;

    for (idx_t r = 0; r < num_txns; ++r) {
        std::string s = txn_res.get_string(0, r);
        std::string rec = txn_res.get_string(1, r);
        if (acct_to_idx.find(s) == acct_to_idx.end()) {
            acct_to_idx[s] = static_cast<int>(idx_to_acct.size());
            idx_to_acct.push_back(s);
        }
        if (acct_to_idx.find(rec) == acct_to_idx.end()) {
            acct_to_idx[rec] = static_cast<int>(idx_to_acct.size());
            idx_to_acct.push_back(rec);
        }
    }

    const int num_nodes = static_cast<int>(idx_to_acct.size());
    std::cout << "[SyndicateDetector] " << num_nodes << " unique accounts participating in laundering pipelines.\n";

    if (progress_cb) progress_cb(20);

    // ── 4. Retrieve account metadata ──────────────────────────────────────────
    std::vector<SuspectNode> nodes(num_nodes);
    for (int i = 0; i < num_nodes; ++i) {
        nodes[i].id = idx_to_acct[i];
    }

    {
        duck_.exec("CREATE TEMP TABLE temp_candidate_accts (id VARCHAR)");
        const std::string tmp_csv = "/tmp/anant_candidate_ids.csv";
        {
            std::ofstream f(tmp_csv);
            f << "id\n";
            for (const auto& a : idx_to_acct) f << a << "\n";
        }
        duck_.exec("COPY temp_candidate_accts FROM '" + tmp_csv + "' (HEADER TRUE)");
        std::remove(tmp_csv.c_str());

        anant::ingest::DuckResult meta_res(duck_.conn(),
            "SELECT a.account_id, a.mule_score, a.layer, a.has_foreign_ip, a.has_terminal_marker, "
            "       a.has_script_device, COALESCE(a.bank, ''), COALESCE(a.total_in, 0.0), COALESCE(a.total_out, 0.0) "
            "FROM accounts a "
            "INNER JOIN temp_candidate_accts t ON a.account_id = t.id"
        );

        for (idx_t r = 0; r < meta_res.row_count(); ++r) {
            std::string id = meta_res.get_string(0, r);
            auto it = acct_to_idx.find(id);
            if (it != acct_to_idx.end()) {
                SuspectNode& n = nodes[it->second];
                n.mule_score  = meta_res.get_double(1, r);
                n.layer       = static_cast<int>(meta_res.get_int64(2, r));
                n.has_foreign = meta_res.get_bool(3, r);
                n.has_term    = meta_res.get_bool(4, r);
                n.has_script  = meta_res.get_bool(5, r);
                n.bank        = meta_res.get_string(6, r);
                n.total_in    = meta_res.get_double(7, r);
                n.total_out   = meta_res.get_double(8, r);
            }
        }
        duck_.exec("DROP TABLE temp_candidate_accts");
    }

    if (progress_cb) progress_cb(35);

    // ── 5. Build Graph & Weighted Adjacency List ──────────────────────────────
    std::vector<InternalEdge> edges;
    edges.reserve(num_txns);

    // Symmetric weighted adjacency for community detection
    std::vector<std::unordered_map<int, double>> sym_adj(num_nodes);
    // Directed adjacency for flow & cycle analysis
    std::vector<std::vector<int>> dir_adj(num_nodes);

    for (idx_t r = 0; r < num_txns; ++r) {
        std::string sender   = txn_res.get_string(0, r);
        std::string receiver = txn_res.get_string(1, r);

        int u = acct_to_idx[sender];
        int v = acct_to_idx[receiver];
        double amt = txn_res.get_double(2, r);

        edges.push_back(InternalEdge{
            .from_idx = u,
            .to_idx   = v,
            .amount   = amt,
            .ts       = txn_res.get_int64(3, r),
            .mode     = txn_res.get_string(4, r),
            .txn_id   = txn_res.get_string(5, r)
        });

        nodes[u].internal_out_deg++;
        nodes[v].internal_in_deg++;

        dir_adj[u].push_back(v);

        // Weighted symmetric edge (log amount + 1.0 weight)
        double w = 1.0 + std::log1p(amt > 0 ? amt : 1000.0);
        sym_adj[u][v] += w;
        sym_adj[v][u] += w;
    }

    if (progress_cb) progress_cb(45);

    // ── 6. Deterministic Weighted Label Propagation (Community Detection) ────
    std::cout << "[SyndicateDetector] Running Weighted Label Propagation...\n";
    std::vector<int> label(num_nodes);
    std::iota(label.begin(), label.end(), 0);

    for (int iter = 0; iter < 25; ++iter) {
        int changed = 0;
        for (int u = 0; u < num_nodes; ++u) {
            if (sym_adj[u].empty()) continue;

            std::unordered_map<int, double> label_weights;
            for (const auto& [v, weight] : sym_adj[u]) {
                label_weights[label[v]] += weight;
            }

            int best_label = label[u];
            double max_w = -1.0;

            for (const auto& [lbl, w] : label_weights) {
                if (w > max_w || (std::abs(w - max_w) < 1e-6 && lbl < best_label)) {
                    max_w = w;
                    best_label = lbl;
                }
            }

            if (label[u] != best_label) {
                label[u] = best_label;
                changed++;
            }
        }
        if (changed == 0) break;
    }

    if (progress_cb) progress_cb(60);

    // ── 7. Group into Syndicates and Characterize ─────────────────────────────
    std::unordered_map<int, std::vector<int>> comm_members;
    for (int i = 0; i < num_nodes; ++i) {
        comm_members[label[i]].push_back(i);
    }

    std::vector<SyndicateRecord> syndicates;

    for (auto& [lbl, members] : comm_members) {
        if (members.size() < 2) continue; // Discard singletons

        std::unordered_set<int> member_set(members.begin(), members.end());
        double total_vol = 0.0;
        int64_t min_ts   = std::numeric_limits<int64_t>::max();
        int64_t max_ts   = 0;

        // Measure internal edges
        for (int u : members) {
            for (const auto& [v, _] : sym_adj[u]) {
                if (u < v && member_set.count(v)) {
                    // Internal connection
                }
            }
        }

        // Sum transactions between members
        for (const auto& edge : edges) {
            if (member_set.count(edge.from_idx) && member_set.count(edge.to_idx)) {
                total_vol += edge.amount;
                if (edge.ts > 0 && edge.ts < min_ts) min_ts = edge.ts;
                if (edge.ts > max_ts) max_ts = edge.ts;
            }
        }
        if (min_ts == std::numeric_limits<int64_t>::max()) min_ts = 0;

        double sum_score = 0.0;
        double max_score = 0.0;
        bool has_foreign = false;
        bool has_script  = false;
        bool has_term    = false;
        std::unordered_map<std::string, int> bank_counts;

        int l1_count = 0;
        int l2_count = 0;
        int l3_count = 0;

        for (int idx : members) {
            auto& n = nodes[idx];
            sum_score += n.mule_score;
            if (n.mule_score > max_score) max_score = n.mule_score;

            if (n.has_foreign) has_foreign = true;
            if (n.has_script)  has_script  = true;
            if (n.has_term)    has_term    = true;

            if (!n.bank.empty()) {
                std::string bank_prefix = n.bank.size() >= 4 ? n.bank.substr(0, 4) : n.bank;
                bank_counts[bank_prefix]++;
            }

            // Assign operational role
            if (n.has_term || n.has_foreign || n.layer == 3 || (n.internal_out_deg == 0 && n.internal_in_deg > 0)) {
                n.role = "TERMINAL_CASHOUT";
                l3_count++;
            } else if (n.internal_in_deg > 0 && n.internal_out_deg > 0) {
                n.role = "AGGREGATOR";
                l2_count++;
            } else if (n.internal_in_deg == 0 && n.internal_out_deg > 0) {
                n.role = "INFLOW_SMURF";
                l1_count++;
            } else {
                n.role = "AGGREGATOR";
                l2_count++;
            }
        }

        // Dominant bank
        std::string dominant_bank = "MIXED";
        int max_bc = 0;
        for (const auto& [b, cnt] : bank_counts) {
            if (cnt > max_bc) {
                max_bc = cnt;
                dominant_bank = b;
            }
        }

        // Topology Archetype Analysis
        std::unordered_map<int, int> local_id;
        for (size_t i = 0; i < members.size(); ++i) local_id[members[i]] = static_cast<int>(i);

        std::vector<std::vector<int>> local_adj(members.size());
        for (const auto& edge : edges) {
            if (member_set.count(edge.from_idx) && member_set.count(edge.to_idx)) {
                local_adj[local_id[edge.from_idx]].push_back(local_id[edge.to_idx]);
            }
        }

        std::vector<int> state(members.size(), 0);
        bool has_cycle = false;
        for (size_t i = 0; i < members.size(); ++i) {
            if (state[i] == 0 && has_cycle_dfs(static_cast<int>(i), local_adj, state)) {
                has_cycle = true;
                break;
            }
        }

        std::string pattern_type;
        if (has_cycle) {
            pattern_type = "WASH_CYCLE";
        } else if (l1_count >= 2 && l3_count <= 2) {
            pattern_type = "AGGREGATION_HUB";
        } else if (l1_count <= 2 && l3_count >= 3) {
            pattern_type = "DISPERSAL_TREE";
        } else if (l1_count <= 1 && l3_count <= 1 && l2_count >= 1) {
            pattern_type = "MULTI_HOP_CHAIN";
        } else {
            pattern_type = "HYBRID_SYNDICATE";
        }

        double avg_score = sum_score / static_cast<double>(members.size());
        double priority  = (total_vol * (avg_score / 100.0)) + (static_cast<double>(members.size()) * 50000.0);

        SyndicateRecord syn;
        syn.pattern_type        = pattern_type;
        syn.member_count        = static_cast<int>(members.size());
        syn.layer1_count        = l1_count;
        syn.layer2_count        = l2_count;
        syn.layer3_count        = l3_count;
        syn.total_volume        = total_vol;
        syn.avg_mule_score      = avg_score;
        syn.max_mule_score      = max_score;
        syn.has_foreign_ip      = has_foreign;
        syn.has_script_device   = has_script;
        syn.has_terminal_marker = has_term;
        syn.primary_bank        = dominant_bank;
        syn.first_seen          = min_ts;
        syn.last_seen           = max_ts;
        syn.priority            = priority;
        syn.member_indices      = std::move(members);

        syndicates.push_back(std::move(syn));
    }

    if (progress_cb) progress_cb(75);

    // ── 8. Sort by Volume / Priority & Assign IDs ─────────────────────────────
    std::sort(syndicates.begin(), syndicates.end(), [](const SyndicateRecord& a, const SyndicateRecord& b) {
        if (std::abs(a.total_volume - b.total_volume) > 1.0) return a.total_volume > b.total_volume;
        return a.member_count > b.member_count;
    });

    for (size_t s = 0; s < syndicates.size(); ++s) {
        std::ostringstream syn_id_ss;
        syn_id_ss << "SYN-" << std::setw(3) << std::setfill('0') << (s + 1);
        syndicates[s].syndicate_id = syn_id_ss.str();

        std::string label = "Syndicate #" + std::to_string(s + 1) + ": ";
        if (syndicates[s].pattern_type == "AGGREGATION_HUB") label += "Fan-In Smurfing Hub";
        else if (syndicates[s].pattern_type == "DISPERSAL_TREE") label += "Dispersal Tree";
        else if (syndicates[s].pattern_type == "WASH_CYCLE") label += "Circular Wash Ring";
        else if (syndicates[s].pattern_type == "MULTI_HOP_CHAIN") label += "Multi-Hop Pass-Through Chain";
        else label += "Hybrid Laundering Network";

        label += " (" + syndicates[s].primary_bank + ")";
        syndicates[s].name = label;
    }

    std::cout << "[SyndicateDetector] Identified " << syndicates.size() << " distinct suspect fraud syndicates!\n";

    if (progress_cb) progress_cb(85);

    // ── 9. Bulk Persist Syndicates into DuckDB ────────────────────────────────
    duck_.exec("DROP TABLE IF EXISTS syndicates");
    duck_.exec(R"SQL(
        CREATE TABLE syndicates (
            syndicate_id        VARCHAR PRIMARY KEY,
            name                VARCHAR,
            pattern_type        VARCHAR,
            member_count        INTEGER,
            layer1_count        INTEGER,
            layer2_count        INTEGER,
            layer3_count        INTEGER,
            total_volume        DOUBLE,
            avg_mule_score      DOUBLE,
            max_mule_score      DOUBLE,
            has_foreign_ip      BOOLEAN,
            has_script_device   BOOLEAN,
            has_terminal_marker BOOLEAN,
            primary_bank        VARCHAR,
            first_seen          BIGINT,
            last_seen           BIGINT
        )
    )SQL");

    const std::string syn_csv = "/tmp/anant_syndicates.csv";
    {
        std::ofstream csv(syn_csv);
        csv << "syndicate_id,name,pattern_type,member_count,layer1_count,layer2_count,layer3_count,"
               "total_volume,avg_mule_score,max_mule_score,has_foreign_ip,has_script_device,"
               "has_terminal_marker,primary_bank,first_seen,last_seen\n";

        for (const auto& s : syndicates) {
            std::string esc_name = "\"";
            for (char c : s.name) { if (c == '"') esc_name += "\"\""; else esc_name += c; }
            esc_name += "\"";

            csv << s.syndicate_id << ","
                << esc_name << ","
                << s.pattern_type << ","
                << s.member_count << ","
                << s.layer1_count << ","
                << s.layer2_count << ","
                << s.layer3_count << ","
                << std::fixed << std::setprecision(2) << s.total_volume << ","
                << s.avg_mule_score << ","
                << s.max_mule_score << ","
                << (s.has_foreign_ip ? "true" : "false") << ","
                << (s.has_script_device ? "true" : "false") << ","
                << (s.has_terminal_marker ? "true" : "false") << ","
                << s.primary_bank << ","
                << s.first_seen << ","
                << s.last_seen << "\n";
        }
    }

    duck_.exec("COPY syndicates FROM '" + syn_csv + "' (HEADER TRUE)");
    std::remove(syn_csv.c_str());

    // ── 10. Bulk Update Accounts with Syndicate ID and Role ───────────────────
    const std::string acct_syn_csv = "/tmp/anant_account_syndicates.csv";
    {
        std::ofstream csv(acct_syn_csv);
        csv << "account_id,syndicate_id,syndicate_role\n";

        for (const auto& s : syndicates) {
            for (int idx : s.member_indices) {
                const auto& n = nodes[idx];
                csv << n.id << "," << s.syndicate_id << "," << n.role << "\n";
            }
        }
    }

    duck_.exec("CREATE TEMP TABLE temp_acct_syndicates (account_id VARCHAR, syndicate_id VARCHAR, syndicate_role VARCHAR)");
    duck_.exec("COPY temp_acct_syndicates FROM '" + acct_syn_csv + "' (HEADER TRUE)");
    duck_.exec(
        "UPDATE accounts SET "
        "  syndicate_id   = s.syndicate_id, "
        "  syndicate_role = s.syndicate_role "
        "FROM temp_acct_syndicates s "
        "WHERE accounts.account_id = s.account_id"
    );
    duck_.exec("DROP TABLE temp_acct_syndicates");
    std::remove(acct_syn_csv.c_str());

    if (progress_cb) progress_cb(95);

    // ── 11. Sync to Memgraph (if connected) ──────────────────────────────────
    if (graph_.is_connected()) {
        std::cout << "[SyndicateDetector] Syncing syndicate tags to Memgraph...\n";
        graph_.run_cypher("CREATE INDEX ON :Account(syndicate_id)");
        for (const auto& s : syndicates) {
            for (int idx : s.member_indices) {
                const auto& n = nodes[idx];
                std::string cypher = "MATCH (a:Account {id: '" + n.id + "'}) "
                                     "SET a.syndicate_id = '" + s.syndicate_id + "', "
                                     "    a.syndicate_role = '" + n.role + "'";
                if (!graph_.run_cypher(cypher)) {
                    std::cout << "[SyndicateDetector] Memgraph memory limit reached, skipping remaining Memgraph sync.\n";
                    goto memgraph_done;
                }
            }
        }
        memgraph_done:;
    }

    if (progress_cb) progress_cb(100);
    std::cout << "[SyndicateDetector] Suspect group identification and persistence complete!\n";
}

} // namespace anant::graph
