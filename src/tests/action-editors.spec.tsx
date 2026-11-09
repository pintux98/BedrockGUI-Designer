import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { ActionEditor } from "../actions/editors";
import { parseActionBlock, serializeActionBlock, ParsedAction } from "../plugin/grammar";

afterEach(() => cleanup());

function FIXTURE(name: string): string {
  return path.resolve(__dirname, "fixtures/plugin-forms", name);
}

function setCheck(text: string, index = 0) {
  fireEvent.click(screen.getAllByRole("button", { name: "Change" })[index]);
  const back = screen.queryByRole("button", { name: "Back to condition types" });
  if (back) fireEvent.click(back);
  const custom = screen.queryByRole("button", { name: "Write a custom condition" });
  if (custom) fireEvent.click(custom);
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: text } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save condition" }));
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
    setCheck("permission:a.b");
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
    setCheck("permission:edited");

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

describe("ConditionalEditor check field (symbol context)", () => {
  function conditionalAction(check: string): Extract<ParsedAction, { kind: "conditional" }> {
    return { kind: "conditional", check, whenTrue: [], whenFalse: [] };
  }

  it("offers only placeholder and permission as condition kinds", () => {
    render(<ActionEditor action={conditionalAction("permission:a.b")} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to condition types" }));
    const kinds = Array.from(document.querySelectorAll("[data-condition-kind]")).map((e) => e.getAttribute("data-condition-kind"));
    expect(kinds).toEqual(["permission", "placeholder"]);
    expect(screen.queryByLabelText(/Reverse it/)).toBeNull();
  });

  it("editing through the wizard writes the check the plugin's check: parser expects", () => {
    const onChange = vi.fn();
    render(<ActionEditor action={conditionalAction("permission:a.b")} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to condition types" }));
    fireEvent.click(document.querySelector('[data-condition-kind="placeholder"]')!);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("%vault_eco_balance%"), { target: { value: "%x%" } });
    fireEvent.change(within(dialog).getByPlaceholderText("100"), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save condition" }));
    expect(onChange.mock.calls.at(-1)![0]).toEqual({
      kind: "conditional",
      check: "placeholder:%x% == 5",
      whenTrue: [],
      whenFalse: []
    });
  });

  it("loads an existing compound check without mangling it, and it remains editable", () => {
    const compound = "permission:a.b && placeholder:%x% >= 5";
    const onChange = vi.fn();
    render(<ActionEditor action={conditionalAction(compound)} onChange={onChange} />);
    expect(screen.getByText(`Custom: ${compound}`)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    setCheck(compound + " && permission:c.d");
    expect(onChange).toHaveBeenCalledWith({
      kind: "conditional",
      check: compound + " && permission:c.d",
      whenTrue: [],
      whenFalse: []
    });
  });

  it("edits the check of a conditional nested inside a branch, leaving every sibling alone", () => {
    const src = fs.readFileSync(FIXTURE("advanced_flow.yml"), "utf8");
    const doc = yaml.load(src) as any;
    const raw = doc.bedrock.buttons.nested_conditional.onClick[0] as string;
    const before = parseActionBlock(raw);
    if (before.kind !== "conditional") throw new Error("expected a conditional");
    const nested = before.whenTrue[1];
    if (nested?.kind !== "conditional") throw new Error("expected a nested conditional in the true branch");

    const onChange = vi.fn();
    render(<ActionEditor action={before} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Expand action" })[1]);
    fireEvent.click(screen.getAllByRole("button", { name: "Change" })[1]);
    const dialog = screen.getByRole("dialog");
    const operator = within(dialog).getByLabelText("Is");
    expect(operator).toHaveValue(">=");
    fireEvent.change(operator, { target: { value: ">" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save condition" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({
      ...before,
      whenTrue: [before.whenTrue[0], { ...nested, check: "placeholder:%player_level% > 30" }]
    });
  });
});
