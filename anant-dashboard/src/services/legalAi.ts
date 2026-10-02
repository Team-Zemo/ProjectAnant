export interface LegalSummaryResponse {
  account_id: string;
  bank: string;
  total_siphoned: number;
  total_inflow: number;
  mule_score: number;
  layer: number;
  l1_txns: Array<{
    txn_id: string;
    sender_account: string;
    receiver_account: string;
    amount: number;
    ts_unix: number;
    payment_mode: string;
    receiver_bank: string;
    receiver_mule_score: number;
    receiver_layer: number;
  }>;
  l2_txns: Array<{
    txn_id: string;
    sender_account: string;
    receiver_account: string;
    amount: number;
    ts_unix: number;
    payment_mode: string;
    receiver_bank: string;
    receiver_mule_score: number;
    receiver_layer: number;
  }>;
  l3_txns: Array<{
    txn_id: string;
    sender_account: string;
    receiver_account: string;
    amount: number;
    ts_unix: number;
    payment_mode: string;
    receiver_bank: string;
    receiver_mule_score: number;
    receiver_layer: number;
    foreign_ip?: boolean;
    terminal_marker?: boolean;
    script_device?: boolean;
  }>;
  freeze_accounts: Array<{
    account_id: string;
    bank: string;
    layer: number;
    mule_score: number;
    total_in: number;
    total_out: number;
    estimated_holding_balance: number;
    has_foreign_ip: boolean;
    has_terminal_marker: boolean;
    has_script_device: boolean;
    syndicate_id?: string;
    syndicate_role?: string;
  }>;
  banks_summary: Array<{
    bank: string;
    accounts_count: number;
    total_disputed_inflow: number;
    max_mule_score: number;
  }>;
}

export async function fetchLegalSummary(accountId: string): Promise<LegalSummaryResponse> {
  const res = await fetch(`/api/legal/summary/${encodeURIComponent(accountId)}`);
  if (!res.ok) throw new Error(`Failed to fetch legal summary: ${res.statusText}`);
  return res.json();
}

export function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatDateTime(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ── Deterministic High-Quality Court-Ready Templates (Zero Latency) ─────────
export function generateDeterministicCaseDiary(
  data: LegalSummaryResponse,
  crimeNo = "CR-104/2026",
  policeStation = "Cyber Crime Police Station, Indore Commissionerate",
  ioName = "Insp. R. K. Sharma (Cyber Cell)"
): string {
  const currentDate = new Date().toLocaleDateString("en-IN", { dateStyle: "long" });
  const siphonedFormatted = formatINR(data.total_siphoned || data.total_inflow || 0);

  const l1Count = data.l1_txns?.length || 0;
  const l2Count = data.l2_txns?.length || 0;
  const l3Count = data.l3_txns?.length || 0;
  const freezeCount = data.freeze_accounts?.length || 0;

  return `# CHRONOLOGICAL CASE DIARY
**UNDER SECTION 172 Cr.P.C. / SECTION 168 BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS), 2023**

---

**POLICE STATION:** ${policeStation}  
**CRIME NO.:** ${crimeNo} / 2026 | **U/S:** 318(4), 316(2), 61(2) BNS, 2023 & Sec 66D IT Act  
**DATE OF ENTRY:** ${currentDate} | **RECORDED BY:** ${ioName}  
**CASE CLASSIFICATION:** Organized Cyber Financial Fraud & Multi-Layered Mule Siphoning  

---

### 1. GENESIS OF COMPLAINT & VICTIM ACCOUNT PARTICULARS
On receipt of complaint regarding unauthorized cyber siphoning of capital, an urgent automated multi-hop forensic trace was initiated on originating/target account:
- **Victim / Originating Account:** \`${data.account_id}\`
- **Originating Bank / IFSC:** ${data.bank || "N/A"}
- **Total Quantum Siphoned:** **${siphonedFormatted}**
- **Dispersal Status:** Rapid high-velocity dispersal across ${l1Count} primary Layer 1 mule accounts within minutes of inception.

---

### 2. MULTI-LAYER FORENSIC MONEY TRAIL AUDIT
Automated forensic graph traversal establishes a deliberate three-tier money laundering structure designed to obscure the audit trail:

#### A. Layer 1 (Primary Mule Inlets / Rapid Splitting)
- **Identified Nodes:** ${l1Count} accounts
- **Execution Mode:** Immediate split-up via IMPS/NEFT/UPI to evade single-transaction velocity threshold alerts.
${data.l1_txns?.slice(0, 5).map((t, idx) => `  ${idx + 1}. **Txn ID:** \`${t.txn_id}\` | **Beneficiary:** \`${t.receiver_account}\` (${t.receiver_bank}) | **Amount:** ${formatINR(t.amount)} | **Time:** ${formatDateTime(t.ts_unix)}`).join("\n")}
${l1Count > 5 ? `  *(and ${l1Count - 5} additional L1 transactions logged in forensic bundle)*` : ""}

