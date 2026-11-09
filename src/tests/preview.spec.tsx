import React from "react";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BedrockPreview } from "../canvas/previews/BedrockPreview";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";

beforeEach(() => useDesignerStore.getState().loadProject(createEmptyProject()));
afterEach(() => cleanup());

function wrap(ui: React.ReactElement) {
  return render(ui);
}

describe("Preview Components", () => {
  describe("BedrockPreview", () => {
    it("renders a CUSTOM form with no fields as an invitation to add one, plus the Submit button", () => {
      const form: any = { type: "CUSTOM", title: "Custom Form", components: [] };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Custom Form")).toBeInTheDocument();
      expect(screen.getByText(/No fields yet/)).toBeInTheDocument();
      expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    it("renders a SIMPLE form with undefined buttons as a shell with no rows", () => {
      const form: any = { type: "SIMPLE", title: "Simple Form", buttons: undefined };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Simple Form")).toBeInTheDocument();
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("renders MODAL content and exactly the buttons it was given", () => {
      const form: any = { type: "MODAL", title: "Modal Form", content: "Are you sure?", buttons: [{ id: "yes", text: "Yes" }] };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Yes"]);
    });

    it("renders Minecraft color codes in title and button text", () => {
      const form: any = { type: "SIMPLE", title: "&aGreen Title", content: "", buttons: [{ id: "b1", text: "&#ff00ffPink" }] };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Green Title")).toHaveStyle({ color: "#55FF55" });
      expect(screen.getByText("Pink")).toHaveStyle({ color: "#FF00FF" });
    });

    it("draws Minecraft's drop shadow, a quarter of the colour, under coloured text", () => {
      const form: any = { type: "SIMPLE", title: "&eYellow", content: "", buttons: [] };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Yellow").style.textShadow).toContain("rgb(63, 63, 21)");
    });

    it("shows content literally, because Bedrock renders no Markdown", () => {
      const form: any = { type: "MODAL", title: "T", content: "**not bold**", buttons: [] };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("**not bold**")).toBeInTheDocument();
    });

    it("selects a button in the store when it is clicked", () => {
      const form: any = { type: "SIMPLE", title: "T", buttons: [{ id: "b1", text: "One" }, { id: "b2", text: "Two" }] };
      wrap(<BedrockPreview form={form} />);
      fireEvent.click(screen.getByRole("button", { name: "Select button b2" }));
      expect(useDesignerStore.getState().selectedBedrockButtonId).toBe("b2");
      expect(useDesignerStore.getState().selectedBedrockComponentId).toBeNull();
    });

    it("marks a button hidden by its show_condition when conditions are not met", () => {
      const form: any = { type: "SIMPLE", title: "T", buttons: [{ id: "b1", text: "Admin", showCondition: "permission:x" }] };
      wrap(<BedrockPreview form={form} conditionsMet={false} />);
      expect(screen.getByRole("button", { name: "Select button b1" })).toHaveTextContent("hidden");
    });

    it("shows a button's alternative text when conditions are not met", () => {
      const form: any = {
        type: "SIMPLE",
        title: "T",
        buttons: [{ id: "b1", text: "Admin", showCondition: "permission:x", alternativeText: "Locked" }]
      };
      wrap(<BedrockPreview form={form} conditionsMet={false} />);
      expect(screen.getByText("Locked")).toBeInTheDocument();
    });

    it("renders 2.0.12 fields: label, online player dropdown and step slider", () => {
      const form: any = {
        type: "CUSTOM",
        title: "Pay",
        components: [
          { id: "info", type: "label", props: { text: "Send money" } },
          { id: "target", type: "dropdown", props: { text: "Player", options: "{online_players}" } },
          { id: "amount", type: "step_slider", props: { text: "Amount", steps: ["10", "50", "100"], default: 1 } }
        ]
      };
      wrap(<BedrockPreview form={form} />);
      expect(screen.getByText("Send money")).toBeInTheDocument();
      expect(screen.getByText("Steve")).toBeInTheDocument();
      expect(screen.getByText("50")).toBeInTheDocument();
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
});
