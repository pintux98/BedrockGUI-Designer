import { describe, it, expect } from "vitest";
import { migrateLegacyDesign, isLegacyDesign } from "../core/migrate";
import { parseProject } from "../core/projectSchemas";
import { createEmptyProject } from "../core/project";

const LEGACY = {
  configVersion: "1.0.0",
  menuName: "welcome",
  platform: "bedrock",
  bedrock: {
    type: "SIMPLE",
    title: "Welcome",
    content: "Hello",
    buttons: [
      {
        id: "site",
        text: "Website",
        translations: { it: "Sito" },
        priority: 5,
        priorityCondition: "permission:a.b",
        onClick: [{ id: "raw", params: 'url {\n  - "https://example.com"\n}', raw: 'url {\n  - "https://example.com"\n}' }]
      }
    ]
  }
};

describe("migrateLegacyDesign", () => {
  it("produces a one-form project keyed by menuName", () => {
    const { project } = migrateLegacyDesign(LEGACY);
    expect(project.forms).toHaveLength(1);
    expect(project.forms[0].id).toBe("welcome");
    expect(project.activeFormId).toBe("welcome");
  });

  it("drops the keys the plugin ignores and says so", () => {
    const { project, notes } = migrateLegacyDesign(LEGACY);
    const button = (project.forms[0].bedrock as any).buttons[0];
    expect(button.translations).toBeUndefined();
    expect(button.priority).toBeUndefined();
    expect(button.priorityCondition).toBeUndefined();
    expect(notes.join(" ")).toContain("translations");
    expect(notes.join(" ")).toContain("priority");
  });

  it("flags the removed url action but keeps its text", () => {
    const { project, notes } = migrateLegacyDesign(LEGACY);
    const button = (project.forms[0].bedrock as any).buttons[0];
    expect(button.onClick[0].raw).toContain("https://example.com");
    expect(notes.join(" ")).toContain("url");
  });

  it("sets the modern config version", () => {
    expect(migrateLegacyDesign(LEGACY).project.configVersion).toBe(1);
  });

  it("produces a project that parseProject accepts, closing the crash path", () => {
    const { project } = migrateLegacyDesign(LEGACY);
    const result = parseProject(project);
    expect(result.ok).toBe(true);
  });

  it("migrates a MODAL with 3 buttons as a work-in-progress state parseProject now accepts", () => {
    const WIP_LEGACY = {
      configVersion: "1.0.0",
      menuName: "wip",
      platform: "bedrock",
      bedrock: {
        type: "MODAL",
        title: "Wip",
        buttons: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
          { id: "c", text: "C" }
        ]
      }
    };
    const { project } = migrateLegacyDesign(WIP_LEGACY);
    const result = parseProject(project);
    expect(result.ok).toBe(true);
  });

  it("a genuinely malformed legacy save (bad bedrock type) still fails parseProject after migration", () => {
    const CORRUPT_LEGACY = {
      configVersion: "1.0.0",
      menuName: "broken",
      platform: "bedrock",
      bedrock: {
        type: "NOT_A_REAL_TYPE",
        title: "Broken",
        buttons: [{ id: "a", text: "A" }]
      }
    };
    const { project } = migrateLegacyDesign(CORRUPT_LEGACY);
    const result = parseProject(project);
    expect(result.ok).toBe(false);
  });
});

describe("isLegacyDesign", () => {
  it("is true for the old flat shape (no forms array, has bedrock)", () => {
    expect(isLegacyDesign(LEGACY)).toBe(true);
  });

  it("is false for a modern project (has a forms array)", () => {
    expect(isLegacyDesign(createEmptyProject())).toBe(false);
  });

  it("is false for nullish or non-object input", () => {
    expect(isLegacyDesign(null)).toBe(false);
    expect(isLegacyDesign(undefined)).toBe(false);
    expect(isLegacyDesign("not an object")).toBe(false);
  });
});
