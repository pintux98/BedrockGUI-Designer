import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ActionPicker } from "../actions/ActionPicker";
import { VisualActionEditor } from "../actions/VisualActionEditor";
import { ConfigSnippetDialog } from "../components/ConfigSnippetDialog";
import { createEmptyProject, createForm, FormDoc } from "../core/project";
import { PlatformTarget } from "../plugin/platforms";
import { useDesignerStore } from "../core/store";
import { BedrockForm } from "../core/types";

afterEach(() => cleanup());

/** The 14 the plugin registers, spelled out rather than read back from the table. */
const CORE_IDS = [
  "command", "open", "message", "delay", "server", "broadcast", "inventory",
  "sound", "economy", "title", "actionbar", "conditional", "random", "bungee"
];

function rows(): HTMLElement[] {
  return screen.queryAllByRole("button").filter((b) => b.hasAttribute("data-action-id"));
}

function rowFor(id: string): HTMLElement {
  const row = rows().find((r) => r.getAttribute("data-action-id") === id);
  if (!row) throw new Error(`no picker row for ${id}`);
  return row;
}

function offeredIds(): string[] {
  return rows().map((r) => r.getAttribute("data-action-id")!);
}

/** The collapse toggle of one addon section. Its rows repeat the addon name. */
function sectionToggle(addonId: string): HTMLElement {
  const toggle = document.querySelector<HTMLElement>(
    `[data-addon-section="${addonId}"] button[aria-expanded]`
  );
  if (!toggle) throw new Error(`no addon section for ${addonId}`);
  return toggle;
}

function setPlatform(platformTarget: PlatformTarget) {
  useDesignerStore.setState({ project: { ...createEmptyProject(), platformTarget } } as never);
}

describe("ActionPicker", () => {
  beforeEach(() => setPlatform("paper"));

  /**
   * The list used to be `actionsForPlatform(project.platformTarget)`, so a project
   * carrying a proxy target silently lost `sound` and `economy` — the user saw 12 of
   * the 14 with nothing saying why.
   */
  it("offers all 14 actions plus Raw whatever the project targets", () => {
    for (const platform of ["paper", "velocity", "bungee"] as PlatformTarget[]) {
      setPlatform(platform);
      render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(offeredIds(), platform).toEqual([...CORE_IDS, "raw"]);
      cleanup();
    }
  });

  it("still offers sound and economy on a proxy target", () => {
    setPlatform("velocity");
    render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Sound")).toBeInTheDocument();
    expect(screen.getByText("Economy")).toBeInTheDocument();
  });

  it("marks exactly sound and economy as Paper-only, on every platform target", () => {
    for (const platform of ["paper", "velocity", "bungee"] as PlatformTarget[]) {
      setPlatform(platform);
      render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
      const noted = rows()
        .filter((r) => r.getAttribute("data-paper-only") === "true")
        .map((r) => r.getAttribute("data-action-id"));
      expect(noted, platform).toEqual(["sound", "economy"]);
      cleanup();
    }
  });

  it("shows the Paper-only note as its own line naming the missing manager", () => {
    render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(rowFor("sound")).toHaveTextContent(
      "Paper only — a proxy registers no sound manager, so this action has no handler there."
    );
    expect(rowFor("economy")).toHaveTextContent(
      "Paper only — a proxy registers no economy manager, so this action has no handler there."
    );
    expect(rowFor("title")).not.toHaveTextContent("Paper only");
    expect(rowFor("actionbar")).not.toHaveTextContent("Paper only");
  });

  it("hands a core action straight to onSelect", () => {
    const onSelect = vi.fn();
    render(<ActionPicker onSelect={onSelect} onClose={vi.fn()} />);
    fireEvent.click(rowFor("economy"));
    expect(onSelect).toHaveBeenCalledWith("economy");
  });
});

describe("ActionPicker addon sections", () => {
  beforeEach(() => setPlatform("paper"));

  it("collapses every addon section, offering no addon row until one is opened", () => {
    render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    for (const [id, name] of [
      ["essentials", "Essentials Addon"],
      ["bedwars", "Bedwars Addon"],
      ["homestead", "Homestead Addon"],
      ["phoenixduels", "PhoenixDuels Addon"]
    ] as [string, string][]) {
      expect(sectionToggle(id)).toHaveAttribute("aria-expanded", "false");
      expect(sectionToggle(id)).toHaveTextContent(name);
    }
    expect(offeredIds()).toEqual([...CORE_IDS, "raw"]);
  });

  it("names each addon and how many actions it registers", () => {
    render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    for (const [id, name, count] of [
      ["essentials", "Essentials Addon", 39],
      ["bedwars", "Bedwars Addon", 16],
      ["homestead", "Homestead Addon", 25],
      ["phoenixduels", "PhoenixDuels Addon", 22]
    ] as [string, string, number][]) {
      expect(sectionToggle(id)).toHaveTextContent(name);
      expect(sectionToggle(id)).toHaveTextContent(`${count} actions`);
    }
  });

  it("reveals that addon's actions when the section is expanded, and only that addon's", () => {
    render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(sectionToggle("bedwars"));

    const addonRows = rows().filter((r) => r.hasAttribute("data-addon"));
    expect(addonRows).toHaveLength(16);
    expect(new Set(addonRows.map((r) => r.getAttribute("data-addon")))).toEqual(new Set(["bedwars"]));
    expect(rowFor("bw_shop_main")).toHaveTextContent("needs Bedwars Addon");
    expect(screen.getByText("BedrockGUI-BedwarsAddon.jar")).toBeInTheDocument();
  });

  it("says which ids take a value and which do not", () => {
    render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(sectionToggle("bedwars"));
    expect(rowFor("bw_shop_cat")).toHaveAttribute("data-takes-value", "true");
    expect(rowFor("bw_shop_cat")).toHaveTextContent("Takes a value after the colon");
    expect(rowFor("bw_stats")).toHaveAttribute("data-takes-value", "false");
    expect(rowFor("bw_stats")).toHaveTextContent("Takes no value.");
  });

  it("searches addon actions too, opening the sections that matched", () => {
    render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search actions..."), { target: { value: "hs_region" } });

    expect(offeredIds()).toEqual(["hs_region_info", "hs_region_menu", "hs_regions"]);
    expect(sectionToggle("homestead")).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector('[data-addon-section="bedwars"]')).toBeNull();
  });

  it("keeps searching the core actions", () => {
    render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search actions..."), { target: { value: "broadcast" } });
    expect(offeredIds()).toEqual(["broadcast"]);
  });

  it("reports no match only when neither a core nor an addon action matches", () => {
    render(<ActionPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search actions..."), { target: { value: "zzz" } });
    expect(screen.getByText('No actions match "zzz"')).toBeInTheDocument();
  });

  it("hands the addon action id to onSelect", () => {
    const onSelect = vi.fn();
    render(<ActionPicker onSelect={onSelect} onClose={vi.fn()} />);
    fireEvent.click(sectionToggle("bedwars"));
    fireEvent.click(rowFor("bw_shop_main"));
    expect(onSelect).toHaveBeenCalledWith("bw_shop_main");
  });
});

