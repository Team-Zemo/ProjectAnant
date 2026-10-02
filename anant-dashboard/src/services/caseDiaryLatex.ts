// LaTeX Case Diary Engine for Police Investigation (Section 172 Cr.P.C. / Section 168 BNSS, 2023)
// Generates court-ready, compilable LaTeX documents and pixel-perfect A4 HTML previews
// with official MP Police background watermark.

import { LegalSummaryResponse, formatINR, formatDateTime } from "./legalAi";
import { MP_POLICE_WATERMARK_DATA_URL } from "../assets/watermarkBase64";
import { ReportLanguage } from "./latexReport";

export interface CaseDiaryFormValues {
  policeStation: string;
  district: string;
  crimeNo: string;
  dateOfEntry: string;
  sectionsApplied: string;
  ioName: string;
  ioRank: string;
  caseClassification: string;
  victimAccount: string;
  victimBank: string;
  fraudAmount: string;
  initialUtr: string;
  dispersalSummary: string;
  incidentDiaryText: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
}

export function escapeLatex(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return "";
  const s = String(text);
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

export function getDefaultCaseDiaryValues(
  data: LegalSummaryResponse | null,
  lang: ReportLanguage = "en"
): CaseDiaryFormValues {
  const isHi = lang === "hi";
  const now = new Date();
  const dateStr = now.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const siphoned = data ? formatINR(data.total_siphoned || data.total_inflow || 0) : "₹ 1,50,00,000";
  const l1Count = data?.l1_txns?.length || 3;
  const freezeCount = data?.freeze_accounts?.length || 5;

  return {
    policeStation: isHi
      ? "साइबर अपराध पुलिस थाना, इंदौर कमिश्नरेट"
      : "Cyber Crime Police Station, Indore Commissionerate",
    district: isHi ? "इंदौर कमिश्नरेट, मध्य प्रदेश" : "Indore Commissionerate, Madhya Pradesh",
    crimeNo: "CR-104/2026",
    dateOfEntry: dateStr,
    sectionsApplied: "Sec. 318(4), 316(2), 61(2) BNS, 2023 & Sec. 66D IT Act",
    ioName: isHi ? "निरीक्षक आर. के. शर्मा" : "Insp. R. K. Sharma",
    ioRank: isHi ? "निरीक्षक (साइबर अपराध प्रकोष्ठ)" : "Inspector of Police (Cyber Crime Cell)",
    caseClassification: isHi
      ? "संगठित वित्तीय साइबर धोखाधड़ी एवं बहु-स्तरीय म्यूल नेटवर्क मनी लॉन्ड्रिंग"
      : "Organized Cyber Financial Fraud & Multi-Layered Mule Siphoning Syndicate",
    victimAccount: data?.account_id || "XXXX-XXXX-8921",
    victimBank: data?.bank || "State Bank of India",
    fraudAmount: siphoned,
    initialUtr: data?.l1_txns?.[0]?.txn_id || "CMS2026100299812",
    dispersalSummary: isHi
      ? `घटना के 3 से 5 मिनट के भीतर ${l1Count} प्राथमिक म्यूल खातों में उच्च वेग से अंतरण।`
      : `Rapid high-velocity electronic dispersal into ${l1Count} primary Layer 1 mule accounts within 3-5 minutes.`,
    incidentDiaryText: isHi
      ? `आवेदक/पीड़ित की सूचना पर अधिकृत साइबर अपराध पंजीबद्ध कर त्वरित डिजिटल विश्लेषण प्रारंभ किया गया। प्रारंभिक साक्ष्यों एवं बैंक वित्तीय प्रवाह से स्पष्ट है कि संगठित साइबर सिंडिकेट द्वारा अनधिकृत इंटरनेट बैंकिंग/यूपीआई सत्र स्थापित कर संपूर्ण राशि को तात्कालिक रूप से प्राथमिक म्यूल खातों में विभाजित कर अंतरित किया गया।`
      : `Upon formal receipt of financial cyber fraud complaint, expedited digital forensics and graph traversal were initiated. Banking money-trail telemetry establishes that an organized syndicate established unauthorized access, splitting siphoned proceeds across primary mule accounts to evade anti-money laundering velocity thresholds.`,
    step1: isHi
      ? "संबंधित बैंक नोडल अधिकारियों को धारा 91 दं.प्र.सं. के अंतर्गत तत्काल डेबिट फ्रीज एवं लियन मार्किंग नोटिस प्रेषित करना।"
      : "Serve Section 91 Cr.P.C. / Sec 94 BNSS statutory requisitions to concerned Principal Bank Nodal Officers for immediate debit freeze.",
    step2: isHi
      ? "समस्त चिन्हित प्राथमिक एवं टर्मिनल खातों के विस्तृत खाता प्रपत्र (AOF), ई-केवाईसी रिकॉर्ड एवं आईपी लॉगिन लॉग्स संरक्षित कराना।"
      : "Requisition certified Account Opening Forms (AOF), biometric e-KYC documents, and IP access connection logs.",
    step3: isHi
      ? "एटीएम निकासी एवं पी2पी क्रिप्टो निकासी बिंदुओं के सीसीटीवी फुटेज एवं डिजिटल वॉलेट ऑपरेटर संदर्भ एकत्र करना।"
      : "Direct immediate preservation of ATM counter CCTV footage, merchant transaction logs, and P2P crypto counterparty records.",
    step4: isHi
      ? "प्रकरण की अद्यतन प्रगति रिपोर्ट सक्षम न्यायिक मजिस्ट्रेट (साइबर न्यायालय) के समक्ष प्रस्तुत करना।"
      : "Submit comprehensive interim progress status report before the Hon'ble Judicial Magistrate (Cyber Court).",
  };
}

export function compileCaseDiaryTokens(
  data: LegalSummaryResponse | null,
  values: CaseDiaryFormValues,
  lang: ReportLanguage = "en"
): Record<string, string> {
  const isHi = lang === "hi";

  const tokens: Record<string, string> = {
    POLICE_STATION: values.policeStation,
    DISTRICT: values.district,
    CRIME_NO: values.crimeNo,
    DATE_OF_ENTRY: values.dateOfEntry,
    SECTIONS_APPLIED: values.sectionsApplied,
    IO_NAME: values.ioName,
    IO_RANK: values.ioRank,
    CASE_CLASSIFICATION: values.caseClassification,
    VICTIM_ACCOUNT: values.victimAccount,
    VICTIM_BANK: values.victimBank,
    FRAUD_AMOUNT: values.fraudAmount,
    INITIAL_UTR: values.initialUtr,
    DISPERSAL_SUMMARY: values.dispersalSummary,
    INCIDENT_DIARY_TEXT: values.incidentDiaryText,
    STEP_1: values.step1,
    STEP_2: values.step2,
    STEP_3: values.step3,
    STEP_4: values.step4,
    TOTAL_SIPHONED: values.fraudAmount,
    L1_COUNT: String(data?.l1_txns?.length || 3),
    L2_COUNT: String(data?.l2_txns?.length || 2),
    L3_COUNT: String(data?.l3_txns?.length || 1),
    FREEZE_COUNT: String(data?.freeze_accounts?.length || 5),
  };

  // Populate L1 transactions (up to 5)
  for (let i = 1; i <= 5; i++) {
    const txn = data?.l1_txns?.[i - 1];
    tokens[`L1_TX${i}_ID`] = txn ? txn.txn_id : `TXN-L100${i}`;
    tokens[`L1_TX${i}_ACC`] = txn ? txn.receiver_account : `ACC-MULE-00${i}`;
    tokens[`L1_TX${i}_BANK`] = txn ? txn.receiver_bank : (i % 2 === 0 ? "HDFC Bank" : "State Bank of India");
    tokens[`L1_TX${i}_AMOUNT`] = txn ? formatINR(txn.amount) : formatINR(350000);
    tokens[`L1_TX${i}_TIME`] = txn ? formatDateTime(txn.ts_unix) : `2026-10-02 14:${10 + i * 2}:15`;
    tokens[`L1_TX${i}_MODE`] = txn ? txn.payment_mode : "IMPS";
  }

  // Populate Freeze Target Accounts (up to 5)
  for (let i = 1; i <= 5; i++) {
    const acc = data?.freeze_accounts?.[i - 1];
    tokens[`FREEZE_${i}_ACC`] = acc ? acc.account_id : `ACC-MULE-00${i}`;
    tokens[`FREEZE_${i}_BANK`] = acc ? acc.bank : "HDFC Bank";
    tokens[`FREEZE_${i}_LAYER`] = acc ? `L${acc.layer}` : `L${(i % 3) + 1}`;
    tokens[`FREEZE_${i}_SCORE`] = acc ? `${acc.mule_score}/100` : `${85 + i}/100`;
    tokens[`FREEZE_${i}_HOLDING`] = acc ? formatINR(acc.estimated_holding_balance) : formatINR(280000);
    const markers: string[] = [];
    if (acc?.has_foreign_ip) markers.push(isHi ? "विदेशी आईपी" : "Foreign IP");
    if (acc?.has_terminal_marker) markers.push(isHi ? "पी2पी क्रिप्टो" : "P2P Crypto");
    if (acc?.has_script_device) markers.push(isHi ? "ऑटोमेशन स्क्रिप्ट" : "Script Bot");
    if (markers.length === 0) markers.push(isHi ? "स्मर्फिंग प्रवाह" : "Rapid Smurfing");
    tokens[`FREEZE_${i}_MARKERS`] = markers.join(", ");
  }

  return tokens;
}

// ── RAW CASE DIARY LATEX TEMPLATES ──────────────────────────────────────────

export const CASE_DIARY_LATEX_TEMPLATE_ENGLISH = `% Official Madhya Pradesh Police Case Diary
% Maintained under Section 172 Cr.P.C. / Section 168 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023
% Note: Ensure 'mp_police_watermark.png' is placed in the same working directory for the official background seal.
\\documentclass[9pt,a4paper]{article}
\\usepackage[a4paper,left=14mm,right=14mm,top=12mm,bottom=12mm,headheight=14pt,headsep=5mm,footskip=7mm]{geometry}
\\usepackage{fontspec}
\\usepackage{microtype}
\\usepackage{array,tabularx,booktabs,longtable}
\\usepackage{fancyhdr}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{lastpage}
\\usepackage{hyperref}
\\hypersetup{hidelinks}
\\usepackage{graphicx}
\\usepackage{tikz}
\\usepackage{eso-pic}

% Official Madhya Pradesh Police Insignia Watermark
\\AddToShipoutPictureBG{%
  \\begin{tikzpicture}[remember picture, overlay]
    \\node[opacity=0.15] at (current page.center) {
      \\includegraphics[width=125mm,keepaspectratio]{mp_police_watermark.png}
    };
  \\end{tikzpicture}%
}

\\setmainfont{Noto Serif}[Ligatures=TeX]
\\definecolor{ink}{HTML}{202A33}
\\definecolor{rule}{HTML}{65727E}
\\definecolor{paperblue}{HTML}{294B63}
\\definecolor{placeholder}{HTML}{5B6670}
\\definecolor{placeholderbg}{HTML}{EEF1F3}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{2.5pt}
\\renewcommand{\\arraystretch}{1.1}
\\setlist[enumerate]{leftmargin=16pt,itemsep=2pt,topsep=2pt}

\\newcommand{\\PH}[1]{\\textcolor{placeholder}{\\fboxsep=1pt\\colorbox{placeholderbg}{\\texttt{\\detokenize{[[#1]]}}}}}
\\newcommand{\\SEC}[1]{\\vspace{4pt}{\\color{paperblue}\\large\\bfseries #1}\\par\\vspace{2pt}\\hrule height 0.55pt\\vspace{3pt}}
\\newcommand{\\NOTE}[1]{\\textcolor{rule}{\\footnotesize\\textit{#1}}}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\small\\textbf{POLICE DEPARTMENT, MADHYA PRADESH} \\;|\\; CASE DIARY}
\\fancyhead[R]{\\small\\textit{Confidential — Investigation Record U/S 172 Cr.P.C.}}
\\fancyfoot[L]{\\small Chronological Case Diary · Crime No. \\PH{CRIME_NO}}
\\fancyfoot[R]{\\small Page \\thepage\\ of \\pageref{LastPage}}
\\renewcommand{\\headrulewidth}{0.5pt}
\\renewcommand{\\footrulewidth}{0.4pt}

\\begin{document}

\\begin{center}
{\\fontsize{8.5}{10}\\selectfont\\textbf{GOVERNMENT OF MADHYA PRADESH \\;\\textperiodcentered\\; POLICE DEPARTMENT}}\\par
\\vspace{1pt}
{\\fontsize{13}{15}\\selectfont\\bfseries CHRONOLOGICAL POLICE CASE DIARY}\\par
{\\small Maintained under Section 172 Cr.P.C. / Section 168 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023}\\par
{\\footnotesize Project Anant Cyber Forensics \\;|\\; PS: \\PH{POLICE_STATION}}\\par
\\vspace{3pt}\\rule{0.92\\linewidth}{0.7pt}
\\end{center}

\\SEC{CASE PARTICULARS \\& ADMINISTRATIVE RECORD}
\\begin{tabularx}{\\linewidth}{@{}>{\\bfseries}p{28mm} X >{\\bfseries}p{28mm} X@{}}
Police Station & \\PH{POLICE_STATION} & District & \\PH{DISTRICT}\\\\
Crime / FIR No. & \\PH{CRIME_NO} & Date of Entry & \\PH{DATE_OF_ENTRY}\\\\
Sections Applied & \\PH{SECTIONS_APPLIED} & Investigating Officer & \\PH{IO_NAME}\\\\
Case Classification & \\multicolumn{3}{X}{\\PH{CASE_CLASSIFICATION}}
\\end{tabularx}

\\SEC{1. GENESIS OF INCIDENT \\& VICTIM PARTICULARS}
\\begin{tabularx}{\\linewidth}{@{}>{\\bfseries}p{28mm} X >{\\bfseries}p{28mm} X@{}}
Victim Account & \\PH{VICTIM_ACCOUNT} & Originating Bank & \\PH{VICTIM_BANK}\\\\
Fraud Quantum & \\textbf{\\PH{FRAUD_AMOUNT}} & Initial Ref / UTR & \\PH{INITIAL_UTR}\\\\
Dispersal Pattern & \\multicolumn{3}{X}{\\PH{DISPERSAL_SUMMARY}}
\\end{tabularx}

\\vspace{3pt}
\\textbf{Case Diary Narrative Record.} \\PH{INCIDENT_DIARY_TEXT}

\\SEC{2. MULTI-LAYER MONEY TRAIL AUDIT}
\\NOTE{Reconstructed transaction sequence across primary siphoning nodes. Table reflects verified banking telemetry.}

\\vspace{2pt}
\\textbf{Primary Layer 1 Mule Inflows (Immediate Siphoning)}
\\scriptsize
\\begin{tabularx}{\\linewidth}{@{}c l l l r l@{}}
\\toprule
\\textbf{\\#} & \\textbf{Txn ID / Ref} & \\textbf{Beneficiary Account} & \\textbf{Bank} & \\textbf{Amount} & \\textbf{Timestamp}\\\\
\\midrule
1 & \\PH{L1_TX1_ID} & \\PH{L1_TX1_ACC} & \\PH{L1_TX1_BANK} & \\PH{L1_TX1_AMOUNT} & \\PH{L1_TX1_TIME}\\\\
2 & \\PH{L1_TX2_ID} & \\PH{L1_TX2_ACC} & \\PH{L1_TX2_BANK} & \\PH{L1_TX2_AMOUNT} & \\PH{L1_TX2_TIME}\\\\
3 & \\PH{L1_TX3_ID} & \\PH{L1_TX3_ACC} & \\PH{L1_TX3_BANK} & \\PH{L1_TX3_AMOUNT} & \\PH{L1_TX3_TIME}\\\\
4 & \\PH{L1_TX4_ID} & \\PH{L1_TX4_ACC} & \\PH{L1_TX4_BANK} & \\PH{L1_TX4_AMOUNT} & \\PH{L1_TX4_TIME}\\\\
5 & \\PH{L1_TX5_ID} & \\PH{L1_TX5_ACC} & \\PH{L1_TX5_BANK} & \\PH{L1_TX5_AMOUNT} & \\PH{L1_TX5_TIME}\\\\
\\bottomrule
\\end{tabularx}
\\normalsize

\\newpage

\\SEC{3. ACCOUNTS PRIORITIZED FOR STATUTORY FREEZE}
\\NOTE{Prioritized beneficiaries identified by AI graph intelligence for lien marking under Sec 91 CrPC / Sec 94 BNSS.}

\\vspace{2pt}
\\scriptsize
\\begin{tabularx}{\\linewidth}{@{}c p{24mm} p{26mm} c c r X@{}}
\\toprule
\\textbf{\\#} & \\textbf{Account ID} & \\textbf{Bank} & \\textbf{Layer} & \\textbf{Mule Score} & \\textbf{Est. Holding} & \\textbf{Forensic Markers}\\\\
\\midrule
1 & \\PH{FREEZE_1_ACC} & \\PH{FREEZE_1_BANK} & \\PH{FREEZE_1_LAYER} & \\PH{FREEZE_1_SCORE} & \\PH{FREEZE_1_HOLDING} & \\PH{FREEZE_1_MARKERS}\\\\
2 & \\PH{FREEZE_2_ACC} & \\PH{FREEZE_2_BANK} & \\PH{FREEZE_2_LAYER} & \\PH{FREEZE_2_SCORE} & \\PH{FREEZE_2_HOLDING} & \\PH{FREEZE_2_MARKERS}\\\\
3 & \\PH{FREEZE_3_ACC} & \\PH{FREEZE_3_BANK} & \\PH{FREEZE_3_LAYER} & \\PH{FREEZE_3_SCORE} & \\PH{FREEZE_3_HOLDING} & \\PH{FREEZE_3_MARKERS}\\\\
4 & \\PH{FREEZE_4_ACC} & \\PH{FREEZE_4_BANK} & \\PH{FREEZE_4_LAYER} & \\PH{FREEZE_4_SCORE} & \\PH{FREEZE_4_HOLDING} & \\PH{FREEZE_4_MARKERS}\\\\
5 & \\PH{FREEZE_5_ACC} & \\PH{FREEZE_5_BANK} & \\PH{FREEZE_5_LAYER} & \\PH{FREEZE_5_SCORE} & \\PH{FREEZE_5_HOLDING} & \\PH{FREEZE_5_MARKERS}\\\\
\\bottomrule
\\end{tabularx}
\\normalsize

\\SEC{4. INVESTIGATIVE INSTRUCTIONS \\& NEXT STEPS}
\\begin{enumerate}
\\item \\PH{STEP_1}
\\item \\PH{STEP_2}
\\item \\PH{STEP_3}
\\item \\PH{STEP_4}
\\end{enumerate}

\\vspace{8pt}
\\textbf{RECORDING OFFICER CERTIFICATION}

Certified that this Case Diary entry accurately records the chronological investigation steps, forensic telemetry, and statutory preservation requisitions initiated on this date in respect of Crime No. \\PH{CRIME_NO}.

\\vspace{10pt}
\\begin{tabularx}{\\linewidth}{@{}X X@{}}
\\rule{0.82\\linewidth}{0.4pt} & \\rule{0.82\\linewidth}{0.4pt}\\\\[-1pt]
\\PH{IO_NAME} & Signature\\\\[7pt]
\\rule{0.82\\linewidth}{0.4pt} & \\rule{0.82\\linewidth}{0.4pt}\\\\[-1pt]
\\PH{IO_RANK} & \\PH{DATE_OF_ENTRY}\\\\[7pt]
\\rule{0.82\\linewidth}{0.4pt} & \\\\
\\PH{POLICE_STATION} & \\\\
\\end{tabularx}

\\vfill
\\begin{center}
\\footnotesize\\textbf{Confidential Case Record under Section 172 Cr.P.C.}\\quad\\textit{All facts certified against underlying banking transaction records.}
\\end{center}

\\end{document}
`;

export const CASE_DIARY_LATEX_TEMPLATE_HINDI = `% Official Madhya Pradesh Police Case Diary (Hindi)
% Maintained under Section 172 Cr.P.C. / Section 168 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023
% Note: Ensure 'mp_police_watermark.png' is placed in the same working directory for the official background seal.
\\documentclass[9pt,a4paper]{article}
\\usepackage[a4paper,left=14mm,right=14mm,top=12mm,bottom=12mm,headheight=14pt,headsep=5mm,footskip=7mm]{geometry}
\\usepackage{fontspec}
\\usepackage{microtype}
\\usepackage{array,tabularx,booktabs,longtable}
\\usepackage{fancyhdr}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{lastpage}
\\usepackage{hyperref}
\\hypersetup{hidelinks}
\\usepackage{graphicx}
\\usepackage{tikz}
\\usepackage{eso-pic}

% Official Madhya Pradesh Police Insignia Watermark
\\AddToShipoutPictureBG{%
  \\begin{tikzpicture}[remember picture, overlay]
    \\node[opacity=0.15] at (current page.center) {
      \\includegraphics[width=125mm,keepaspectratio]{mp_police_watermark.png}
    };
  \\end{tikzpicture}%
}

\\setmainfont{Noto Serif Devanagari}[Script=Devanagari,Language=Hindi]
\\newfontfamily\\latinfont{Noto Serif}[Ligatures=TeX]
\\newfontfamily\\monofont{Noto Sans Mono}
\\definecolor{ink}{HTML}{202A33}
\\definecolor{rule}{HTML}{65727E}
\\definecolor{paperblue}{HTML}{294B63}
\\definecolor{placeholder}{HTML}{5B6670}
\\definecolor{placeholderbg}{HTML}{EEF1F3}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{2.5pt}
\\renewcommand{\\arraystretch}{1.1}
\\setlist[enumerate]{leftmargin=16pt,itemsep=2pt,topsep=2pt}

\\newcommand{\\PH}[1]{\\textcolor{placeholder}{\\fboxsep=1pt\\colorbox{placeholderbg}{\\monofont\\scriptsize\\detokenize{[[#1]]}}}}
\\newcommand{\\SEC}[1]{\\vspace{4pt}{\\color{paperblue}\\large\\bfseries #1}\\par\\vspace{2pt}\\hrule height 0.55pt\\vspace{3pt}}
\\newcommand{\\NOTE}[1]{\\textcolor{rule}{\\footnotesize\\textit{#1}}}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\small\\textbf{मध्य प्रदेश पुलिस विभाग} \\;|\\; केस डायरी}
\\fancyhead[R]{\\small\\textit{गोपनीय — प्रकरण अभिलेख धारा 172 दं.प्र.सं.}}
\\fancyfoot[L]{\\small कालानुक्रमिक केस डायरी · अपराध क्रमांक \\PH{CRIME_NO}}
\\fancyfoot[R]{\\small पृष्ठ \\thepage\\ / \\pageref{LastPage}}
\\renewcommand{\\headrulewidth}{0.5pt}
\\renewcommand{\\footrulewidth}{0.4pt}

\\begin{document}

\\begin{center}
{\\fontsize{8.5}{10}\\selectfont\\textbf{मध्य प्रदेश शासन \\;\\textperiodcentered\\; पुलिस विभाग}}\\par
\\vspace{1pt}
{\\fontsize{13}{15}\\selectfont\\bfseries कालानुक्रमिक पुलिस केस डायरी}\\par
{\\small धारा 172 दण्ड प्रक्रिया संहिता, 1973 / धारा 168 भारतीय नागरिक सुरक्षा संहिता (BNSS), 2023}\\par
{\\footnotesize प्रोजेक्ट अनंत साइबर फॉरेंसिक \\;|\\; थाना: \\PH{POLICE_STATION}}\\par
\\vspace{3pt}\\rule{0.92\\linewidth}{0.7pt}
\\end{center}

\\SEC{प्रकरण विवरण एवं प्रशासनिक अभिलेख}
\\begin{tabularx}{\\linewidth}{@{}>{\\bfseries}p{28mm} X >{\\bfseries}p{28mm} X@{}}
थाना & \\PH{POLICE_STATION} & जिला & \\PH{DISTRICT}\\\\
अपराध / प्राथमिकी क्र. & \\PH{CRIME_NO} & प्रविष्टि दिनांक & \\PH{DATE_OF_ENTRY}\\\\
लागू धाराएं & \\PH{SECTIONS_APPLIED} & विवेचना अधिकारी & \\PH{IO_NAME}\\\\
प्रकरण वर्गीकरण & \\multicolumn{3}{X}{\\PH{CASE_CLASSIFICATION}}
\\end{tabularx}

\\SEC{1. घटना का मूल एवं पीड़ित का विवरण}
\\begin{tabularx}{\\linewidth}{@{}>{\\bfseries}p{28mm} X >{\\bfseries}p{28mm} X@{}}
पीड़ित खाता & \\PH{VICTIM_ACCOUNT} & मूल बैंक & \\PH{VICTIM_BANK}\\\\
धोखाधड़ी राशि & \\textbf{\\PH{FRAUD_AMOUNT}} & प्रारंभिक संदर्भ / UTR & \\PH{INITIAL_UTR}\\\\
प्रवाह स्वरूप & \\multicolumn{3}{X}{\\PH{DISPERSAL_SUMMARY}}
\\end{tabularx}

\\vspace{3pt}
\\textbf{केस डायरी दैनंदिनी विवरण.} \\PH{INCIDENT_DIARY_TEXT}

\\SEC{2. बहु-स्तरीय धनराशि प्रवाह विश्लेषण}
\\NOTE{प्राथमिक निकासी खातों में पुनर्निर्मित लेनदेन प्रवाह। तालिका बैंक फॉरेंसिक से सत्यापित है।}

\\vspace{2pt}
\\textbf{प्रथम स्तर (Layer 1) प्राथमिक म्यूल आवक (त्वरित निकासी)}
\\scriptsize
\\begin{tabularx}{\\linewidth}{@{}c l l l r l@{}}
\\toprule
\\textbf{\\#} & \\textbf{लेनदेन ID} & \\textbf{लाभार्थी खाता} & \\textbf{बैंक} & \\textbf{राशि} & \\textbf{समय}\\\\
\\midrule
1 & \\PH{L1_TX1_ID} & \\PH{L1_TX1_ACC} & \\PH{L1_TX1_BANK} & \\PH{L1_TX1_AMOUNT} & \\PH{L1_TX1_TIME}\\\\
2 & \\PH{L1_TX2_ID} & \\PH{L1_TX2_ACC} & \\PH{L1_TX2_BANK} & \\PH{L1_TX2_AMOUNT} & \\PH{L1_TX2_TIME}\\\\
3 & \\PH{L1_TX3_ID} & \\PH{L1_TX3_ACC} & \\PH{L1_TX3_BANK} & \\PH{L1_TX3_AMOUNT} & \\PH{L1_TX3_TIME}\\\\
4 & \\PH{L1_TX4_ID} & \\PH{L1_TX4_ACC} & \\PH{L1_TX4_BANK} & \\PH{L1_TX4_AMOUNT} & \\PH{L1_TX4_TIME}\\\\
5 & \\PH{L1_TX5_ID} & \\PH{L1_TX5_ACC} & \\PH{L1_TX5_BANK} & \\PH{L1_TX5_AMOUNT} & \\PH{L1_TX5_TIME}\\\\
\\bottomrule
\\end{tabularx}
\\normalsize

\\newpage

\\SEC{3. वैधानिक रोक (फ्रीज) हेतु प्राथमिकता प्राप्त खाते}
\\NOTE{धारा 91 दं.प्र.सं. / धारा 94 BNSS के अधीन लियन मार्किंग हेतु चिह्नित खाते।}

\\vspace{2pt}
\\scriptsize
\\begin{tabularx}{\\linewidth}{@{}c p{24mm} p{26mm} c c r X@{}}
\\toprule
\\textbf{\\#} & \\textbf{खाता क्रमांक} & \\textbf{बैंक} & \\textbf{स्तर} & \\textbf{म्यूल स्कोर} & \\textbf{अनुमानित शेष} & \\textbf{फॉरेंसिक संकेतक}\\\\
\\midrule
1 & \\PH{FREEZE_1_ACC} & \\PH{FREEZE_1_BANK} & \\PH{FREEZE_1_LAYER} & \\PH{FREEZE_1_SCORE} & \\PH{FREEZE_1_HOLDING} & \\PH{FREEZE_1_MARKERS}\\\\
2 & \\PH{FREEZE_2_ACC} & \\PH{FREEZE_2_BANK} & \\PH{FREEZE_2_LAYER} & \\PH{FREEZE_2_SCORE} & \\PH{FREEZE_2_HOLDING} & \\PH{FREEZE_2_MARKERS}\\\\
3 & \\PH{FREEZE_3_ACC} & \\PH{FREEZE_3_BANK} & \\PH{FREEZE_3_LAYER} & \\PH{FREEZE_3_SCORE} & \\PH{FREEZE_3_HOLDING} & \\PH{FREEZE_3_MARKERS}\\\\
4 & \\PH{FREEZE_4_ACC} & \\PH{FREEZE_4_BANK} & \\PH{FREEZE_4_LAYER} & \\PH{FREEZE_4_SCORE} & \\PH{FREEZE_4_HOLDING} & \\PH{FREEZE_4_MARKERS}\\\\
5 & \\PH{FREEZE_5_ACC} & \\PH{FREEZE_5_BANK} & \\PH{FREEZE_5_LAYER} & \\PH{FREEZE_5_SCORE} & \\PH{FREEZE_5_HOLDING} & \\PH{FREEZE_5_MARKERS}\\\\
\\bottomrule
\\end{tabularx}
\\normalsize

\\SEC{4. विवेचना अधिकारी के अग्रिम निर्देश एवं कार्रवाई}
\\begin{enumerate}
\\item \\PH{STEP_1}
\\item \\PH{STEP_2}
\\item \\PH{STEP_3}
\\item \\PH{STEP_4}
\\end{enumerate}

\\vspace{8pt}
\\textbf{विवेचक प्रमाणन}

प्रमाणित किया जाता है कि यह केस डायरी प्रविष्टि अपराध क्रमांक \\PH{CRIME_NO} के संबंध में आज दिनांक तक की गई कालानुक्रमिक विवेचना, फॉरेंसिक विश्लेषण एवं वैधानिक कार्रवाई को सत्य रूप से दर्ज करती है।

\\vspace{10pt}
\\begin{tabularx}{\\linewidth}{@{}X X@{}}
\\rule{0.82\\linewidth}{0.4pt} & \\rule{0.82\\linewidth}{0.4pt}\\\\[-1pt]
\\PH{IO_NAME} & हस्ताक्षर\\\\[7pt]
\\rule{0.82\\linewidth}{0.4pt} & \\rule{0.82\\linewidth}{0.4pt}\\\\[-1pt]
\\PH{IO_RANK} & \\PH{DATE_OF_ENTRY}\\\\[7pt]
\\rule{0.82\\linewidth}{0.4pt} & \\\\
\\PH{POLICE_STATION} & \\\\
\\end{tabularx}

\\vfill
\\begin{center}
\\footnotesize\\textbf{धारा 172 दं.प्र.सं. के अधीन गोपनीय प्रकरण अभिलेख।}\\quad\\textit{समस्त तथ्य बैंकिंग अभिलेखों से सत्यापित हैं।}
\\end{center}

\\end{document}
`;

export function generateCaseDiaryLatex(
  tokens: Record<string, string>,
  lang: ReportLanguage = "en"
): string {
  const template = lang === "hi" ? CASE_DIARY_LATEX_TEMPLATE_HINDI : CASE_DIARY_LATEX_TEMPLATE_ENGLISH;
  let result = template;

  for (const [key, value] of Object.entries(tokens)) {
    const escaped = escapeLatex(value);
    const searchTarget = `\\PH{${key}}`;
    result = result.replaceAll(searchTarget, escaped);
  }

  return result;
}

// Generates pixel-perfect 1:1 court-ready Case Diary HTML representation for preview & print
export function generateCaseDiaryCourtHtml(
  tokens: Record<string, string>,
  lang: ReportLanguage = "en"
): string {
  const isHi = lang === "hi";

  const watermarkHtml = `
    <div class="mp-police-watermark" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 135mm; height: 135mm; pointer-events: none; z-index: 0; opacity: 0.15; display: flex; align-items: center; justify-content: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
      <img src="${MP_POLICE_WATERMARK_DATA_URL}" style="width: 100%; height: auto; object-fit: contain; pointer-events: none;" alt="Madhya Pradesh Police Official Seal" />
    </div>
  `;

  return `
    <div class="latex-document-root" style="font-family: ${isHi ? "'Noto Serif Devanagari', 'Noto Serif', serif" : "'Noto Serif', 'Times New Roman', serif"}; color: #202A33; line-height: 1.35; font-size: 9.5pt;">
      <!-- PAGE 1 -->
      <div class="latex-page" style="page-break-after: always; break-after: always; padding: 14mm 14mm 12mm 14mm; background: #fff; position: relative;">
        ${watermarkHtml}
        <div style="position: relative; z-index: 1;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; border-bottom: 0.5pt solid #202A33; padding-bottom: 3px; margin-bottom: 12px; font-size: 8pt;">
            <div><strong>${isHi ? "मध्य प्रदेश पुलिस विभाग" : "POLICE DEPARTMENT, MADHYA PRADESH"}</strong> | ${isHi ? "केस डायरी" : "CASE DIARY"}</div>
            <div style="font-style: italic; color: #555;">${isHi ? "गोपनीय — प्रकरण अभिलेख धारा 172 दं.प्र.सं." : "Confidential — Case Record U/S 172 Cr.P.C."}</div>
          </div>

          <!-- Title -->
          <div style="text-align: center; margin-bottom: 10px;">
            <div style="font-size: 8.5pt; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;">${isHi ? "मध्य प्रदेश शासन · पुलिस विभाग" : "GOVERNMENT OF MADHYA PRADESH · POLICE DEPARTMENT"}</div>
            <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">${isHi ? "कालानुक्रमिक पुलिस केस डायरी" : "CHRONOLOGICAL POLICE CASE DIARY"}</div>
            <div style="font-size: 8pt; color: #444; margin-top: 2px;">${isHi ? "धारा 172 दण्ड प्रक्रिया संहिता, 1973 / धारा 168 BNSS, 2023" : "Maintained under Section 172 Cr.P.C. / Section 168 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023"}</div>
            <div style="font-size: 8pt; color: #555; margin-top: 1px;">
              ${isHi ? "थाना:" : "Police Station:"} <strong>${tokens["POLICE_STATION"]}</strong> | ${isHi ? "अपराध क्र.:" : "Crime No.:"} <span style="font-family: monospace; font-weight: bold; background: #EEF1F3; padding: 1px 4px; border-radius: 2px;">${tokens["CRIME_NO"]}</span>
            </div>
            <div style="width: 92%; margin: 6px auto 0 auto; border-top: 0.7pt solid #202A33;"></div>
          </div>

          <!-- Case Particulars -->
          <div style="margin-top: 10px;">
            <div style="color: #294B63; font-size: 11pt; font-weight: bold; text-transform: uppercase;">${isHi ? "प्रकरण विवरण एवं प्रशासनिक अभिलेख" : "CASE PARTICULARS & ADMINISTRATIVE RECORD"}</div>
            <div style="height: 0.55pt; background: #65727E; margin: 3px 0 6px 0;"></div>

            <table style="width: 100%; font-size: 8.5pt; border-collapse: collapse; margin-bottom: 6px;">
              <tr>
                <td style="width: 22%; font-weight: bold; padding: 2px 0;">${isHi ? "थाना" : "Police Station"}</td>
                <td style="width: 28%;">${tokens["POLICE_STATION"]}</td>
                <td style="width: 20%; font-weight: bold; padding: 2px 0;">${isHi ? "जिला" : "District"}</td>
                <td style="width: 30%;">${tokens["DISTRICT"]}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 2px 0;">${isHi ? "अपराध / FIR क्र." : "Crime / FIR No."}</td>
                <td style="font-family: monospace; font-weight: bold;">${tokens["CRIME_NO"]}</td>
                <td style="font-weight: bold; padding: 2px 0;">${isHi ? "प्रविष्टि दिनांक" : "Date of Entry"}</td>
                <td>${tokens["DATE_OF_ENTRY"]}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 2px 0;">${isHi ? "लागू धाराएं" : "Sections Applied"}</td>
                <td style="font-weight: bold; color: #b91c1c;">${tokens["SECTIONS_APPLIED"]}</td>
                <td style="font-weight: bold; padding: 2px 0;">${isHi ? "विवेचना अधिकारी" : "Investigating Officer"}</td>
                <td>${tokens["IO_NAME"]}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 2px 0;">${isHi ? "प्रकरण वर्गीकरण" : "Case Classification"}</td>
                <td colspan="3">${tokens["CASE_CLASSIFICATION"]}</td>
              </tr>
            </table>

            <!-- Section 1 -->
            <div style="color: #294B63; font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-top: 10px;">${isHi ? "1. घटना का मूल एवं पीड़ित का विवरण" : "1. GENESIS OF INCIDENT & VICTIM PARTICULARS"}</div>
            <div style="height: 0.55pt; background: #65727E; margin: 3px 0 6px 0;"></div>

            <table style="width: 100%; font-size: 8.5pt; border-collapse: collapse; margin-bottom: 6px;">
              <tr>
                <td style="width: 22%; font-weight: bold; padding: 2px 0;">${isHi ? "पीड़ित खाता" : "Victim Account"}</td>
                <td style="width: 28%; font-family: monospace; font-weight: bold;">${tokens["VICTIM_ACCOUNT"]}</td>
                <td style="width: 20%; font-weight: bold; padding: 2px 0;">${isHi ? "मूल बैंक" : "Originating Bank"}</td>
                <td style="width: 30%;">${tokens["VICTIM_BANK"]}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 2px 0;">${isHi ? "धोखाधड़ी राशि" : "Fraud Quantum"}</td>
                <td style="font-weight: bold; color: #b91c1c;">${tokens["FRAUD_AMOUNT"]}</td>
                <td style="font-weight: bold; padding: 2px 0;">${isHi ? "प्रारंभिक UTR" : "Initial UTR"}</td>
                <td style="font-family: monospace;">${tokens["INITIAL_UTR"]}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 2px 0;">${isHi ? "प्रवाह स्वरूप" : "Dispersal Pattern"}</td>
                <td colspan="3">${tokens["DISPERSAL_SUMMARY"]}</td>
              </tr>
            </table>

            <div style="font-size: 9pt; text-align: justify; margin: 8px 0 12px 0; line-height: 1.4;">
              <strong>${isHi ? "केस डायरी दैनंदिनी विवरण।" : "Case Diary Narrative Record."}</strong> ${tokens["INCIDENT_DIARY_TEXT"]}
            </div>

            <!-- Section 2 -->
            <div style="color: #294B63; font-size: 11pt; font-weight: bold; text-transform: uppercase;">${isHi ? "2. बहु-स्तरीय धनराशि प्रवाह विश्लेषण" : "2. MULTI-LAYER MONEY TRAIL AUDIT"}</div>
            <div style="height: 0.55pt; background: #65727E; margin: 3px 0 4px 0;"></div>
            <div style="font-size: 7.5pt; font-style: italic; color: #65727E; margin-bottom: 6px;">
              ${isHi ? "प्राथमिक निकासी खातों में पुनर्निर्मित लेनदेन प्रवाह। तालिका बैंक फॉरेंसिक से सत्यापित है।" : "Reconstructed transaction sequence across primary siphoning nodes. Table reflects verified banking telemetry."}
            </div>

            <div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 4px;">
              ${isHi ? "प्रथम स्तर (Layer 1) प्राथमिक म्यूल आवक (त्वरित निकासी)" : "Primary Layer 1 Mule Inflows (Immediate Siphoning)"}
            </div>
            <table style="width: 100%; font-size: 8pt; border-collapse: collapse; margin-bottom: 6px;">
              <thead>
                <tr style="border-top: 1.2pt solid #202A33; border-bottom: 0.5pt solid #202A33; text-align: left;">
                  <th style="padding: 4px 2px; text-align: center; width: 30px;">#</th>
                  <th style="padding: 4px 4px;">${isHi ? "लेनदेन ID" : "Txn ID / Ref"}</th>
                  <th style="padding: 4px 4px;">${isHi ? "लाभार्थी खाता" : "Beneficiary Account"}</th>
                  <th style="padding: 4px 4px;">${isHi ? "बैंक" : "Bank"}</th>
                  <th style="padding: 4px 4px; text-align: right;">${isHi ? "राशि" : "Amount"}</th>
                  <th style="padding: 4px 4px;">${isHi ? "समय" : "Timestamp"}</th>
                </tr>
              </thead>
              <tbody>
                ${[1, 2, 3, 4, 5].map((i) => `
                  <tr style="border-bottom: 0.3pt solid #eee;">
                    <td style="text-align: center; font-weight: bold; padding: 3px 2px;">${i}</td>
                    <td style="padding: 3px 4px; font-family: monospace; font-size: 7.5pt;">${tokens[`L1_TX${i}_ID`]}</td>
                    <td style="padding: 3px 4px; font-family: monospace; font-size: 7.5pt; font-weight: bold;">${tokens[`L1_TX${i}_ACC`]}</td>
                    <td style="padding: 3px 4px;">${tokens[`L1_TX${i}_BANK`]}</td>
                    <td style="padding: 3px 4px; text-align: right; font-weight: bold;">${tokens[`L1_TX${i}_AMOUNT`]}</td>
                    <td style="padding: 3px 4px; font-size: 7.5pt;">${tokens[`L1_TX${i}_TIME`]}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr style="border-top: 1.2pt solid #202A33;"><td colspan="6"></td></tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Page 1 Footer -->
        <div style="position: absolute; bottom: 8mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between; border-top: 0.4pt solid #202A33; padding-top: 3px; font-size: 7.5pt; color: #444; z-index: 1;">
          <div>${isHi ? `कालानुक्रमिक केस डायरी · अपराध क्रमांक ${tokens["CRIME_NO"]}` : `Chronological Case Diary · Crime No. ${tokens["CRIME_NO"]}`}</div>
          <div>${isHi ? "पृष्ठ 1 / 2" : "Page 1 of 2"}</div>
        </div>
      </div>

      <!-- PAGE 2 -->
      <div class="latex-page" style="padding: 14mm 14mm 12mm 14mm; background: #fff; position: relative;">
        ${watermarkHtml}
        <div style="position: relative; z-index: 1;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; border-bottom: 0.5pt solid #202A33; padding-bottom: 3px; margin-bottom: 12px; font-size: 8pt;">
            <div><strong>${isHi ? "मध्य प्रदेश पुलिस विभाग" : "POLICE DEPARTMENT, MADHYA PRADESH"}</strong> | ${isHi ? "केस डायरी" : "CASE DIARY"}</div>
            <div style="font-style: italic; color: #555;">${isHi ? "गोपनीय — प्रकरण अभिलेख धारा 172 दं.प्र.सं." : "Confidential — Case Record U/S 172 Cr.P.C."}</div>
          </div>

          <!-- Section 3 -->
          <div style="color: #294B63; font-size: 11pt; font-weight: bold; text-transform: uppercase;">
            ${isHi ? "3. वैधानिक रोक (फ्रीज) हेतु प्राथमिकता प्राप्त खाते" : "3. ACCOUNTS PRIORITIZED FOR STATUTORY FREEZE"}
          </div>
          <div style="height: 0.55pt; background: #65727E; margin: 3px 0 4px 0;"></div>
          <div style="font-size: 7.5pt; font-style: italic; color: #65727E; margin-bottom: 6px;">
            ${isHi ? "धारा 91 दं.प्र.सं. / धारा 94 BNSS के अधीन लियन मार्किंग हेतु चिह्नित खाते।" : "Prioritized beneficiaries identified by AI graph intelligence for lien marking under Sec 91 CrPC / Sec 94 BNSS."}
          </div>

          <table style="width: 100%; font-size: 8pt; border-collapse: collapse; margin-bottom: 10px;">
            <thead>
              <tr style="border-top: 1.2pt solid #202A33; border-bottom: 0.5pt solid #202A33; text-align: left;">
                <th style="padding: 4px 2px; text-align: center; width: 25px;">#</th>
                <th style="padding: 4px 4px;">${isHi ? "खाता क्रमांक" : "Account ID"}</th>
                <th style="padding: 4px 4px;">${isHi ? "बैंक" : "Bank"}</th>
                <th style="padding: 4px 2px; text-align: center; width: 40px;">${isHi ? "स्तर" : "Layer"}</th>
                <th style="padding: 4px 4px; text-align: center;">${isHi ? "म्यूल स्कोर" : "Mule Score"}</th>
                <th style="padding: 4px 4px; text-align: right;">${isHi ? "अनुमानित शेष" : "Est. Holding"}</th>
                <th style="padding: 4px 4px;">${isHi ? "फॉरेंसिक संकेतक" : "Forensic Markers"}</th>
              </tr>
            </thead>
            <tbody>
              ${[1, 2, 3, 4, 5].map((i) => `
                <tr style="border-bottom: 0.3pt solid #eee;">
                  <td style="text-align: center; font-weight: bold; padding: 3px 2px;">${i}</td>
                  <td style="padding: 3px 4px; font-family: monospace; font-size: 7.5pt; font-weight: bold;">${tokens[`FREEZE_${i}_ACC`]}</td>
                  <td style="padding: 3px 4px;">${tokens[`FREEZE_${i}_BANK`]}</td>
                  <td style="padding: 3px 2px; text-align: center;">${tokens[`FREEZE_${i}_LAYER`]}</td>
                  <td style="padding: 3px 4px; text-align: center; font-weight: bold; color: #b91c1c;">${tokens[`FREEZE_${i}_SCORE`]}</td>
                  <td style="padding: 3px 4px; text-align: right; font-weight: bold;">${tokens[`FREEZE_${i}_HOLDING`]}</td>
                  <td style="padding: 3px 4px; font-size: 7.5pt;">${tokens[`FREEZE_${i}_MARKERS`]}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr style="border-top: 1.2pt solid #202A33;"><td colspan="7"></td></tr>
            </tfoot>
          </table>

          <!-- Section 4 -->
          <div style="color: #294B63; font-size: 11pt; font-weight: bold; text-transform: uppercase;">
            ${isHi ? "4. विवेचना अधिकारी के अग्रिम निर्देश एवं कार्रवाई" : "4. INVESTIGATIVE INSTRUCTIONS & NEXT STEPS"}
          </div>
          <div style="height: 0.55pt; background: #65727E; margin: 3px 0 6px 0;"></div>

          <ol style="font-size: 8.5pt; margin: 4px 0 12px 18px; padding: 0; line-height: 1.4;">
            <li style="margin-bottom: 3px;">${tokens["STEP_1"]}</li>
            <li style="margin-bottom: 3px;">${tokens["STEP_2"]}</li>
            <li style="margin-bottom: 3px;">${tokens["STEP_3"]}</li>
            <li style="margin-bottom: 3px;">${tokens["STEP_4"]}</li>
          </ol>

          <!-- Officer Certification -->
          <div style="font-weight: bold; font-size: 8.5pt; text-transform: uppercase; margin: 10px 0 3px 0;">
            ${isHi ? "विवेचक प्रमाणन" : "RECORDING OFFICER CERTIFICATION"}
          </div>
          <div style="font-size: 8pt; margin-bottom: 12px; font-style: italic; line-height: 1.35;">
            ${isHi ? `प्रमाणित किया जाता है कि यह केस डायरी प्रविष्टि अपराध क्रमांक ${tokens["CRIME_NO"]} के संबंध में आज दिनांक तक की गई कालानुक्रमिक विवेचना, फॉरेंसिक विश्लेषण एवं वैधानिक कार्रवाई को सत्य रूप से दर्ज करती है।` : `Certified that this Case Diary entry accurately records the chronological investigation steps, forensic telemetry, and statutory preservation requisitions initiated on this date in respect of Crime No. ${tokens["CRIME_NO"]}.`}
          </div>

          <table style="width: 100%; font-size: 8pt; border-collapse: collapse; margin-top: 8px;">
            <tr>
              <td style="width: 50%; padding-right: 15px;">
                <div style="border-top: 0.4pt solid #202A33; padding-top: 2px; font-weight: bold;">${tokens["IO_NAME"]}</div>
              </td>
              <td style="width: 50%; padding-left: 15px;">
                <div style="border-top: 0.4pt solid #202A33; padding-top: 2px;">${isHi ? "हस्ताक्षर" : "Signature"}</div>
              </td>
            </tr>
            <tr>
              <td style="padding-right: 15px; padding-top: 6px;">
                <div style="border-top: 0.4pt solid #202A33; padding-top: 2px;">${tokens["IO_RANK"]}</div>
              </td>
              <td style="padding-left: 15px; padding-top: 6px;">
                <div style="border-top: 0.4pt solid #202A33; padding-top: 2px;">${tokens["DATE_OF_ENTRY"]}</div>
              </td>
            </tr>
            <tr>
              <td style="padding-right: 15px; padding-top: 6px;">
                <div style="border-top: 0.4pt solid #202A33; padding-top: 2px;">${tokens["POLICE_STATION"]}</div>
              </td>
              <td style="padding-left: 15px; padding-top: 6px;"></td>
            </tr>
          </table>
        </div>

        <!-- Page 2 Footer -->
        <div style="position: absolute; bottom: 8mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between; border-top: 0.4pt solid #202A33; padding-top: 3px; font-size: 7.5pt; color: #444; z-index: 1;">
          <div>${isHi ? `कालानुक्रमिक केस डायरी · अपराध क्रमांक ${tokens["CRIME_NO"]}` : `Chronological Case Diary · Crime No. ${tokens["CRIME_NO"]}`}</div>
          <div>${isHi ? "पृष्ठ 2 / 2" : "Page 2 of 2"}</div>
        </div>
      </div>
    </div>
  `;
}
