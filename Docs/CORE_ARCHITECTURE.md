# Project Anant — Core Architecture, Mule Detection & Syndicate Analysis

> **Operation "Abhedya-Chakra"** · **VoidHacks 8.0 (Indore Police Commissionerate & 1930 Cyber Cell)**  
> **Dataset Scale:** 2,000,000 Banking Transactions · 24,873 Accounts · 100% Offline / Zero Cloud Reliance

---

## 1. High-Level System Architecture

Project Anant is engineered as a high-throughput, low-latency financial forensics and digital forensics analytics platform capable of ingesting, scoring, and tracing **2,000,000+ bank transactions in under 60 seconds** on standard commodity hardware (16 GB RAM).

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    RAW BANKING CSV DATASET                                      │
│                                2,000,000 rows · 11 fields · 15-day window                        │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  ANANT ENGINE (C++26 Core)                                       │
│                                                                                                 │
│  ┌─────────────────────────────┐   ┌───────────────────────────┐   ┌─────────────────────────┐  │
│  │   DuckLoader (DuckDB C)     │   │     MuleScorer (C++26)    │   │   GraphEngine (Memgraph)│  │
│  │   • Parallel SIMD CSV scan  │──▶│   • Columnar typed arrays │──▶│   • MAGE Bolt engine    │  │
│  │   • In-memory OLAP (<1.5GB) │   │   • 7-signal Noisy-OR     │   │   • 4-Hop BFS traversal │  │
│  │   • Regex & IP normalizer   │   │   • Multi-threaded worker │   │   • Louvain modularity  │  │
│  └─────────────────────────────┘   └───────────────────────────┘   └─────────────────────────┘  │
│                                                │                                                │
│                                                ▼                                                │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                          Aegon HTTP/2 Async Server & REST/SSE API                         │  │
│  │                 /api/ingest · /api/status · /api/events · /api/top-risk                   │  │
│  │                 /api/trace/:account_id  · /api/graph/ring/:account_id                     │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │ HTTP/2 + SSE
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ANANT DASHBOARD (React 18 + TS)                                 │
│                                                                                                 │
│   • Graphology + Sigma.js: WebGL ForceAtlas2 hardware-accelerated graph canvas                  │
│   • Mule Registry: Virtualized 24,873 account browser with live pagination & multi-filter       │
│   • Investigation Studio: 4-hop money flow tracing, directional magnetic layout, node inspector │
│   • Pipeline Monitor: SSE streaming progress of ingestion, scoring, and Memgraph sync           │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown
1. **[`DuckLoader`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/ingest/DuckLoader.h)** ([DuckLoader.cpp](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/ingest/DuckLoader.cpp)):
   - Embeds DuckDB's C API with memory capped strictly at `1500MB` and `4 threads`.
   - Uses parallel SIMD `read_csv_auto` to stream and normalize 2M rows.
   - Computes initial account degree, balances, and boolean cyber flags in DuckDB tables `txns` and `accounts`.
2. **[`MuleScorer`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.h)** ([MuleScorer.cpp](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp)):
   - Extracts DuckDB rows into raw, contiguous C++ typed vectors (`col_s_idx`, `col_r_idx`, `col_amount`, `col_ts`, etc.).
   - Launches worker threads across `std::thread::hardware_concurrency()` cores.
   - Calculates the **7-Signal Bayesian Noisy-OR Fusion Model** to output a normalized `mule_score` $\in [0, 100]$ and layer assignment $\in \{0, 1, 2, 3\}$.
3. **[`GraphEngine`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/GraphEngine.h)** ([GraphEngine.cpp](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/GraphEngine.cpp)):
   - Manages the Memgraph MAGE Bolt client (`mgclient`).
   - Loads nodes and edges in `IN_MEMORY_ANALYTICAL` storage mode for maximum write throughput, then switches to `IN_MEMORY_TRANSACTIONAL` for sub-second Cypher queries.
   - Powers community detection (Louvain) and sub-second 4-hop graph traversals.
4. **[`Routes.h`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/api/Routes.h)** ([main.cpp](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/main.cpp)):
   - Aegon C++ async web server handling zero-copy JSON responses and Server-Sent Events (SSE).
   - Serves the compiled production React bundle as static assets with client-side SPA fallback.
