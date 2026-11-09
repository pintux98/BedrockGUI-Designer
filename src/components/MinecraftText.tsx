import React from "react";
import { MinecraftTextStyle, parseMinecraftText } from "../core/minecraftText";

export function MinecraftText({ text, shadow = false }: { text: string; shadow?: boolean }) {
  const segments = React.useMemo(() => parseMinecraftText(text), [text]);
  return (
    <>
      {segments.map((s, idx) => (
        <span key={idx} style={minecraftTextStyleToCss(s.style, shadow)}>
          {s.text}
        </span>
      ))}
    </>
  );
}

export function shadowColor(hex: string): string | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) >> 2;
  const g = ((n >> 8) & 0xff) >> 2;
  const b = (n & 0xff) >> 2;
  return `rgb(${r} ${g} ${b})`;
}

function minecraftTextStyleToCss(style: MinecraftTextStyle, shadow: boolean): React.CSSProperties {
  const decorations: string[] = [];
  if (style.underline) decorations.push("underline");
  if (style.strikethrough) decorations.push("line-through");
  const dark = shadow && style.color ? shadowColor(style.color) : undefined;
  return {
    color: style.color,
    fontWeight: style.bold ? "bold" : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: decorations.length ? decorations.join(" ") : undefined,
    textShadow: dark ? `1px 1px 0 ${dark}` : undefined
  };
}
