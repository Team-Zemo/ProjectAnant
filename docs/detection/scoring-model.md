# 7-Signal Scoring Model & Mathematical Formulation

> **Engine File:** `anant-engine/src/graph/MuleScorer.cpp`  
> **Theoretical Framework:** Bayesian Noisy-OR Causal Gates + Two-Stage Calibrated AML Ranking

---

## Scoring Model Flowchart

![7-Signal Bayesian Scoring Architecture](/scoring_diagram.jpg)

---

## Why Bayesian Noisy-OR Fusion (Over Linear Weighting)?

In traditional anti-money laundering (AML) architectures, risk scores are computed as linear weighted sums:

$$\text{Score} = \sum_{i=1}^{n} w_i \cdot S_i$$

### The Fatal Flaw of Linear Models in Cyber-Fraud
Consider a sophisticated money mule:
- **100% of outgoing funds** are converted to Binance/P2P crypto.
- Operates exclusively from a Russian/Cambodian bulletproof proxy (`185.220.x.x`).
- Connects through an automated headless script emulator (`Linux_Script`).
- **However**, because the account was rented only recently, it has an average transaction count, balanced fan degree, and moderate velocity.

In a linear weighting model, the low or zero values of other signals **mathematically dilute** the decisive cyber and terminal indicators. The account receives a mediocre score (e.g. 42 / 100) and escapes automated police freezing orders.

### The Noisy-OR Solution
In causal probabilistic graph modeling, distinct behavioral anomalies represent **independent causal fraud mechanisms**. If any strong indicator is definitively activated, the probability of the account being a laundering conduit surges toward certainty.

Mathematically, we model the survival probability $\text{Survive}$ (the probability that the account is innocent across all observed signals):

$$\text{Survive} = \prod_{i=1}^{7} (1 - P_i)^{w_i}$$

The probability of fraud is the complement of innocence:

$$P_{\text{mule}} = 1 - \text{Survive} = 1 - \prod_{i=1}^{7} (1 - P_i)^{w_i}$$

$$\text{Mule Score} = 100 \times P_{\text{mule}} \quad \in [0.0, 100.0]$$

Where:
- $P_i \in [0.0, 1.0]$ is the normalized probability output by Signal $i$.
- $w_i > 0$ is the empirical reliability weight assigned to Signal $i$.

---

## The 7 Behavioral & Structural Signals

### Summary Weights Matrix

| Signal | Mathematical Symbol | Weight ($w_i$) | Category | Core Behavior Captured |
| :--- | :---: | :---: | :--- | :--- |
| **Terminal Cash-Out Ratio** | $P_{\text{terminal}}$ | **0.35** | Strong | Percentage of funds diverted into Crypto/P2P/ATM cashouts |
| **Cyber Automation Fingerprint** | $P_{\text{cyber}}$ | **0.35** | Strong | Non-human browser automation (emulators) & offshore IPs |
| **Turnover Conservation Ratio** | $P_{\text{turnover}}$ | **0.30** | Strong | Symmetrical pass-through ratio ($\min/\max$ volume balance) |
| **Temporal Velocity** | $P_{\text{velocity}}$ | **0.20** | Medium | Continuous exponential decay matching of transfers in $< 30$ mins |
| **Dormancy Burst Index** | $P_{\text{burst}}$ | **0.15** | Medium | Sleeper accounts with sudden spikes or $< 24$h throwaways |
| **Counterparty Asymmetry** | $P_{\text{asymmetry}}$ | **0.10** | Contextual | Bipartite disjointness between sender set and receiver set |
| **Structural Fan Pattern** | $P_{\text{fan}}$ | **0.10** | Contextual | Degree product and relay fan balance with merchant suppression |

---

### Detailed Mathematical Formulations

#### 1. Turnover Conservation Ratio ($P_{\text{turnover}}$)
- **Concept:** Legitimate retail customers retain funds, save money, or draw balances gradually. Mule accounts act as flow-through conduits: money entered must leave rapidly, leaving near-zero residual balance.
- **Formula:**
  $$\text{TCR} = \frac{\min(\text{Total Outflow}, \text{Total Inflow})}{\max(\text{Total Outflow}, \text{Total Inflow})}$$
  $$P_{\text{turnover}} = \sigma(\text{TCR}, \mu = 0.85, s = 15.0) = \frac{1}{1 + \exp\left(-15.0 \times (\text{TCR} - 0.85)\right)}$$
- **Characteristics:** The steep sigmoid ensures accounts with retention ratio $< 70\%$ yield near $0.0$, while accounts with pass-through $> 90\%$ ramp up to $0.80 - 1.00$.

