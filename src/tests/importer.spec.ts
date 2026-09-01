import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDesignerStore } from "../store";
import { useImporter } from "../importers/useImporter";
import { useToastStore } from "../core/toast";
import type { Project } from "../core/project";

function twoFormProject(): Project {
  return {
    pluginTarget: "2.0.11" as any,
    configVersion: 1,
    assets: { enabled: false, port: 0, host: "" },
    platformTarget: "paper",
    activeFormId: "main_menu",
    forms: [
      {
        id: "main_menu",
        fileName: "main_menu.yml",
        bedrock: {
          type: "SIMPLE",
          title: "Main Menu Title",
          content: "",
          buttons: [{ id: "button_1", text: "Click me" }]
        }
      },
      {
        id: "shop",
        fileName: "shop.yml",
        bedrock: {
          type: "SIMPLE",
          title: "Shop Title",
          content: "",
          buttons: [{ id: "button_1", text: "Buy" }]
        }
      }
    ]
  };
}

describe("useImporter name-collision handling", () => {
  beforeEach(() => {
    useDesignerStore.getState().loadProject(twoFormProject());
    useToastStore.setState({ toasts: [] });
  });

  it("refuses the import and leaves both forms untouched when the imported name clashes with a different existing form", async () => {
    const yamlText = [
      "forms:",
      "  shop:",
      "    bedrock:",
      "      type: SIMPLE",
      "      title: Imported Title",
      "      buttons:",
      "        button_1:",
      "          text: Imported Button",
      ""
    ].join("\n");
    const file = new File([yamlText], "shop.yml", { type: "text/yaml" });

    const { result } = renderHook(() => useImporter());
    await act(async () => {
      await result.current.importYaml(file);
    });

    const state = useDesignerStore.getState();
    expect(state.project.activeFormId).toBe("main_menu");

    const mainMenu = state.project.forms.find((f) => f.id === "main_menu")!;
    expect(mainMenu.bedrock.title).toBe("Main Menu Title");
    expect((mainMenu.bedrock as any).buttons[0].text).toBe("Click me");

    const shop = state.project.forms.find((f) => f.id === "shop")!;
    expect(shop.bedrock.title).toBe("Shop Title");
    expect((shop.bedrock as any).buttons[0].text).toBe("Buy");

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.variant === "error" && t.message.includes('"shop"'))).toBe(true);
  });

  it("still imports onto the active form when the imported name does not clash", async () => {
    const yamlText = [
      "forms:",
      "  warp_menu:",
      "    bedrock:",
      "      type: SIMPLE",
      "      title: Warp Title",
      "      buttons:",
      "        button_1:",
      "          text: Warp Button",
      ""
    ].join("\n");
    const file = new File([yamlText], "warp_menu.yml", { type: "text/yaml" });

    const { result } = renderHook(() => useImporter());
    await act(async () => {
      await result.current.importYaml(file);
    });

    const state = useDesignerStore.getState();
    expect(state.project.activeFormId).toBe("warp_menu");
    const active = state.activeForm();
    expect(active.bedrock.title).toBe("Warp Title");
    expect((active.bedrock as any).buttons[0].text).toBe("Warp Button");

    const shop = state.project.forms.find((f) => f.id === "shop")!;
    expect(shop.bedrock.title).toBe("Shop Title");
  });
});
