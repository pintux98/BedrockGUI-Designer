import React from "react";
import { useDesignerStore } from "../core/store";
import { activeFormStack } from "../store/historySlice";

interface HistoryPanelProps {
  onCollapseChange?: (collapsed: boolean) => void;
}

/** The only two fields a timeline row needs; both stacks' entries already have them. */
interface HistoryRow {
  description: string;
  timestamp: number;
}

/**
 * One timeline over one stack.
 *
 * There are two of these rather than one merged list, because there are two
 * undos: ctrl+z / the TopBar buttons walk the active form's stack, and nothing
 * but the structural toast and this panel's Project section walk project
 * history. A merged list would put rows next to each other that a single
 * keystroke cannot walk through, and "revert to here" would count steps against
 * a list neither action follows — so each section counts its steps against the
 * stack it belongs to and calls that stack's own action.
 */
function HistorySection({
  label,
  hint,
  undoRows,
  redoRows,
  currentLabel,
  emptyLabel,
  onRevert
}: {
  label: string;
  hint: string;
  undoRows: HistoryRow[];
  redoRows: HistoryRow[];
  currentLabel: string;
  emptyLabel: string;
  onRevert: (steps: number) => void;
}) {
  const entries = [
    ...undoRows.map((x, i) => ({ ...x, index: i, active: false })),
    { description: currentLabel, timestamp: Date.now(), index: undoRows.length, active: true },
    ...redoRows
      .slice()
      .reverse()
      .map((x, i) => ({ ...x, index: undoRows.length + 1 + i, active: false }))
  ].reverse();

  return (
    <div className="space-y-1">
      <div className="px-2 pt-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text">{label}</span>
        <span className="text-[10px] text-brand-muted truncate">{hint}</span>
      </div>
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
            onRevert(undoRows.length - entry.index);
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
      {entries.length === 1 && <div className="text-xs text-brand-muted text-center py-3">{emptyLabel}</div>}
    </div>
  );
}

export function HistoryPanel({ onCollapseChange }: HistoryPanelProps) {
  const { history, projectHistory, project, undo, undoProject } = useDesignerStore();
  const [collapsed, setCollapsed] = React.useState(false);

  // Notify parent of collapse state
  React.useEffect(() => {
    onCollapseChange?.(collapsed);
  }, [collapsed, onCollapseChange]);

  const formUndo = activeFormStack(history, project, "undo");
  const formRedo = activeFormStack(history, project, "redo");

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rowCount =
    formUndo.length + formRedo.length + projectHistory.undo.length + projectHistory.redo.length;

  React.useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
    }
  }, [rowCount]);

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
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <HistorySection
            label={`This form — ${project.activeFormId}`}
            hint="Ctrl+Z"
            undoRows={formUndo}
            redoRows={formRedo}
            currentLabel="Current State"
            emptyLabel="No edits to this form yet"
            onRevert={(steps) => {
              for (let s = 0; s < steps; s++) undo();
            }}
          />
          <HistorySection
            label="Project"
            hint="not Ctrl+Z"
            undoRows={projectHistory.undo}
            redoRows={projectHistory.redo}
            currentLabel="Current Project State"
            emptyLabel="No project changes yet"
            onRevert={(steps) => {
              for (let s = 0; s < steps; s++) undoProject();
            }}
          />
        </div>
      )}
    </div>
  );
}