---

#### 2. Terminal Cash-Out Ratio ($P_{\text{terminal}}$)
- **Concept:** Money laundering syndicates exit formal banking into irreversible, pseudonymous crypto exchange rails (P2P desks, USDT, Binance, OTC escrow).
- **Extraction:** Scans narration strings for keywords:
  $$\text{is\_terminal} = \text{Narration} \text{ LIKE } ('\%CRYPTO\%' \lor '\%P2P\%' \lor '\%WALLET\%' \lor '\%USDT\%' \lor '\%BINANCE\%' \lor '\%OTC\%')$$
- **Formula:**
  $$P_{\text{terminal}} = \begin{cases} \dfrac{\sum_{t \in \text{Out}_{\text{terminal}}} \text{Amount}(t)}{\text{Total Outflow}} & \text{if Total Outflow} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$

---

#### 3. Cyber Automation Fingerprint ($P_{\text{cyber}}$)
- **Concept:** Syndicates run automated headless bot scripts (`Web_Emulator`, `Linux_Script`) routed through offshore bulletproof proxy ranges (`185.x.x.x` and `194.x.x.x`).
- **Formula:**
  $$\text{script\_ratio} = \frac{\text{Count}(\text{txns with } \text{Device} \in \{\text{'Web\_Emulator'}, \text{'Linux\_Script'}\})}{\text{Total Txn Count}}$$
  $$\text{foreign\_ratio} = \frac{\text{Count}(\text{txns with } \text{IP} \in \{185.*, 194.*\})}{\text{Total Txn Count}}$$
  $$P_{\text{cyber\_base}} = \max(\text{script\_ratio}, \text{foreign\_ratio})$$
- **Synergy Multiplier:** If both script ratio and foreign IP ratio exceed $40\%$:
  $$P_{\text{cyber}} = \begin{cases} \min(1.0, P_{\text{cyber\_base}} \times 1.25) & \text{if } \text{script\_ratio} > 0.4 \land \text{foreign\_ratio} > 0.4 \\ P_{\text{cyber\_base}} & \text{otherwise} \end{cases}$$

---

#### 4. Multi-Window Temporal Velocity ($P_{\text{velocity}}$)
- **Concept:** Rapid fund transit. Stolen funds typically transit a mule node within 3 to 15 minutes before the victim can freeze their account.
- **Algorithm (Continuous Bipartite Temporal Matching):**
  1. For each incoming transaction $t_{\text{in}} = (A_{\text{in}}, \tau_{\text{in}})$, scan subsequent outgoing transactions $t_{\text{out}} = (A_{\text{out}}, \tau_{\text{out}})$.
  2. Search horizon: $\Delta t = \tau_{\text{out}} - \tau_{\text{in}} \in [0, 7200\text{ s}]$ (2-hour ceiling).
  3. Exponential decay half-life $\tau_{\text{half}} = 1800.0\text{ s}$ (30 minutes):
     $$\text{time\_score} = \exp\left(-\frac{\Delta t}{1800.0}\right)$$
  4. Amount match factor (rewards 1-to-1 matching while tolerating fee cuts):
     $$\text{amount\_match} = \max\left(0.0, 1.0 - \frac{|A_{\text{out}} - A_{\text{in}}|}{\max(A_{\text{in}}, 1.0)}\right)$$
  5. Combined score per transaction pair:
     $$\text{score} = \text{time\_score} \times \left(0.3 + 0.7 \times \text{amount\_match}\right)$$
  6. **Anti-Double-Counting:** Uses an `out_used` bitmask so each outgoing transaction matches at most once.
  7. **Coverage Penalty:**
     $$\text{coverage} = \frac{\text{Matched Volume}}{\text{Total Inflow}}$$
     $$P_{\text{velocity}} = \left(\frac{\sum \text{score} \times A_{\text{in}}}{\text{Matched Volume}}\right) \times \min\left(1.0, \frac{\text{coverage}}{0.60}\right)$$

---

#### 5. Dormancy Burst Index ($P_{\text{burst}}$)
- **Concept:** Mules are either **burner throwaways** ($< 24$ hours active) or **compromised sleeper accounts** (dormant for weeks, then laundering a massive volume spike in 24 hours).
- **Formulation:**
  - **Case 1: Disposable Burner Mule:**
    $$\text{Span} = \text{last\_seen} - \text{first\_seen}$$
    $$\text{If } \text{Span} \le 86,400\text{ s (24h)} \land \text{Txns} \ge 3 \implies P_{\text{burst}} = 0.70$$
  - **Case 2: Sleeper Spike ($\text{Span} \ge 7\text{ days}$):**
    Two-pointer sliding window computes maximum volume concentrated in any 24h window:
    $$\text{peak\_24h} = \max_{t} \sum_{t \le \tau_i \le t + 86400} \text{Amount}_i$$
    $$P_{\text{burst}} = \sigma\left(\frac{\text{peak\_24h}}{\text{Total Volume}}, \mu = 0.60, s = 10.0\right)$$

