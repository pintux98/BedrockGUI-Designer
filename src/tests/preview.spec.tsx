import React from "react";
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BedrockPreview } from "../canvas/previews/BedrockPreview";
import { DndContext } from "@dnd-kit/core";

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
