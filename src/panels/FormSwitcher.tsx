import React from "react";
import { useDesignerStore } from "../core/store";
import { BufferedInput } from "../components/BufferedInput";
import { confirmDialog } from "../core/confirm";
import { toast } from "../core/toast";

function nextFormId(existingIds: string[]): string {
  let n = existingIds.length + 1;
  let id = `form_${n}`;
  while (existingIds.includes(id)) id = `form_${++n}`;
  return id;
}

export function FormSwitcher() {
  const { project, setActiveForm, addForm, renameForm, duplicateForm, removeForm } = useDesignerStore();
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const canDelete = project.forms.length > 1;

  const handleAdd = () => {
    const id = nextFormId(project.forms.map((f) => f.id));
    addForm(id);
  };

  const handleRenameCommit = (from: string, to: string) => {
    setRenamingId(null);
    if (to === from) return;
    if (!to.trim()) {
      toast.error(`Cannot rename '${from}' to an empty id.`);
      return;
    }
    if (project.forms.some((f) => f.id === to)) {
      toast.error(`Cannot rename to '${to}' — a form with that id already exists.`);
      return;
    }
    renameForm(from, to);
  };

  // Ctrl+Z undoes edits *inside* the form on screen and never reaches project
  // history, so the old "You can undo this with Ctrl+Z" was a promise the app
  // stopped keeping. What actually brings the form back is the Undo button on
  // the toast this raises, or the History panel's Project section.
  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete form",
      message: `Delete form '${id}'? Ctrl+Z will not bring it back — use the Undo button on the toast that appears, or the Project section of the History panel.`,
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (ok) removeForm(id);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-brand-text uppercase tracking-wider">Forms</span>
        <button type="button" className="ui-btn-ghost" aria-label="Add form" onClick={handleAdd}>
          +
        </button>
      </div>
      <ul className="space-y-1">
        {project.forms.map((form) => {
          const isActive = form.id === project.activeFormId;
          const isRenaming = renamingId === form.id;
          return (
            <li key={form.id} className="flex items-center gap-1">
              {isRenaming ? (
                <BufferedInput
                  autoFocus
                  value={form.id}
                  onCommit={(next) => handleRenameCommit(form.id, next)}
                  onBlur={() => setRenamingId(null)}
                  className="ui-input flex-1 min-w-0 text-sm"
                  aria-label={`Rename ${form.id}`}
                />
              ) : (
                <button
                  type="button"
                  aria-current={isActive}
                  aria-label={`Open form ${form.id}`}
                  onClick={() => setActiveForm(form.id)}
                  className={`flex-1 min-w-0 truncate text-left ui-btn ${isActive ? "ui-btn-primary" : "ui-btn-secondary"}`}
                >
                  {form.id}
                </button>
              )}
              <button
                type="button"
                className="ui-btn-ghost"
                aria-label={`Rename form ${form.id}`}
                onClick={() => setRenamingId(form.id)}
              >
                ✎
              </button>
              <button
                type="button"
                className="ui-btn-ghost"
                aria-label={`Duplicate form ${form.id}`}
                onClick={() => duplicateForm(form.id)}
              >
                ⧉
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="ui-btn-ghost"
                  aria-label={`Delete form ${form.id}`}
                  onClick={() => handleDelete(form.id)}
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
