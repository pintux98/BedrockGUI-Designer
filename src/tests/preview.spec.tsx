import React from "react";
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BedrockPreview } from "../canvas/previews/BedrockPreview";
import { DndContext, useDndContext } from "@dnd-kit/core";

afterEach(() => cleanup());

function wrap(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

describe("Preview Components", () => {
  describe("BedrockPreview", () => {
    it("renders a CUSTOM form with no components as an empty drop target", () => {
      const form: any = {
        type: "CUSTOM",
        title: "Custom Form",
        components: []
      };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Custom Form")).toBeInTheDocument();
      expect(screen.getByText("Drag components here")).toBeInTheDocument();
      expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Close preview"]);
    });

    it("renders a SIMPLE form with undefined buttons as a shell with no rows", () => {
      const form: any = {
        type: "SIMPLE",
        title: "Simple Form",
        buttons: undefined
      };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Simple Form")).toBeInTheDocument();
      // The close button is the only one there is: nothing invented a row for the missing list.
      expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Close preview"]);
    });

    it("renders MODAL content and exactly the buttons it was given", () => {
      const form: any = {
        type: "MODAL",
        title: "Modal Form",
        content: "Are you sure?",
        buttons: [{ id: "yes", text: "Yes" }]
      };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Modal Form")).toBeInTheDocument();
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["✕", "Yes"]);
    });

    it("renders Minecraft color codes in title and button text", () => {
      const form: any = {
        type: "SIMPLE",
        title: "&aGreen Title",
        content: "",
        buttons: [{ id: "b1", text: "&#ff00ffPink" }]
      };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Green Title")).toHaveStyle({ color: "#55FF55" });
      expect(screen.getByText("Pink")).toHaveStyle({ color: "#FF00FF" });
    });
  });

  /**
   * The preview is the only place a button `image:` is ever drawn, and until these tests
   * existed the whole feature was unguarded: replacing the resolver call with
   * `{ src: undefined, label: image }` degraded every icon to a grey two-letter box and
   * the entire suite — unit and e2e — stayed green. Each case below pins a literal URL
   * or caption, so the wiring between BedrockPreview and resolveImageForPreview cannot
   * be cut without a red test.
   */
  describe("BedrockPreview button images", () => {
    function simpleWithImage(image: string) {
      return { type: "SIMPLE", title: "Icons", content: "", buttons: [{ id: "b1", text: "Row", image }] } as any;
    }

    it("draws an http image as an <img> pointing at the URL itself", () => {
      const { container } = wrap(<BedrockPreview form={simpleWithImage("https://example.com/icon.png")} />);
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src", "https://example.com/icon.png");
      expect(img).toHaveAttribute("title", "https://example.com/icon.png");
    });

    it("draws head:Notch as the mc-heads render the plugin asks the client for", () => {
      const { container } = wrap(<BedrockPreview form={simpleWithImage("head:Notch")} />);
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src", "https://mc-heads.net/head/Notch/64");
      expect(img).toHaveAttribute("title", "Player head: Notch");
    });

    it("draws BARRIER as a player head, because that is what the game draws", () => {
      const { container } = wrap(<BedrockPreview form={simpleWithImage("BARRIER")} />);
      expect(container.querySelector("img")).toHaveAttribute("src", "https://mc-heads.net/head/BARRIER/64");
    });

    it("falls back to a labelled box for a material the designer cannot draw", () => {
      const { container } = wrap(<BedrockPreview form={simpleWithImage("DIAMOND_SWORD")} />);
      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByTitle("Material: DIAMOND_SWORD")).toHaveTextContent("DI");
    });

    it("draws no image node at all for a button that carries no image", () => {
      const form: any = { type: "SIMPLE", title: "Icons", content: "", buttons: [{ id: "b1", text: "Row" }] };
      const { container } = wrap(<BedrockPreview form={form} />);
      expect(container.querySelector("img")).toBeNull();
      // Not even the fallback box: an absent image is a blank slot, not "No image".
      expect(screen.queryByTitle("No image")).toBeNull();
      expect(screen.queryByText("IMG")).toBeNull();
    });
  });

  /**
   * BedrockPreview routes MODAL content through `hasMinecraftCodes`: colour codes go to
   * MinecraftText, everything else to ReactMarkdown. Both branches were uncovered — nailing
   * either one open left the suite green.
   */
  describe("MODAL content routing", () => {
    function modalWith(content: string) {
      return { type: "MODAL", title: "Routing", content, buttons: [] } as any;
    }

    it("renders content carrying colour codes through MinecraftText", () => {
      const { container } = wrap(<BedrockPreview form={modalWith("&cDanger")} />);
      expect(screen.getByText("Danger")).toHaveStyle({ color: "#FF5555" });
      // ReactMarkdown would have wrapped the text in a paragraph; MinecraftText emits spans.
      expect(container.querySelector("p")).toBeNull();
    });

    it("renders content with no colour codes as markdown", () => {
      const { container } = wrap(<BedrockPreview form={modalWith("**bold** and _italic_")} />);
      expect(container.querySelector("strong")).toHaveTextContent("bold");
      expect(container.querySelector("em")).toHaveTextContent("italic");
      // MinecraftText would have left the asterisks and underscores on screen.
      expect(screen.queryByText("**bold** and _italic_")).toBeNull();
    });
  });
});