#### B. Layer 2 (Layering & Smurfing Distributors)
- **Identified Nodes:** ${l2Count} intermediary aggregator/distributor nodes.
- **Modus Operandi:** Cross-bank pass-through transfers aggregating dispersed L1 funds into consolidated pooling nodes.
${data.l2_txns?.slice(0, 4).map((t, idx) => `  ${idx + 1}. **Txn ID:** \`${t.txn_id}\` | **From:** \`${t.sender_account}\` → **To:** \`${t.receiver_account}\` | **Amount:** ${formatINR(t.amount)}`).join("\n")}

#### C. Layer 3 (Terminal Cashout & Exit Points)
- **Identified Nodes:** ${l3Count} terminal cash-out endpoints.
- **Behavioral Indicators Detected:**
  - Foreign IP Access (185.x / 194.x range)
  - Headless script/emulator automation (Linux_Script, Web_Emulator)
  - P2P Crypto and digital wallet merchant cashouts.

---

### 3. ACTIONABLE DIRECTIVES & ACCOUNTS MARKED FOR IMMEDIATE FREEZE
To preserve the *corpus delicti* and prevent irrevocable terminal dissipation, the following **${freezeCount} accounts** are prioritized for immediate statutory freeze under Section 91 CrPC / Section 94 BNSS:

| Priority | Beneficiary Account | Bank / IFSC | Layer | Mule Index | Est. Holding Balance | Risk Factors |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
${data.freeze_accounts?.slice(0, 10).map((a, i) => `| ${i + 1} | \`${a.account_id}\` | ${a.bank} | L${a.layer} | **${a.mule_score}** | ${formatINR(a.estimated_holding_balance)} | ${[a.has_foreign_ip ? "Foreign IP" : "", a.has_terminal_marker ? "P2P Crypto" : "", a.has_script_device ? "Script" : ""].filter(Boolean).join(", ") || "Smurfing"} |`).join("\n")}

---

### 4. INVESTIGATING OFFICER'S NEXT STEPS
1. Dispatch Section 91 CrPC requisition notices to respective Bank Nodal Officers demanding immediate lien freeze.
2. Direct preservation of IP connection logs, KYC dossiers, and ATM CCTV footage for all listed Layer 1 & Layer 3 accounts.
3. Submit formal status report to Judicial Magistrate Cyber Court.

\`\`\`
Signed & Certified True Copy
${ioName}
Cyber Crime Police Station, Indore Commissionerate
\`\`\`
`;
}

