import React, { useState, useEffect, useMemo } from "react";
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
  Code2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Globe2,
} from "lucide-react";
import {
  fetchLegalSummary,
  generateDeterministicCaseDiary,
  streamLegalNoticeWithOllama,
  formatINR,
  formatDateTime,
  type LegalSummaryResponse,
} from "../../services/legalAi";
import { MP_POLICE_WATERMARK_DATA_URL } from "../../assets/watermarkBase64";
import {
  ReportLanguage,
  LatexFormValues,
  getDefaultFormValues,
  compileReportTokens,
  generateLatexSource,
  generateCourtHtml,
  fetchAiDeterministicSummaries,
} from "../../services/latexReport";
import {
  CaseDiaryFormValues,
  getDefaultCaseDiaryValues,
  compileCaseDiaryTokens,
  generateCaseDiaryLatex,
  generateCaseDiaryCourtHtml,
} from "../../services/caseDiaryLatex";

interface LegalNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

type TabType = "sec91_notice" | "case_diary" | "evidence_tables";

export const LegalNoticeModal: React.FC<LegalNoticeModalProps> = ({
  isOpen,
  onClose,
  accountId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("sec91_notice");
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [summaryData, setSummaryData] = useState<LegalSummaryResponse | null>(null);
  const [isEditing, setIsEditing] = useState(false); // for Case Diary markdown edit
  const [copied, setCopied] = useState(false);

  // Case Diary State (LaTeX)
  const [caseDiaryLang, setCaseDiaryLang] = useState<ReportLanguage>("en");
  const [caseDiaryValues, setCaseDiaryValues] = useState<CaseDiaryFormValues>(() =>
    getDefaultCaseDiaryValues(null, "en")
  );
  const [showCaseDiaryTex, setShowCaseDiaryTex] = useState(false);
  const [crimeNo, setCrimeNo] = useState("CR-104/2026");
  const [policeStation, setPoliceStation] = useState("Cyber Crime Police Station, Indore Commissionerate");
  const [ioName, setIoName] = useState("Insp. R. K. Sharma (Cyber Cell)");
  const [caseDiaryContent, setCaseDiaryContent] = useState("");

  // LaTeX Section 91 Report State
  const [reportLang, setReportLang] = useState<ReportLanguage>("en");
  const [latexFormValues, setLatexFormValues] = useState<LatexFormValues>(() =>
    getDefaultFormValues(null, "en")
  );
  const [showInputsDrawer, setShowInputsDrawer] = useState(false);
  const [showRawTex, setShowRawTex] = useState(false);
  const [activeFormCategory, setActiveFormCategory] = useState<"admin" | "victim" | "syndicate" | "narrative" | "officer">("admin");

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
        setCaseDiaryContent(diary);
        setLatexFormValues(getDefaultFormValues(data, reportLang));
        setCaseDiaryValues(getDefaultCaseDiaryValues(data, caseDiaryLang));
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

  // Language switch handler for Sec 91 Notice
  const handleLanguageSwitch = (newLang: ReportLanguage) => {
    setReportLang(newLang);
    setLatexFormValues((prev) => {
      const defaults = getDefaultFormValues(summaryData, newLang);
      return {
        ...defaults,
        firNumber: prev.firNumber || defaults.firNumber,
        caseNumber: prev.caseNumber || defaults.caseNumber,
        reportId: prev.reportId || defaults.reportId,
        officerName: prev.officerName || defaults.officerName,
        policeStation: prev.policeStation || defaults.policeStation,
        district: prev.district || defaults.district,
        reportDate: prev.reportDate || defaults.reportDate,
      };
    });
  };

  // Language switch handler for Case Diary
  const handleCaseDiaryLanguageSwitch = (newLang: ReportLanguage) => {
    setCaseDiaryLang(newLang);
    setCaseDiaryValues((prev) => {
      const defaults = getDefaultCaseDiaryValues(summaryData, newLang);
      return {
        ...defaults,
        crimeNo: prev.crimeNo || defaults.crimeNo,
        policeStation: prev.policeStation || defaults.policeStation,
        district: prev.district || defaults.district,
        ioName: prev.ioName || defaults.ioName,
      };
    });
  };

  // Compile tokens for LaTeX Section 91 Report
  const latexTokens = useMemo(() => {
    return compileReportTokens(summaryData, latexFormValues, reportLang);
  }, [summaryData, latexFormValues, reportLang]);

  // Generate 100% valid compilable LaTeX .tex code
  const compiledLatexSource = useMemo(() => {
    return generateLatexSource(latexTokens, reportLang);
  }, [latexTokens, reportLang]);

  // Generate 1:1 court-ready compiled HTML representation
  const compiledCourtHtml = useMemo(() => {
    return generateCourtHtml(latexTokens, reportLang);
  }, [latexTokens, reportLang]);

  // Compile tokens for LaTeX Case Diary
  const caseDiaryTokens = useMemo(() => {
    return compileCaseDiaryTokens(summaryData, caseDiaryValues, caseDiaryLang);
  }, [summaryData, caseDiaryValues, caseDiaryLang]);

  // Generate 100% valid compilable Case Diary LaTeX .tex code
  const compiledCaseDiaryLatex = useMemo(() => {
    return generateCaseDiaryLatex(caseDiaryTokens, caseDiaryLang);
  }, [caseDiaryTokens, caseDiaryLang]);

  // Generate 1:1 court-ready Case Diary compiled HTML representation
  const compiledCaseDiaryCourtHtml = useMemo(() => {
    return generateCaseDiaryCourtHtml(caseDiaryTokens, caseDiaryLang);
  }, [caseDiaryTokens, caseDiaryLang]);

  // Case Diary Simple Markdown parser
  const caseDiaryHtml = useMemo(() => {
    if (!caseDiaryContent) return "";
    return caseDiaryContent
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-foreground mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-foreground mt-5 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-foreground mt-6 mb-3">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-foreground">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
      .replace(/\n\n/gim, '<p class="my-2"></p>')
      .replace(/\n/gim, '<br />');
  }, [caseDiaryContent]);

  const handleCopy = () => {
    const textToCopy =
      activeTab === "sec91_notice"
        ? compiledLatexSource
        : activeTab === "case_diary"
        ? compiledCaseDiaryLatex
        : caseDiaryContent;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (activeTab === "sec91_notice") {
      const filename = `project_anant_compact_report_${reportLang}_${accountId}_${latexFormValues.reportId}.tex`;
      const blob = new Blob([compiledLatexSource], { type: "application/x-latex;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (activeTab === "case_diary") {
      const filename = `police_case_diary_${caseDiaryLang}_${caseDiaryValues.crimeNo.replace(/[^a-zA-Z0-9]/g, "_")}.tex`;
      const blob = new Blob([compiledCaseDiaryLatex], { type: "application/x-latex;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const filename = `${activeTab}_${accountId}_${new Date().toISOString().slice(0, 10)}.md`;
      const blob = new Blob([caseDiaryContent], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handlePrint = () => {
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

    if (activeTab === "sec91_notice") {
      const printHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Section_91_Notice_${accountId}_${latexFormValues.reportId}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;600;700;800&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Sans+Mono:wght@400;600&display=swap" rel="stylesheet">
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
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
                color: #202A33;
              }
              .latex-document-root {
                margin: 0;
                padding: 0;
              }
              .latex-page {
                width: 210mm;
                min-height: 297mm;
                height: 297mm;
                margin: 0;
                padding: 14mm 14mm 12mm 14mm !important;
                box-sizing: border-box;
                page-break-after: always !important;
                break-after: always !important;
                position: relative;
              }
              table {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              tr {
                page-break-inside: avoid;
                break-inside: avoid;
              }
            </style>
          </head>
          <body>
            ${compiledCourtHtml}
          </body>
        </html>
      `;
      doc.open();
      doc.write(printHtml);
      doc.close();
    } else if (activeTab === "case_diary") {
      const printHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Police_Case_Diary_${caseDiaryValues.crimeNo.replace(/[^a-zA-Z0-9]/g, "_")}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;600;700;800&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Sans+Mono:wght@400;600&display=swap" rel="stylesheet">
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
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
                color: #202A33;
              }
              .latex-document-root {
                margin: 0;
                padding: 0;
              }
              .latex-page {
                width: 210mm;
                min-height: 297mm;
                height: 297mm;
                margin: 0;
                padding: 14mm 14mm 12mm 14mm !important;
                box-sizing: border-box;
                page-break-after: always !important;
                break-after: always !important;
                position: relative;
              }
              table {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              tr {
                page-break-inside: avoid;
                break-inside: avoid;
              }
            </style>
          </head>
          <body>
            ${compiledCaseDiaryCourtHtml}
          </body>
        </html>
      `;
      doc.open();
      doc.write(printHtml);
      doc.close();
    } else if (activeTab === "evidence_tables" && summaryData) {
      const printHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Evidence_Tables_${accountId}</title>
            <style>
              @page { size: A4 portrait; margin: 15mm; }
              * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; margin: 0; padding: 0; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8.5pt; }
              th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; }
              th { background: #f2f2f2; font-weight: bold; }
              h1 { font-size: 13pt; text-align: center; margin-bottom: 12px; }
              h2 { font-size: 10.5pt; border-bottom: 1px solid #000; padding-bottom: 3px; margin-top: 14px; }
            </style>
          </head>
          <body style="position: relative;">
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 140mm; height: 140mm; pointer-events: none; z-index: -1; opacity: 0.14; display: flex; align-items: center; justify-content: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <img src="${MP_POLICE_WATERMARK_DATA_URL}" style="width: 100%; height: auto;" alt="Watermark" />
            </div>
            <h1>FORENSIC EVIDENCE SCHEDULE TABLES</h1>
            <h2>SCHEDULE A: ACCOUNTS RECOMMENDED FOR IMMEDIATE FREEZE (${summaryData.freeze_accounts?.length || 0})</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Account ID</th><th>Bank</th><th>Layer</th><th>Mule Score</th><th>Total Inflow</th><th>Est. Holding</th><th>Markers</th>
                </tr>
              </thead>
              <tbody>
                ${summaryData.freeze_accounts?.map((a, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><b>${a.account_id}</b></td>
                    <td>${a.bank}</td>
                    <td>L${a.layer}</td>
                    <td><b>${a.mule_score}</b></td>
                    <td>${formatINR(a.total_in)}</td>
                    <td><b>${formatINR(a.estimated_holding_balance)}</b></td>
                    <td>${[a.has_foreign_ip ? "Foreign IP" : "", a.has_terminal_marker ? "P2P Crypto" : "", a.has_script_device ? "Script" : ""].filter(Boolean).join(", ") || "Smurfing"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <h2>SCHEDULE B: DISPUTED LAYER 1 TRANSACTIONS (${summaryData.l1_txns?.length || 0})</h2>
            <table>
              <thead>
                <tr>
                  <th>Txn ID</th><th>Beneficiary Account</th><th>Bank</th><th>Amount (INR)</th><th>Timestamp</th><th>Mode</th>
                </tr>
              </thead>
              <tbody>
                ${summaryData.l1_txns?.map(t => `
                  <tr>
                    <td>${t.txn_id}</td>
                    <td><b>${t.receiver_account}</b></td>
                    <td>${t.receiver_bank}</td>
                    <td><b>${formatINR(t.amount)}</b></td>
                    <td>${formatDateTime(t.ts_unix)}</td>
                    <td>${t.payment_mode}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </body>
        </html>
      `;
      doc.open();
      doc.write(printHtml);
      doc.close();
    } else {
      // Case Diary
      const printHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Case_Diary_${crimeNo.replace(/[^a-zA-Z0-9]/g, "_")}</title>
            <style>
              @page { size: A4 portrait; margin: 18mm 15mm; }
              * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; line-height: 1.45; color: #000; margin: 0; padding: 0; position: relative; }
              .police-letterhead { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 14px; }
              h1 { font-size: 12pt; text-align: center; }
              h2, h3, h4 { font-family: Arial, sans-serif; font-size: 10pt; margin: 10pt 0 4pt 0; }
              table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 8.5pt; font-family: Arial, sans-serif; }
              th, td { border: 1px solid #000; padding: 4pt 5pt; }
              th { background: #f2f2f2; }
            </style>
          </head>
          <body style="position: relative;">
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 140mm; height: 140mm; pointer-events: none; z-index: -1; opacity: 0.14; display: flex; align-items: center; justify-content: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <img src="${MP_POLICE_WATERMARK_DATA_URL}" style="width: 100%; height: auto;" alt="Watermark" />
            </div>
            <div class="police-letterhead">
              <div style="font-size: 8.5pt; font-weight: bold; letter-spacing: 1px;">GOVERNMENT OF MADHYA PRADESH · POLICE DEPARTMENT</div>
              <div style="font-size: 13pt; font-weight: 800; margin-top: 3px;">${policeStation}</div>
              <div style="font-size: 8pt; color: #444;">Indore Police Commissionerate · Email: cybercrime-indore@mp.gov.in</div>
            </div>
            ${caseDiaryHtml}
          </body>
        </html>
      `;
      doc.open();
      doc.write(printHtml);
      doc.close();
    }

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

  // AI Generation Trigger
  const handleAiRefine = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);

    try {
      if (activeTab === "sec91_notice") {
        // AI strictly updates the deterministic summaries without modifying the LaTeX template structure
        const aiFields = await fetchAiDeterministicSummaries(summaryData, latexFormValues, reportLang);
        setLatexFormValues((prev) => ({
          ...prev,
          ...aiFields,
        }));
      } else if (activeTab === "case_diary") {
        const prompt = `You are a Senior Cyber Crime Investigating Officer at Cyber Crime Police Station, Indore.
Write an official, court-ready Chronological Police Case Diary under Section 172 Cr.P.C. / Section 168 BNSS, 2023 for:
- Victim Account: ${summaryData?.account_id} (${summaryData?.bank})
- Total Funds Siphoned: ${formatINR(summaryData?.total_siphoned || summaryData?.total_inflow || 0)}
- Layer 1 Mules count: ${summaryData?.l1_txns?.length || 0}
- Layer 2 Aggregators count: ${summaryData?.l2_txns?.length || 0}
- Layer 3 Terminal Cashouts: ${summaryData?.l3_txns?.length || 0}
- Immediate Freeze Accounts: ${summaryData?.freeze_accounts?.map((a) => `${a.account_id} (${a.bank}, MuleScore: ${a.mule_score})`).slice(0, 8).join(", ")}
Include chronological entry date, crime number ${crimeNo}, investigative findings, and official IO sign-off. Keep it formal, professional, and well-structured.`;

        await streamLegalNoticeWithOllama(
          prompt,
          (text) => setCaseDiaryContent(text),
          "gemma3:1b"
        );
      }
    } catch (err) {
      console.warn("AI generation failed, preserving structured facts:", err);
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="legal-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="legal-modal-container relative w-full max-w-6xl h-[92vh] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden text-foreground">
        
        {/* Top Modal Header */}
        <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 print:hidden">
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
                {activeTab === "sec91_notice" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-mono font-bold">
                    LATEX COMPILER
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                <span>Account: <strong className="text-foreground">{accountId}</strong></span>
                <span className="text-border">·</span>
                <span>Sec. 91 CrPC / Sec. 94 BNSS</span>
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
              title="Use local Gemma 3 AI to generate deterministic summary only"
            >
              <Sparkles className={`w-3.5 h-3.5 ${aiGenerating ? "animate-spin" : ""}`} />
              <span>{aiGenerating ? "Drafting..." : "AI Summary (Gemma 3)"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
              title="Print Official Court Document (PDF)"
            >
              <Printer className="w-4 h-4 text-foreground" />
            </button>

            <button
              onClick={handleCopy}
              className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
              title={activeTab === "sec91_notice" ? "Copy Sec 91 LaTeX Source (.tex)" : activeTab === "case_diary" ? "Copy Case Diary LaTeX Source (.tex)" : "Copy Content"}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-foreground" />}
            </button>

            <button
              onClick={handleDownload}
              className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
              title={activeTab === "sec91_notice" ? "Download Sec 91 .tex File" : activeTab === "case_diary" ? "Download Case Diary .tex File" : "Download Markdown"}
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

        {/* Tab Switcher & Sub-Controls */}
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
              <span>Sec. 91 Bank Freeze Notice (LaTeX)</span>
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
              <span>Police Case Diary (LaTeX)</span>
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

          {/* Right Controls depending on tab */}
          <div className="flex items-center gap-2">
            {activeTab === "sec91_notice" && (
              <>
                {/* Language Switcher */}
                <div className="flex items-center bg-muted/40 p-0.5 rounded-xl border border-border text-xs font-mono">
                  <button
                    onClick={() => handleLanguageSwitch("en")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      reportLang === "en"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => handleLanguageSwitch("hi")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      reportLang === "hi"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    हिन्दी
                  </button>
                </div>

                {/* Edit Form Drawer Toggle */}
                <button
                  onClick={() => setShowInputsDrawer(!showInputsDrawer)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    showInputsDrawer
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      : "bg-muted/40 border-border text-foreground hover:bg-muted"
                  }`}
                  title="Configure case fields and victim details"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Case Inputs</span>
                  {showInputsDrawer ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                </button>

                {/* LaTeX Source View Toggle */}
                <button
                  onClick={() => setShowRawTex(!showRawTex)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    showRawTex
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                  title="Toggle raw LaTeX code view"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showRawTex ? "Court Preview" : "View .tex"}</span>
                </button>
              </>
            )}

            {/* Case Diary LaTeX Controls */}
            {activeTab === "case_diary" && (
              <>
                {/* Language Switcher */}
                <div className="flex items-center bg-muted/40 p-0.5 rounded-xl border border-border text-xs font-mono">
                  <button
                    onClick={() => handleCaseDiaryLanguageSwitch("en")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      caseDiaryLang === "en"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => handleCaseDiaryLanguageSwitch("hi")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      caseDiaryLang === "hi"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    हिन्दी
                  </button>
                </div>

                {/* LaTeX Source View Toggle */}
                <button
                  onClick={() => setShowCaseDiaryTex(!showCaseDiaryTex)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    showCaseDiaryTex
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                  title="Toggle Case Diary raw LaTeX code view"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showCaseDiaryTex ? "Court Preview" : "View .tex"}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* SECTION 91: Case Inputs Form Drawer (Collapsible) */}
        {activeTab === "sec91_notice" && showInputsDrawer && (
          <div className="bg-muted/25 border-b border-border p-4 max-h-72 overflow-y-auto print:hidden animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold text-foreground font-sans uppercase tracking-wider">
                  Case Details & Requisition Inputs (Auto-Filled from Graph Facts)
                </h4>
              </div>

              {/* Category tabs within drawer */}
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <button
                  onClick={() => setActiveFormCategory("admin")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${activeFormCategory === "admin" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Admin / FIR
                </button>
                <button
                  onClick={() => setActiveFormCategory("victim")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${activeFormCategory === "victim" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Victim / Fraud
                </button>
                <button
                  onClick={() => setActiveFormCategory("syndicate")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${activeFormCategory === "syndicate" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Syndicate
                </button>
                <button
                  onClick={() => setActiveFormCategory("narrative")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${activeFormCategory === "narrative" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted"}`}
                >
                  AI Narrative
                </button>
                <button
                  onClick={() => setActiveFormCategory("officer")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${activeFormCategory === "officer" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Certification
                </button>
              </div>
            </div>

            {/* Form Fields by Category */}
            {activeFormCategory === "admin" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">FIR Number</label>
                  <input
                    type="text"
                    value={latexFormValues.firNumber}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, firNumber: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-mono focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Case Number</label>
                  <input
                    type="text"
                    value={latexFormValues.caseNumber}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, caseNumber: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-mono focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Report ID</label>
                  <input
                    type="text"
                    value={latexFormValues.reportId}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, reportId: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-mono focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Report Date</label>
                  <input
                    type="text"
                    value={latexFormValues.reportDate}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, reportDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-mono focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Officer Name</label>
                  <input
                    type="text"
                    value={latexFormValues.officerName}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, officerName: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Police Station</label>
                  <input
                    type="text"
                    value={latexFormValues.policeStation}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, policeStation: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none truncate"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">District / Jurisdiction</label>
                  <input
                    type="text"
                    value={latexFormValues.district}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, district: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Investigation Period</label>
                  <input
                    type="text"
                    value={latexFormValues.investigationPeriod}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, investigationPeriod: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
              </div>
            )}

            {activeFormCategory === "victim" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Victim Account (Masked)</label>
                  <input
                    type="text"
                    value={latexFormValues.victimAccountMasked}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, victimAccountMasked: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-mono focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Victim Bank</label>
                  <input
                    type="text"
                    value={latexFormValues.victimBank}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, victimBank: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Fraud Quantum Siphoned</label>
                  <input
                    type="text"
                    value={latexFormValues.fraudAmount}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, fraudAmount: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-bold text-rose-500 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Initial UTR Reference</label>
                  <input
                    type="text"
                    value={latexFormValues.initialUtr}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, initialUtr: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-mono focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Initial Transaction Timestamp</label>
                  <input
                    type="text"
                    value={latexFormValues.initialTxnDateTime}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, initialTxnDateTime: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Investigation Inception Source</label>
                  <input
                    type="text"
                    value={latexFormValues.investigationSource}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, investigationSource: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
              </div>
            )}

            {activeFormCategory === "syndicate" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Syndicate Identifier</label>
                  <input
                    type="text"
                    value={latexFormValues.syndicateId}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, syndicateId: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-mono focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Archetype Classification</label>
                  <input
                    type="text"
                    value={latexFormValues.syndicateArchetype}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, syndicateArchetype: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Topology / Relationship</label>
                  <input
                    type="text"
                    value={latexFormValues.syndicateRelationship}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, syndicateRelationship: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
              </div>
            )}

            {activeFormCategory === "narrative" && (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-foreground">Incident Summary (AI Deterministic)</label>
                    <span className="text-[10px] text-muted-foreground font-mono">Token: [[INCIDENT_SUMMARY]]</span>
                  </div>
                  <textarea
                    rows={2}
                    value={latexFormValues.incidentSummary}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, incidentSummary: e.target.value })}
                    className="w-full p-2 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-foreground">Account Interpretation (AI Deterministic)</label>
                    <span className="text-[10px] text-muted-foreground font-mono">Token: [[ACCOUNT_INTERPRETATION]]</span>
                  </div>
                  <textarea
                    rows={2}
                    value={latexFormValues.accountInterpretation}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, accountInterpretation: e.target.value })}
                    className="w-full p-2 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-foreground">Conclusion & Requisition Order (AI Deterministic)</label>
                    <span className="text-[10px] text-muted-foreground font-mono">Token: [[CONCLUSION]]</span>
                  </div>
                  <textarea
                    rows={2}
                    value={latexFormValues.conclusion}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, conclusion: e.target.value })}
                    className="w-full p-2 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
              </div>
            )}

            {activeFormCategory === "officer" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Certifying Officer Name</label>
                  <input
                    type="text"
                    value={latexFormValues.certifyingOfficerName}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, certifyingOfficerName: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Rank / Designation</label>
                  <input
                    type="text"
                    value={latexFormValues.certifyingOfficerRank}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, certifyingOfficerRank: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Station / Unit</label>
                  <input
                    type="text"
                    value={latexFormValues.certifyingPoliceStation}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, certifyingPoliceStation: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Certification Date</label>
                  <input
                    type="text"
                    value={latexFormValues.certificationDate}
                    onChange={(e) => setLatexFormValues({ ...latexFormValues, certificationDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Case Diary Parameters Strip */}
        {activeTab === "case_diary" && (
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
        )}

        {/* Main Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/10 print:p-0 print:overflow-visible">
          {loading && (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm font-mono text-muted-foreground">Loading forensic money trail facts...</span>
            </div>
          )}

          {/* TAB 1: SECTION 91 NOTICE (LATEX REPORT) */}
          {!loading && activeTab === "sec91_notice" && (
            <div className="max-w-4xl mx-auto space-y-6">
              {showRawTex ? (
                /* Read-Only Syntax Viewer for Generated LaTeX */
                <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <Code2 className="w-4 h-4 text-primary" />
                      <span>Compiled LaTeX Document: <strong>{reportLang === "hi" ? "project_anant_compact_report_hindi.tex" : "project_anant_compact_report_english.tex"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="/mp_police_watermark.png"
                        download="mp_police_watermark.png"
                        className="text-[11px] font-sans font-medium text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded border border-primary/20"
                        title="Download mp_police_watermark.png to compile locally with xelatex"
                      >
                        <Download className="w-3 h-3" />
                        <span>Watermark Asset (.png)</span>
                      </a>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        XeLaTeX Compilable
                      </span>
                    </div>
                  </div>
                  <pre className="p-4 bg-muted/30 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed text-foreground max-h-[65vh] select-all">
                    {compiledLatexSource}
                  </pre>
                </div>
              ) : (
                /* Client-Side Compiled Visual Document Preview */
                <div className="flex flex-col gap-6 items-center">
                  <div className="w-full rounded-2xl border border-border bg-white text-zinc-900 shadow-2xl p-6 sm:p-10 select-text overflow-x-auto">
                    <div dangerouslySetInnerHTML={{ __html: compiledCourtHtml }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: POLICE CASE DIARY (LATEX) */}
          {!loading && activeTab === "case_diary" && (
            <div className="max-w-4xl mx-auto space-y-6">
              {showCaseDiaryTex ? (
                /* Read-Only Syntax Viewer for Generated Case Diary LaTeX */
                <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <Code2 className="w-4 h-4 text-primary" />
                      <span>Compiled Case Diary LaTeX: <strong>{caseDiaryLang === "hi" ? "police_case_diary_hindi.tex" : "police_case_diary_english.tex"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="/mp_police_watermark.png"
                        download="mp_police_watermark.png"
                        className="text-[11px] font-sans font-medium text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded border border-primary/20"
                        title="Download mp_police_watermark.png to compile locally with xelatex"
                      >
                        <Download className="w-3 h-3" />
                        <span>Watermark Asset (.png)</span>
                      </a>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        XeLaTeX Compilable
                      </span>
                    </div>
                  </div>
                  <pre className="p-4 bg-muted/30 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed text-foreground max-h-[65vh] select-all">
                    {compiledCaseDiaryLatex}
                  </pre>
                </div>
              ) : (
                /* Client-Side Compiled Visual Document Preview */
                <div className="flex flex-col gap-6 items-center">
                  <div className="w-full rounded-2xl border border-border bg-white text-zinc-900 shadow-2xl p-6 sm:p-10 select-text overflow-x-auto">
                    <div dangerouslySetInnerHTML={{ __html: compiledCaseDiaryCourtHtml }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EVIDENCE TABLES */}
          {!loading && activeTab === "evidence_tables" && summaryData && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Accounts to Freeze Table */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-md">
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
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-md">
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
        </div>

        {/* Footer Status Bar */}
        <div className="px-5 py-2.5 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between text-xs text-muted-foreground font-mono print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Forensic Data: DuckDB Multi-Hop Engine (2M Txns)</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Section 91 CrPC / Section 94 BNSS</span>
            <span className="text-border">|</span>
            <span>LaTeX Client-Side Compilation Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