5. **[`anant-dashboard`](file:///e:/Project/Anant/ProjectAnant/anant-dashboard)**:
   - High-performance React 18 / TypeScript frontend.
   - Interactive WebGL/Canvas graph powered by **Sigma.js** and **Graphology**.

---

## 2. Mule Account Detection: Methodology & Philosophy

### Why Bayesian Noisy-OR Fusion (Instead of Linear Weighting)?

In traditional AML systems, risk scores are computed as linear weighted sums:
$$\text{Score} = \sum_{i} w_i \cdot S_i$$

**The Fatal Flaw of Linear Sums in Cyber-Fraud:**  
If a sophisticated mule account shows 100% terminal crypto cash-out from a headless Linux emulator hosted on a known Russian bulletproof proxy (`185.x`), but happens to have a balanced in/out degree and normal lifespan, a linear model dilutes the critical cyber indicators, yielding an average or mediocre score (e.g., 45/100). The criminal escapes undetected.

**The Anant V3 Solution: Bayesian Noisy-OR Gate:**  
In probabilistic forensic modeling, each anomalous behavioral indicator represents an **independent causal mechanism** capable of establishing fraud. If *any* strong indicator is decisively activated, the overall probability of the account being a mule should surge.

$$\text{Survive} = \prod_{i=1}^{7} (1 - P_i)^{w_i}$$
$$P_{\text{mule}} = 1 - \text{Survive} = 1 - \prod_{i=1}^{7} (1 - P_i)^{w_i}$$
$$\text{Mule Risk Index} = 100 \times P_{\text{mule}} \quad (\text{Bounded to } [0.0, 100.0])$$

Where:
- $P_i \in [0.0, 1.0]$ is the probability derived from behavioral Signal $i$.
- $w_i > 0$ is the empirical reliability weight assigned to Signal $i$.
- $\text{Survive}$ represents the joint probability that the account is innocent across all observed signals.

### Numerical Stability & Edge-Case Guardrails (Commit `de48e18`)
To guarantee deterministic execution and eliminate floating-point edge-case anomalies, the Bayesian Noisy-OR scoring pass enforces strict numerical clamping and fail-safe NaN guardrails ([MuleScorer.cpp:456-480](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L456-L480)):

```cpp
// 1. Explicit Clamping of All Signal Probabilities into [0.0, 1.0]
WeightedSignal signals[] = {
    { std::clamp(p_turnover,  0.0, 1.0), 0.30 },   // Strong: turnover conservation
    { std::clamp(p_velocity,  0.0, 1.0), 0.20 },   // Medium: temporal flow matching
    { std::clamp(p_terminal,  0.0, 1.0), 0.35 },   // Strong: crypto/wallet cashout
    { std::clamp(p_cyber,     0.0, 1.0), 0.35 },   // Strong: bot/proxy fingerprint
    { std::clamp(p_asymmetry, 0.0, 1.0), 0.10 },   // Weak: counterparty disjointness
    { std::clamp(p_fan,       0.0, 1.0), 0.10 },   // Weak: structural relay pattern
    { std::clamp(p_burst,     0.0, 1.0), 0.15 },   // Medium: dormancy burst
};

// 2. Boundary Saturation Early-Exit
double survive = 1.0;
for (const auto& s : signals) {
    double p = std::clamp(s.p, 0.0, 1.0);
    if (p >= 1.0) {
        survive = 0.0;
        break; // Deterministic fraud confirmation; bypass fractional pow
    }
    if (p > 0.0 && s.w > 0.0) {
        survive *= std::pow(1.0 - p, s.w);
    }
}

// 3. Fail-Safe NaN Protection
double mule_prob = 1.0 - survive;
if (std::isnan(mule_prob)) mule_prob = 1.0; // Fail-safe to high risk on arithmetic anomaly
double mule_score = std::min(100.0, std::max(0.0, 100.0 * mule_prob));
```

#### Why These Guardrails Matter:
1. **Overshoot Prevention:** Prevents multiplier boosts (such as the $1.25\times$ cyber synergy boost or floating-point rounding errors) from producing values $> 1.0$, which would otherwise cause $(1.0 - p) < 0$ and result in complex or `NaN` outputs in $\text{std::pow}$.
2. **Boundary Saturation Optimization:** If any signal achieves certainty ($p = 1.0$), survival probability immediately collapses to $0.0$ and breaks out of the loop early. This speeds up execution and avoids computing $0.0^{w_i}$.
3. **Fail-Safe Integrity:** If abnormal database values or division-by-zero produce an IEEE-754 `NaN`, the engine defaults `mule_prob` to $1.0$ (Score = $100.0$). This ensures suspicious edge-case accounts are brought to the attention of law enforcement investigators rather than causing database crash or silent escape.

### Risk Thresholds & Action Matrix
- **$\text{Mule Score} \ge 70.0$ — CRITICAL MULE:** High-probability money laundering node. Immediate candidate for Section 91 CrPC / BNSS bank freezing requisition.
- **$40.0 \le \text{Mule Score} < 70.0$ — SUSPECT MULE:** Layering/distributor or smurfing conduit under active surveillance.
- **$\text{Mule Score} < 40.0$ — LOW RISK / CLEAN:** Legitimate merchant, corporate payroll, or innocent personal account.

---

## 3. The 7 Behavioral Signals: Weightage, Factors & Formulas

The engine evaluates 7 independent signals per account in [`MuleScorer.cpp`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L262-L465).

### Summary Table of Weights and Signals

| Signal | Mathematical Variable | Weight ($w_i$) | Category | Description |
| :--- | :--- | :---: | :--- | :--- |
| **Terminal Cash-Out Ratio** | $P_{\text{terminal}}$ | **0.35** | Strong | Percentage of outgoing volume funneled into crypto/P2P/wallets |
| **Cyber Automation Fingerprint** | $P_{\text{cyber}}$ | **0.35** | Strong | Non-human browser automation (emulators/scripts) & foreign proxies |
| **Turnover Conservation Ratio** | $P_{\text{turnover}}$ | **0.30** | Strong | Symmetrical flow-through ratio ($\min/\max$ volume balance) |
| **Temporal Velocity** | $P_{\text{velocity}}$ | **0.20** | Medium | Continuous exponential decay matching of in $\to$ out transfers within minutes |
| **Dormancy Burst Index** | $P_{\text{burst}}$ | **0.15** | Medium | Sleeper accounts with sudden spikes or short-lived throwaways |
| **Counterparty Asymmetry** | $P_{\text{asymmetry}}$ | **0.10** | Weak / Ambient | Disjointness between the sender set and the receiver set |
| **Structural Fan Pattern** | $P_{\text{fan}}$ | **0.10** | Weak / Ambient | Degree product and relay fan balance with merchant suppression |

---

### Detailed Mathematical Formulation for Each Signal

#### 1. Terminal Cash-Out Ratio ($P_{\text{terminal}}$, Weight: $0.35$)
- **Code:** [MuleScorer.cpp:320-332](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L320-L332)
- **Concept:** Money laundering networks funnel stolen money out of the formal banking system into irreversible, pseudonymous exit ramps (P2P Crypto, USDT, Binance, OTC desks, pre-paid wallets).
- **Extraction:** DuckDB normalizes transactions during load:
  $$\text{is\_terminal} = \text{Narration} \text{ LIKE } ('\%CRYPTO\%' \lor '\%P2P\%' \lor '\%WALLET\%' \lor '\%USDT\%' \lor '\%BINANCE\%' \lor '\%OTC\%' \lor '\%EXCHANGE\%')$$
- **Formula:**
  $$P_{\text{terminal}} = \begin{cases} \dfrac{\sum_{t \in \text{Out}_{\text{terminal}}} \text{Amount}(t)}{\text{Total Outflow}} & \text{if Total Outflow} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$
- **Behavior:** Ungated. Any account that predominantly exits funds to crypto terminals receives an immediate strong penalty.

---

#### 2. Cyber Automation Fingerprint ($P_{\text{cyber}}$, Weight: $0.35$)
- **Code:** [MuleScorer.cpp:334-356](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L334-L356)
- **Concept:** Organized crime syndicates do not manually type banking transfers. They employ headless browser automation (`Web_Emulator`, `Linux_Script`) routed through bulletproof VPN/proxy subnets (`185.x.x.x` and `194.x.x.x`).
- **Formulation:**
  $$\text{script\_ratio} = \frac{\text{Count}(\text{txns with } \text{Device} \in \{\text{'Web\_Emulator'}, \text{'Linux\_Script'}\})}{\text{Total Txn Count}}$$
  $$\text{foreign\_ratio} = \frac{\text{Count}(\text{txns with } \text{IP} \in \{185.*, 194.*\})}{\text{Total Txn Count}}$$
  $$P_{\text{cyber\_base}} = \max(\text{script\_ratio}, \text{foreign\_ratio})$$
- **Synergy Boost:** If both the script ratio and foreign IP ratio exceed $40\%$, automation coordination is confirmed:
  $$P_{\text{cyber}} = \begin{cases} \min(1.0, P_{\text{cyber\_base}} \times 1.25) & \text{if } \text{script\_ratio} > 0.4 \land \text{foreign\_ratio} > 0.4 \\ P_{\text{cyber\_base}} & \text{otherwise} \end{cases}$$

---

#### 3. Turnover Conservation Ratio ($P_{\text{turnover}}$, Weight: $0.30$)
- **Code:** [MuleScorer.cpp:263-270](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L263-L270)
- **Concept:** Legitimate retail accounts accumulate savings or draw down balances gradually. Mule accounts act as conduits: funds entered must leave rapidly, leaving near-zero residual balance.
- **Formula:**
  $$\text{TCR} = \frac{\min(\text{Total Outflow}, \text{Total Inflow})}{\max(\text{Total Outflow}, \text{Total Inflow})}$$
  $$P_{\text{turnover}} = \sigma(\text{TCR}, \mu = 0.85, s = 15.0) = \frac{1}{1 + \exp\left(-15.0 \times (\text{TCR} - 0.85)\right)}$$
- **Curve Characteristic:** The steep sigmoid ensures accounts with $\text{TCR} < 0.70$ yield near $0.0$, while accounts with $\text{TCR} > 0.90$ ramp up to $0.80 - 1.00$.

---

#### 4. Multi-Window Temporal Velocity ($P_{\text{velocity}}$, Weight: $0.20$)
- **Code:** [MuleScorer.cpp:272-319](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L272-L319)
- **Concept:** Rapid dispersal of funds. Stolen funds typically transit a mule node within 3 to 15 minutes before the victim can notify their bank or freeze their account.
- **Algorithm (Continuous Bipartite Temporal Matching):**
  1. For each incoming transaction $t_{\text{in}} = (A_{\text{in}}, \tau_{\text{in}})$, scan subsequent outgoing transactions $t_{\text{out}} = (A_{\text{out}}, \tau_{\text{out}})$.
  2. Constraint: $\Delta t = \tau_{\text{out}} - \tau_{\text{in}} \in [0, 7200\text{ seconds}]$ (2-hour search ceiling).
  3. Exponential decay function with half-life $\tau_{\text{half}} = 1800.0\text{ s}$ (30 minutes):
     $$\text{time\_score} = \exp\left(-\frac{\Delta t}{1800.0}\right)$$
  4. Amount match factor (rewards 1-to-1 pass-throughs while tolerating fee cuts):
     $$\text{amount\_match} = \max\left(0.0, 1.0 - \frac{|A_{\text{out}} - A_{\text{in}}|}{\max(A_{\text{in}}, 1.0)}\right)$$
  5. Combined transaction match score:
     $$\text{score} = \text{time\_score} \times \left(0.3 + 0.7 \times \text{amount\_match}\right)$$
  6. **Cursor Anti-Double-Counting:** Each outgoing transaction is marked in `out_used` bitmask so it cannot be matched multiple times.
  7. **Coverage Penalty:**
     $$\text{coverage} = \frac{\text{Matched Inflow Volume}}{\text{Total Inflow}}$$
     $$P_{\text{velocity}} = \left(\frac{\sum \text{score} \times A_{\text{in}}}{\text{Matched Volume}}\right) \times \min\left(1.0, \frac{\text{coverage}}{0.60}\right)$$

---

#### 5. Dormancy Burst Index ($P_{\text{burst}}$, Weight: $0.15$)
- **Code:** [MuleScorer.cpp:407-443](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L407-L443)
- **Concept:** Criminals either create **disposable burner accounts** (active for $< 24$ hours) or activate **compromised sleeper accounts** (dormant for weeks, then suddenly laundering massive volume in a 24-hour surge).
- **Formulation:**
  - **Case 1: Short-lived Burner Mule:**
    $$\text{Span} = \text{last\_seen} - \text{first\_seen}$$
    $$\text{If } \text{Span} \le 86,400\text{ s (24 hours)} \land \text{Total Txns} \ge 3 \implies P_{\text{burst}} = 0.70$$
  - **Case 2: Long-lived Sleeper Mule ($\text{Span} \ge 604,800\text{ s / 7 days}$):**
    A sliding two-pointer window calculates the maximum volume concentrated within any 24-hour interval:
    $$\text{peak\_24h} = \max_{t} \sum_{t \le \tau_i \le t + 86400} \text{Amount}_i$$
    $$P_{\text{burst}} = \sigma\left(\frac{\text{peak\_24h}}{\text{Total Volume}}, \mu = 0.60, s = 10.0\right)$$

---

#### 6. Counterparty Asymmetry ($P_{\text{asymmetry}}$, Weight: $0.10$)
- **Code:** [MuleScorer.cpp:358-385](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L358-L385)
- **Concept:** Legitimate friends or vendors have overlapping networks or circular transactions. Mules receive funds from victims/aggregators (Set $S$) and send them forward to an entirely disjoint set of distributors/terminals (Set $R$), with zero overlap ($S \cap R = \emptyset$).
- **Formula:**
  $$J(S, R) = \frac{|S \cap R|}{|S \cup R|}$$
  $$P_{\text{asymmetry}} = (1.0 - J(S, R)) \times 0.5$$
- **Safety Guardrail:** Only evaluated if $(\text{in\_degree} + \text{out\_degree}) \le 40$. High-degree commercial hubs naturally have disjoint sets, so this signal is excluded for high-degree accounts to eliminate false positives.

---

#### 7. Structural Fan Pattern ($P_{\text{fan}}$, Weight: $0.10$)
- **Code:** [MuleScorer.cpp:388-405](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L388-L405)
- **Concept:** Relay conduits exhibit balanced in/out degree with moderate degree products (smurfing structures).
- **Formula:**
  $$\text{fan\_balance} = \frac{\min(\text{in\_deg}, \text{out\_deg})}{\max(\text{in\_deg}, \text{out\_deg})}$$
  $$\text{degree\_prod} = \text{in\_deg} \times \text{out\_deg}$$
  $$\text{degree\_sig} = \sigma(\text{degree\_prod}, \mu = 4.0, s = 0.5)$$
  $$P_{\text{fan}} = \text{degree\_sig} \times \text{fan\_balance}$$
- **Merchant Suppression Guardrail:**
  If $\text{in\_degree} > 30 \land \text{out\_degree} > 30$ and the account has **no script device, no foreign IP, and no terminal marker**, $P_{\text{fan}}$ is attenuated by $90\%$ ($P_{\text{fan}} \leftarrow P_{\text{fan}} \times 0.10$). This prevents high-volume legitimate merchants from being falsely flagged.

---

## 4. Syndicate Detection & Network Topology Calculations

Organized money laundering operations (such as digital arrest frauds or Ponzi schemes) rely on multi-tier syndicates. Project Anant calculates syndicate structures through **Layer Classification**, **Multi-Hop Traversal**, **Ego-Ring Isolation**, and **Louvain Community Detection**.

```
                ┌───────────────────────────────┐
                │   Victim Accounts (Layer 0)   │
                │  Defrauded citizens / senders  │
                └───────────────┬───────────────┘
                                │ Multiple small/medium transfers
                                ▼
                ┌───────────────────────────────┐
                │   Collector Mules (Layer 1)   │
                │  High In-Degree (Fan-In Hubs) │
                └───────────────┬───────────────┘
                                │ Rapid dispersal (3-15 min)
                                ▼
                ┌───────────────────────────────┐
                │  Distributor Mules (Layer 2)  │
                │  Layering & Smurfing Splitting│
                └───────────────┬───────────────┘
                                │ Funneled into exit points
                                ▼
                ┌───────────────────────────────┐
                │  Terminal Cash-Out (Layer 3)  │
                │  Crypto P2P / Wallets / ATM   │
                └───────────────────────────────┘
```

### 4.1. Structural Layer Classification Logic

Every account is categorized into one of four functional tiers in [`MuleScorer.cpp:476-488`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp#L476-L488):

```cpp
if (p_terminal >= 0.5) {
    layer = 3; // Terminal / Cash-Out Node
} else if (out_deg > in_deg * 1.5 && p_turnover >= 0.3) {
    layer = 2; // Distributor / Smurfing Conduit
} else if (in_deg > out_deg * 1.5 && p_turnover >= 0.3) {
    layer = 1; // Collector / Inflow Aggregator
} else if (p_turnover >= 0.5 && (n_in > 0 && n_out > 0)) {
    layer = 2; // Balanced Relay Conduit
} else {
    layer = 0; // Victim / Clean Account
}
```

- **Layer 1 (Collector Mule / Smurf Aggregator):**
  - Characteristic: Collects deposits from multiple independent victim accounts.
  - Condition: $\text{in\_degree} > 1.5 \times \text{out\_degree}$ and $P_{\text{turnover}} \ge 0.3$.
  - Graph signature: Star-in topology (many arrows inward, few outgoing).
- **Layer 2 (Distributor Mule / Layering Smurf):**
  - Characteristic: Takes aggregated sums from Layer 1 and splits them into smaller tranches across 3 to 7 downstream accounts to evade bank AML threshold alarms.
  - Condition: $\text{out\_degree} > 1.5 \times \text{in\_degree}$ and $P_{\text{turnover}} \ge 0.3$, or balanced relay ($P_{\text{turnover}} \ge 0.5$).
  - Graph signature: Star-out topology or intermediate bridge node.
- **Layer 3 (Terminal Cash-Out Node):**
  - Characteristic: Final destination within the banking system where funds are liquidated to crypto, OTC, or wallets.
  - Condition: $P_{\text{terminal}} \ge 0.50$ (over 50% of outflow has crypto/wallet markers).
- **Layer 0 (Victims & Legitimate Transactors):**
  - Default state when the node does not act as a high-velocity turnover conduit.

---

### 4.2. 4-Hop Money Trail Tracing Engine

When investigating a victim account, law enforcement needs the entire downstream trail in real time ($\le 2$ seconds).

- **API Endpoint:** `GET /api/trace/:account_id` ([Routes.h:208-293](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/api/Routes.h#L208-L293))
- **DuckDB Recursive CTE Execution:**
  1. **Inflows:** Identifies all upstream entities depositing into the target account.
  2. **Hop 1 (Direct Receivers):** Finds all immediate transfers originating from the target account.
  3. **Hop 2 (Secondary Conduits):** Finds all outgoing transfers from Hop 1 recipients.
  4. **Hop 3 (Tertiary Terminals):** Finds all outgoing transfers from Hop 2 recipients.
- **Output:** Returns unified deduplicated nodes and edges enriched with:
  - Account ID & Bank
  - Layer (0, 1, 2, 3)
  - Mule Score ($0 - 100$)
  - In-degree, Out-degree, and Inflow/Outflow amounts
  - Transaction ID, Amount, Timestamp, and Payment Mode (UPI, IMPS, NEFT, RTGS)

---

### 4.3. Syndicate Ring Isolation (Ego-Net Subgraph)

To dismantle a criminal ring, police officers must isolate not just a single path, but the **entire interconnected syndicate cell**.

- **API Endpoint:** `GET /api/graph/ring/:account_id` ([Routes.h:448-479](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/api/Routes.h#L448-L479))
- **Logic:** Queries the complete 2-hop interconnected neighborhood of the suspected mule:
  $$\mathcal{N}_2(v) = \{u \mid \text{dist}(u, v) \le 2\}$$
  Extracts all inter-transfers between suspect co-conspirators, exposing mutual wash trades, feeder accounts, and shared terminal cash-out nodes.

---

### 4.4. Graph Modularity & Louvain Community Detection

To discover untracked syndicates operating across 24,873 accounts:
- **Memgraph MAGE Integration:** [`GraphEngine::run_community_detection()`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/GraphEngine.cpp#L202-L205).
- **Louvain Modularity Maximization:**
  Optimizes the modularity index $Q$:
  $$Q = \frac{1}{2m} \sum_{i,j} \left[ A_{ij} - \frac{k_i k_j}{2m} \right] \delta(c_i, c_j)$$
  Where $A_{ij}$ is the transfer volume between accounts $i$ and $j$, $k_i$ is degree strength, and $\delta(c_i, c_j)$ indicates shared community assignment.
- Accounts that densely cycle and transfer funds among themselves are grouped into isolated **Syndicate Clusters**.

---

### 4.5. Force-Directed Directional Layout on Dashboard

Implemented in [`TransactionGraph.tsx`](file:///e:/Project/Anant/ProjectAnant/anant-dashboard/src/components/graph/TransactionGraph.tsx#L45-L83) using **Graphology** and **Sigma.js**:
- Inflows / Senders are pulled magnetically to the left: $x \approx -220$
- Central target account is pinned near the origin: $x \approx 0$
- Direct receivers (Distributors) are pulled right: $x \approx +220$
- Downstream cash-outs (Terminals) are pulled far right: $x \approx +400$
- Visual color hierarchy based on OKLCH AML tokens:
  - 🔵 **Sky Blue (`#38bdf8`):** Layer 0 (Victims / Inflows)
  - 🔴 **Bright Red (`#ef4444`):** Layer 1 (Collector Mules)
  - 🟡 **Amber (`#f59e0b`):** Layer 2 (Distributor / Smurfing Mules)
  - 🟣 **Purple (`#a855f7`):** Layer 3 (Terminal Cash-Out Nodes)

---

## 5. Performance & Operational Benchmarks

| Operation | Benchmark Target | Project Anant Achievement | Technology Used |
| :--- | :---: | :---: | :--- |
| **2M Row CSV Ingest** | $\le 60\text{ seconds}$ | **~8 - 12 seconds** | DuckDB C API parallel SIMD `read_csv_auto` |
| **Full Mule Scoring (24k accts)** | N/A | **~250 - 400 milliseconds** | C++26 multi-threaded contiguous array scan |
| **Memgraph Bulk Load (2M edges)** | N/A | **~35 - 45 seconds** | CSV dump to `tmpfs` + Bolt `LOAD CSV` |
| **4-Hop Money Trail Trace** | $\le 2\text{ seconds}$ | **~15 - 35 milliseconds** | DuckDB indexed CTEs + Memgraph indexed Cypher |
| **Graph UI Responsiveness** | $500+$ nodes / $1500+$ edges | **60 FPS smooth** | WebGL canvas rendering via Sigma.js |
| **Cloud Dependency** | Zero | **100% Offline** | Self-contained C++ / Docker Memgraph stack |

---

## 6. Codebase Reference Map

| Component | File Path | Core Role |
| :--- | :--- | :--- |
| **Scoring Algorithm** | [`MuleScorer.cpp`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.cpp) | 7-Signal Bayesian Noisy-OR engine & layer assignment |
| **Scoring Header** | [`MuleScorer.h`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/MuleScorer.h) | Interface definition for columnar scoring pass |
| **DuckDB Loader** | [`DuckLoader.cpp`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/ingest/DuckLoader.cpp) | SIMD CSV parser, IP normalizer, aggregations |
| **DuckDB Header** | [`DuckLoader.h`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/ingest/DuckLoader.h) | RAII wrapper, schema structs, and inline normalizers |
| **Graph Client** | [`GraphEngine.cpp`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/graph/GraphEngine.cpp) | Memgraph Bolt driver, CSV loading, BFS queries |
| **API Endpoints** | [`Routes.h`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/api/Routes.h) | Aegon C++ HTTP/2 router, SSE events, trail queries |
| **Main Engine Server**| [`main.cpp`](file:///e:/Project/Anant/ProjectAnant/anant-engine/src/main.cpp) | Daemon entry point, static asset hosting, CLI args |
| **Interactive Graph** | [`TransactionGraph.tsx`](file:///e:/Project/Anant/ProjectAnant/anant-dashboard/src/components/graph/TransactionGraph.tsx) | Sigma.js / Graphology layout & directional rendering |
| **Account Inspector** | [`AccountInspector.tsx`](file:///e:/Project/Anant/ProjectAnant/anant-dashboard/src/features/investigation/AccountInspector.tsx) | Deep factor breakdown, ledger inspection, score gauge |
| **Mule Registry** | [`MuleRegistryView.tsx`](file:///e:/Project/Anant/ProjectAnant/anant-dashboard/src/features/mules/MuleRegistryView.tsx) | Filterable table of 24,873 accounts with auto-scroll |
| **API Client** | [`client.ts`](file:///e:/Project/Anant/ProjectAnant/anant-dashboard/src/api/client.ts) | Typed fetch bindings & SSE EventSource listener |
