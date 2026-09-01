export type ConditionContext = "colon" | "symbol";

export interface ConditionOperator {
  word: string | null;
  symbol: string | null;
  label: string;
  numeric: boolean;
  needsExpected: boolean;
}

export const OPERATORS: readonly ConditionOperator[] = [
  { word: "equals", symbol: "==", label: "equals", numeric: false, needsExpected: true },
  { word: "not_equals", symbol: "!=", label: "does not equal", numeric: false, needsExpected: true },
  { word: "contains", symbol: null, label: "contains", numeric: false, needsExpected: true },
  { word: "starts_with", symbol: null, label: "starts with", numeric: false, needsExpected: true },
  { word: "ends_with", symbol: null, label: "ends with", numeric: false, needsExpected: true },
  { word: "greater_than", symbol: ">", label: "is greater than", numeric: true, needsExpected: true },
  { word: "greater_equal", symbol: ">=", label: "is at least", numeric: true, needsExpected: true },
  { word: "less_than", symbol: "<", label: "is less than", numeric: true, needsExpected: true },
  { word: "less_equal", symbol: "<=", label: "is at most", numeric: true, needsExpected: true },
  { word: "regex", symbol: null, label: "matches regex", numeric: false, needsExpected: true },
  { word: "empty", symbol: null, label: "is empty", numeric: false, needsExpected: false },
  { word: "not_empty", symbol: null, label: "is not empty", numeric: false, needsExpected: false }
];

export const ATOM_KINDS = ["permission", "placeholder", "plugin", "bedrock_player", "java_player", "not"] as const;

const VALUELESS_ATOMS = ["bedrock_player", "java_player"] as const;

export function operatorsFor(context: ConditionContext): ConditionOperator[] {
  if (context === "symbol") return OPERATORS.filter((o) => o.symbol !== null).map((o) => ({ ...o, word: null }));
  return [...OPERATORS];
}

export function validateCondition(text: string, context: ConditionContext): string[] {
  const problems: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return ["Condition is empty."];

  let depth = 0;
  for (const ch of trimmed) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) { problems.push("Unbalanced parentheses."); break; }
  }
  if (depth !== 0 && !problems.length) problems.push("Unbalanced parentheses.");

  for (const atom of splitAtoms(trimmed)) {
    problems.push(...validateAtom(atom, context));
  }
  return problems;
}

function splitAtoms(text: string): string[] {
  return text
    .split(/\|\||&&/)
    .map((part) => part.replace(/[()]/g, "").trim())
    .filter(Boolean);
}

function validateAtom(atom: string, context: ConditionContext): string[] {
  const body = atom.startsWith("not:") ? atom.slice(4) : atom;
  const valueless = VALUELESS_ATOMS.find((kind) => body === kind || body.startsWith(`${kind}:`));
  if (valueless) {
    const value = body.slice(valueless.length + 1);
    return value.trim()
      ? []
      : [`"${valueless}" needs a value, even though it is ignored — write ${valueless}:true.`];
  }
  if (body.startsWith("permission:") || body.startsWith("plugin:")) {
    return body.split(":").slice(1).join(":").trim() ? [] : [`"${atom}" is missing its value.`];
  }
  if (!body.startsWith("placeholder:")) {
    return [`"${atom}" is not a known condition. Use permission:, placeholder:, plugin:, bedrock_player:, java_player: or not:.`];
  }
  return context === "symbol" ? validateSymbolAtom(atom, body) : validateColonAtom(atom, body);
}

function validateSymbolAtom(atom: string, body: string): string[] {
  const match = body.slice("placeholder:".length).match(/^(.*?)\s+(>=|<=|==|!=|>|<)\s+(.*)$/);
  if (!match) return [`"${atom}" must read placeholder:<value> <operator> <expected> inside a conditional check.`];
  return OPERATORS.some((o) => o.symbol === match[2]) ? [] : [`"${match[2]}" is not a valid operator.`];
}

function validateColonAtom(atom: string, body: string): string[] {
  if (/\s(>=|<=|==|!=|>|<)\s/.test(body)) {
    return [`"${atom}" uses conditional-check syntax. Here it must be placeholder:<value>:<operator>:<expected>.`];
  }
  const parts = body.split(":");
  if (parts.length < 3) return [`"${atom}" must read placeholder:<value>:<operator>[:<expected>].`];
  const opToken = parts[2];
  const operator = OPERATORS.find((o) => o.word === opToken || o.symbol === opToken);
  if (!operator) return [`"${opToken}" is not a valid operator.`];
  if (operator.needsExpected && parts.length < 4) return [`"${opToken}" needs a value to compare against.`];
  return [];
}
