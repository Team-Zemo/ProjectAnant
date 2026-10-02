import React, { useState, useEffect } from "react";
import { Search, X, GitBranch, ArrowRight } from "lucide-react";
import type { RiskAccount } from "../../types";

interface QuickTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrace: (accountId: string) => void;
  topRiskAccounts: RiskAccount[];
}

export const QuickTraceModal: React.FC<QuickTraceModalProps> = ({
  isOpen,
  onClose,
  onTrace,
  topRiskAccounts,
}) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = topRiskAccounts.filter((a) =>
    a.account_id.toLowerCase().includes(query.toLowerCase()) ||
    (a.bank && a.bank.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const acct = query.trim();
    if (acct) {
      onTrace(acct);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 landing-reveal">
        <form onSubmit={handleSubmit} className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-5 h-5 text-primary flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Enter Bank Account ID (e.g. KKBK10000000)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </form>

        <div className="p-3 max-h-80 overflow-y-auto flex flex-col gap-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
            {query ? "Matching Mule Suspects" : "High Risk Mule Suspects"}
          </div>

          {filtered.map((a) => {
            const score = Number(a.mule_score ?? 0);
            const layer = Number(a.layer ?? 0);
            const badgeClass =
              layer === 1 ? "badge-l1" : layer === 2 ? "badge-l2" : layer === 3 ? "badge-l3" : "badge-clean";

            return (
              <button
                key={a.account_id}
                type="button"
                onClick={() => {
                  onTrace(a.account_id);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <GitBranch className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold font-mono text-foreground">
                      {a.account_id}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {a.bank || "BANK"} · {a.tx_count} txns
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeClass}`}>
                    L{layer || 0}
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {score.toFixed(1)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {query ? `Press Enter to trace "${query}"` : "No high risk accounts loaded"}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Press <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">Enter</kbd> to trace</span>
          <span>Press <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">Esc</kbd> to cancel</span>
        </div>
      </div>
    </div>
  );
};
