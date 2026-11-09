import React from "react";
import { useDesignerStore } from "../core/store";
import { BufferedInput } from "../components/BufferedInput";
import { confirmDialog } from "../core/confirm";
import { toast } from "../core/toast";
import { Icon } from "../components/Icon";
import { FORM_TYPE_INFO } from "./FormTypePanel";
import { useValidation } from "../core/useValidation";

function nextFormId(existingIds: string[]): string {
  let n = existingIds.length + 1;
  let id = `form_${n}`;
  while (existingIds.includes(id)) id = `form_${++n}`;
  return id;
}

export function FormSwitcher() {
  const { project, setActiveForm, addForm, renameForm, duplicateForm, removeForm, setSelectedBedrockButtonId, setSelectedBedrockComponentId } =
    useDesignerStore();
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const { byForm } = useValidation();
  const canDelete = project.forms.length > 1;

  const open = (id: string) => {
    setSelectedBedrockButtonId(null);
    setSelectedBedrockComponentId(null);
    setActiveForm(id);
  };

  const handleAdd = () => {
    const id = nextFormId(project.forms.map((f) => f.id));
    addForm(id);
    open(id);
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
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 pb-1.5 pt-3">
        <h2 className="text-[12px] font-semibold text-brand-muted">Forms</h2>
        <button type="button" className="ui-icon-btn" aria-label="Add form" title="Add form" onClick={handleAdd}>
          <Icon name="plus" size={15} />
        </button>
      </div>
      <ul className="space-y-px px-1.5">
        {project.forms.map((form) => {
          const isActive = form.id === project.activeFormId;
          const info = FORM_TYPE_INFO[form.bedrock.type];
          if (renamingId === form.id) {
            return (
              <li key={form.id} className="px-1 py-0.5">
                <BufferedInput
                  autoFocus
                  value={form.id}
                  onCommit={(next) => handleRenameCommit(form.id, next)}
                  onBlur={() => setRenamingId(null)}
                  onKeyDown={(e) => e.key === "Escape" && setRenamingId(null)}
                  className="ui-input font-mono-ui"
                  aria-label={`Rename ${form.id}`}
                />
              </li>
            );
          }
          return (
            <li
              key={form.id}
              className={`group flex items-center rounded-md ${
                isActive ? "bg-brand-surface-raised text-brand-text" : "text-brand-muted hover:bg-brand-surface-raised/60 hover:text-brand-text"
              }`}
            >
              <button
                type="button"
                aria-current={isActive}
                aria-label={`Open form ${form.id}`}
                onClick={() => open(form.id)}
                onDoubleClick={() => setRenamingId(form.id)}
                title={`${info.label}, saved as ${form.fileName}`}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
              >
                <Icon name={info.icon} size={14} className={isActive ? "text-brand-accent" : ""} />
                <span className="truncate font-mono-ui text-[12.5px]">{form.id}</span>
                {byForm[form.id]?.length > 0 && (
                  <span
                    className={`ml-auto size-2 shrink-0 rounded-full ${byForm[form.id].some((i) => i.level === "error") ? "bg-brand-danger" : "bg-brand-warning"}`}
                    title={`${byForm[form.id].length} problem${byForm[form.id].length === 1 ? "" : "s"}`}
                  />
                )}
              </button>
              <span className={`flex items-center pr-1 ${isActive ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
                <button type="button" className="ui-icon-btn size-6" aria-label={`Rename form ${form.id}`} title="Rename" onClick={() => setRenamingId(form.id)}>
                  <Icon name="pencil" size={13} />
                </button>
                <button type="button" className="ui-icon-btn size-6" aria-label={`Duplicate form ${form.id}`} title="Duplicate" onClick={() => duplicateForm(form.id)}>
                  <Icon name="copy" size={13} />
                </button>
                {canDelete && (
                  <button type="button" className="ui-icon-btn size-6 hover:!text-brand-danger" aria-label={`Delete form ${form.id}`} title="Delete" onClick={() => handleDelete(form.id)}>
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
