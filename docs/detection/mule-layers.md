# Mule Hierarchy & Defrauded Victim Shield

> **Engine File:** `anant-engine/src/graph/MuleScorer.cpp:475-487`  
> **Structural Taxonomy:** Layer 0 (Victims), Layer 1 (Collectors), Layer 2 (Distributors), Layer 3 (Terminals)

---

## 4-Tier Multi-Layer Mule Architecture

Organized financial crime does not operate in flat networks. Modern syndicates use a multi-tiered pipeline designed to insulate the masterminds from the initial theft.

![Hierarchical Multi-Layer Mule Architecture](/mule_layers_diagram.jpg)

---

## Layer Definitions & Operational Roles

### Layer 0: Defrauded Victims (The Exfiltration Source)
- **Role:** Innocent citizens whose accounts were defrauded via phishing, APK malware, task-earning refunds, digital arrest threats, or SIM swap fraud.
- **Transactional Behavior:**
  - Net outflow accounts ($\text{Total Outflow} \gg \text{Total Inflow}$).
  - Unauthorized transfers channel directly into Layer 1 collector mules.
  - Zero incoming criminal funds.
- **The Defrauded Victim Shield (Commit `5915a2b`):**
  - **The Risk:** In standard AML tools, victim accounts appear to have huge single-day outflows to known fraud accounts, causing banks to freeze the victim's remaining life savings.
  - **The Solution:** Project Anant explicitly tags victim accounts as **Layer 0** and hard-caps their Mule Risk Index at $\mathbf{\le 8.5 / 100}$.
  - **Legal Priority:** Automatically flagged in police reports as **"Priority Candidates for Immediate Bank Restitution"**.

---

### Layer 1: Collector Mules (Aggregation Hubs)
- **Role:** Initial landing pads for stolen victim funds.
- **Transactional Behavior:**
  - **High Fan-In Ratio:** Receives small to medium amounts from multiple distinct victims ($\text{in\_degree} > \text{out\_degree} \times 1.5$).
  - **Rapid Consolidation:** Immediately bundles funds into larger tranches and pushes them onward to Layer 2 distributors.
  - Moderate to high turnover conservation ($P_{\text{turnover}} \ge 0.30$).

---

### Layer 2: Distributor / Layering Mules (Smurfing Conduits)
- **Role:** Obfuscating the money trail through high-frequency smurfing.
- **Transactional Behavior:**
  - **High Fan-Out / Balanced Relays:** Fans out consolidated funds to numerous second-tier accounts to evade single-transaction threshold reporting.
  - **High Temporal Velocity:** Inter-transaction dwell time is typically under 15 minutes.
  - $\text{out\_degree} > \text{in\_degree} \times 1.5$ with $P_{\text{turnover}} \ge 0.30$, or balanced pass-through conduits ($\text{in\_deg} > 0 \land \text{out\_deg} > 0$ with $P_{\text{turnover}} \ge 0.50$).

---

### Layer 3: Terminal Cash-Out Mules (The Exit Ramps)
- **Role:** Converting fiat currency into irreversible, non-traceable assets outside the banking system.
- **Transactional Behavior:**
  - Overwhelming concentration of transactions directed to **Crypto Exchanges (Binance, USDT, WazirX), P2P Merchant Desks, Hawala Escrow, or ATM Cashouts**.
  - $P_{\text{terminal}} \ge 0.50$ or $P_{\text{terminal\_in}} \ge 0.50$.
  - Highest risk tier ($\text{Mule Score} \ge 90.0$).
  - Immediate targets for bank freezing notices under Section 91 Cr.P.C. / Section 94 BNSS.

---

## Layer Classification Algorithm

The engine classifies each account deterministically using graph structural metrics and terminal ratios:

```cpp
// anant-engine/src/graph/MuleScorer.cpp
int32_t layer = 0;

if (p_terminal >= 0.5 || p_terminal_in >= 0.5) {
    layer = 3; // Terminal / Cash-Out
} else if (out_deg > in_deg * 1.5 && p_turnover >= 0.3) {
    layer = 2; // Distributor / Layering
} else if (in_deg > out_deg * 1.5 && p_turnover >= 0.3) {
    layer = 1; // Collector / Aggregator
} else if (p_turnover >= 0.5 && (n_in > 0 && n_out > 0)) {
    layer = 2; // Balanced relay conduit
}

// Explicit Defrauded Victim Override
if (is_victim) {
    layer = 0;
    mule_score = std::min(mule_score, 8.5);
}
```

---

## Dataset Breakdown Across Layers

In the benchmark 2,000,000 transaction dataset (24,873 accounts):

| Layer | Classification | Account Count | Mean Mule Score | Action Required |
| :---: | :--- | :---: | :---: | :--- |
| **Layer 0** | Defrauded Victims | **300** | **7.2 / 100** | Bank Restitution & Victim Protection |
| **Layer 1** | Collector Mules | **386** | **84.3 / 100** | Trace Aggregation Hubs |
| **Layer 2** | Distributor Mules | **428** | **88.6 / 100** | Trace Layering Relays |
| **Layer 3** | Terminal Cash-Out Mules | **259** | **96.4 / 100** | Immediate Sec 91 Bank Freeze |
| — | Clean Citizens | **23,500** | **4.1 / 100** | Zero Action / Zero False Freezes |
