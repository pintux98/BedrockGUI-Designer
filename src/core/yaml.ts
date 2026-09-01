import yaml from "js-yaml";
import { BedrockForm } from "./types";
import { ActionInstance } from "./types";

export function stateToYaml(form: BedrockForm): string {
  const entry = stateToFormEntry(form);
  return postprocessMultilineStrings(
    yaml.dump(
      { ...entry, configVersion: "1.0.0" },
      { lineWidth: -1, noRefs: true, forceQuotes: true, quotingType: "\"" }
    )
  );
}

export function stateToSnippetYaml(form: BedrockForm): string {
  return postprocessMultilineStrings(
    yaml.dump(stateToFormEntry(form), { lineWidth: -1, noRefs: true, forceQuotes: true, quotingType: "\"" })
  );
}

export function stateToFormEntry(form: BedrockForm): Record<string, unknown> {
  const entry: Record<string, unknown> = {};

  if (form) {
    const bedrock: Record<string, any> = {};
    if (form.command) bedrock["command"] = form.command;
    if (form.commandIntercept) bedrock["command_intercept"] = form.commandIntercept;
    if (form.permission) bedrock["permission"] = form.permission;
    bedrock["type"] = form.type;
    bedrock["title"] = form.title;
    if ("content" in form && form.content) {
      bedrock["description"] = form.content;
    }
    if (form.type !== "CUSTOM") {
      const buttons: Record<string, any> = {};
      for (const b of form.buttons ?? []) {
        const buttonData: Record<string, any> = {
          text: b.text,
          image: b.image,
          onClick: serializeActionBlocks(b.onClick),
          show_condition: b.showCondition,
          alternative_text: b.alternativeText,
          alternative_image: b.alternativeImage,
          alternative_onClick: b.alternativeOnClick,
        };
        if (b.conditions?.length) {
          buttonData.conditions = Object.fromEntries(
            b.conditions.map((c) => [
              c.id,
              stripUndefined({
                condition: c.condition,
                property: c.property,
                value: c.value
              })
            ])
          );
        }
        buttons[b.id] = stripUndefined(buttonData);
      }
      bedrock["buttons"] = buttons;
    } else {
      bedrock["components"] = Object.fromEntries(
        (form.components ?? []).map((c) => [
          c.id,
          stripUndefined({
            type: c.type,
            ...c.props,
            action: serializeActionBlocks(c.action)
          })
        ])
      );
    }
    if (form.globalActions?.length) {
      bedrock["global_actions"] = serializeActionBlocks(form.globalActions);
    }
    entry["bedrock"] = stripUndefined(bedrock);
  }

  return stripUndefined(entry);
}

export function yamlToStateDoc(text: string): { menuName: string; entry: any; configVersion?: string } {
  const doc = yaml.load(text) as any;
  const forms = doc?.forms ?? {};
  const key = Object.keys(forms)[0];
  if (key) return { menuName: key, entry: forms[key], configVersion: doc?.configVersion };
  if (doc?.bedrock) {
    return { menuName: "example", entry: doc, configVersion: doc?.configVersion };
  }
  throw new Error("No forms.<menu_name> found");
}

export function deserializeActions(onClick: any): ActionInstance[] | undefined {
  if (typeof onClick === "string" && onClick.trim()) {
    return [{ id: "raw", params: onClick.trim(), raw: onClick.trim() } as ActionInstance];
  }
  if (!Array.isArray(onClick) || !onClick.length) return undefined;
  return onClick
    .map((v) => {
      if (typeof v !== "string") return null;
      const raw = v.trim();
      if (!raw) return null;
      return { id: "raw", params: raw, raw } as ActionInstance;
    })
    .filter(Boolean) as ActionInstance[];
}

function serializeActionBlocks(actions?: ActionInstance[]) {
  if (!actions?.length) return undefined;
  return actions
    .map((a) => {
      if (typeof a.raw === "string" && a.raw.trim()) return a.raw.trim();
      if (typeof a.params === "string" && a.params.trim()) return a.params.trim();
    })
    .filter(Boolean);
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = stripUndefined(v as any);
    else out[k] = v;
  }
  return out;
}

function postprocessMultilineStrings(text: string) {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const listItem = line.match(/^(\s*-\s*)"((?:\\.|[^"\\])*)"\s*$/);
    if (listItem) {
      const prefix = listItem[1];
      const inner = listItem[2];
      if (!inner.includes("\\n")) {
        out.push(line);
        continue;
      }

      const indent = prefix.match(/^\s*/)?.[0] ?? "";
      const decoded = unescapeDoubleQuoted(inner);
      out.push(`${indent}- |-`);
      for (const contentLine of decoded.split("\n")) {
        out.push(`${indent}  ${contentLine}`);
      }
      continue;
    }

    const mappingValue = line.match(/^(\s*[^:\n][^:\n]*:\s*)"((?:\\.|[^"\\])*)"\s*$/);
    if (mappingValue) {
      const prefix = mappingValue[1];
      const inner = mappingValue[2];
      if (!inner.includes("\\n")) {
        out.push(line);
        continue;
      }

      const indent = prefix.match(/^\s*/)?.[0] ?? "";
      const decoded = unescapeDoubleQuoted(inner);
      out.push(`${prefix}|-`);
      for (const contentLine of decoded.split("\n")) {
        out.push(`${indent}  ${contentLine}`);
      }
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

function unescapeDoubleQuoted(s: string) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = s[i + 1];
    if (next === undefined) {
      out += "\\";
      continue;
    }
    i++;
    if (next === "n") out += "\n";
    else if (next === "\"") out += "\"";
    else if (next === "\\") out += "\\";
    else out += `\\${next}`;
  }
  return out;
}