export function generateDeterministicSec91Notice(
  data: LegalSummaryResponse,
  targetBank?: string,
  crimeNo = "CR-104/2026",
  policeStation = "Cyber Crime Police Station, Indore Commissionerate",
  ioName = "Insp. R. K. Sharma (Cyber Cell)"
): string {
  const currentDate = new Date().toLocaleDateString("en-IN", { dateStyle: "long" });
  const noticeNo = `CCPS/IND/SEC91/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

  // Filter transactions and freeze accounts for selected bank, or all
  const filteredAccounts = targetBank
    ? data.freeze_accounts?.filter((a) => a.bank.toUpperCase().includes(targetBank.toUpperCase()))
    : data.freeze_accounts;

  const filteredTxns = targetBank
    ? data.l1_txns?.filter((t) => t.receiver_bank.toUpperCase().includes(targetBank.toUpperCase()))
    : data.l1_txns;

  const bankDisplayName = targetBank || "RESPECTIVE PRINCIPAL NODAL OFFICERS (SBI, HDFC, ICICI, AXIS, ETC.)";

  return `# LEGAL NOTICE FOR DEBIT FREEZE & PRODUCTION OF EVIDENCE
**ISSUED UNDER SECTION 91 OF THE CODE OF CRIMINAL PROCEDURE, 1973**  
*(CORRESPONDING TO SECTION 94 OF BHARATIYA NAGARIK SURAKSHA SANHITA - BNSS, 2023)*

---

**NOTICE REF. NO.:** ${noticeNo}  
**DATE OF ISSUE:** ${currentDate}  
**ISSUING POLICE STATION:** ${policeStation}  
**CRIME REFERENCE:** FIR NO. ${crimeNo} / 2026  
**SECTIONS APPLIED:** Sec. 318(4), 316(2), 61(2) BNS, 2023 r/w Sec 66D Information Technology Act  

---

### TO:
**THE PRINCIPAL NODAL OFFICER / HEAD - CYBER FRAUD INVESTIGATION CELL**  
**${bankDisplayName}**  
**SUBJECT:** URGENT STATUTORY REQUISITION FOR IMMEDIATE DEBIT FREEZE / LIEN MARKING ON FRAUDULENT BENEFICIARY ACCOUNTS AND PRODUCTION OF FORENSIC BANKING RECORDS.

---

### 1. LEGAL RECITALS & STATUTORY MANDATE
Whereas, an investigation is in active progress at this Police Station into an organized cyber financial fraud wherein proceeds of crime totaling **${formatINR(data.total_siphoned || data.total_inflow || 0)}** were siphoned from Victim Account \`${data.account_id}\` through electronic unauthorized transfers.

Whereas, digital forensics and banking money-trail telemetry establish that the disputed stolen funds have been routed into and are currently residing within beneficiary account(s) maintained at your esteemed bank.

Now, therefore, in exercise of powers vested in me under **Section 91 Cr.P.C. (Section 94 BNSS, 2023)**, you are hereby **STRICTLY ORDERED AND DIRECTED** to execute the following directives immediately upon receipt of this notice:

---

### 2. REQUISITION CLAUSES
1. **IMMEDIATE DEBIT FREEZE & LIEN MARKING:**  
   You are directed to place an immediate **DEBIT FREEZE / LIEN MARK** to the extent of disputed amounts on the accounts tabulated in **Schedule-A** below to prevent withdrawal, ATM cashout, P2P crypto conversion, or downstream layering.

2. **PRODUCTION OF CERTIFIED SUBSCRIBER & KYC RECORDS:**  
   You are required to submit within **24 hours** certified true copies under Section 65B of the Indian Evidence Act / Section 63 BSA:
   - Complete Account Opening Form (AOF), Aadhaar/PAN cards, and biometric e-KYC logs.
   - Certified Statement of Account from inception till date with running balance.
   - IP access logs (with source port & timestamp) for Internet Banking and Mobile Banking logins.
   - ATM transaction logs with counter CCTV footage for all withdrawal attempts.

---

### SCHEDULE-A: TARGET BENEFICIARY ACCOUNTS TO BE FROZEN

| S.No. | Beneficiary Account No. | Bank / IFSC Prefix | Siphoned Amount | Layer | Mule Score | Modus / Terminal Marker |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
${(filteredAccounts?.length ? filteredAccounts : data.freeze_accounts)?.slice(0, 10).map((a, i) => `| ${i + 1} | **\`${a.account_id}\`** | ${a.bank} | ${formatINR(a.total_in)} | Layer ${a.layer} | **${a.mule_score}/100** | ${a.has_terminal_marker ? "P2P Crypto Exit" : a.has_foreign_ip ? "Foreign IP" : "Rapid Muling"} |`).join("\n")}

---

### SCHEDULE-B: DISPUTED ELECTRONIC TRANSACTIONS LOG

| Transaction ID | Originating Account | Beneficiary Account | Amount (INR) | Timestamp (IST) | Channel |
|:---:|:---:|:---:|:---:|:---:|:---:|
${(filteredTxns?.length ? filteredTxns : data.l1_txns)?.slice(0, 8).map((t) => `| \`${t.txn_id}\` | \`${t.sender_account}\` | \`${t.receiver_account}\` | **${formatINR(t.amount)}** | ${formatDateTime(t.ts_unix)} | ${t.payment_mode} |`).join("\n")}

---

### 3. STATUTORY WARNING & COMPLIANCE
Please take note that failure or willful neglect to comply with this statutory requisition forthwith will render the responsible bank officials liable for penal prosecution under:
- **Section 175 IPC / Section 211 BNS, 2023** (Omission to produce document to public servant by person legally bound to produce it).
- **Section 188 IPC / Section 223 BNS, 2023** (Disobedience to order duly promulgated by public servant).

Kindly confirm execution of debit freeze with current available balance via return official email to: \`cybercrime-indore@mp.gov.in\`.

---

\`\`\`
OFFICIAL SEAL & SIGNATURE

___________________________________________
(Investigating Officer)
${ioName}
Inspector of Police, Cyber Crime Police Station
Indore Police Commissionerate, Madhya Pradesh
\`\`\`
`;
}

// ── Streaming LLM Generation via Local Ollama (gemma3:1b) ───────────────────
export async function streamLegalNoticeWithOllama(
  prompt: string,
  onChunk: (chunk: string) => void,
  model = "gemma3:1b"
): Promise<string> {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP Error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Failed to get reader from Ollama stream response");

  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((l) => l.trim().length > 0);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.response) {
          fullText += parsed.response;
          onChunk(fullText);
        }
      } catch {
        // partial json chunk, ignore
      }
    }
  }

  return fullText;
}
