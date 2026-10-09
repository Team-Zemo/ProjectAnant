# User Interface: Investigation Studio & Graph Canvas

> **Directory:** `anant-dashboard/src/`  
> **Key Libraries:** React 18 · TypeScript · Sigma.js v3 · Graphology · TailwindCSS

---

## Design Philosophy

The Project Anant dashboard is built for cyber crime police investigators who need to dissect complex multi-hop money laundering networks in seconds.

It features a high-contrast dark aesthetic, responsive WebGL rendering capable of visualizing tens of thousands of graph nodes, and zero-latency virtualized data tables.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         ANANT INVESTIGATION STUDIO                               │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────┐  ┌───────────────────────────────────────────┐ │
│ │                               │  │ ACCOUNT INSPECTOR PANEL                   │ │
│ │   WEBGL HARDWARE-ACCELERATED  │  │ • Account ID & Layer Badge (L0 – L3)       │ │
│ │          GRAPH CANVAS         │  │ • Mule Risk Index (e.g. 96.6 / 100)        │ │
│ │                               │  │ • [How was this score calculated?] Button │ │
│ │    Sigma.js v3 + Graphology   │  │ • Syndicate Membership (SYN-003)           │ │
│ │    GPU ForceAtlas2 Layout     │  │ • One-Click [Isolate Ring] & [Export]      │ │
│ │    Directional Arrow Tracing  │  │ • Section 91 Case Officer Generator        │ │
│ │                               │  │ • Transaction Timeline Table               │ │
│ └───────────────────────────────┘  └───────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. WebGL Hardware-Accelerated Graph Canvas

- **Engine:** **Sigma.js v3** backed by **Graphology**.
- **Shader Pipeline:** Custom WebGL shaders render directional transaction arrows, node size proportionally scaled by flow volume, and color-coded risk layers:
  - 🟡 **Layer 0 (Amber):** Defrauded Victims (Net Outflow)
  - 🔵 **Layer 1 (Sky Blue):** Collector Mules (Aggregation)
  - 🟣 **Layer 2 (Purple):** Distributor Mules (Layering Relays)
  - 🔴 **Layer 3 (Crimson/Red):** Terminal Cashout Mules (Crypto/P2P)
- **ForceAtlas2 Layout:** Interactive force-directed spatial clustering physically groups syndicate members together on canvas based on transaction velocity.

---

## 2. Multi-Hop Investigation & Ego-Ring Traversal

- **Dynamic Hop Depth:** Allows investigators to expand money trails across 1, 2, 3, or 4 hops from any initial victim complaint.
- **Directional Flow Highlighting:** Clicking any node highlights all upstream funders (where the money came from) and downstream cash-out destinations (where the money escaped).
- **Ego-Ring Isolation:** Filters out irrelevant background nodes, focusing investigative attention solely on the active suspect network.

---

## 3. The Interactive Score Explainer Modal

Located in the Account Inspector directly under the Mule Risk Index progress gauge, clicking **"How was this score calculated?"** opens a full mathematical walkthrough modal:

### Modal Tabs:
1. **Formula & Step-by-Step Walkthrough:**
   - Shows the exact Two-Stage Gate decision.
   - Shows live substituted variables:
     $$\text{flow\_evidence} = (0.40 \times P_{\text{turnover}}) + (0.40 \times P_{\text{terminal}}) + (0.20 \times P_{\text{cyber}})$$
     $$\text{vol\_factor} = \sigma\left(\log_{10}(\text{TotalVolume}), 5.0, 1.0\right)$$
     $$\text{rank\_factor} = 0.35\cdot\text{flow} + 0.30\cdot P_{\text{cyber}} + 0.20\cdot P_{\text{terminal}} + 0.15\cdot\text{vol}$$
     $$\text{Final Score} = 72.0 + (\text{rank\_factor} \times 26.5)$$
2. **All 7 Risk Signals Breakdown:**
   - 7 dedicated cards showing normalized intensity bars (0.0 to 1.0), plain-English definitions, formal mathematical equations, and concrete transaction evidence for that account.
3. **Legal Admissibility & Section 91 CrPC:**
   - Explains statutory compliance and includes a **"Copy Audit Log"** button that copies a complete text evidence report for police case files.

---

## 4. Virtualized Mule Registry & Multi-Filter Browser

Located in the Mules and Victims views:
- Efficiently renders the entire **24,873 account database** with zero lag.
- **Multi-Filter Faceting:**
  - Search by Account ID prefix or Bank Name.
  - Filter by Layer (Layer 0, Layer 1, Layer 2, Layer 3).
  - Filter by Risk Severity (Critical, Suspect, Low).
  - Filter by Behavioral Tags (Foreign IP, Crypto Terminal, Bot Script).
  - One-click navigation that jumps directly to that account's node on the WebGL canvas.
