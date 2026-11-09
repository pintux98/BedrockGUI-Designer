import React from "react";
import { useDesignerStore } from "./store";
import { validateForm, type FormIssue } from "./validateForm";
import { validateProject } from "./validateProject";
import { useLineContext } from "../data/useMinecraftData";

export interface ValidationResult {
  byForm: Record<string, FormIssue[]>;
  project: FormIssue[];
  errorCount: number;
  warningCount: number;
}

export function useValidation(): ValidationResult {
  const project = useDesignerStore((s) => s.project);
  const ctx = useLineContext();
  return React.useMemo(() => {
    const byForm = Object.fromEntries(project.forms.map((f) => [f.id, validateForm(f, ctx)]));
    const projectIssues: FormIssue[] = validateProject(project).map((i) => ({ level: i.level, message: i.message }));
    const all = [...projectIssues, ...Object.values(byForm).flat()];
    return {
      byForm,
      project: projectIssues,
      errorCount: all.filter((i) => i.level === "error").length,
      warningCount: all.filter((i) => i.level === "warning").length
    };
  }, [project, ctx]);
}
