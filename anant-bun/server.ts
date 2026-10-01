/**
 * anant-bun/server.ts
 * Bun.js orchestration layer:
 *   - Serves the React static build
 *   - Proxies API requests to Aegon (C++ engine on :8080)
 *   - Bridges llama-server for AI document generation with GBNF guardrails
 *   - PDF generation via Playwright
 */

import { serveStatic } from "./middleware/static";
import { generatePDF }  from "./pdf";

const AEGON_BASE  = process.env.AEGON_URL  ?? "http://127.0.0.1:8080";
const LLAMA_BASE  = process.env.LLAMA_URL  ?? "http://127.0.0.1:8090";
const PORT        = parseInt(process.env.PORT ?? "3000");

// ─────────────────────────────────────────────────────────────────────────────
// Bun HTTP Server
// ─────────────────────────────────────────────────────────────────────────────

const server = Bun.serve({
    port: PORT,

    async fetch(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const path = url.pathname;

        // ── CORS preflight ────────────────────────────────────────────────────
        if (req.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin":  "*",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                },
            });
        }

        // ── API proxy → Aegon C++ engine ──────────────────────────────────────
        if (path.startsWith("/api/") && path !== "/api/ai/legal") {
            const upstream = AEGON_BASE + path + url.search;
            const proxied  = new Request(upstream, {
                method:  req.method,
                headers: req.headers,
                body:    req.method !== "GET" ? req.body : undefined,
            });
            const res = await fetch(proxied);
            return new Response(res.body, {
                status:  res.status,
                headers: {
                    ...Object.fromEntries(res.headers),
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        // ── POST /api/ai/legal — legal document generation ────────────────────
        // Flow:
        //   1. POST /api/ai/generate to Aegon → gets verified facts JSON
        //   2. Build template-pinned prompt (NO hallucination possible on structure)
        //   3. POST to llama-server (with grammar= param) → structured JSON
        //   4. Validate output against facts DB
        //   5. Render PDF via Playwright
        //   6. Return PDF or JSON
        if (path === "/api/ai/legal" && req.method === "POST") {
            return handleLegalGeneration(req);
        }

        // ── GET /api/ai/legal/pdf/:id — download generated PDF ───────────────
        if (path.startsWith("/api/ai/legal/pdf/")) {
            const id = path.split("/").pop()!;
            const file = Bun.file(`/tmp/anant-legal-${id}.pdf`);
            if (await file.exists()) {
                return new Response(file, {
                    headers: {
                        "Content-Type":        "application/pdf",
                        "Content-Disposition": `attachment; filename="legal-notice-${id}.pdf"`,
                    },
                });
            }
            return new Response(JSON.stringify({ error: "PDF not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // ── Static React dashboard ────────────────────────────────────────────
        return serveStatic(req, "./static");
    },
});

console.log(`
╔══════════════════════════════════════════╗
║  Project Anant — Bun.js Orchestrator    ║
╚══════════════════════════════════════════╝
  Listening on  http://localhost:${PORT}
  Aegon proxy → ${AEGON_BASE}
  llama-server → ${LLAMA_BASE}
`);

// ─────────────────────────────────────────────────────────────────────────────
// Legal Document Generation Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleLegalGeneration(req: Request): Promise<Response> {
    const body = await req.json() as {
        account_id: string;
        type: "fir" | "freeze";
        officer_name?: string;
        station?: string;
    };

    if (!body.account_id) {
        return errorResponse(400, "account_id required");
    }

    // Step 1: Get verified facts from Aegon C++ engine
    const factsRes = await fetch(`${AEGON_BASE}/api/ai/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ account_id: body.account_id, type: body.type }),
    });
    if (!factsRes.ok) {
        return errorResponse(502, "Failed to get verified facts from engine");
    }
    const facts = await factsRes.json() as FactsPayload;

    // Step 2: Build template-pinned prompt
    // The LLM ONLY writes narrative prose — never account numbers or amounts
    const prompt = buildGuardrailedPrompt(facts, body.type, body.officer_name, body.station);

    // Step 3: Call llama-server with GBNF grammar (structural enforcement)
    const grammarFile = body.type === "freeze"
        ? "/home/surendra/IdeaProjects/ProjectAnant/grammars/freeze_notice.gbnf"
        : "/home/surendra/IdeaProjects/ProjectAnant/grammars/fir_diary.gbnf";

    let llamaResult: LlamaOutput;
    try {
        llamaResult = await callLlamaServer(prompt, grammarFile);
    } catch (e) {
        return errorResponse(503, `llama-server error: ${e}`);
    }

    // Step 4: Anti-hallucination validation
    const validationError = validateOutput(llamaResult, facts);
    if (validationError) {
        console.error("[AI] Validation failed:", validationError, "— retrying with stricter params");
        // Retry with temperature=0
        llamaResult = await callLlamaServer(prompt, grammarFile, { temperature: 0.0 });
        const retry = validateOutput(llamaResult, facts);
        if (retry) {
            return errorResponse(422, "AI output failed validation: " + retry);
        }
    }

    // Step 5: Render PDF
    const docId = `${body.account_id}-${Date.now()}`;
    const htmlContent = renderLegalHTML(llamaResult, facts, body.type);
    const pdfPath = await generatePDF(htmlContent, `/tmp/anant-legal-${docId}.pdf`);

    return new Response(JSON.stringify({
        success:  true,
        doc_id:   docId,
        pdf_url:  `/api/ai/legal/pdf/${docId}`,
        document: llamaResult,
    }), {
        headers: {
            "Content-Type":                "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Template-pinned prompt builder
// The LLM never sees raw instructions to "generate account numbers"
// ─────────────────────────────────────────────────────────────────────────────

interface FactsPayload {
    subject_account: string;
    bank: string;
    total_in: number;
    total_out: number;
    tx_count: number;
    graph_info: any[];
    transactions: any[];
}

function buildGuardrailedPrompt(
    facts: FactsPayload,
    type: "fir" | "freeze",
    officer?: string,
    station?: string
): string {
    const acct  = facts.subject_account;
    const bank  = facts.bank;
    const txns  = facts.transactions.slice(0, 20); // top 20 for context
    const layer = facts.graph_info[0]?.["a.layer"] ?? "unknown";
    const score = facts.graph_info[0]?.["a.mule_score"] ?? 0;

    const txnSummary = txns.map((t: any) =>
        `TXN: ${t.txn_id} | ₹${t.amount} | ${t.payment_mode} | ${new Date(t.ts_unix * 1000).toISOString()}`
    ).join("\n");

    if (type === "freeze") {
        return `You are a legal assistant drafting a Section 91 CrPC Bank Freeze Requisition.
Use ONLY the following verified data. DO NOT invent any account numbers, amounts, or transaction IDs.

VERIFIED DATA:
- Subject Account: ${acct}
- Bank Code: ${bank}
- Mule Layer Classification: ${layer === 1 ? "L1 Collector" : layer === 2 ? "L2 Distributor" : layer === 3 ? "L3 Terminal" : "Unknown"}
- Mule Risk Score: ${score}/100
- Total Funds Received: ₹${facts.total_in.toFixed(2)}
- Total Funds Dispersed: ₹${facts.total_out.toFixed(2)}
- Transaction Count: ${facts.tx_count}
- Investigating Officer: ${officer ?? "IO Name"}
- Police Station: ${station ?? "Cyber Cell, Indore"}

TOP TRANSACTIONS:
${txnSummary}

Write ONLY the "narrative_summary" field — a 3-4 sentence legal narrative describing suspicious activity.
Do NOT include account numbers in your narrative. Those are already in the structured data fields.`;
    }

    return `You are a legal assistant writing a Police Case Diary entry for a cybercrime investigation.
Use ONLY the data provided. DO NOT generate account numbers or transaction IDs.

CASE FACTS:
- Primary Account Under Investigation: ${acct} (${bank} Bank)
- Classification: Layer ${layer} Money Mule (Score: ${score}/100)
- Total Siphoned Funds: ₹${facts.total_in.toFixed(2)}
- Transactions Identified: ${facts.tx_count}

Write the "case_summary" field — a chronological paragraph (4-6 sentences) describing the money laundering scheme.
Reference transaction patterns and timing, but never fabricate specific account numbers or amounts beyond what's provided.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// llama-server caller
// ─────────────────────────────────────────────────────────────────────────────

interface LlamaOutput {
    narrative_summary?: string;
    case_summary?: string;
    [key: string]: any;
}

async function callLlamaServer(
    prompt: string,
    grammarFile: string,
    overrides: Record<string, any> = {}
): Promise<LlamaOutput> {
    const grammar = await Bun.file(grammarFile).text();

    const payload = {
        prompt,
        grammar,
        n_predict:   512,
        temperature: 0.1,
        top_p:       0.9,
        stop:        ["\n\n", "```"],
        ...overrides,
    };

    const res = await fetch(`${LLAMA_BASE}/completion`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(60_000), // 60s timeout
    });

    if (!res.ok) throw new Error(`llama-server HTTP ${res.status}`);
    const data = await res.json() as { content: string };
    return JSON.parse(data.content) as LlamaOutput;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-hallucination validator
// Ensures LLM output doesn't contain account numbers not in our dataset
// ─────────────────────────────────────────────────────────────────────────────

function validateOutput(output: LlamaOutput, facts: FactsPayload): string | null {
    const allText = JSON.stringify(output);

    // Extract all 12-digit numbers from LLM output
    const accountPattern = /\b\d{12}\b/g;
    const foundAccounts  = allText.match(accountPattern) ?? [];

    // Build set of verified accounts from facts
    const verified = new Set<string>([facts.subject_account]);
    for (const t of facts.transactions) {
        if (t.sender_account)   verified.add(t.sender_account);
        if (t.receiver_account) verified.add(t.receiver_account);
    }

    // Check for hallucinated accounts
    for (const acct of foundAccounts) {
        if (!verified.has(acct)) {
            return `Hallucinated account number detected: ${acct}`;
        }
    }

    // Check for hallucinated large amounts (not in transactions)
    const amountPattern = /₹[\d,]+\.?\d*/g;
    // (simplified validation — full impl would check against facts.transactions)

    return null; // valid
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML template renderer for legal docs
// ─────────────────────────────────────────────────────────────────────────────

function renderLegalHTML(doc: LlamaOutput, facts: FactsPayload, type: string): string {
    const date = new Date().toLocaleDateString("en-IN", {
        year: "numeric", month: "long", day: "numeric"
    });

    if (type === "freeze") {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; color: #000; }
    h1 { text-align: center; font-size: 16px; text-decoration: underline; }
    h2 { font-size: 14px; }
    .header { text-align: center; margin-bottom: 30px; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; }
    .section { margin: 20px 0; border-top: 1px solid #000; padding-top: 10px; }
    @media print { body { margin: 20mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>UNDER SECTION 91 CrPC / BNSS</h1>
    <h1>BANK ACCOUNT FREEZE REQUISITION</h1>
    <p>Indore Police Commissionerate — Cyber Cell (1930)</p>
  </div>

  <div class="section">
    <h2>TO</h2>
    <p>The Nodal Officer,<br>
    ${facts.bank} Bank,<br>
    [Branch Address]</p>
  </div>

  <div class="section">
    <h2>SUBJECT: Freeze Requisition for Cyber Fraud Investigation</h2>
    <div class="field"><span class="label">Date:</span> ${date}</div>
    <div class="field"><span class="label">Account Number:</span> ${facts.subject_account}</div>
    <div class="field"><span class="label">Bank / IFSC Prefix:</span> ${facts.bank}</div>
    <div class="field"><span class="label">Total Disputed Amount:</span> ₹${facts.total_in.toFixed(2)}</div>
    <div class="field"><span class="label">Number of Transactions:</span> ${facts.tx_count}</div>
  </div>

  <div class="section">
    <h2>GROUNDS FOR FREEZE</h2>
    <p>${doc.narrative_summary ?? "Suspicious activity identified."}</p>
  </div>

  <div class="section">
    <h2>TRANSACTION DETAILS (Top 5)</h2>
    <table border="1" cellpadding="4" style="width:100%; border-collapse:collapse;">
      <tr><th>TXN ID</th><th>Amount (₹)</th><th>Mode</th><th>Date/Time</th></tr>
      ${facts.transactions.slice(0, 5).map((t: any) =>
          `<tr><td>${t.txn_id}</td><td>${t.amount}</td><td>${t.payment_mode}</td>
           <td>${new Date(t.ts_unix * 1000).toLocaleString("en-IN")}</td></tr>`
      ).join("")}
    </table>
  </div>

  <div class="section">
    <div class="field"><span class="label">Investigating Officer:</span> ___________________</div>
    <div class="field"><span class="label">Badge No.:</span> ___________________</div>
    <div class="field"><span class="label">Police Station:</span> Cyber Cell, Indore</div>
    <br><br>
    <p>Signature: ___________________</p>
    <p>Seal: ___________________</p>
  </div>
</body>
</html>`;
    }

    // FIR / Case Diary
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; }
    h1, h2 { text-align: center; }
    .section { margin: 20px 0; }
    @media print { body { margin: 20mm; } }
  </style>
</head>
<body>
  <h1>POLICE CASE DIARY</h1>
  <h2>Cyber Crime Investigation — Money Mule Network</h2>
  <p><strong>Date:</strong> ${date}</p>
  <p><strong>Primary Account:</strong> ${facts.subject_account} (${facts.bank} Bank)</p>
  <p><strong>Mule Risk Score:</strong> ${facts.graph_info[0]?.["a.mule_score"] ?? "N/A"}/100</p>

  <div class="section">
    <h2>CASE SUMMARY</h2>
    <p>${doc.case_summary ?? "Investigation ongoing."}</p>
  </div>

  <div class="section">
    <h2>FINANCIAL SUMMARY</h2>
    <p><strong>Total Funds Received:</strong> ₹${facts.total_in.toFixed(2)}</p>
    <p><strong>Total Funds Dispersed:</strong> ₹${facts.total_out.toFixed(2)}</p>
    <p><strong>Transaction Count:</strong> ${facts.tx_count}</p>
  </div>
</body>
</html>`;
}

function errorResponse(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}
