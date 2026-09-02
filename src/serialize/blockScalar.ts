import * as yaml from "js-yaml";

export function applyBlockScalars(text: string) {
  return postprocessMultilineStrings(text);
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
      if (decoded === undefined || isUnsafeForLiteralBlock(decoded)) {
        out.push(line);
        continue;
      }
      const { indicator, body } = chomp(decoded);
      out.push(`${indent}- ${indicator}`);
      pushBody(out, indent, body);
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
      if (decoded === undefined || isUnsafeForLiteralBlock(decoded)) {
        out.push(line);
        continue;
      }
      const { indicator, body } = chomp(decoded);
      out.push(`${prefix}${indicator}`);
      pushBody(out, indent, body);
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

function pushBody(out: string[], indent: string, body: string) {
  for (const contentLine of body.split("\n")) {
    out.push(contentLine === "" ? "" : `${indent}  ${contentLine}`);
  }
}

function chomp(decoded: string): { indicator: "|" | "|-"; body: string } {
  if (!decoded.endsWith("\n")) return { indicator: "|-", body: decoded };
  return { indicator: "|", body: decoded.replace(/\n+$/, "") };
}

const UNSAFE_LITERAL_BLOCK_CHARS = /[\x00-\x08\x0B-\x1F]/;

function isUnsafeForLiteralBlock(decoded: string): boolean {
  return decoded.startsWith(" ") || UNSAFE_LITERAL_BLOCK_CHARS.test(decoded);
}

function unescapeDoubleQuoted(inner: string): string | undefined {
  try {
    const loaded = yaml.load(`"${inner}"`);
    return typeof loaded === "string" ? loaded : undefined;
  } catch {
    return undefined;
  }
}
