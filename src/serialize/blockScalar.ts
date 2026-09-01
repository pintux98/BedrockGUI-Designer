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
      const { indicator, body } = chomp(decoded);
      out.push(`${indent}- ${indicator}`);
      for (const contentLine of body.split("\n")) {
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
      const { indicator, body } = chomp(decoded);
      out.push(`${prefix}${indicator}`);
      for (const contentLine of body.split("\n")) {
        out.push(`${indent}  ${contentLine}`);
      }
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

function chomp(decoded: string): { indicator: "|" | "|-"; body: string } {
  if (!decoded.endsWith("\n")) return { indicator: "|-", body: decoded };
  return { indicator: "|", body: decoded.replace(/\n+$/, "") };
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
