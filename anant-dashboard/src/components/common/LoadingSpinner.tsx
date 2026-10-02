import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = "Processing graph engine...",
  size = "md",
}) => {
  const sizeMap = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-10 h-10",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6">
      <Loader2 className={`${sizeMap[size]} animate-spin text-primary`} />
      {label && (
        <span className="text-xs font-mono text-muted-foreground animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};
