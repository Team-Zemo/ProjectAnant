import React from "react";
import {
  X,
  Shield,
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Globe,
  Radio,
  Cpu,
  Copy,
  Check,
  Network,
  Download,
  GitBranch,
  Zap,
  Scale,
  FileText,
} from "lucide-react";
import type { AccountStats } from "../../types";

interface AccountInspectorProps {
  detail: AccountStats | null;
  onClose: () => void;
  onSelectAccount?: (accountId: string) => void;
  onIsolateSyndicate?: (syndicateId: string) => void;
  onIsolateRing?: (accountId: string) => void;
  onExportSubdataset?: () => void;
  onOpenLegalNotice?: (accountId: string) => void;
}

export const AccountInspector: React.FC<AccountInspectorProps> = ({
  detail,
  onClose,
  onSelectAccount,
  onIsolateSyndicate,
  onIsolateRing,
  onExportSubdataset,
  onOpenLegalNotice,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!detail) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-card border-l border-border">
        <Activity className="w-12 h-12 text-muted-foreground/30 mb-3" />
        <h4 className="text-sm font-bold text-foreground font-sans">No Account Selected</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Click any node in the graph canvas or select an account from the High Risk list to inspect deep mule metrics.
        </p>
      </div>
    );
  }

  const score = Number(detail.mule_score ?? 0);
  const layer = Number(detail.layer ?? 0);
  const passThrough = detail.total_in > 0 ? (detail.total_out / detail.total_in) * 100 : 0;

  const copyAccountId = () => {
    navigator.clipboard.writeText(detail.account_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatINR = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const riskLabel =
    score >= 70 ? "CRITICAL MULE" : score >= 40 ? "SUSPECT MULE" : "LOW RISK";
  const riskColor =
    score >= 70 ? "text-destructive" : score >= 40 ? "text-warning" : "text-success";
  const riskGradient =
    score >= 70
      ? "bg-gradient-to-r from-red-500 to-rose-600"
      : score >= 40
      ? "bg-gradient-to-r from-amber-500 to-orange-500"
      : "bg-gradient-to-r from-sky-400 to-emerald-500";

  return (
    <div className="h-full flex flex-col bg-card border-l border-border overflow-hidden select-text text-foreground">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between gap-3 bg-muted/20">
        <div className="flex flex-col gap-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {detail.bank || "BANK"}
            </span>
            <span
              className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md ${
                layer === 1
                  ? "badge-l1"
                  : layer === 2
                  ? "badge-l2"
                  : layer === 3
                  ? "badge-l3"
                  : "badge-clean"
              }`}
            >
              Layer {layer || 0}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono font-bold text-sm text-foreground truncate">
              {detail.account_id}
            </span>
            <button
              onClick={copyAccountId}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Copy Account ID"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Behavioral Signals Strip */}
      {(detail.has_foreign_ip || detail.has_terminal_marker || detail.has_script_device) && (
        <div className="px-4 py-2 bg-destructive/5 border-b border-border flex flex-wrap gap-1.5">
          {detail.has_foreign_ip && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-destructive/15 text-destructive border border-destructive/25 font-mono font-bold flex items-center gap-1">
              <Globe className="w-3 h-3" /> Foreign IP (185.x / 194.x)
            </span>
          )}
          {detail.has_terminal_marker && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25 font-mono font-bold flex items-center gap-1">
              <Radio className="w-3 h-3" /> Crypto/P2P Terminal
            </span>
          )}
          {detail.has_script_device && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-warning/15 text-warning border border-warning/25 font-mono font-bold flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Emulator / Script
            </span>
          )}
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Mule Risk Gauge Card */}
        <div className="p-4 rounded-xl bg-background border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase font-mono tracking-wider">
              Mule Risk Index
            </span>
            <span className={`text-[10px] font-extrabold uppercase font-mono px-2 py-0.5 rounded ${riskColor} bg-muted`}>
              {riskLabel}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-3xl font-black font-mono tracking-tight ${riskColor}`}>
              {score.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">/ 100</span>
          </div>

          {/* Progress Meter Bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden mt-1">
            <div
              className={`h-full rounded-full transition-all duration-500 ${riskGradient}`}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
        </div>

        {/* ── One-Click Subgraph Isolation & Syndicate Ring (Module C Requirement) ── */}
        {detail.syndicate_id ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-xs font-bold">
                <Network className="w-3.5 h-3.5 text-amber-400" />
                <span>Syndicate: {detail.syndicate_id}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold uppercase">
                {detail.syndicate_role || "Mule"}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Account is mapped to organized fraud syndicate <span className="text-amber-400 font-mono font-bold">{detail.syndicate_id}</span>. One click isolates all clustered syndicate members and exports court-ready evidence.
            </p>

            <div className="grid grid-cols-2 gap-2 mt-0.5">
              <button
                type="button"
                onClick={() => onIsolateSyndicate?.(detail.syndicate_id!)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                title={`Isolate full ${detail.syndicate_id} network in graph`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Isolate Ring</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onIsolateSyndicate?.(detail.syndicate_id!);
                  setTimeout(() => {
                    onExportSubdataset?.();
                  }, 250);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 transition-all cursor-pointer"
                title="Isolate syndicate ring and immediately download court-ready sub-dataset"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Isolate & Export</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-card border border-border flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-primary font-mono text-xs font-bold">
                <GitBranch className="w-3.5 h-3.5 text-primary" />
                <span>Direct Neighborhood Ring</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono font-bold">
                2-HOP
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Isolate the immediate 2-hop transaction neighborhood around this account and export the associated sub-dataset.
            </p>

            <div className="grid grid-cols-2 gap-2 mt-0.5">
              <button
                type="button"
                onClick={() => onIsolateRing?.(detail.account_id)}
                className="px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Isolate Ring</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onIsolateRing?.(detail.account_id);
                  setTimeout(() => {
                    onExportSubdataset?.();
                  }, 250);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 transition-all cursor-pointer"
                title="Isolate 2-hop ring and immediately download court-ready sub-dataset"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Isolate & Export</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Section 91 & Police Case Diary Generator (Module D Requirement) ── */}
        <div className="p-3.5 rounded-xl bg-card border border-border flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-foreground font-mono text-xs font-bold">
              <Scale className="w-3.5 h-3.5 text-primary" />
              <span>Legal Case Officer</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-primary/15 text-primary font-mono font-bold">
              SEC 91 / BNSS
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Auto-generate court-ready Section 91 CrPC Bank Freeze Requisitions and chronological Police Case Diary with local Gemma 3 AI.
          </p>

          <button
            type="button"
            onClick={() => onOpenLegalNotice?.(detail.account_id)}
            className="w-full mt-1 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:border-primary/60"
          >
            <FileText className="w-4 h-4 text-primary" />
            <span>Generate Sec 91 Notice / Case Diary</span>
          </button>
        </div>

        {/* Scoring Breakdown Factors */}
        <div className="p-3.5 rounded-xl bg-background border border-border flex flex-col gap-2.5 text-xs">
          <div className="text-[11px] font-bold text-foreground font-sans uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span>Risk Factor Breakdown</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pass-Through Velocity:</span>
            <span className="font-mono font-bold text-foreground">
              {passThrough > 0 ? `${passThrough.toFixed(1)}%` : "0%"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">In-Degree (Senders):</span>
            <span className="font-mono font-bold text-foreground">
              {detail.in_degree ? `${detail.in_degree} distinct senders` : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Out-Degree (Receivers):</span>
            <span className="font-mono font-bold text-foreground">
              {detail.out_degree ? `${detail.out_degree} distinct receivers` : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Exit Terminal Marker:</span>
            <span className={`font-mono font-bold ${detail.has_terminal_marker ? "text-primary" : "text-muted-foreground"}`}>
              {detail.has_terminal_marker ? "DETECTED" : "None"}
            </span>
          </div>
        </div>

        {/* Financial Flow Card */}
        <div className="p-3.5 rounded-xl bg-background border border-border flex flex-col gap-2.5">
          <div className="text-[11px] font-bold text-foreground font-sans uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>Financial Volume</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-card border border-border flex flex-col">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                <ArrowDownLeft className="w-3 h-3 text-emerald-500" /> Total Inflow
              </span>
              <span className="font-mono font-bold text-emerald-500 text-sm mt-0.5">
                {formatINR(detail.total_in)}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-card border border-border flex flex-col">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                <ArrowUpRight className="w-3 h-3 text-rose-500" /> Total Outflow
              </span>
              <span className="font-mono font-bold text-rose-500 text-sm mt-0.5">
                {formatINR(detail.total_out)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">Transaction Count:</span>
            <span className="font-mono font-bold text-foreground">
              {detail.tx_count?.toLocaleString()} txns
            </span>
          </div>
        </div>

        {/* Recent Transactions Ledger */}
        {detail.transactions && detail.transactions.length > 0 && (
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground uppercase tracking-wider font-mono text-[11px]">
                Ledger ({detail.transactions.length})
              </span>
              <span className="text-[10px] text-muted-foreground">Latest 20</span>
            </div>

            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-60">
              {detail.transactions.slice(0, 20).map((t) => {
                const isOut = t.sender_account === detail.account_id;
                const counterparty = isOut ? t.receiver_account : t.sender_account;

                return (
                  <div
                    key={t.txn_id}
                    className="p-2 rounded-lg bg-background border border-border flex items-center justify-between text-xs hover:border-primary/40 transition-colors"
                  >
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-mono text-[10px] text-muted-foreground truncate">
                        {t.txn_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectAccount?.(counterparty)}
                        className="font-mono text-[11px] text-foreground hover:text-primary transition-colors text-left truncate cursor-pointer flex items-center gap-1"
                      >
                        <span>{isOut ? "→" : "←"}</span>
                        <span>{counterparty}</span>
                      </button>
                    </div>

                    <div className="flex flex-col items-end">
                      <span
                        className={`font-mono font-bold text-xs ${
                          isOut ? "text-rose-500" : "text-emerald-500"
                        }`}
                      >
                        {isOut ? "-" : "+"}
                        {formatINR(t.amount)}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground uppercase">
                        {t.payment_mode}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
