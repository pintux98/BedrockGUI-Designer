import * as yaml from "js-yaml";
import {
  ActionInstance,
  BedrockButton,
  BedrockButtonConditionRule,
  BedrockComponent,
  BedrockComponentType,
  BedrockForm
} from "../core/types";
import { FormDoc } from "../core/project";
import { BUTTON_KEYS, COMPONENT_KEYS, CONDITION_KEYS, FORM_KEYS } from "../plugin/keys";

export function parseFormDocument(text: string, id: string): FormDoc {
  const doc = (yaml.load(text) ?? {}) as Record<string, any>;
  const bedrock = (doc.bedrock ?? doc) as Record<string, any>;
  const type = String(bedrock[FORM_KEYS.type] ?? "SIMPLE").toUpperCase();

  const base = {
    title: String(bedrock[FORM_KEYS.title] ?? "Unknown"),
    content: readContent(bedrock),
    command: str(bedrock[FORM_KEYS.command]),
    commandIntercept: str(bedrock[FORM_KEYS.commandIntercept]),
    permission: str(bedrock[FORM_KEYS.permission]),
    globalActions: readActions(bedrock[FORM_KEYS.globalActions])
  };

  const form: BedrockForm =
    type === "CUSTOM"
      ? { ...base, type: "CUSTOM", components: readComponents(bedrock[FORM_KEYS.components]) }
      : {
          ...base,
          type: type === "MODAL" ? "MODAL" : "SIMPLE",
          buttons: readButtons(bedrock[FORM_KEYS.buttons])
        };

  const result: FormDoc = { id, fileName: `${id}.yml`, bedrock: form };
  if (doc.java !== undefined) result.javaRaw = doc.java;
  return result;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readContent(bedrock: Record<string, any>): string | string[] | undefined {
  const content = bedrock[FORM_KEYS.content] ?? bedrock[FORM_KEYS.description];
  if (Array.isArray(content)) return content.map(String);
  return typeof content === "string" ? content : undefined;
}

function readActions(value: unknown): ActionInstance[] | undefined {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const actions = list
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((raw) => ({ id: "raw", params: raw.trim(), raw: raw.trim() }) as ActionInstance);
  return actions.length ? actions : undefined;
}

function readButtons(value: unknown): BedrockButton[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, any>).map(([id, b]) => {
    const button: BedrockButton = { id, text: String(b?.[BUTTON_KEYS.text] ?? "") };
    if (str(b?.[BUTTON_KEYS.image])) button.image = b[BUTTON_KEYS.image];
    const onClick = readActions(b?.[BUTTON_KEYS.onClick]);
    if (onClick) button.onClick = onClick;
    if (str(b?.[BUTTON_KEYS.showCondition])) button.showCondition = b[BUTTON_KEYS.showCondition];
    if (str(b?.[BUTTON_KEYS.alternativeText])) button.alternativeText = b[BUTTON_KEYS.alternativeText];
    if (str(b?.[BUTTON_KEYS.alternativeImage])) button.alternativeImage = b[BUTTON_KEYS.alternativeImage];
    if (str(b?.[BUTTON_KEYS.alternativeOnClick]))
      button.alternativeOnClick = b[BUTTON_KEYS.alternativeOnClick];
    const conditions = readConditions(b?.[BUTTON_KEYS.conditions]);
    if (conditions) button.conditions = conditions;
    return button;
  });
}

function readConditions(value: unknown): BedrockButtonConditionRule[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rules = Object.entries(value as Record<string, any>).map(([id, c]) => ({
    id,
    condition: String(c?.[CONDITION_KEYS.condition] ?? ""),
    property: (c?.[CONDITION_KEYS.property] ?? "text") as BedrockButtonConditionRule["property"],
    value: String(c?.[CONDITION_KEYS.value] ?? "")
  }));
  return rules.length ? rules : undefined;
}

function readComponents(value: unknown): BedrockComponent[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, any>).map(([id, raw]) => {
    const {
      [COMPONENT_KEYS.type]: type,
      [COMPONENT_KEYS.action]: action,
      ...props
    } = (raw ?? {}) as Record<string, any>;
    const component: BedrockComponent = {
      id,
      type: String(type ?? "input").toLowerCase() as BedrockComponentType,
      props
    };
    const parsed = readActions(action);
    if (parsed) component.action = parsed;
    return component;
  });
}
