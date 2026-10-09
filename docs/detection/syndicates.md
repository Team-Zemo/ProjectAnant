# Syndicate Detection & Network Topology

> **Engine File:** `anant-engine/src/graph/SyndicateDetector.cpp`  
> **Algorithm:** Weighted Label Propagation (LPA) & In-Memory Bipartite Graph Partitioning  
> **Output:** 122 Distinct Fraud Syndicates Clustered across 1,073 Mules

---

## The Need for Syndicate Clustering

In real-world police operations, taking action against isolated mule accounts is playing a losing game of "whack-a-mole". Criminal cartels recruit dozens of replaceable college students and rural account holders every week.

To dismantle money laundering operations, cyber police require **syndicate-level intelligence**:
- Which 15 accounts belong to the **same organized crime syndicate**?
- Who is the initial collector receiving the stolen funds?
- Who is the distributor layering the money?
- Who is the terminal mule operating the crypto/P2P cashout?

Project Anant automatically clusters isolated mule nodes into cohesive criminal syndicates.

---

## Graph Formulation & Weighted Label Propagation

### 1. Laundered Flow Subgraph Extraction
The engine queries all transactions connecting accounts flagged with high risk ($\text{Mule Score} \ge 50.0$) or exhibiting cyber/terminal indicators:

```sql
SELECT sender_account, receiver_account, amount, ts_unix,
       foreign_ip, terminal_marker, script_device
FROM txns
WHERE sender_account IN (SELECT account_id FROM accounts WHERE mule_score >= 50.0)
  AND receiver_account IN (SELECT account_id FROM accounts WHERE mule_score >= 50.0)
```

In the benchmark dataset, this isolates **2,654 active laundering transfers** between **1,073 unique mule accounts**.

---

### 2. Weighted Label Propagation Algorithm (LPA)

Traditional unweighted community detection treats a ₹500 grocery payment the same as a ₹10,00,000 rapid cashout transfer. Project Anant employs a **Weighted Label Propagation** algorithm where edge weights reflect:
1. **Transfer Amount:** $W_{\text{amount}} = \log_{10}(\text{Amount})$
2. **Temporal Proximity:** Transfers occurring within $< 30$ minutes receive a $2.0\times$ velocity weight multiplier.
3. **Cyber Synergy:** Edges sharing identical foreign IP subnets or script signatures receive a $1.5\times$ coordination multiplier.

```
Edge Weight W(u, v) = log10(Amount) × VelocityBoost × CyberBoost
```

#### Algorithm Steps:
1. **Initialization:** Assign each node $u$ a unique label $L_0(u) = u$.
2. **Iteration:** In each asynchronous step, shuffle node traversal order. Each node adopts the label that maximizes total incoming weighted affinity:
   $$L_{t+1}(u) = \arg\max_{l} \sum_{v \in \mathcal{N}(u), L_t(v) = l} W(u, v)$$
3. **Convergence:** Repeats until node labels stabilize (typically in 4 to 7 iterations, completing in **~70 milliseconds**).
4. **Syndicate ID Formatting:** Clusters with $\ge 3$ members are assigned permanent IDs (`SYN-001`, `SYN-002`, ..., `SYN-122`).

---

## Syndicate Role Attribution

Within each detected syndicate cluster, the engine designates member operational roles based on their structural position:

| Syndicate Role | Criteria | Operational Function |
| :--- | :--- | :--- |
| **`COLLECTOR`** | $\text{in\_deg} > \text{out\_deg} \times 1.5$ or receives victim flow | Initial aggregation point for phished funds |
| **`DISTRIBUTOR`** | High fan-out or balanced relay conduit | Smurfing & rapid layering to evade reporting limits |
| **`TERMINAL_CASHOUT`** | $P_{\text{terminal}} \ge 0.50$ or crypto merchant tag | Final liquidation point to Binance/P2P/ATM |

---

## One-Click Subgraph Isolation & Evidence Export

In the Project Anant Investigation Studio:
1. Clicking **"Isolate Ring"** immediately masks all 23,000+ unrelated background accounts on the WebGL canvas, isolating only the interconnected syndicate members and their money flow paths.
2. Clicking **"Isolate & Export"** instantly downloads a court-ready sub-dataset (CSV / JSON) containing:
   - Full list of syndicate account IDs, bank names, and IFSC codes.
   - Comprehensive transaction hashes, amounts, timestamps, and payment channels.
   - Cyber forensic indicators (IP addresses, device fingerprints).
   - Official Section 91 Cr.P.C. / Section 94 BNSS annexure formatting.

---

## Benchmark Results

```
[SyndicateDetector] Starting suspect group identification via Graph Community Detection...
[SyndicateDetector] Loaded 2654 laundering transfers.
[SyndicateDetector] 1073 unique accounts participating in laundering pipelines.
[SyndicateDetector] Running Weighted Label Propagation...
[SyndicateDetector] Identified 122 distinct suspect fraud syndicates!
[SyndicateDetector] Suspect group identification and persistence complete in 70ms!
```

- **Total Syndicates Identified:** 122 organized crime groups.
- **Largest Clustered Ring:** 34 interconnected accounts funneled into 3 terminal crypto cashouts.
- **Average Syndicate Size:** 8.8 accounts per syndicate.
- **Convergence Time:** ~70 ms on commodity multi-core CPU.
