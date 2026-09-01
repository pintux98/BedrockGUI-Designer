import yaml from "js-yaml";
import { FormDoc } from "../core/project";
import { ActionInstance, BedrockButton, BedrockComponent } from "../core/types";
import { applyBlockScalars } from "./blockScalar";

export function serializeFormDocument(doc: FormDoc): string {
  const form = doc.bedrock;
  const bedrock: Record<string, unknown> = {};

  if (form.command) bedrock.command = form.command;
  if (form.commandIntercept) bedrock.command_intercept = form.commandIntercept;
  if (form.permission) bedrock.permission = form.permission;
  bedrock.type = form.type;
  bedrock.title = form.title;

  const content = form.content;
  const hasContent = Array.isArray(content) ? content.length > 0 : Boolean(content);
  if (hasContent) bedrock.content = content;

  if (form.type === "CUSTOM") {
    bedrock.components = componentsToMap(form.components ?? []);
  } else {
    bedrock.buttons = buttonsToMap(form.buttons ?? []);
  }

  const globalActions = actionsToList(form.globalActions);
  if (globalActions) bedrock.global_actions = globalActions;

  const document: Record<string, unknown> = { bedrock };
  if (doc.javaRaw !== undefined) document.java = doc.javaRaw;

  return applyBlockScalars(
    yaml.dump(document, { lineWidth: -1, noRefs: true, forceQuotes: true, quotingType: '"' })
  );
}

function buttonsToMap(buttons: BedrockButton[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const b of buttons) {
    const entry: Record<string, unknown> = { text: b.text };
    if (b.image) entry.image = b.image;
    const onClick = actionsToList(b.onClick);
    if (onClick) entry.onClick = onClick;
    if (b.showCondition) entry.show_condition = b.showCondition;
    if (b.alternativeText) entry.alternative_text = b.alternativeText;
    if (b.alternativeImage) entry.alternative_image = b.alternativeImage;
    if (b.alternativeOnClick) entry.alternative_onClick = b.alternativeOnClick;
    if (b.conditions?.length) {
      entry.conditions = Object.fromEntries(
        b.conditions.map((c) => [c.id, { condition: c.condition, property: c.property, value: c.value }])
      );
    }
    out[b.id] = entry;
  }
  return out;
}

function componentsToMap(components: BedrockComponent[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of components) {
    const entry: Record<string, unknown> = { type: c.type, ...c.props };
    const action = actionsToList(c.action);
    if (action) entry.action = action.length === 1 ? action[0] : action;
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