/**
 * Request: reorder buttons by dragging them in the preview itself.
 *
 * The reorder is resolved by DndHost from dnd-kit ids, so the only thing that can silently
 * break the feature is the preview registering ids that DndHost does not recognise. These
 * tests read the ids straight out of the live DndContext registry and compare them against
 * literals — the same literals `computeReorderResult` is tested against in dnd-host.spec.ts.
 */
describe("BedrockPreview reordering", () => {
  let registered: string[] = [];
  let sortOrder: string[] = [];

  function DraggableIdProbe() {
    const { draggableNodes } = useDndContext();
    registered = Array.from(draggableNodes.keys(), String);
    // What SortableContext was handed as `items` — the order the strategy shifts rows in.
    const first = draggableNodes.values().next().value;
    sortOrder = (first?.data.current as any)?.sortable?.items?.map(String) ?? [];
    return null;
  }

  function wrapWithProbe(ui: React.ReactElement) {
    registered = [];
    sortOrder = [];
    return render(
      <DndContext>
        {ui}
        <DraggableIdProbe />
      </DndContext>
    );
  }

  it("registers one draggable per SIMPLE button, named the way DndHost reorders them", () => {
    const form: any = {
      type: "SIMPLE",
      title: "Menu",
      content: "",
      buttons: [
        { id: "button_1", text: "One" },
        { id: "button_2", text: "Two" },
        { id: "button_3", text: "Three" }
      ]
    };
    wrapWithProbe(<BedrockPreview form={form} />);
    expect(registered).toEqual([
      "bedrock-preview-button-button_1",
      "bedrock-preview-button-button_2",
      "bedrock-preview-button-button_3"
    ]);
  });

  it("registers one draggable per CUSTOM component", () => {
    const form: any = {
      type: "CUSTOM",
      title: "Menu",
      components: [
        { id: "component_1", type: "input", props: {} },
        { id: "component_2", type: "toggle", props: {} }
      ]
    };
    wrapWithProbe(<BedrockPreview form={form} />);
    expect(registered).toEqual([
      "bedrock-preview-component-component_1",
      "bedrock-preview-component-component_2"
    ]);
  });

  it("does not register a draggable for a button hidden by its show_condition", () => {
    // A row that is not on screen must not be in the sort order either, or dropping onto
    // index 1 would land somewhere the user cannot see.
    const form: any = {
      type: "SIMPLE",
      title: "Menu",
      content: "",
      buttons: [
        { id: "shown", text: "Shown" },
        { id: "gated", text: "Gated", showCondition: "permission:some.perm" }
      ]
    };
    wrapWithProbe(<BedrockPreview form={form} />);
    expect(registered).toEqual(["bedrock-preview-button-shown"]);
    // And the sort order SortableContext works from holds the same single row: a list that
    // still counted the hidden one would shift the visible rows by the wrong index.
    expect(sortOrder).toEqual(["bedrock-preview-button-shown"]);
  });

  it("gives each SIMPLE row a grab handle that is invisible until hover or focus", () => {
    const form: any = {
      type: "SIMPLE",
      title: "Menu",
      content: "",
      buttons: [{ id: "button_1", text: "One" }]
    };
    const { container } = wrap(<BedrockPreview form={form} />);
    const handle = container.querySelector('[aria-label="Reorder button_1"]')!;
    expect(handle).toHaveAttribute("aria-roledescription", "sortable");
    // Resting state is a plain Bedrock button: the affordance only appears on hover/focus.
    expect(handle.className).toContain("opacity-0");
    expect(handle.className).toContain("group-hover:opacity-100");
  });

  it("keeps the drag handle out of the button, so clicking the row still selects it", () => {
    const form: any = {
      type: "SIMPLE",
      title: "Menu",
      content: "",
      buttons: [{ id: "button_1", text: "One" }]
    };
    const { container } = wrap(<BedrockPreview form={form} />);
    const handle = container.querySelector('[aria-label="Reorder button_1"]')!;
    expect(handle.closest("button")).toBeNull();
  });

  it("puts no drag handle on MODAL buttons, which DndHost refuses to reorder", () => {
    const form: any = {
      type: "MODAL",
      title: "Confirm",
      content: "Sure?",
      buttons: [
        { id: "yes", text: "Yes" },
        { id: "no", text: "No" }
      ]
    };
    wrapWithProbe(<BedrockPreview form={form} />);
    expect(registered).toEqual([]);
  });
});

/**
 * The "Detailed Mode" checkbox is gone; the id captions it used to gate are now always on.
 */
describe("BedrockPreview id captions", () => {
  it("captions every SIMPLE row with its button id, with no checkbox to turn on", () => {
    const form: any = {
      type: "SIMPLE",
      title: "Menu",
      content: "",
      buttons: [{ id: "button_1", text: "One" }]
    };
    wrap(<BedrockPreview form={form} />);
    expect(screen.getByText("button_1")).toBeInTheDocument();
  });

  it("captions every CUSTOM row with its id and type", () => {
    const form: any = {
      type: "CUSTOM",
      title: "Menu",
      components: [{ id: "component_1", type: "slider", props: {} }]
    };
    wrap(<BedrockPreview form={form} />);
    expect(screen.getByText("component_1 (slider)")).toBeInTheDocument();
  });

  it("captions MODAL buttons without polluting the button's own text", () => {
    const form: any = {
      type: "MODAL",
      title: "Confirm",
      content: "Sure?",
      buttons: [{ id: "yes", text: "Yes" }]
    };
    wrap(<BedrockPreview form={form} />);
    expect(screen.getByText("yes")).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["✕", "Yes"]);
  });
});
