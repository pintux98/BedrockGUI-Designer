import { describe, it, expect } from "vitest";
import { createEmptyProject } from "../core/project";
import { parseProject } from "../core/projectSchemas";

describe("parseProject", () => {
  it("accepts a freshly created project", () => {
    const result = parseProject(createEmptyProject());
    expect(result.ok).toBe(true);
  });

  it("rejects a project whose active form does not exist", () => {
    const project = { ...createEmptyProject(), activeFormId: "ghost" };
    const result = parseProject(project);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(" ")).toContain("ghost");
  });

  it("rejects duplicate form ids", () => {
    const project = createEmptyProject();
    project.forms.push({ ...project.forms[0] });
    const result = parseProject(project);
    expect(result.ok).toBe(false);
  });
});
