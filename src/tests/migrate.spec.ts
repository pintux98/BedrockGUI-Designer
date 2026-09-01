import { describe, it, expect } from "vitest";
import { migrateLegacyDesign } from "../core/migrate";

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
});
