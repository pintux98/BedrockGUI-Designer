import yaml from "js-yaml";
import {
  ActionInstance,
  BedrockButton,
  BedrockButtonConditionRule,
  BedrockComponent,
  BedrockComponentType,
  BedrockForm
} from "../core/types";
import { FormDoc } from "../core/project";

export function parseFormDocument(text: string, id: string): FormDoc {
  const doc = (yaml.load(text) ?? {}) as Record<string, any>;
  const bedrock = (doc.bedrock ?? doc) as Record<string, any>;
  const type = String(bedrock.type ?? "SIMPLE").toUpperCase();

  const base = {
    title: String(bedrock.title ?? "Unknown"),
    content: readContent(bedrock),
    command: str(bedrock.command),
    commandIntercept: str(bedrock.command_intercept),
    permission: str(bedrock.permission),
    globalActions: readActions(bedrock.global_actions)
  };

  const form: BedrockForm =
    type === "CUSTOM"
      ? { ...base, type: "CUSTOM", components: readComponents(bedrock.components) }
      : { ...base, type: type === "MODAL" ? "MODAL" : "SIMPLE", buttons: readButtons(bedrock.buttons) };

  const result: FormDoc = { id, fileName: `${id}.yml`, bedrock: form };
  if (doc.java !== undefined) result.javaRaw = doc.java;
  return result;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readContent(bedrock: Record<string, any>): string | string[] | undefined {
  const content = bedrock.content ?? bedrock.description;
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
    const button: BedrockButton = { id, text: String(b?.text ?? "") };
    if (str(b?.image)) button.image = b.image;
    const onClick = readActions(b?.onClick);
    if (onClick) button.onClick = onClick;
    if (str(b?.show_condition)) button.showCondition = b.show_condition;
    if (str(b?.alternative_text)) button.alternativeText = b.alternative_text;
    if (str(b?.alternative_image)) button.alternativeImage = b.alternative_image;
    if (str(b?.alternative_onClick)) button.alternativeOnClick = b.alternative_onClick;
    const conditions = readConditions(b?.conditions);
    if (conditions) button.conditions = conditions;
    return button;
  });
}

function readConditions(value: unknown): BedrockButtonConditionRule[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rules = Object.entries(value as Record<string, any>).map(([id, c]) => ({
    id,
    condition: String(c?.condition ?? ""),
    property: (c?.property ?? "text") as BedrockButtonConditionRule["property"],
    value: String(c?.value ?? "")
  }));
  return rules.length ? rules : undefined;
}

function readComponents(value: unknown): BedrockComponent[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, any>).map(([id, raw]) => {
    const { type, action, ...props } = (raw ?? {}) as Record<string, any>;
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
