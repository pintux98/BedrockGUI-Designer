import { PlatformTarget, PLUGIN_TARGET } from "../plugin";
import { BedrockForm } from "./types";

export interface AssetsConfig {
  enabled: boolean;
  port: number;
  host: string;
}

export interface FormDoc {
  id: string;
  fileName: string;
  bedrock: BedrockForm;
  javaRaw?: unknown;
}

export interface Project {
  pluginTarget: typeof PLUGIN_TARGET;
  configVersion: 1;
  assets: AssetsConfig;
  platformTarget: PlatformTarget;
  forms: FormDoc[];
  activeFormId: string;
}

export function createForm(id: string): FormDoc {
  return {
    id,
    fileName: `${id}.yml`,
    bedrock: {
      type: "SIMPLE",
      title: "New Form",
      content: "",
      buttons: [{ id: "button_1", text: "Click me" }]
    }
  };
}

export function createEmptyProject(): Project {
  const form = createForm("main_menu");
  return {
    pluginTarget: PLUGIN_TARGET,
    configVersion: 1,
    assets: { enabled: false, port: 0, host: "" },
    platformTarget: "paper",
    forms: [form],
    activeFormId: form.id
  };
}

export function findForm(project: Project, id: string): FormDoc | undefined {
  return project.forms.find((f) => f.id === id);
}
