import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { ActionEditor } from "../actions/editors";
import { parseActionBlock, serializeActionBlock } from "../plugin/grammar";

afterEach(() => cleanup());

function FIXTURE(name: string): string {
  return path.resolve(__dirname, "fixtures/plugin-forms", name);
}

function findNestedConditional(src: string): string {
  const doc = yaml.load(src) as any;
  return doc.bedrock.buttons.nested_conditional.onClick[0] as string;
}

describe("ActionEditor", () => {
  it("edits a lines action without touching the others", () => {
    const parsed = parseActionBlock('message {\n  - "a"\n  - "b"\n}');
    const onChange = vi.fn();
    render(<ActionEditor action={parsed} onChange={onChange} />);
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "changed" } });
    fireEvent.blur(screen.getAllByRole("textbox")[1]);
    expect(onChange).toHaveBeenCalledWith({ kind: "lines", id: "message", lines: ["a", "changed"] });
  });

  it("edits a conditional branch without flattening a nested conditional", () => {
    const src = fs.readFileSync(FIXTURE("advanced_flow.yml"), "utf8");
    const nested = findNestedConditional(src);
    const parsed = parseActionBlock(nested);
    const onChange = vi.fn();
    render(<ActionEditor action={parsed} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/check/i), { target: { value: "permission:a.b" } });
    fireEvent.blur(screen.getByLabelText(/check/i));
    const next = onChange.mock.calls[0][0];
    expect(next.kind).toBe("conditional");
    expect(next.check).toBe("permission:a.b");
    expect(next.whenTrue.some((a: any) => a.kind === "conditional")).toBe(true);
  });

  it("keeps an unrecognised block as raw and returns it unchanged", () => {
    const text = 'url {\n  - "https://example.com"\n}';
    const parsed = parseActionBlock(text);
    expect(parsed.kind).toBe("raw");
    const onChange = vi.fn();
    render(<ActionEditor action={parsed} onChange={onChange} />);
    expect(screen.getByRole("textbox")).toHaveValue(text);
  });

  it("edits weighted random entries", () => {
    const parsed = parseActionBlock('random {\n  - "message:a@3.0"\n  - "message:b@1.0"\n}');
    const onChange = vi.fn();
    render(<ActionEditor action={parsed} onChange={onChange} />);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "5" } });
    fireEvent.blur(screen.getAllByRole("spinbutton")[0]);
    expect(onChange.mock.calls[0][0].entries[0]).toEqual({ text: "message:a", weight: 5 });
  });
});

describe("real advanced_flow.yml actions survive an edit through the editor", () => {
  const src = fs.readFileSync(FIXTURE("advanced_flow.yml"), "utf8");
  const doc = yaml.load(src) as any;

  it("nested_conditional keeps its nested branches structurally identical after an edit", () => {
    const raw = doc.bedrock.buttons.nested_conditional.onClick[0] as string;
    const before = parseActionBlock(raw);
    if (before.kind !== "conditional") throw new Error("expected a conditional");

    const onChange = vi.fn();
    render(<ActionEditor action={before} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/check/i), { target: { value: "permission:edited" } });
    fireEvent.blur(screen.getByLabelText(/check/i));

    const next = onChange.mock.calls[0][0];
    const roundTripped = parseActionBlock(serializeActionBlock(next));
    expect(roundTripped).toEqual({ ...before, check: "permission:edited" });
  });

  it("loot_roll keeps its weighted entries structurally identical after an edit", () => {
    const raw = doc.bedrock.buttons.loot_roll.onClick[0] as string;
    const before = parseActionBlock(raw);
    if (before.kind !== "random") throw new Error("expected a random");

    const onChange = vi.fn();
    render(<ActionEditor action={before} onChange={onChange} />);
    const firstWeight = screen.getAllByRole("spinbutton")[0];
    fireEvent.change(firstWeight, { target: { value: "2" } });
    fireEvent.blur(firstWeight);

    const next = onChange.mock.calls[0][0];
    const roundTripped = parseActionBlock(serializeActionBlock(next));
    const expected = {
      kind: "random",
      entries: before.entries.map((e, i) => (i === 0 ? { ...e, weight: 2 } : e))
    };
    expect(roundTripped).toEqual(expected);
  });
});
