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

describe("OpenTargetPicker — what it suggests", () => {
  it("suggests this project's forms", () => {
    useDesignerStore.getState().addForm("shop");
    render(<OpenTargetPicker value="" onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: /this project/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "main_menu" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "shop" })).toBeInTheDocument();
  });

  it("never offers an addon action id as an open target", () => {
    // `open` resolves against formMenus, which is built only from config.getKeys("forms").
    // An addon registers action handlers, so bw_shop_main can never be opened.
    useDesignerStore.getState().addForm("shop");
    render(<OpenTargetPicker value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("option", { name: "bw_arena_main" })).toBeNull();
    expect(screen.queryByRole("option", { name: "pd_duel" })).toBeNull();
    expect(screen.queryByRole("option", { name: "home_main" })).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getAllByRole("group")).toHaveLength(1);
  });

  it("narrows the suggestions to what has been typed so far", () => {
    useDesignerStore.getState().addForm("shop");
    useDesignerStore.getState().addForm("shop_confirm");
    render(<OpenTargetPicker value="shop" onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "shop" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "shop_confirm" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "main_menu" })).toBeNull();
  });

  it("filters against the draft as it is typed, without committing it", () => {
    const onChange = vi.fn();
    useDesignerStore.getState().addForm("shop");
    render(<OpenTargetPicker value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "sho" } });
    expect(screen.getByRole("option", { name: "shop" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "main_menu" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("OpenTargetPicker — the addon correction", () => {
  it("corrects an addon action id typed as an open target instead of suggesting it", () => {
    render(<OpenTargetPicker value="bw_shop_main" onChange={vi.fn()} />);
    const note = screen.getByText(/is an action type registered by the/i).closest("p");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("Bedwars Addon");
    expect(note!.textContent).toContain("BedrockGUI-BedwarsAddon.jar");
    expect(note!.textContent).toContain("not a menu");
    expect(note!.textContent).toContain("fails at runtime even with the addon installed");
    expect(note!.textContent).toContain("bw_shop_main { }");
  });

  it("does not fall back to the plain unknown-target note for an addon id", () => {
    render(<OpenTargetPicker value="bw_shop_main" onChange={vi.fn()} />);
    expect(screen.queryByText(/is not a known target/i)).toBeNull();
  });

  it("offers the colon form for an addon action that reads a value, worded as optional", () => {
    render(<OpenTargetPicker value="hs_region_menu" onChange={vi.fn()} />);
    const note = screen.getByText(/is an action type registered by the/i).closest("p")!;
    expect(note.textContent).toContain("Homestead Addon");
    expect(note.textContent).toContain("hs_region_menu:<value>");
    expect(note.textContent).toContain("can take a value, though it does not have to");
  });

  it("names the base id, not the payload, when an addon id already carries one", () => {
    render(<OpenTargetPicker value="hs_region_menu:spawn" onChange={vi.fn()} />);
    const note = screen.getByText(/is an action type registered by the/i).closest("p")!;
    expect(note.textContent).toContain("Homestead Addon");
    expect(note.textContent).toContain("hs_region_menu:<value>");
  });

  it("does not claim an addon action that ignores its payload takes a value", () => {
    render(<OpenTargetPicker value="bw_stats" onChange={vi.fn()} />);
    const note = screen.getByText(/is an action type registered by the/i).closest("p")!;
    expect(note.textContent).toContain("bw_stats { }");
    expect(note.textContent).not.toContain("can take a value");
  });

  it("keeps an unknown id in the field and says it is not a known target, without rewriting it", () => {
    const onChange = vi.fn();
    render(<OpenTargetPicker value="my_own_menu" onChange={onChange} />);
    expect(screen.getByRole("combobox")).toHaveValue("my_own_menu");
    expect(screen.getByText(/is not a known target/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("OpenTargetPicker — when it commits", () => {
  it("does not commit while the field is being typed in", () => {
    const onChange = vi.fn();
    render(<OpenTargetPicker value="" onChange={onChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "m" } });
    fireEvent.change(input, { target: { value: "my" } });
    fireEvent.change(input, { target: { value: "my_own_menu" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("my_own_menu");
  });

  it("commits the draft on blur", () => {
    const onChange = vi.fn();
    render(<OpenTargetPicker value="" onChange={onChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "my_own_menu" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("my_own_menu");
  });

  it("commits the draft on Enter", () => {
    const onChange = vi.fn();
    render(<OpenTargetPicker value="" onChange={onChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "my_own_menu" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("my_own_menu");
  });

  it("commits the id of a suggestion that is clicked", () => {
    const onChange = vi.fn();
    useDesignerStore.getState().addForm("shop");
    render(<OpenTargetPicker value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("option", { name: "shop" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("shop");
  });

  it("commits the highlighted suggestion when Enter follows the arrow keys", () => {
    const onChange = vi.fn();
    useDesignerStore.getState().addForm("shop");
    const input = render(<OpenTargetPicker value="" onChange={onChange} />).container.querySelector("input")!;
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("shop");
  });

  it("commits exactly what was typed — no trimming and no case folding", () => {
    // The component promises it never normalises. A .trim().toLowerCase() slipped into
    // commit() passed the old suite; this is what stops that.
    const onChange = vi.fn();
    render(<OpenTargetPicker value="" onChange={onChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "  My_Own_Menu  " } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("  My_Own_Menu  ");
  });

  it("stays silent on blur when nothing was typed", () => {
    const onChange = vi.fn();
    render(<OpenTargetPicker value="shop" onChange={onChange} />);
    fireEvent.blur(screen.getByRole("combobox"));
    expect(onChange).not.toHaveBeenCalled();
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

  it("writes the committed target back into the first line and leaves the rest alone", () => {
    const onChange = vi.fn();
    render(<ActionEditor action={linesAction("open", ["old", "keep"])} onChange={onChange} />);
    const combobox = screen.getByRole("combobox");
    fireEvent.change(combobox, { target: { value: "new_menu" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(combobox);
    expect(onChange).toHaveBeenCalledWith({ kind: "lines", id: "open", lines: ["new_menu", "keep"] });
  });

  it("leaves every other action id on the plain line input with its placeholder button", () => {
    render(<ActionEditor action={linesAction("message", ["hello"])} onChange={vi.fn()} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("textbox", { name: /line 1/i })).toHaveValue("hello");
    expect(screen.getByRole("button", { name: /insert placeholder into line 1/i })).toBeInTheDocument();
  });
});
