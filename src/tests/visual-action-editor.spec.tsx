import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { VisualActionEditor } from "../actions/VisualActionEditor";

afterEach(() => cleanup());

const MESSAGE = 'message {\n  - "a"\n}';
const CONDITIONAL = 'conditional {\n  check: "permission:a.b"\n}';
const RANDOM = 'random {\n  - "message:x@2"\n}';
const BUNGEE = 'bungee {\n  subchannel: "Connect"\n  - "lobby"\n}';
const UNKNOWN = 'url {\n  - "https://example.com"\n}';

/**
 * Mirrors how `PropertiesPanel` drives the editor: the committed blocks go into the
 * model and come straight back down as `value`, so anything the editor drops on the
 * way up is gone from the screen on the next render.
 */
function Harness({ initial, spy }: { initial: string[]; spy?: (v: string[]) => void }) {
  const [value, setValue] = React.useState(initial);
  return (
    <VisualActionEditor
      value={value}
      onChange={(v) => {
        spy?.(v);
        setValue(v);
      }}
    />
  );
}

function addViaPicker(description: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: "+ Add Action" }));
  fireEvent.click(screen.getByRole("button", { name: description }));
}

const RAW_ENTRY = /Write raw action block YAML/;
const MESSAGE_ENTRY = /Send a chat message to the player/;

function commit(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe("VisualActionEditor", () => {
  it("dispatches each block to the editor for its parsed kind", () => {
    render(<Harness initial={[MESSAGE, CONDITIONAL, RANDOM, BUNGEE, UNKNOWN]} />);

    expect(screen.getAllByRole("button", { name: "Collapse action" })).toHaveLength(5);

    // lines → LinesEditor
    expect(screen.getByRole("textbox", { name: "Line 1" })).toHaveValue("a");
    // conditional → ConditionalEditor (its check builder plus the two branches)
    expect(screen.getByRole("combobox", { name: /type/i })).toHaveValue("permission");
    expect(screen.getByText("If true")).toBeInTheDocument();
    expect(screen.getByText("If false")).toBeInTheDocument();
    // random → RandomEditor
    expect(screen.getByRole("textbox", { name: "Entry 1 text" })).toHaveValue("message:x");
    expect(screen.getByRole("spinbutton", { name: "Entry 1 weight" })).toHaveValue(2);
    // bungee → BungeeEditor
    expect(screen.getByLabelText("Subchannel")).toHaveValue("Connect");
    expect(screen.getByRole("textbox", { name: "Arg 1" })).toHaveValue("lobby");
    // an id the plugin does not define stays raw rather than being coerced
    expect(screen.getByRole("textbox", { name: "Raw action block" })).toHaveValue(UNKNOWN);
  });

  it("commits an edit made in a typed editor as the re-serialized block", () => {
    const spy = vi.fn();
    render(<Harness initial={[MESSAGE, BUNGEE]} spy={spy} />);

    commit(screen.getByRole("textbox", { name: "Arg 1" }), "hub");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual([MESSAGE, 'bungee {\n  subchannel: "Connect"\n  - "hub"\n}']);
  });

  it("reorders blocks through the header controls", () => {
    const spy = vi.fn();
    render(<Harness initial={[MESSAGE, RANDOM]} spy={spy} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Move action down" })[0]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual([RANDOM, MESSAGE]);
  });

  it("re-derives its blocks when the value changes from outside, such as an undo", () => {
    const { rerender } = render(<VisualActionEditor value={[MESSAGE]} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Line 1" })).toHaveValue("a");

    rerender(<VisualActionEditor value={[RANDOM]} onChange={vi.fn()} />);
    expect(screen.queryByRole("textbox", { name: "Line 1" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Entry 1 text" })).toHaveValue("message:x");
  });

  // ─── Finding 1 ────────────────────────────────────────────────────────────
  // A freshly added Raw block serializes to "", which must never reach the model
  // (it would export as a blank action block) but must not be destroyed either.
  it("keeps a still-empty new block out of the model without writing it to the YAML", () => {
    const spy = vi.fn();
    render(<Harness initial={[MESSAGE]} spy={spy} />);

    addViaPicker(RAW_ENTRY);

    expect(screen.getByRole("textbox", { name: "Raw action block" })).toHaveValue("");
    expect(spy).not.toHaveBeenCalled();

    commit(screen.getByRole("textbox", { name: "Raw action block" }), UNKNOWN);
    expect(spy.mock.calls.at(-1)![0]).toEqual([MESSAGE, UNKNOWN]);
  });

  it("keeps an empty in-progress block on screen while a sibling is edited", () => {
    const spy = vi.fn();
    render(<Harness initial={[]} spy={spy} />);

    addViaPicker(MESSAGE_ENTRY);
    addViaPicker(RAW_ENTRY);
    expect(screen.getByRole("textbox", { name: "Raw action block" })).toBeInTheDocument();

    // Tidying the message above must not take the empty block down with it.
    commit(screen.getByRole("textbox", { name: "Line 1" }), "hi");

    expect(screen.getByRole("textbox", { name: "Raw action block" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Line 1" })).toHaveValue("hi");
    expect(spy.mock.calls.at(-1)![0]).toEqual(['message {\n  - "hi"\n}']);
    for (const call of spy.mock.calls) expect(call[0]).not.toContain("");
  });
});
