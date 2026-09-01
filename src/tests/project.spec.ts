import { describe, it, expect } from "vitest";
import { createEmptyProject, createForm, findForm } from "../core/project";

describe("project model", () => {
  it("starts with one SIMPLE form that is active", () => {
    const project = createEmptyProject();
    expect(project.forms).toHaveLength(1);
    expect(project.activeFormId).toBe(project.forms[0].id);
    expect(project.forms[0].bedrock.type).toBe("SIMPLE");
  });

  it("targets plugin 2.0.11 with config version 1", () => {
    const project = createEmptyProject();
    expect(project.pluginTarget).toBe("2.0.11");
    expect(project.configVersion).toBe(1);
  });

  it("defaults the assets server to off", () => {
    expect(createEmptyProject().assets).toEqual({ enabled: false, port: 0, host: "" });
  });

  it("derives a file name from the form id", () => {
    expect(createForm("main_menu").fileName).toBe("main_menu.yml");
  });

  it("finds a form by id", () => {
    const project = createEmptyProject();
    project.forms.push(createForm("shop"));
    expect(findForm(project, "shop")?.id).toBe("shop");
    expect(findForm(project, "nope")).toBeUndefined();
  });
});