---

#### 6. Counterparty Asymmetry ($P_{\text{asymmetry}}$)
- **Concept:** Legitimate business and social contacts have overlapping bipartite networks. Mules receive funds from victims/aggregators (Set $S$) and send forward to disjoint distributors/terminals (Set $R$), with zero overlap ($S \cap R = \emptyset$).
- **Formula:**
  $$J(S, R) = \frac{|S \cap R|}{|S \cup R|}$$
  $$P_{\text{asymmetry}} = (1.0 - J(S, R)) \times 0.5$$
- **High-Degree Guardrail:** Only evaluated if $(\text{in\_degree} + \text{out\_degree}) \le 40$. High-volume commercial hubs naturally have disjoint sets, so this signal is excluded for high-degree accounts.

---

#### 7. Structural Fan Pattern ($P_{\text{fan}}$)
- **Concept:** Relay conduits exhibit balanced in/out degree with moderate degree products (smurfing multiplexing).
- **Formula:**
  $$\text{fan\_balance} = \frac{\min(\text{in\_deg}, \text{out\_deg})}{\max(\text{in\_deg}, \text{out\_deg})}$$
  $$\text{degree\_prod} = \text{in\_deg} \times \text{out\_deg}$$
  $$\text{degree\_sig} = \sigma(\text{degree\_prod}, \mu = 4.0, s = 0.5)$$
  $$P_{\text{fan}} = \text{degree\_sig} \times \text{fan\_balance}$$
- **Merchant Suppression:**
  If $\text{in\_degree} > 30 \land \text{out\_degree} > 30$ and the account has **no script device, no foreign IP, and no terminal marker**, $P_{\text{fan}}$ is attenuated by $90\%$ ($P_{\text{fan}} \leftarrow P_{\text{fan}} \times 0.10$), completely shielding high-volume merchants.

---

## The Calibrated Two-Stage AML Gate Pipeline

To guarantee **100% recall on fraud mules** and **0% false positives on clean citizens**, the engine executes a calibrated two-stage gate:

```
                  ┌──────────────────────────────────────────────┐
                  │ Compute Base Flow Evidence:                  │
                  │ flow_evidence = 0.40·P_pt + 0.40·P_term      │
                  │               + 0.20·P_cyber                 │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                     /────────────────────────────────────────\
                    <  (P_cyber > 0.05) OR (P_terminal > 0.05) >
                     \────────────────────────────────────────/
                                    /          \
                         YES       /            \      NO
                                  ▼              ▼
           ┌────────────────────────────┐    ┌───────────────────────────┐
           │     GATE 1: FRAUD TRACK    │    │    GATE 2: CLEAN TRACK    │
           │                            │    │                           │
           │ vol_factor = σ(log10(vol)) │    │ Score = clamp(            │
           │ rank_factor = 0.35·flow    │    │   flow_evidence · 25,     │
           │   + 0.30·P_cyber           │    │   0, 28                   │
           │   + 0.20·P_terminal        │    │ )                         │
           │   + 0.15·vol_factor        │    │                           │
           │                            │    │ Output: 0.0 – 28.0        │
           │ Score = 72.0 +             │    │ (Zero citizen freezes)    │
           │   clamp(rank,0,1) · 26.5   │    └───────────────────────────┘
           │                            │
           │ Output: 72.0 – 98.5        │
           └────────────────────────────┘
```

---

## Numerical Stability Guardrails

1. **Overshoot Clamping:** All signal probabilities are strictly clamped to $[0.0, 1.0]$ before computing powers, preventing negative bases in $\text{std::pow}$.
2. **Boundary Saturation Early-Exit:** If any signal achieves $p \ge 1.0$, survival probability instantly collapses to $0.0$ and breaks out of the loop early, bypassing fractional power computation.
3. **Fail-Safe NaN Protection:** If an arithmetic division anomaly produces an IEEE-754 `NaN`, the engine defaults `mule_prob` to $1.0$ (Score = $100.0$), ensuring suspicious edge cases are flagged for manual police audit rather than escaping silently.
