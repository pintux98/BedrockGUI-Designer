export type MinecraftTextStyle = {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
};

export type MinecraftTextSegment = {
  text: string;
  style: MinecraftTextStyle;
};

const LEGACY_COLORS: Record<string, string> = {
  "0": "#000000",
  "1": "#0000AA",
  "2": "#00AA00",
  "3": "#00AAAA",
  "4": "#AA0000",
  "5": "#AA00AA",
  "6": "#FFAA00",
  "7": "#AAAAAA",
  "8": "#555555",
  "9": "#5555FF",
  a: "#55FF55",
  b: "#55FFFF",
  c: "#FF5555",
  d: "#FF55FF",
  e: "#FFFF55",
  f: "#FFFFFF"
};

// MiniMessage's sixteen named colours are the legacy palette under different
// spellings, so they are derived from LEGACY_COLORS rather than duplicated —
// the two syntaxes cannot drift apart.
const MINI_COLORS: Record<string, string> = {
  black: LEGACY_COLORS["0"],
  dark_blue: LEGACY_COLORS["1"],
  dark_green: LEGACY_COLORS["2"],
  dark_aqua: LEGACY_COLORS["3"],
  dark_red: LEGACY_COLORS["4"],
  dark_purple: LEGACY_COLORS["5"],
  gold: LEGACY_COLORS["6"],
  gray: LEGACY_COLORS["7"],
  dark_gray: LEGACY_COLORS["8"],
  blue: LEGACY_COLORS["9"],
  green: LEGACY_COLORS.a,
  aqua: LEGACY_COLORS.b,
  red: LEGACY_COLORS.c,
  light_purple: LEGACY_COLORS.d,
  yellow: LEGACY_COLORS.e,
  white: LEGACY_COLORS.f
};

// `obfuscated` has no representation in MinecraftTextStyle, so it is left to
// fall through as literal text rather than being silently swallowed.
const MINI_DECORATIONS: Record<string, keyof MinecraftTextStyle> = {
  bold: "bold",
  italic: "italic",
  underlined: "underline",
  strikethrough: "strikethrough"
};

