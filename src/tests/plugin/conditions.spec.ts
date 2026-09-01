import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { operatorsFor, validateCondition } from "../../plugin/conditions";
import { parseActionBlock, ParsedAction } from "../../plugin/grammar";

describe("operatorsFor", () => {
  it("offers word operators only in colon context", () => {
    expect(operatorsFor("colon").map((o) => o.word)).toContain("greater_than");
    expect(operatorsFor("symbol").map((o) => o.word).filter(Boolean)).toEqual([]);
  });

  it("offers symbol operators in both contexts", () => {
    expect(operatorsFor("symbol").map((o) => o.symbol)).toContain(">=");
    expect(operatorsFor("colon").map((o) => o.symbol)).toContain(">=");
  });
});

describe("validateCondition", () => {
  it("accepts a permission atom", () => {
    expect(validateCondition("permission:bedrockgui.admin", "colon")).toEqual([]);
  });

  it("accepts a colon placeholder comparison", () => {
    expect(validateCondition("placeholder:%vault_eco_balance%:greater_than:25", "colon")).toEqual([]);
  });

  it("accepts a symbol placeholder comparison in a check", () => {
    expect(validateCondition("placeholder:%vault_eco_balance% >= 25", "symbol")).toEqual([]);
  });

  it("rejects symbol syntax in a colon context", () => {
    expect(validateCondition("placeholder:%x% >= 5", "colon").length).toBeGreaterThan(0);
  });

  it("rejects an unknown operator", () => {
    expect(validateCondition("placeholder:%x%:bigger_than:5", "colon").length).toBeGreaterThan(0);
  });

  it("accepts combined atoms with and or", () => {
    expect(validateCondition("permission:a.b && (plugin:Vault || not:permission:c.d)", "colon")).toEqual([]);
  });

  it("rejects unbalanced parentheses", () => {
    expect(validateCondition("(permission:a.b", "colon").length).toBeGreaterThan(0);
  });

  it("accepts the operators that need no expected value", () => {
    expect(validateCondition("placeholder:%x%:not_empty", "colon")).toEqual([]);
  });
});

describe("validateCondition against the shipped fixtures", () => {
  const dir = path.resolve(__dirname, "../fixtures/plugin-forms");
  const showConditions: string[] = [];
  const checks: string[] = [];

  for (const file of fs.readdirSync(dir)) {
    const doc = yaml.load(fs.readFileSync(path.join(dir, file), "utf8"));
    collectShowConditions(doc, showConditions);
    const blocks: string[] = [];
    collectBlocks(doc, blocks);
    for (const block of blocks) collectChecks(parseActionBlock(block), checks);
  }

  it("found show_condition values in the fixtures", () => {
    expect(showConditions.length).toBeGreaterThan(0);
  });

  it("validates every fixture show_condition as colon syntax", () => {
    for (const condition of showConditions) {
      expect(validateCondition(condition, "colon")).toEqual([]);
    }
  });

  it("found conditional check values in the fixtures", () => {
    expect(checks.length).toBeGreaterThan(0);
  });

  it("validates every fixture conditional check as symbol syntax", () => {
    for (const check of checks) {
      expect(validateCondition(check, "symbol")).toEqual([]);
    }
  });
});

function collectShowConditions(node: unknown, out: string[]) {
  if (Array.isArray(node)) { node.forEach((n) => collectShowConditions(n, out)); return; }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "show_condition" && typeof value === "string") out.push(value);
      else collectShowConditions(value, out);
    }
  }
}

function collectBlocks(node: unknown, out: string[]) {
  if (typeof node === "string") {
    if (/^\s*[A-Za-z_]+\s*\{[\s\S]*\}\s*$/.test(node)) out.push(node);
    return;
  }
  if (Array.isArray(node)) { node.forEach((n) => collectBlocks(n, out)); return; }
  if (node && typeof node === "object") Object.values(node).forEach((n) => collectBlocks(n, out));
}

function collectChecks(action: ParsedAction, out: string[]) {
  if (action.kind !== "conditional") return;
  out.push(action.check);
  action.whenTrue.forEach((a) => collectChecks(a, out));
  action.whenFalse.forEach((a) => collectChecks(a, out));
}
