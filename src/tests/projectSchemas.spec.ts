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
    if (!result.ok) expect(result.problems.join(" ")).toContain("main_menu");
  });

  it("accepts a work-in-progress MODAL with 3 buttons, so a user can still save/reload it", () => {
    const project = createEmptyProject();
    project.forms[0].bedrock = {
      type: "MODAL",
      title: "Title",
      buttons: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
        { id: "c", text: "C" }
      ]
    } as any;
    const result = parseProject(project);
    expect(result.ok).toBe(true);
  });

  it("accepts a work-in-progress SIMPLE form with zero buttons", () => {
    const project = createEmptyProject();
    project.forms[0].bedrock = { type: "SIMPLE", title: "Title", buttons: [] } as any;
    const result = parseProject(project);
    expect(result.ok).toBe(true);
  });

  it("accepts a work-in-progress CUSTOM form with zero components", () => {
    const project = createEmptyProject();
    project.forms[0].bedrock = { type: "CUSTOM", title: "Title", components: [] } as any;
    const result = parseProject(project);
    expect(result.ok).toBe(true);
  });

  it("accepts a work-in-progress button with empty text", () => {
    const project = createEmptyProject();
    project.forms[0].bedrock = {
      type: "SIMPLE",
      title: "Title",
      buttons: [{ id: "a", text: "" }]
    } as any;
    const result = parseProject(project);
    expect(result.ok).toBe(true);
  });
});
