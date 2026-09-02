import React from "react";
import { useDesignerStore } from "../core/store";
import { allHistoryRows } from "../store/historySlice";

interface HistoryPanelProps {
  onCollapseChange?: (collapsed: boolean) => void;
}

export function HistoryPanel({ onCollapseChange }: HistoryPanelProps) {
  const { history, projectHistory, project, undo } = useDesignerStore();
  const [collapsed, setCollapsed] = React.useState(false);

  // Notify parent of collapse state
  React.useEffect(() => {
    onCollapseChange?.(collapsed);
  }, [collapsed, onCollapseChange]);

  // One timeline over every form's stack plus project history. A panel reading only
  // history[active.id] omitted structural changes entirely, and once undo() began
  // choosing across all forms, counting steps from a narrower list would have made
  // "revert to here" undo a different number of things than the row implies.
  const undoRows = allHistoryRows(history, project, projectHistory, "undo");
  const redoRows = allHistoryRows(history, project, projectHistory, "redo");

  const entries = [
    ...undoRows.map((x, i) => ({ ...x, index: i, active: false })),
    { description: "Current State", timestamp: Date.now(), index: undoRows.length, active: true },
    ...redoRows
      .slice()
      .reverse()
      .map((x, i) => ({ ...x, index: undoRows.length + 1 + i, active: false }))
  ].reverse();

  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
    }
  }, [entries.length]);

  return (
    <div className={`flex flex-col h-full border-t border-brand-border overflow-hidden transition-all duration-300 ${collapsed ? "bg-brand-surface" : "bg-brand-bg"}`}>
      <div 
        className="h-8 flex items-center px-4 bg-brand-surface border-b border-brand-border cursor-pointer hover:bg-brand-surface2 transition-colors justify-between shrink-0"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-brand-text">History</span>
          {collapsed && <span className="text-[10px] text-brand-muted px-2 py-0.5 rounded bg-brand-bg border border-brand-border">Collapsed</span>}
        </div>
        <span className="text-xs text-brand-muted transition-transform duration-300" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </div>
      {!collapsed && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {entries.map((entry, i) => (
             <div
               key={i}
               className={`p-2 text-xs border cursor-pointer flex items-center justify-between group ${
                 entry.active
                   ? "bg-brand-accent/20 border-brand-accent text-white"
                   : "bg-brand-surface border-brand-border text-brand-muted hover:bg-brand-surface2"
               }`}
               onClick={() => {
                 if (entry.active || entry.index >= undoRows.length) return;
                 const steps = undoRows.length - entry.index;
                 for (let s = 0; s < steps; s++) undo();
               }}
             >
               <div className="flex flex-col overflow-hidden">
                 <div className="font-bold truncate">{entry.description}</div>
                 <div className="opacity-50 text-[10px]">
                   {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--:--"}
                 </div>
               </div>
               {entry.active && <div className="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_5px_rgba(0,255,0,0.5)]" />}
               {!entry.active && entry.index < undoRows.length && (
                 <div className="hidden group-hover:block text-[10px] bg-brand-surface2 px-1 border border-brand-border">
                   Revert
                 </div>
               )}
             </div>
          ))}
          {entries.length === 1 && (
              <div className="text-xs text-brand-muted text-center py-4">No history yet</div>
          )}
        </div>
      )}
    </div>
  );
}
