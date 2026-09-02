import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { OpenTargetPicker } from "../components/OpenTargetPicker";
import { ActionEditor } from "../actions/editors";
import { ParsedAction } from "../plugin/grammar";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";

beforeEach(() => useDesignerStore.getState().loadProject(createEmptyProject()));
afterEach(() => cleanup());

function linesAction(id: string, lines: string[]): ParsedAction {
  return { kind: "lines", id: id as Extract<ParsedAction, { kind: "lines" }>["id"], lines };
}

describe("OpenTargetPicker", () => {
  it("offers this project's forms first, then addon targets grouped by addon", () => {
    useDesignerStore.getState().addForm("shop");
    render(<OpenTargetPicker value="" onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: /this project/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "shop" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /bedwars/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "bw_arena_main" })).toBeInTheDocument();
  });

  it("puts this project's group before every addon group", () => {
    useDesignerStore.getState().addForm("shop");
    render(<OpenTargetPicker value="" onChange={vi.fn()} />);
    const groups = screen.getAllByRole("group");
    expect(groups[0]).toHaveAccessibleName(/this project/i);
    expect(groups.length).toBeGreaterThan(1);
  });

  it("names the addon a chosen target needs", () => {
    render(<OpenTargetPicker value="pd_duel" onChange={vi.fn()} />);
    expect(screen.getByText(/PhoenixDuels Addon/)).toBeInTheDocument();
  });

  it("names the addon behind a parameterised target that carries an argument", () => {
    render(<OpenTargetPicker value="hs_region_menu:spawn" onChange={vi.fn()} />);
    expect(screen.getByText(/Homestead Addon/)).toBeInTheDocument();
    expect(screen.getByText(/expects an argument after a colon/i)).toBeInTheDocument();
  });

  it("does not claim a plain addon form id expects an argument", () => {
    render(<OpenTargetPicker value="pd_duel" onChange={vi.fn()} />);
    expect(screen.queryByText(/expects an argument after a colon/i)).toBeNull();
  });

  it("accepts a free-text id that matches nothing", () => {
    const onChange = vi.fn();
    render(<OpenTargetPicker value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "my_own_menu" } });
    expect(onChange).toHaveBeenCalledWith("my_own_menu");
  });

  it("keeps an unknown id in the field and says it is not a known target, without rewriting it", () => {
    const onChange = vi.fn();
    render(<OpenTargetPicker value="my_own_menu" onChange={onChange} />);
    expect(screen.getByRole("combobox")).toHaveValue("my_own_menu");
    expect(screen.getByText(/not a known target/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("emits the id of a suggestion that is clicked", () => {
    const onChange = vi.fn();
    render(<OpenTargetPicker value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("option", { name: "bw_arena_main" }));
    expect(onChange).toHaveBeenCalledWith("bw_arena_main");
  });

  it("narrows the suggestions to what has been typed so far", () => {
    render(<OpenTargetPicker value="bw_arena" onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "bw_arena_main" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "pd_duel" })).toBeNull();
  });
});

describe("LinesEditor wiring", () => {
  it("uses the picker for the first line of an open block only", () => {
    render(<ActionEditor action={linesAction("open", ["", ""])} onChange={vi.fn()} />);
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("labels the later lines of an open block as chained menus or arguments", () => {
    render(<ActionEditor action={linesAction("open", ["shop", "3"])} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: /line 2 \(chained menu or argument\)/i })).toBeInTheDocument();
    expect(screen.getByText(/only the first value is always a menu/i)).toBeInTheDocument();
  });

  it("writes the picked target back into the first line and leaves the rest alone", () => {
    const onChange = vi.fn();
    render(<ActionEditor action={linesAction("open", ["old", "keep"])} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "bw_stats" } });
    expect(onChange).toHaveBeenCalledWith({ kind: "lines", id: "open", lines: ["bw_stats", "keep"] });
  });

  it("leaves every other action id on the plain line input with its placeholder button", () => {
    render(<ActionEditor action={linesAction("message", ["hello"])} onChange={vi.fn()} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("textbox", { name: /line 1/i })).toHaveValue("hello");
    expect(screen.getByRole("button", { name: /insert placeholder into line 1/i })).toBeInTheDocument();
  });
});