/**
 * End to end through the editor that owns the picker, because what matters is the text
 * that reaches the model. The plugin accepts one shape for an addon action: the colon
 * form. `bw_shop_main { }` returns null from ActionExecutor.parseNewFormat
 * (ActionExecutor.java:272-275) and a bare `bw_shop_main` runs as a command (:236-238).
 */
describe("inserting an addon action", () => {
  function Harness({ spy }: { spy: (v: string[]) => void }) {
    const [value, setValue] = React.useState<string[]>([]);
    return (
      <VisualActionEditor
        value={value}
        onChange={(v) => {
          spy(v);
          setValue(v);
        }}
      />
    );
  }

  function pick(addonId: string, id: string) {
    fireEvent.click(screen.getByRole("button", { name: "+ Add Action" }));
    fireEvent.click(sectionToggle(addonId));
    fireEvent.click(rowFor(id));
  }

  beforeEach(() => setPlatform("paper"));

  it("commits the colon form for an action that takes no value", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    pick("bedwars", "bw_shop_main");
    expect(spy).toHaveBeenCalledWith(["bw_shop_main:"]);
    expect(screen.getByRole("textbox", { name: "Raw action block" })).toHaveValue("bw_shop_main:");
  });

  it("commits the colon form ready for a payload when the action takes one", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    pick("bedwars", "bw_shop_cat");
    expect(spy).toHaveBeenCalledWith(["bw_shop_cat:"]);
  });

  it("leaves a core action's block untouched", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Action" }));
    fireEvent.click(rowFor("message"));
    expect(spy).toHaveBeenCalledWith(['message {\n  - ""\n}']);
  });
});

describe("ConfigSnippetDialog addon requirements", () => {
  function withOnClick(form: FormDoc, raw: string): FormDoc {
    return {
      ...form,
      bedrock: {
        ...form.bedrock,
        type: "SIMPLE",
        buttons: [{ id: "b1", text: "B", onClick: [{ id: "a0", params: {}, raw }] }]
      } as BedrockForm
    };
  }

  function loadForms(...forms: FormDoc[]) {
    useDesignerStore.setState({
      project: { ...createEmptyProject(), forms, activeFormId: forms[0].id }
    } as never);
  }

  it("lists the addon and its jar when the project uses one of its actions", () => {
    loadForms(withOnClick(createForm("main"), "hs_region_menu:12345"));
    render(<ConfigSnippetDialog open onClose={vi.fn()} snippet="forms: {}\n" />);

    expect(screen.getByText("This project also needs an addon")).toBeInTheDocument();
    expect(screen.getByText("Homestead Addon")).toBeInTheDocument();
    expect(screen.getByText("BedrockGUI-HomesteadAddon.jar")).toBeInTheDocument();
    expect(screen.getByText("hs_region_menu")).toBeInTheDocument();
    expect(screen.queryByText("Bedwars Addon")).toBeNull();
  });

  it("shows nothing extra when the project uses no addon action", () => {
    loadForms(withOnClick(createForm("main"), 'message {\n  - "hi"\n}'));
    const { container } = render(<ConfigSnippetDialog open onClose={vi.fn()} snippet="forms: {}\n" />);

    expect(container.ownerDocument.querySelector("[data-addon-requirements]")).toBeNull();
    expect(screen.queryByText(/also needs an addon/)).toBeNull();
    expect(screen.getByText("Register your exported forms")).toBeInTheDocument();
  });

  it("lists every addon the project uses, once each", () => {
    loadForms(
      withOnClick(createForm("a"), "bw_stats:"),
      withOnClick(createForm("b"), "bw_arena_main:"),
      withOnClick(createForm("c"), "pd_kits:")
    );
    render(<ConfigSnippetDialog open onClose={vi.fn()} snippet="forms: {}\n" />);

    const listed = Array.from(
      document.querySelectorAll("[data-addon-required]"),
      (el) => el.getAttribute("data-addon-required")
    );
    expect(listed).toEqual(["bedwars", "phoenixduels"]);
    expect(screen.getByText("This project also needs addons")).toBeInTheDocument();
    expect(screen.getByText("bw_arena_main, bw_stats")).toBeInTheDocument();
  });
});
