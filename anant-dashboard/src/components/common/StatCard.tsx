import React from "react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  badgeText?: string;
  badgeType?: "primary" | "secondary" | "accent" | "success" | "warning" | "destructive" | "info";
  colorClass?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  badgeText,
  badgeType = "primary",
  colorClass = "text-primary",
  onClick,
}) => {
  const badgeClasses = {
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground border border-border",
    accent: "bg-accent text-accent-foreground",
    success: "bg-success/20 text-success border border-success/30",
    warning: "bg-warning/20 text-warning border border-warning/30",
    destructive: "bg-destructive/20 text-destructive border border-destructive/30",
    info: "bg-accent/20 text-accent",
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-border bg-card text-card-foreground feature-card shadow-sm p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-md ${
        onClick ? "cursor-pointer hover:scale-[1.01]" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          {title}
        </div>
        <div className={`p-2.5 rounded-xl bg-muted/60 border border-border ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-extrabold tracking-tight text-foreground font-sans">
        {value}
      </div>
      {(description || badgeText) && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {badgeText && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${badgeClasses[badgeType]}`}>
              {badgeText}
            </span>
          )}
          {description && <span className="truncate">{description}</span>}
        </div>
      )}
    </div>
  );
};
