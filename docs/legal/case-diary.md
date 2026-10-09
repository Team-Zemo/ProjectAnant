# Digital Forensics, Legal AI & Police Case Diaries

> **Component:** `anant-dashboard/src/features/investigation/LegalNoticeModal.tsx`  
> **Statutory Compliance:** Section 91 Cr.P.C. / Section 94 BNSS 2023 · Section 172 Cr.P.C. / Section 168 BNSS 2023  
> **Insignia Watermark:** Law Enforcement Agency Insignia (28% Opacity)

---

## The Legal Compliance Imperative

Under Indian criminal jurisprudence, an automated AML tool is useless to law enforcement if its outputs cannot withstand judicial scrutiny in court.

### The Problem with Black-Box Neural Networks
- Section 65B of the Indian Evidence Act (and Section 63 of Bharatiya Sakshya Adhiniyam, 2023) mandates clear provenance and verifiable reliability for electronic evidence.
- When an account is frozen, bank ombudsmen and high courts routinely demand: *"What specific transactions and empirical rules justified freezing this citizen's account?"*
- If the answer is *"A neural network with 10 million hidden weights outputted a 0.89 risk probability"*, the freezing order is legally vulnerable to being quashed.

### The Project Anant White-Box Standard
Every single flagged mule account in Project Anant is backed by an **exact mathematical audit trail**:
- Turnover conservation ratio ($P_{\text{turnover}}$) with exact inflow and outflow amounts.
- Terminal cashout ratio ($P_{\text{terminal}}$) citing specific crypto exchange keywords.
- Foreign IP ranges (`185.x`, `194.x`) and headless browser device fingerprints.
- Exact Two-Stage Gate decision values.

---

## Automated Legal Documents Generated

Project Anant generates two distinct types of court-ready legal documents on demand:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             LEGAL DOCUMENT SUITE                                 │
├──────────────────────────┬───────────────────────────────────────────────────────┤
│ Document 1               │ Section 91 Cr.P.C. / Section 94 BNSS Bank Notice      │
│ Document 2               │ Section 172 Cr.P.C. / Section 168 BNSS Case Diary     │
│ Languages                │ Full Bilingual Support: English & Hindi (Devanagari)  │
│ Output Formats           │ Professional XeLaTeX Source (.tex) & Pixel-Exact HTML │
│ Official Watermark       │ Agency Insignia Seal (28% Opacity)                    │
│ Evidence Tables          │ Schedule A (Immediate Freeze) & B (Surveillance)      │
└──────────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 1. Section 91 Cr.P.C. / Section 94 BNSS Bank Freezing Notice

Issued by the Investigating Officer (IO) to bank branch managers and nodal cyber officers directing the immediate lien/freeze of identified mule accounts:

### Key Components:
- **Formal Police Letterhead:** Cyber Crime Police Station / Financial Investigation Cell.
- **Statutory Authority Citation:** Requisition under Section 91 Cr.P.C. / Section 94 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023.
- **Disputed Fund Tracking:** Exact stolen amount, transaction IDs, timestamp, and victim complaint reference.
- **Freeze Schedule A:** Table of identified Layer 3 & Layer 2 mule accounts with Bank Name, Account Number, IFSC, Calculated Mule Score, and Estimated Holding.
- **Direction to Furnish:** Requisition for complete KYC (Aadhaar, PAN, phone), IP login logs, and ATM CCTV footage within 24 hours.

---

## 2. Police Case Diary (U/S 172 Cr.P.C. / Section 168 BNSS)

The official chronological diary maintained by the Investigating Officer recording the day-to-day progress of the cyber investigation:

### Key Components:
- **Formal Heading:** "प्रकरण दैनिक डायरी" / "POLICE CASE DIARY"
- **FIR / Crime Registration Details:** Crime Number, Date, Police Station, Investigating Officer name and rank.
- **Chronological Narrative:**
  - Initial complaint receipt from 1930 Cyber Helpline.
  - Identification of Defrauded Victim Account (Layer 0).
  - Graph traversal isolating Layer 1 collector mules and Layer 2 smurfing conduits.
  - Final cashout identification at Layer 3 crypto terminals.
- **Investigative Orders:** Steps taken to freeze accounts, preserve IP logs, and issue statutory notices.

---

## Official Agency Watermark (28% Opacity)

All generated LaTeX source documents and HTML print previews embed an authentic law enforcement agency insignia watermark:

```latex
% Official Law Enforcement Insignia Watermark
\AddToShipoutPictureBG{%
  \begin{tikzpicture}[remember picture, overlay]
    \node[opacity=0.28] at (current page.center) {
      \includegraphics[width=125mm,keepaspectratio]{mp_police_watermark.png}
    };
  \end{tikzpicture}%
}
```

The opacity is calibrated to **28%**, ensuring the official state seal is clearly visible and authoritative in court while preserving pristine text legibility.

---

## Local Offline LLM Integration (Ollama Gemma)

For officers who want human-like narrative refinement in case diaries, Project Anant integrates with local offline LLMs (e.g. `gemma3:1b` via Ollama):
- **100% Offline Execution:** Runs completely on local CPU/GPU via `http://localhost:11434`.
- **Zero Data Leakage:** Sensitive banking records and citizen identities are never transmitted over the internet or sent to third-party cloud APIs.
- **Deterministic Guardrails:** The LLM strictly refines natural language phrasing while all factual numbers, account IDs, and transaction amounts remain locked to the deterministic database records.
