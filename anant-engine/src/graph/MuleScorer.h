#pragma once
/**
 * MuleScorer — computes the Mule Risk Index (0–100) for each account.
 *
 * This runs AFTER DuckDB ingestion as a one-shot batch pass.
 * Results are written back to the DuckDB `accounts.mule_score` column
 * and then synced into Memgraph node properties.
 *
 * Algorithm (weighted composite):
 *   30pts — Pass-through velocity (≥90% of in-funds dispersed ≤15 min)
 *   20pts — Fan-out score (3–7 distinct outgoing accounts)
 *   20pts — Fan-in score (≥5 distinct incoming accounts)
 *   20pts — Terminal marker (CRYPTO/P2P in narration OR foreign IP)
 *   10pts — Script device (Web_Emulator / Linux_Script)
 */

#include "../ingest/DuckLoader.h"
#include "../graph/GraphEngine.h"
#include <functional>
#include <string>

namespace anant::graph {

class MuleScorer {
public:
    MuleScorer(anant::ingest::DuckLoader& duck, GraphEngine& graph)
        : duck_(duck), graph_(graph) {}

    /// Run scoring for all accounts. Writes scores to DuckDB + Memgraph.
    /// progress_cb receives (pct 0-100)
    void score_all(std::function<void(int)> progress_cb = {});

private:
    /// Velocity pass-through: accounts that disperse ≥90% of incoming funds
    /// within 15 minutes across ≥2 outgoing transfers.
    void score_velocity(std::function<void(int)>& cb);

    /// Fan-in (collector) and fan-out (distributor) scoring.
    void score_degree(std::function<void(int)>& cb);

    /// Terminal marker and script device scoring.
    void score_terminal(std::function<void(int)>& cb);

    /// Final composite: clamp to [0,100], write to DuckDB accounts table.
    void finalize(std::function<void(int)>& cb);

    /// Push scores from DuckDB to Memgraph node properties.
    void sync_to_memgraph();

    anant::ingest::DuckLoader& duck_;
    GraphEngine&               graph_;
};

} // namespace anant::graph
