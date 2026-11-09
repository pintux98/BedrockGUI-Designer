import React from "react";
import { useDesignerStore } from "../core/store";
import { useValidation } from "../core/useValidation";
import type { FormIssue } from "../core/validateForm";
import { Icon } from "../components/Icon";

export function ValidationPanel() {
  const { project, setActiveForm, setSelectedBedrockButtonId, setSelectedBedrockComponentId } = useDesignerStore();
  const { byForm, project: projectIssues, errorCount, warningCount } = useValidation();
  const [expanded, setExpanded] = React.useState(false);
  const activeId = project.activeFormId;
  const total = errorCount + warningCount;

  const go = (formId: string, issue: FormIssue) => {
    setActiveForm(formId);
    setSelectedBedrockButtonId(issue.target?.kind === "button" ? issue.target.id : null);
    setSelectedBedrockComponentId(issue.target?.kind === "component" ? issue.target.id : null);
  };

  if (!total) {
    return (
      <div className="flex min-h-8 shrink-0 items-center gap-2 border-t border-brand-border bg-brand-surface px-4 text-[12.5px] text-brand-muted">
        <Icon name="check" size={14} className="text-brand-success" />
        No problems found in any form
      </div>
    );
  }

  const groups = [
    ...(projectIssues.length ? [{ id: "", title: "Project", issues: projectIssues }] : []),
    ...[activeId, ...project.forms.map((f) => f.id).filter((id) => id !== activeId)]
      .filter((id) => byForm[id]?.length)
      .map((id) => ({ id, title: id === activeId ? `${id} (open)` : id, issues: byForm[id] }))
  ];
  const first = groups[0]?.issues[0];

  return (
    <div className="flex min-w-0 shrink-0 flex-col border-t border-brand-border bg-brand-surface">
      {expanded && (
        <div className="max-h-56 overflow-y-auto border-b border-brand-border bg-brand-surface2 px-2 py-1.5">
          {groups.map((g) => (
            <section key={g.id || "project"} className="mb-1.5">
              <h3 className="px-2 py-1 font-mono-ui text-[12px] text-brand-muted">{g.title}</h3>
              {g.issues.map((issue, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!g.id}
                  onClick={() => g.id && go(g.id, issue)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-[12.5px] enabled:hover:bg-brand-surface-raised"
                >
                  <Icon
                    name="alert"
                    size={14}
                    className={`mt-0.5 ${issue.level === "error" ? "text-brand-danger" : "text-brand-warning"}`}
                  />
                  <span className="sr-only">{issue.level === "error" ? "Error:" : "Warning:"}</span>
                  <span className="min-w-0 break-words">{issue.message}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="flex min-h-8 items-center gap-3 overflow-hidden px-4 text-left text-[12.5px] hover:bg-brand-surface-raised"
      >
        {errorCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-brand-danger">
            <Icon name="alert" size={14} />
            {errorCount} {errorCount === 1 ? "error" : "errors"}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-brand-warning">
            <Icon name="alert" size={14} />
            {warningCount} {warningCount === 1 ? "warning" : "warnings"}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-brand-muted">{first?.message}</span>
        <Icon name={expanded ? "chevronDown" : "up"} size={14} className="shrink-0 text-brand-muted" />
      </button>
    </div>
  );
}
