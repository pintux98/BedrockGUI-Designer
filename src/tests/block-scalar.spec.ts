import { describe, it, expect } from "vitest";
import * as yaml from "js-yaml";
import { applyBlockScalars } from "../serialize/blockScalar";

describe("applyBlockScalars", () => {
  it("turns a mapping value containing a newline into a |- block", () => {
    const dumped = yaml.dump(
      { content: "line one\nline two" },
      { lineWidth: -1, noRefs: true, forceQuotes: true, quoteStyle: "double" }
    );
    const text = applyBlockScalars(dumped);
    expect(text).toContain("content: |-");
    expect(text).toContain("line one");
    expect(text).toContain("line two");
    expect(yaml.load(text)).toEqual({ content: "line one\nline two" });
  });

  it("turns a list item containing a newline into a |- block", () => {
    const dumped = yaml.dump(
      { onClick: ["message {\n  - \"Hi\"\n}"] },
      { lineWidth: -1, noRefs: true, forceQuotes: true, quoteStyle: "double" }
    );
    const text = applyBlockScalars(dumped);
    expect(text).toContain("- |-");
    expect(yaml.load(text)).toEqual({ onClick: ['message {\n  - "Hi"\n}'] });
  });

  it("does not indent blank lines inside a block scalar body", () => {
    const dumped = yaml.dump(
      { content: "line one\n\nline two" },
      { lineWidth: -1, noRefs: true, forceQuotes: true, quoteStyle: "double" }
    );
    const text = applyBlockScalars(dumped);
    const lines = text.split("\n");
    const lineOneIndex = lines.findIndex((l) => l.trim() === "line one");
    expect(lineOneIndex).toBeGreaterThanOrEqual(0);
    expect(lines[lineOneIndex + 1]).toBe("");
    expect(yaml.load(text)).toEqual({ content: "line one\n\nline two" });
  });
});
