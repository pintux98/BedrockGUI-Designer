import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { parseAction, serializeAction } from "../actions/VisualActionEditor";
import { parseActionBlock } from "../plugin/grammar";

describe("VisualActionEditor parse/serialize", () => {
  it("indents every line of a two-entry true branch, not just the first", () => {
    const parsed = parseAction(
      'conditional {\n  check: "permission:my.perm"\n  true:\n    - "message { - \\"one\\" }"\n    - "message { - \\"two\\" }"\n  false:\n}'
    );
    expect(parsed.type).toBe("conditional");
    expect(parsed.trueLines).toHaveLength(2);

    const serialized = serializeAction(parsed) as string;
    const reparsed = parseActionBlock(serialized);
    if (reparsed.kind !== "conditional") throw new Error(`expected conditional, got ${reparsed.kind}`);
    expect(reparsed.whenTrue).toHaveLength(2);
    expect(reparsed.whenTrue[0]).toEqual({ kind: "lines", id: "message", lines: ["one"] });
    expect(reparsed.whenTrue[1]).toEqual({ kind: "lines", id: "message", lines: ["two"] });
  });

  it("reads and writes the flat weighted-list random shape (no 1:/2: groups)", () => {
    const raw = 'random {\n  - "inventory:give:diamond:1@1.0"\n  - "inventory:give:gold_ingot:4@3.0"\n}';
    const parsed = parseAction(raw);
    expect(parsed.type).toBe("random");
    expect(parsed.lines).toEqual(["inventory:give:diamond:1@1.0", "inventory:give:gold_ingot:4@3.0"]);

    const serialized = serializeAction(parsed) as string;
    const reparsed = parseActionBlock(serialized);
    if (reparsed.kind !== "random") throw new Error(`expected random, got ${reparsed.kind}`);
    expect(reparsed.entries).toEqual([
      { text: "inventory:give:diamond:1", weight: 1.0 },
      { text: "inventory:give:gold_ingot:4", weight: 3.0 }
    ]);
  });

  it("round-trips the real nested_conditional action from advanced_flow.yml without flattening", () => {
    const file = path.resolve(__dirname, "fixtures/plugin-forms/advanced_flow.yml");
    const doc = yaml.load(fs.readFileSync(file, "utf8")) as any;
    const raw = doc.bedrock.buttons.nested_conditional.onClick[0] as string;

    const before = parseActionBlock(raw);
    if (before.kind !== "conditional") throw new Error("expected a conditional");

    const editorParsed = parseAction(raw);
    expect(editorParsed.type).toBe("conditional");

    const serialized = serializeAction(editorParsed) as string;
    const after = parseActionBlock(serialized);

    expect(after).toEqual(before);
  });
});
