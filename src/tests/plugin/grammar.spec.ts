import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parseActionBlock, serializeActionBlock } from "../../plugin/grammar";

const MESSAGE = `message {
  - "First line"
  - "Second line"
}`;

const CONDITIONAL = `conditional {
  check: "placeholder:%vault_eco_balance% >= 25"
  true:
    - |
      economy {
        - "remove:25"
      }
  false:
    - |
      message {
        - "Not enough."
      }
}`;

describe("parseActionBlock", () => {
  it("parses a lines action", () => {
    expect(parseActionBlock(MESSAGE)).toEqual({
      kind: "lines",
      id: "message",
      lines: ["First line", "Second line"]
    });
  });

  it("parses a conditional with both branches", () => {
    const parsed = parseActionBlock(CONDITIONAL);
    if (parsed.kind !== "conditional") throw new Error("expected a conditional");
    expect(parsed.check).toBe("placeholder:%vault_eco_balance% >= 25");
    expect(parsed.whenTrue).toEqual([{ kind: "lines", id: "economy", lines: ["remove:25"] }]);
    expect(parsed.whenFalse).toEqual([{ kind: "lines", id: "message", lines: ["Not enough."] }]);
  });

  it("parses weighted random entries", () => {
    const parsed = parseActionBlock(`random {\n  - "message:Common@3.0"\n  - "message:Rare@1.0"\n}`);
    if (parsed.kind !== "random") throw new Error("expected a random");
    expect(parsed.entries).toEqual([
      { text: "message:Common", weight: 3.0 },
      { text: "message:Rare", weight: 1.0 }
    ]);
  });

  it("returns raw for an unknown action type", () => {
    const text = `url {\n  - "https://example.com"\n}`;
    expect(parseActionBlock(text)).toEqual({ kind: "raw", text });
  });

  it("returns raw for malformed input", () => {
    expect(parseActionBlock("not a block at all")).toEqual({ kind: "raw", text: "not a block at all" });
  });
});

describe("serializeActionBlock", () => {
  it("round-trips a lines action", () => {
    expect(serializeActionBlock(parseActionBlock(MESSAGE))).toBe(MESSAGE);
  });

  it("round-trips a conditional", () => {
    const once = serializeActionBlock(parseActionBlock(CONDITIONAL));
    const twice = serializeActionBlock(parseActionBlock(once));
    expect(twice).toBe(once);
  });

  it("emits raw text unchanged", () => {
    expect(serializeActionBlock({ kind: "raw", text: "anything at all" })).toBe("anything at all");
  });

  it("round-trips the real bungee block from advanced_flow.yml", () => {
    const file = path.resolve(__dirname, "../fixtures/plugin-forms/advanced_flow.yml");
    const doc = yaml.load(fs.readFileSync(file, "utf8")) as any;
    const block = doc.bedrock.buttons.bungee.onClick[0] as string;

    const parsed = parseActionBlock(block);
    if (parsed.kind !== "bungee") throw new Error("expected a bungee action");
    expect(parsed.subchannel).toBe("Message");
    expect(parsed.args).toEqual(["{player}", "§9Delivered to you by the proxy."]);

    const serialized = serializeActionBlock(parsed);
    expect(parseActionBlock(serialized)).toEqual(parsed);
  });
});

it("returns a non-raw parse for every block in the shipped fixtures", () => {
  const dir = path.resolve(__dirname, "../fixtures/plugin-forms");
  const blocks: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    const doc = yaml.load(fs.readFileSync(path.join(dir, file), "utf8")) as any;
    collectBlocks(doc, blocks);
  }
  expect(blocks.length).toBeGreaterThan(20);
  const unparsed = blocks.filter((b) => parseActionBlock(b).kind === "raw");
  expect(unparsed).toEqual([]);
});

function collectBlocks(node: unknown, out: string[]) {
  if (typeof node === "string") {
    if (/^\s*[A-Za-z_]+\s*\{[\s\S]*\}\s*$/.test(node)) out.push(node);
    return;
  }
  if (Array.isArray(node)) { node.forEach((n) => collectBlocks(n, out)); return; }
  if (node && typeof node === "object") Object.values(node).forEach((n) => collectBlocks(n, out));
}
