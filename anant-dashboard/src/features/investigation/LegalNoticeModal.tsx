import React, { useState, useEffect, useMemo } from "react";
import { marked } from "marked";
import {
  X,
  Printer,
  Copy,
  Check,
  Download,
  Sparkles,
  FileText,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Edit3,
  Eye,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  fetchLegalSummary,
  generateDeterministicCaseDiary,
  generateDeterministicSec91Notice,
  streamLegalNoticeWithOllama,
  formatINR,
  formatDateTime,
  type LegalSummaryResponse,
} from "../../services/legalAi";

interface LegalNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

type TabType = "case_diary" | "sec91_notice" | "evidence_tables";

export const LegalNoticeModal: React.FC<LegalNoticeModalProps> = ({
  isOpen,
  onClose,
  accountId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("sec91_notice");
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [summaryData, setSummaryData] = useState<LegalSummaryResponse | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>("all");
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Notice parameters
  const [crimeNo, setCrimeNo] = useState("CR-104/2026");
  const [policeStation, setPoliceStation] = useState("Cyber Crime Police Station, Indore Commissionerate");
  const [ioName, setIoName] = useState("Insp. R. K. Sharma (Cyber Cell)");

  // Notice text content
  const [caseDiaryContent, setCaseDiaryContent] = useState("");
  const [sec91Content, setSec91Content] = useState("");

  // Load summary data on modal open
  useEffect(() => {
    if (!isOpen || !accountId) return;

    let cancelled = false;
    setLoading(true);

    fetchLegalSummary(accountId)
      .then((data) => {
        if (cancelled) return;
        setSummaryData(data);
        const diary = generateDeterministicCaseDiary(data, crimeNo, policeStation, ioName);
        const sec91 = generateDeterministicSec91Notice(data, undefined, crimeNo, policeStation, ioName);
        setCaseDiaryContent(diary);
        setSec91Content(sec91);
      })
      .catch((err) => {
        console.error("Failed to load legal facts:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, accountId]);

  // Update notice when bank filter changes
  useEffect(() => {
    if (!summaryData) return;
    const bank = selectedBank === "all" ? undefined : selectedBank;
    const sec91 = generateDeterministicSec91Notice(summaryData, bank, crimeNo, policeStation, ioName);
    setSec91Content(sec91);
  }, [selectedBank, summaryData]);

  const currentContent = activeTab === "case_diary" ? caseDiaryContent : sec91Content;

  const renderedHtml = useMemo(() => {
    try {
      return marked.parse(currentContent, { gfm: true, breaks: true }) as string;
    } catch {
      return currentContent;
    }
  }, [currentContent]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    // Create an isolated hidden iframe for clean, court-ready multi-page printing
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    let bodyContent = "";
    if (activeTab === "evidence_tables" && summaryData) {
      bodyContent = `
        <h1 style="text-align:center; font-size:13pt; margin-bottom:12pt; text-transform:uppercase;">FORENSIC EVIDENCE SCHEDULE TABLES</h1>
        <h2 style="font-size:11pt; border-bottom:1px solid #000; padding-bottom:3px; margin-top:14pt; text-transform:uppercase;">SCHEDULE A: ACCOUNTS RECOMMENDED FOR IMMEDIATE FREEZE (${summaryData.freeze_accounts?.length || 0})</h2>
        <table>
          <thead>
            <tr>
              <th style="width:25px; text-align:center;">#</th>
              <th>Account ID</th>
              <th>Bank</th>
              <th style="width:35px; text-align:center;">Layer</th>
              <th style="width:55px; text-align:center;">Mule Index</th>
              <th style="text-align:right;">Total Inflow</th>
              <th style="text-align:right;">Est. Holding Balance</th>
              <th>Risk Markers</th>
            </tr>
          </thead>
          <tbody>
            ${summaryData.freeze_accounts?.map((a, i) => `
              <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td><b>${a.account_id}</b></td>
                <td>${a.bank}</td>
                <td style="text-align:center;">L${a.layer}</td>
                <td style="text-align:center;"><b>${a.mule_score}</b></td>
                <td style="text-align:right;">${formatINR(a.total_in)}</td>
                <td style="text-align:right;"><b>${formatINR(a.estimated_holding_balance)}</b></td>
                <td>${[a.has_foreign_ip ? "Foreign IP" : "", a.has_terminal_marker ? "P2P Crypto" : "", a.has_script_device ? "Script" : ""].filter(Boolean).join(", ") || "Smurfing"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h2 style="font-size:11pt; border-bottom:1px solid #000; padding-bottom:3px; margin-top:18pt; text-transform:uppercase;">SCHEDULE B: DISPUTED LAYER 1 TRANSACTIONS (${summaryData.l1_txns?.length || 0})</h2>
        <table>
          <thead>
            <tr>
              <th>Txn ID</th>
              <th>Beneficiary Account</th>
              <th>Bank</th>
              <th style="text-align:right;">Amount (INR)</th>
              <th>Timestamp (IST)</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            ${summaryData.l1_txns?.map(t => `
              <tr>
                <td>${t.txn_id}</td>
                <td><b>${t.receiver_account}</b></td>
                <td>${t.receiver_bank}</td>
                <td style="text-align:right;"><b>${formatINR(t.amount)}</b></td>
                <td>${formatDateTime(t.ts_unix)}</td>
                <td style="text-transform:uppercase;">${t.payment_mode}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else {
      bodyContent = renderedHtml;
    }

    const docTitle = activeTab === "case_diary" 
      ? `Case_Diary_${crimeNo.replace(/[^a-zA-Z0-9]/g, "_")}` 
      : activeTab === "evidence_tables" 
      ? `Evidence_Tables_${accountId}` 
      : `Section_91_Notice_${accountId}`;

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${docTitle}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 18mm 15mm 18mm 15mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
              font-family: "Times New Roman", Times, Georgia, serif;
              font-size: 10.5pt;
              line-height: 1.45;
            }
            .police-letterhead {
              text-align: center;
              border-bottom: 2px solid #000000;
              padding-bottom: 6px;
              margin-bottom: 14px;
            }
            .govt-title {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 8.5pt;
              font-weight: 700;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              color: #222222;
            }
            .ps-heading {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 13.5pt;
              font-weight: 800;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              margin: 4px 0 2px 0;
              color: #000000;
            }
            .ps-sub {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 8.5pt;
              color: #444444;
            }
            h1, h2, h3, h4 {
              font-family: Arial, Helvetica, sans-serif;
              color: #000000;
              page-break-after: avoid;
              break-after: avoid;
            }
            h1 {
              font-size: 12.5pt;
              text-align: center;
              text-transform: uppercase;
              margin: 12pt 0 6pt 0;
              letter-spacing: 0.5px;
            }
            h2 {
              font-size: 11pt;
              border-bottom: 1px solid #000000;
              padding-bottom: 2pt;
              margin-top: 14pt;
              margin-bottom: 6pt;
              text-transform: uppercase;
            }
            h3 {
              font-size: 10.5pt;
              margin-top: 10pt;
              margin-bottom: 4pt;
              font-weight: 700;
            }
            p {
              margin: 5pt 0;
              text-align: justify;
            }
            ul, ol {
              margin: 4pt 0 6pt 18pt;
              padding: 0;
            }
            li {
              margin-bottom: 3pt;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10pt 0;
              font-size: 8.5pt;
              font-family: Arial, Helvetica, sans-serif;
              page-break-inside: auto;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            th, td {
              border: 1px solid #000000;
              padding: 4.5pt 5pt;
              text-align: left;
              vertical-align: middle;
            }
            th {
              background-color: #f2f2f2 !important;
              font-weight: 700;
            }
            pre, code {
              font-family: "Courier New", Courier, monospace;
              font-size: 8.5pt;
              color: #000000;
            }
            pre {
              border: 1px dashed #444444;
              padding: 6pt;
              background: #fafafa !important;
              white-space: pre-wrap;
              word-break: break-all;
              page-break-inside: avoid;
              break-inside: avoid;
              margin: 8pt 0;
            }
            hr {
              border: none;
              border-top: 1px solid #000000;
              margin: 10pt 0;
            }
            strong, b {
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <div class="police-letterhead">
            <div class="govt-title">Government of Madhya Pradesh · Police Department</div>
            <div class="ps-heading">${policeStation}</div>
            <div class="ps-sub">Indore Police Commissionerate · Pin: 452001 · Email: cybercrime-indore@mp.gov.in</div>
          </div>
          <div class="doc-content">
            ${bodyContent}
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(printHtml);
    doc.close();

    // Allow resources and fonts to render, then trigger print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Print failed:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    }, 250);
  };

  const handleDownload = () => {
    const filename = `${activeTab}_${accountId}_${new Date().toISOString().slice(0, 10)}.md`;
    const blob = new Blob([currentContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Trigger Ollama AI generation using gemma3:1b
  const handleAiRefine = async () => {
    if (!summaryData || aiGenerating) return;
    setAiGenerating(true);

    try {
      if (activeTab === "case_diary") {
        const prompt = `You are a Senior Cyber Crime Investigating Officer at Cyber Crime Police Station, Indore.
Write an official, court-ready Chronological Police Case Diary under Section 172 Cr.P.C. / Section 168 BNSS, 2023 for:
- Victim Account: ${summaryData.account_id} (${summaryData.bank})
- Total Funds Siphoned: ${formatINR(summaryData.total_siphoned || summaryData.total_inflow)}
- Layer 1 Mules count: ${summaryData.l1_txns?.length || 0}
- Layer 2 Aggregators count: ${summaryData.l2_txns?.length || 0}
- Layer 3 Terminal Cashouts: ${summaryData.l3_txns?.length || 0}
- Immediate Freeze Accounts: ${summaryData.freeze_accounts?.map((a) => `${a.account_id} (${a.bank}, MuleScore: ${a.mule_score})`).slice(0, 8).join(", ")}
Include chronological entry date, crime number ${crimeNo}, investigative findings, and official IO sign-off. Keep it formal, professional, and well-structured.`;

        await streamLegalNoticeWithOllama(
          prompt,
          (text) => setCaseDiaryContent(text),
          "gemma3:1b"
        );
      } else {
        const prompt = `You are an Investigating Officer at Cyber Crime Police Station, Indore Commissionerate.
Write a formal legal freeze requisition notice under Section 91 of Code of Criminal Procedure, 1973 (and Section 94 BNSS, 2023) addressed to:
The Principal Nodal Officer / Cyber Fraud Investigation Cell, ${selectedBank === "all" ? "Respective Banks (SBI, HDFC, ICICI, etc.)" : selectedBank}
Case Ref: FIR No. ${crimeNo}/2026.
Requisition directives:
1. Immediate debit freeze and lien marking on fraudulent accounts siphoned from victim ${summaryData.account_id}.
2. Immediate production of account opening KYC, biometric verification, IP access logs, and statement of accounts.
3. Statutory warning under Section 175 IPC / Section 211 BNS, 2023 for non-compliance.
Sign off as ${ioName}, Cyber Crime Police Station, Indore.`;

        await streamLegalNoticeWithOllama(
          prompt,
          (text) => setSec91Content(text),
          "gemma3:1b"
        );
      }
    } catch (err) {
      console.warn("Ollama AI generation failed, keeping structured template:", err);
    } finally {
      setAiGenerating(false);
    }
  };

  const banksList = summaryData?.banks_summary || [];

  return (
    <div className="legal-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="legal-modal-container relative w-full max-w-5xl h-[90vh] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden text-foreground">
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/25 text-primary flex items-center justify-center font-bold shadow-sm">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-foreground font-sans tracking-tight">
                  Legal AI Officer & Notice Generator
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  COURT-READY
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                <span>Account: <strong className="text-foreground">{accountId}</strong></span>
                <span className="text-border">·</span>
                <span>Sec. 91 CrPC / Sec. 168 BNSS</span>
                <span className="text-border">·</span>
                <span className="text-primary font-bold">Model: gemma3:1b</span>
              </p>
            </div>
          </div>

          {/* Quick Actions Header */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAiRefine}
              disabled={aiGenerating || loading}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
              title="Use local Gemma 3 AI to generate or refine legal narrative"
            >
              <Sparkles className={`w-3.5 h-3.5 ${aiGenerating ? "animate-spin" : ""}`} />
              <span>{aiGenerating ? "AI Drafting..." : "AI Re-Draft (Gemma 3)"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
              title="Print Official Court Document"
            >
              <Printer className="w-4 h-4 text-foreground" />
            </button>

            <button
              onClick={handleCopy}
              className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
              title="Copy to Clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-foreground" />}
            </button>

            <button
              onClick={handleDownload}
              className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
              title="Download Markdown Document"
            >
              <Download className="w-4 h-4 text-foreground" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer ml-1"
              title="Close Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Filters */}
        <div className="px-5 py-2.5 bg-background border-b border-border flex flex-wrap items-center justify-between gap-3 flex-shrink-0 print:hidden">
          {/* Main Document Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border text-xs">
            <button
              onClick={() => setActiveTab("sec91_notice")}
              className={`px-3 py-1.5 rounded-lg font-bold font-sans transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "sec91_notice"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Sec. 91 Bank Freeze Notice</span>
            </button>

            <button
              onClick={() => setActiveTab("case_diary")}
              className={`px-3 py-1.5 rounded-lg font-bold font-sans transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "case_diary"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Police Case Diary</span>
            </button>

            <button
              onClick={() => setActiveTab("evidence_tables")}
              className={`px-3 py-1.5 rounded-lg font-bold font-sans transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "evidence_tables"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Evidence Tables</span>
            </button>
          </div>

          {/* Right Sub-Controls */}
          <div className="flex items-center gap-3">
            {/* Bank Filter Chips (When on Sec 91 Notice) */}
            {activeTab === "sec91_notice" && banksList.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto max-w-md py-1">
                <span className="text-[10px] text-muted-foreground font-mono uppercase mr-1">Bank:</span>
                <button
                  onClick={() => setSelectedBank("all")}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                    selectedBank === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Banks
                </button>
                {banksList.slice(0, 5).map((b) => (
                  <button
                    key={b.bank}
                    onClick={() => setSelectedBank(b.bank)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                      selectedBank === b.bank
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {b.bank.slice(0, 4)} ({b.accounts_count})
                  </button>
                ))}
              </div>
            )}

            {/* Edit / Preview Toggle */}
            {activeTab !== "evidence_tables" && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                  isEditing
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : "bg-muted border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                <span>{isEditing ? "Preview Mode" : "Edit Text"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Notice Parameters Strip (Collapsible Metadata) */}
        <div className="px-5 py-2 bg-muted/15 border-b border-border flex flex-wrap items-center gap-4 text-xs font-mono print:hidden">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">FIR Crime No:</span>
            <input
              type="text"
              value={crimeNo}
              onChange={(e) => setCrimeNo(e.target.value)}
              className="px-2 py-0.5 rounded bg-background border border-border text-foreground font-bold text-xs w-28 focus:border-primary outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Police Station:</span>
            <input
              type="text"
              value={policeStation}
              onChange={(e) => setPoliceStation(e.target.value)}
              className="px-2 py-0.5 rounded bg-background border border-border text-foreground text-xs w-64 focus:border-primary outline-none truncate"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">IO:</span>
            <input
              type="text"
              value={ioName}
              onChange={(e) => setIoName(e.target.value)}
              className="px-2 py-0.5 rounded bg-background border border-border text-foreground text-xs w-48 focus:border-primary outline-none"
            />
          </div>
        </div>

        {/* Main Document Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-background print:p-0 print:overflow-visible">
          {loading && (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm font-mono text-muted-foreground">Loading forensic money trail facts...</span>
            </div>
          )}

          {!loading && activeTab === "evidence_tables" && summaryData && (
            <div className="space-y-6">
              {/* Accounts to Freeze Table */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <h4 className="text-sm font-bold text-foreground font-sans">
                      Target Accounts Recommended for Immediate Freeze ({summaryData.freeze_accounts?.length || 0})
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">Ranked by Mule Index</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left">
                        <th className="py-2 px-2">Account ID</th>
                        <th className="py-2 px-2">Bank</th>
                        <th className="py-2 px-2">Layer</th>
                        <th className="py-2 px-2">Mule Index</th>
                        <th className="py-2 px-2 text-right">Total In</th>
                        <th className="py-2 px-2 text-right">Est. Holding</th>
                        <th className="py-2 px-2">Risk Markers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.freeze_accounts?.map((a) => (
                        <tr key={a.account_id} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="py-2 px-2 font-bold text-primary">{a.account_id}</td>
                          <td className="py-2 px-2">{a.bank}</td>
                          <td className="py-2 px-2">L{a.layer}</td>
                          <td className="py-2 px-2">
                            <span className={`px-1.5 py-0.5 rounded font-bold ${
                              a.mule_score >= 70 ? "text-rose-500 bg-rose-500/15" : "text-amber-500 bg-amber-500/15"
                            }`}>
                              {a.mule_score}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-emerald-400">{formatINR(a.total_in)}</td>
                          <td className="py-2 px-2 text-right font-bold text-foreground">{formatINR(a.estimated_holding_balance)}</td>
                          <td className="py-2 px-2 text-[10px] text-muted-foreground">
                            {[a.has_foreign_ip ? "Foreign IP" : "", a.has_terminal_marker ? "P2P Crypto" : "", a.has_script_device ? "Script" : ""].filter(Boolean).join(", ") || "Smurfing"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Layer 1 Disputed Transactions Table */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground font-sans">
                      Primary Layer 1 Outflow Transactions ({summaryData.l1_txns?.length || 0})
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">Disputed Evidence Log</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left">
                        <th className="py-2 px-2">Txn ID</th>
                        <th className="py-2 px-2">Beneficiary Account</th>
                        <th className="py-2 px-2">Receiver Bank</th>
                        <th className="py-2 px-2 text-right">Amount (INR)</th>
                        <th className="py-2 px-2">Timestamp (IST)</th>
                        <th className="py-2 px-2">Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.l1_txns?.map((t) => (
                        <tr key={t.txn_id} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="py-2 px-2 font-bold text-foreground">{t.txn_id}</td>
                          <td className="py-2 px-2 text-primary">{t.receiver_account}</td>
                          <td className="py-2 px-2">{t.receiver_bank}</td>
                          <td className="py-2 px-2 text-right font-bold text-rose-500">{formatINR(t.amount)}</td>
                          <td className="py-2 px-2 text-muted-foreground">{formatDateTime(t.ts_unix)}</td>
                          <td className="py-2 px-2 uppercase">{t.payment_mode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab !== "evidence_tables" && (
            <div className="max-w-4xl mx-auto">
              {isEditing ? (
                <textarea
                  value={currentContent}
                  onChange={(e) => {
                    if (activeTab === "case_diary") setCaseDiaryContent(e.target.value);
                    else setSec91Content(e.target.value);
                  }}
                  className="w-full h-[65vh] p-4 font-mono text-xs leading-relaxed rounded-2xl bg-card border border-border text-foreground focus:border-primary outline-none resize-none shadow-inner"
                  placeholder="Edit legal notice text..."
                />
              ) : (
                <div className="legal-paper-document p-8 sm:p-12 rounded-2xl bg-card border border-border shadow-xl font-serif text-foreground print:border-none print:shadow-none print:p-0">
                  {/* Official Government Header for Print */}
                  <div className="text-center border-b-2 border-foreground/80 pb-4 mb-6">
                    <div className="text-xs uppercase tracking-widest font-sans font-bold text-muted-foreground">
                      GOVERNMENT OF MADHYA PRADESH · POLICE DEPARTMENT
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-sans uppercase tracking-tight text-foreground mt-1">
                      {policeStation}
                    </div>
                    <div className="text-xs font-sans text-muted-foreground mt-0.5">
                      Indore Police Commissionerate · Pin: 452001 · Email: cybercrime-indore@mp.gov.in
                    </div>
                  </div>

                  {/* Rendered Document Body */}
                  <div
                    className="legal-html-content selection:bg-primary/20"
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Status Bar */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between text-xs text-muted-foreground font-mono print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Forensic Data: DuckDB Multi-Hop Engine (2M Txns)</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Section 91 CrPC / Section 168 BNSS</span>
            <span className="text-border">|</span>
            <span>Certified Court-Ready Forensics</span>
          </div>
        </div>
      </div>
    </div>
  );
};
