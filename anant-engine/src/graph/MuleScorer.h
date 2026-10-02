#pragma once
/**
 * MuleScorer — computes the Mule Risk Index (0–100) for each account.
 *
 * Implements the Anant V2 Temporal Flow Conservation Engine:
 *   Step 1: Bidirectional Pass-Through Matching (1-to-N Dispersal & N-to-1 Aggregation)
 *           with 16-minute window (960s), cursor anti-double-counting, and continuous decay.
 *   Step 2: Value-Weighted Cash-Out Terminal Risk (TR) across 3 cyber flags:
 *           Foreign IP (185/194), Headless Script Device, and Crypto/Cash Narrations.
 *   Step 3: Graph Topology & Smurfing Signatures (Matched Fan-In, Matched Fan-Out, Reciprocal Wash).
 *   Step 4: Dormancy Burst Index (distinguishing compromised personal mules from legitimate merchants).
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

    /// Run the full scoring engine across all accounts using columnar typed arrays.
    /// progress_cb receives (pct 0-100)
    void score_all(std::function<void(int)> progress_cb = {});

private:
    void execute_scoring(std::function<void(int)> progress_cb);
    void sync_to_memgraph();

    anant::ingest::DuckLoader& duck_;
    GraphEngine&               graph_;
};

} // namespace anant::graph
