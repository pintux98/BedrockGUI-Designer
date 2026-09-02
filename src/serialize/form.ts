import * as yaml from "js-yaml";
import { FormDoc } from "../core/project";
import { ActionInstance, BedrockButton, BedrockComponent } from "../core/types";
import { BUTTON_KEYS, COMPONENT_KEYS, CONDITION_KEYS, FORM_KEYS } from "../plugin/keys";
import { applyBlockScalars } from "./blockScalar";

export function serializeFormDocument(doc: FormDoc): string {
  const form = doc.bedrock;
  const bedrock: Record<string, unknown> = {};

  if (form.command) bedrock[FORM_KEYS.command] = form.command;
  if (form.commandIntercept) bedrock[FORM_KEYS.commandIntercept] = form.commandIntercept;
  if (form.permission) bedrock[FORM_KEYS.permission] = form.permission;
  bedrock[FORM_KEYS.type] = form.type;
  bedrock[FORM_KEYS.title] = form.title;

  const content = form.content;
  const hasContent = Array.isArray(content) ? content.length > 0 : Boolean(content);
  if (hasContent) bedrock[FORM_KEYS.content] = content;

  if (form.type === "CUSTOM") {
    bedrock[FORM_KEYS.components] = componentsToMap(form.components ?? []);
  } else {
    bedrock[FORM_KEYS.buttons] = buttonsToMap(form.buttons ?? []);
  }

  const globalActions = actionsToList(form.globalActions);
  if (globalActions) bedrock[FORM_KEYS.globalActions] = globalActions;

  const document: Record<string, unknown> = { bedrock };
  if (doc.javaRaw !== undefined) document.java = doc.javaRaw;

  return applyBlockScalars(
    yaml.dump(document, { lineWidth: -1, noRefs: true, forceQuotes: true, quoteStyle: "double" })
  );
}

function buttonsToMap(buttons: BedrockButton[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const b of buttons) {
    const entry: Record<string, unknown> = { [BUTTON_KEYS.text]: b.text };
    if (b.image) entry[BUTTON_KEYS.image] = b.image;
    const onClick = actionsToList(b.onClick);
    if (onClick) entry[BUTTON_KEYS.onClick] = onClick;
    if (b.showCondition) entry[BUTTON_KEYS.showCondition] = b.showCondition;
    if (b.alternativeText) entry[BUTTON_KEYS.alternativeText] = b.alternativeText;
    if (b.alternativeImage) entry[BUTTON_KEYS.alternativeImage] = b.alternativeImage;
    if (b.alternativeOnClick) entry[BUTTON_KEYS.alternativeOnClick] = b.alternativeOnClick;
    if (b.conditions?.length) {
      entry[BUTTON_KEYS.conditions] = Object.fromEntries(
        b.conditions.map((c) => [
          c.id,
          {
            [CONDITION_KEYS.condition]: c.condition,
            [CONDITION_KEYS.property]: c.property,
            [CONDITION_KEYS.value]: c.value
          }
        ])
      );
    }
    out[b.id] = entry;
  }
  return out;
}

function componentsToMap(components: BedrockComponent[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of components) {
    const entry: Record<string, unknown> = { [COMPONENT_KEYS.type]: c.type, ...c.props };
    const action = actionsToList(c.action);
    if (action) entry[COMPONENT_KEYS.action] = action.length === 1 ? action[0] : action;
    out[c.id] = entry;
  }
  return out;
}

function actionsToList(actions?: ActionInstance[]): string[] | undefined {
  if (!actions?.length) return undefined;
  const list = actions
    .map((a) =>
      typeof a.raw === "string" && a.raw.trim()
        ? a.raw.trim()
        : typeof a.params === "string"
          ? a.params.trim()
          : ""
    )
    .filter(Boolean);
  return list.length ? list : undefined;
}