// Sticky: matched at an exact offset without slicing the input on every step.
const MINI_TAG = /<(\/?)(#[0-9a-fA-F]{6}|[A-Za-z_]+)>/y;
const MINI_TAG_SCAN = /<\/?(#[0-9a-fA-F]{6}|[A-Za-z_]+)>/g;

type MiniTag = { closing: boolean; name: string; next: number };

function tryReadMiniTag(input: string, start: number): MiniTag | null {
  if (input[start] !== "<") return null;
  MINI_TAG.lastIndex = start;
  const m = MINI_TAG.exec(input);
  if (!m) return null;
  const name = m[2].startsWith("#") ? m[2] : m[2].toLowerCase();
  if (!isKnownMiniTagName(name)) return null;
  return { closing: m[1] === "/", name, next: start + m[0].length };
}

function isKnownMiniTagName(name: string) {
  if (name.startsWith("#")) return true;
  // Own-property checks only: `in` would report <constructor> and <toString>
  // as known tags and resolve them to junk off Object.prototype.
  const own = Object.prototype.hasOwnProperty;
  return own.call(MINI_COLORS, name) || own.call(MINI_DECORATIONS, name);
}

function isHexDigit(c: string) {
  return /^[0-9a-fA-F]$/.test(c);
}

function tryReadHexColor(input: string, start: number) {
  if (start + 7 > input.length) return null;
  if (input[start] !== "#") return null;
  const hex = input.slice(start + 1, start + 7);
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return { color: `#${hex.toUpperCase()}`, next: start + 7 };
}

function tryReadAmpSectionHexColor(input: string, start: number) {
  const ch = input[start];
  if (ch !== "&" && ch !== "§") return null;
  if (start + 8 > input.length) return null;
  if (input[start + 1] !== "#") return null;
  const hex = input.slice(start + 2, start + 8);
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return { color: `#${hex.toUpperCase()}`, next: start + 8 };
}

function tryReadXSequenceHexColor(input: string, start: number) {
  const ch = input[start];
  if (ch !== "&" && ch !== "§") return null;
  const prefix = ch;
  if (start + 2 > input.length) return null;
  if (input[start + 1].toLowerCase() !== "x") return null;
  let i = start + 2;
  const digits: string[] = [];
  for (let n = 0; n < 6; n++) {
    if (i + 2 > input.length) return null;
    if (input[i] !== prefix) return null;
    const d = input[i + 1];
    if (!isHexDigit(d)) return null;
    digits.push(d.toUpperCase());
    i += 2;
  }
  return { color: `#${digits.join("")}`, next: i };
}

export function stripMinecraftCodes(input: string) {
  return parseMinecraftText(input)
    .map((s) => s.text)
    .join("");
}

export function hasMinecraftCodes(input: string) {
  if (!input) return false;
  if (/#([0-9a-fA-F]{6})/.test(input)) return true;
  if (/([&§])#([0-9a-fA-F]{6})/.test(input)) return true;
  if (/([&§])[0-9a-fA-FrRlLoOnNmM]/.test(input)) return true;
  if (/([&§])x((?:\1[0-9a-fA-F]){6})/.test(input)) return true;
  // Only tags parseMinecraftText actually understands count; an unknown tag is
  // literal text and must not divert the preview away from its markdown path.
  MINI_TAG_SCAN.lastIndex = 0;
  for (let m = MINI_TAG_SCAN.exec(input); m; m = MINI_TAG_SCAN.exec(input)) {
    const name = m[1].startsWith("#") ? m[1] : m[1].toLowerCase();
    if (isKnownMiniTagName(name)) return true;
  }
  return false;
}

export function parseMinecraftText(input: string): MinecraftTextSegment[] {
  const out: MinecraftTextSegment[] = [];
  let style: MinecraftTextStyle = {};
  let buf = "";

  const flush = () => {
    if (!buf) return;
    out.push({ text: buf, style: { ...style } });
    buf = "";
  };

  const setStyle = (next: MinecraftTextStyle) => {
    flush();
    style = next;
  };

  const applyStyle = (patch: Partial<MinecraftTextStyle>) => {
    flush();
    style = { ...style, ...patch };
  };

  // Drops a single property so a closing tag clears only what its opener set,
  // and leaves no undefined-valued key behind on the emitted style.
  const clearStyle = (key: keyof MinecraftTextStyle) => {
    if (!(key in style)) return;
    flush();
    const next = { ...style };
    delete next[key];
    style = next;
  };

  let i = 0;
  while (i < input.length) {
    const ch = input[i];

    if (ch === "&" || ch === "§") {
      const next = input[i + 1];
      if (next === ch) {
        buf += ch;
        i += 2;
        continue;
      }

      const xSeq = tryReadXSequenceHexColor(input, i);
      if (xSeq) {
        setStyle({ color: xSeq.color });
        i = xSeq.next;
        continue;
      }

      const ampHex = tryReadAmpSectionHexColor(input, i);
      if (ampHex) {
        setStyle({ color: ampHex.color });
        i = ampHex.next;
        continue;
      }

      if (typeof next === "string") {
        const code = next.toLowerCase();
        if (LEGACY_COLORS[code]) {
          setStyle({ color: LEGACY_COLORS[code] });
          i += 2;
          continue;
        }
        if (code === "r") {
          setStyle({});
          i += 2;
          continue;
        }
        if (code === "l") {
          applyStyle({ bold: true });
          i += 2;
          continue;
        }
        if (code === "o") {
          applyStyle({ italic: true });
          i += 2;
          continue;
        }
        if (code === "n") {
          applyStyle({ underline: true });
          i += 2;
          continue;
        }
        if (code === "m") {
          applyStyle({ strikethrough: true });
          i += 2;
          continue;
        }
      }

      buf += ch;
      i += 1;
      continue;
    }

    if (ch === "<") {
      // An unrecognised or malformed tag is deliberately not consumed here: it
      // falls through to `buf` so a typo like <bild> stays visible to the user.
      const tag = tryReadMiniTag(input, i);
      if (tag) {
        const decoration = MINI_DECORATIONS[tag.name];
        if (decoration) {
          if (tag.closing) clearStyle(decoration);
          else applyStyle({ [decoration]: true });
        } else if (tag.closing) {
          clearStyle("color");
        } else {
          // A colour tag keeps any decorations already in effect.
          applyStyle({
            color: tag.name.startsWith("#") ? `#${tag.name.slice(1).toUpperCase()}` : MINI_COLORS[tag.name]
          });
        }
        i = tag.next;
        continue;
      }
    }

    if (ch === "#") {
      const hex = tryReadHexColor(input, i);
      if (hex) {
        setStyle({ color: hex.color });
        i = hex.next;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }

  flush();
  return out;
}
