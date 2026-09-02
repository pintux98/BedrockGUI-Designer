import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { zipSync, strToU8 } from "fflate";
import { useDesignerStore } from "../store";
import { useImporter } from "../importers/useImporter";
import { useToastStore } from "../core/toast";
import { createEmptyProject, createForm } from "../core/project";
import { serializeFormDocument } from "../serialize/form";
import { serializeConfigDocument } from "../serialize/config";
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

describe("useImporter ZIP handling", () => {
  beforeEach(() => {
    useDesignerStore.getState().loadProject(twoFormProject());
    useToastStore.setState({ toasts: [] });
  });

  it("replaces the whole project with the ZIP's forms rather than merging into the current one", async () => {
    const files = {
      "forms/x.yml": strToU8(serializeFormDocument(createForm("x"))),
      "forms/y.yml": strToU8(serializeFormDocument(createForm("y")))
    };
    const file = new File([zipSync(files)], "bundle.zip");

    const { result } = renderHook(() => useImporter());
    await act(async () => {
      await result.current.importYaml(file);
    });

    const state = useDesignerStore.getState();
    expect(state.project.forms.map((f) => f.id)).toEqual(["x", "y"]);
    expect(state.project.forms.find((f) => f.id === "shop")).toBeUndefined();
  });

  it("resolves an id from the config.yml registry key, not the file name, and reports the missing config.yml note when absent", async () => {
    const project = createEmptyProject();
    const shop = createForm("shop");
    shop.fileName = "store.yml";
    project.forms.push(shop);
    const files = {
      "config.yml": strToU8(serializeConfigDocument(project)),
      "forms/main_menu.yml": strToU8(serializeFormDocument(project.forms[0])),
      "forms/store.yml": strToU8(serializeFormDocument(shop))
    };
    const file = new File([zipSync(files)], "bundle.zip");

    const { result } = renderHook(() => useImporter());
    await act(async () => {
      await result.current.importYaml(file);
    });

    const state = useDesignerStore.getState();
    const imported = state.project.forms.find((f) => f.fileName === "store.yml");
    expect(imported?.id).toBe("shop");
  });

  it("reports a config.yml-registered form whose file is missing from the archive as a toast, and imports the rest anyway", async () => {
    const project = createEmptyProject();
    project.forms.push(createForm("shop"));
    const files: Record<string, Uint8Array> = {
      "config.yml": strToU8(serializeConfigDocument(project)),
      "forms/main_menu.yml": strToU8(serializeFormDocument(project.forms[0])),
      "forms/shop.yml": strToU8(serializeFormDocument(project.forms[1]))
    };
    delete files["forms/shop.yml"];
    const file = new File([zipSync(files)], "bundle.zip");

    const { result } = renderHook(() => useImporter());
    await act(async () => {
      await result.current.importYaml(file);
    });

    const state = useDesignerStore.getState();
    expect(state.project.forms.map((f) => f.id)).toEqual(["main_menu"]);

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.variant === "info" && t.message.includes("shop.yml"))).toBe(true);
  });
});

describe("useImporter malformed input handling", () => {
  beforeEach(() => {
    useDesignerStore.getState().loadProject(twoFormProject());
    useToastStore.setState({ toasts: [] });
  });

  it("shows an error toast naming the file and leaves the store unchanged when a single .yml is malformed", async () => {
    const file = new File(["foo: [1, 2"], "broken.yml", { type: "text/yaml" });

    const { result } = renderHook(() => useImporter());
    await act(async () => {
      await result.current.importYaml(file);
    });

    const state = useDesignerStore.getState();
    expect(state.project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.variant === "error" && t.message.includes("broken.yml"))).toBe(true);
  });

  it("reports a malformed form file inside a ZIP as a note and still imports the rest", async () => {
    const files: Record<string, Uint8Array> = {
      "forms/good.yml": strToU8(serializeFormDocument(createForm("good"))),
      "forms/bad.yml": strToU8("foo: [1, 2")
    };
    const file = new File([zipSync(files)], "bundle.zip");

    const { result } = renderHook(() => useImporter());
    await act(async () => {
      await result.current.importYaml(file);
    });

    const state = useDesignerStore.getState();
    expect(state.project.forms.map((f) => f.id)).toEqual(["good"]);

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.variant === "info" && t.message.includes("bad.yml"))).toBe(true);
  });

  it("shows an error toast and leaves the store unchanged when the imported project fails validation", async () => {
    const yamlText = [
      "bedrock:",
      "  type: CUSTOM",
      "  title: Broken",
      "  components:",
      "    field1:",
      "      type: not_a_real_type",
      ""
    ].join("\n");
    const file = new File([yamlText], "broken_custom.yml", { type: "text/yaml" });

    const { result } = renderHook(() => useImporter());
    await act(async () => {
      await result.current.importYaml(file);
    });

    const state = useDesignerStore.getState();
    expect(state.project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);

    const toasts = useToastStore.getState().toasts;
    expect(
      toasts.some((t) => t.variant === "error" && t.message.includes("Could not import"))
    ).toBe(true);
  });
});

describe("useImporter legacy multi-form config", () => {
  beforeEach(() => {
    useDesignerStore.getState().loadProject(twoFormProject());
    useToastStore.setState({ toasts: [] });
  });

  it("sets assets even when the legacy config also has inline forms to import (closes the handoff item)", async () => {
    const yamlText = [
      "config-version: 1",
      "assets:",
      "  enabled: true",
      "  port: 9000",
      "  host: mc.test",
      "forms:",
      "  warp_menu:",
      "    type: SIMPLE",
      "    title: Warp Title",
      "    buttons:",
      "      button_1:",
      "        text: Warp Button",
      ""
    ].join("\n");
    const file = new File([yamlText], "config.yml", { type: "text/yaml" });

    const { result } = renderHook(() => useImporter());
    await act(async () => {
      await result.current.importYaml(file);
    });

    const state = useDesignerStore.getState();
    expect(state.project.assets).toEqual({ enabled: true, port: 9000, host: "mc.test" });
    expect(state.project.forms.some((f) => f.id === "warp_menu")).toBe(true);
    expect(state.project.forms.some((f) => f.id === "shop")).toBe(true);
  });
});
