#pragma once
/**
 * SyndicateDetector — identifies, classifies, and persists suspect groups (Mule Rings / Fraud Syndicates).
 *
 * Implements rigorous graph clustering without shortcuts:
 *   1. Induces the laundering subgraph from high-confidence transactions connecting suspect accounts.
 *   2. Computes Connected Components via Disjoint-Set Union (DSU) to isolate independent fraud syndicates.
 *   3. Classifies operational roles for each member: INFLOW_SMURF (Layer 1), AGGREGATOR (Layer 2), TERMINAL_CASHOUT (Layer 3).
 *   4. Identifies topological archetypes: DISPERSAL_TREE, AGGREGATION_HUB, WASH_CYCLE, MULTI_HOP_CHAIN, HYBRID_SYNDICATE.
 *   5. Persists syndicates metadata and account memberships to DuckDB & Memgraph.
 */

#include "../ingest/DuckLoader.h"
#include "../graph/GraphEngine.h"
#include <functional>
#include <string>

namespace anant::graph {

class SyndicateDetector {
public:
    SyndicateDetector(anant::ingest::DuckLoader& duck, GraphEngine& graph)
        : duck_(duck), graph_(graph) {}

    /// Run full syndicate detection and persist results to DuckDB & Memgraph
    void detect_and_store(std::function<void(int pct)> progress_cb = {});

private:
    anant::ingest::DuckLoader& duck_;
    GraphEngine&               graph_;
};

} // namespace anant::graph
