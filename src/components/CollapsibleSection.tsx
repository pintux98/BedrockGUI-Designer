import React from "react";

interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  icon?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  defaultExpanded = true,
  icon,
  children,
  headerRight,
  className = ""
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <div className={`bg-brand-surface2 border border-brand-border rounded overflow-hidden ${className}`}>
      <div
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-brand-surface-raised/30 transition-colors text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(!expanded); }}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <span className="text-xs font-medium text-brand-text">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          <span className="text-xs text-brand-muted transition-transform duration-150" style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
            ▼
          </span>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-brand-border/50">
          {children}
        </div>
      )}
    </div>
  );
}
