import React from "react";
import { BufferedInput } from "./BufferedInput";
import {
  ATOM_KINDS,
  operatorsFor,
  validateCondition,
  type ConditionContext,
  type ConditionOperator
} from "../plugin/conditions";

const REAL_KINDS: readonly string[] = ATOM_KINDS.filter((kind) => kind !== "not");
const DEFAULT_TOKEN = "{some_placeholder}";
const DEFAULT_EXPECTED = "value";

interface ConditionBuilderProps {
  value: string;
  context: ConditionContext;
  onChange: (next: string) => void;
}

interface ParsedCondition {
  negate: boolean;
  kind: string | null;
  rest: string;
}

function parseCondition(raw: string): ParsedCondition {
  const trimmed = raw.trim();
  const negate = trimmed.startsWith("not:");
  const body = negate ? trimmed.slice(4) : trimmed;
  const byLength = [...REAL_KINDS].sort((a, b) => b.length - a.length);
  for (const kind of byLength) {
    if (body === kind) return { negate, kind, rest: "" };
    if (body.startsWith(`${kind}:`)) return { negate, kind, rest: body.slice(kind.length + 1) };
  }
  return { negate: false, kind: null, rest: trimmed };
}

function operatorToken(op: ConditionOperator): string {
  return op.word ?? op.symbol ?? "";
}

function defaultValueFor(kind: string): string {
  return kind === "plugin" ? "SomePlugin" : "my.permission";
}

/**
 * `ConditionEvaluator.evaluateSingle` reads an operator for exactly one condition
 * type: `placeholder`, which it splits as `placeholder:<value>:<operator>:<expected>`.
 * `permission` and `plugin` take `parts[offset + 1]` and stop; `bedrock_player` and
 * `java_player` take no value at all (they still need a segment to parse, hence the
 * `:true`). So `opToken` deliberately has no effect outside the placeholder branch,
 * and OPERATOR_KINDS keeps the UI from offering a control the plugin would ignore.
 */
const OPERATOR_KINDS: readonly string[] = ["placeholder"];

function buildBody(kind: string, val: string, opToken: string, expected: string, context: ConditionContext): string {
  if (kind === "bedrock_player" || kind === "java_player") return `${kind}:true`;
  if (kind === "permission" || kind === "plugin") return `${kind}:${val.trim() || defaultValueFor(kind)}`;
  const tok = val.trim() || DEFAULT_TOKEN;
  const exp = expected.trim() || DEFAULT_EXPECTED;
  const op = opToken.trim() || operatorToken(operatorsFor(context)[0]);
  return context === "symbol" ? `placeholder:${tok} ${op} ${exp}` : `placeholder:${tok}:${op}:${exp}`;
}

function supports(trial: string, context: ConditionContext): boolean {
  return validateCondition(trial, context).length === 0;
}

export function ConditionBuilder({ value, context, onChange }: ConditionBuilderProps) {
  const uid = React.useId();
  const operators = operatorsFor(context);

  const supportedKinds = REAL_KINDS.filter((kind) => supports(buildBody(kind, "", "", "", context), context));
  const kinds = supportedKinds.length ? supportedKinds : [REAL_KINDS[0]];
  const negationSupported = supports(`not:${buildBody(kinds[0], "", "", "", context)}`, context);

  const parsed = parseCondition(value);
  // Null while the value names no kind this context supports — an empty condition,
  // or free text typed in the advanced box. The Type select then shows an unset
  // option rather than displaying a kind the value does not hold, which used to
  // make re-picking that very kind a no-op change event.
  const selectedKind = parsed.kind && kinds.includes(parsed.kind) ? parsed.kind : null;
  const activeKind = selectedKind ?? kinds[0];

  let currentVal = "";
  let currentOpToken = "";
  let currentExpected = "";
  if (selectedKind) {
    if (activeKind === "placeholder") {
      if (context === "symbol") {
        const match = parsed.rest.match(/^(.*?)\s+(>=|<=|==|!=|>|<)\s+(.*)$/);
        if (match) {
          currentVal = match[1];
          currentOpToken = match[2];
          currentExpected = match[3];
        } else {
          currentVal = parsed.rest;
        }
      } else {
        const parts = parsed.rest.split(":");
        currentVal = parts[0] ?? "";
        currentOpToken = parts[1] ?? "";
        currentExpected = parts.slice(2).join(":");
      }
    } else if (activeKind === "permission" || activeKind === "plugin") {
      currentVal = parsed.rest;
    }
  }

  const matchedOperator =
    operators.find((op) => (currentOpToken && (op.word === currentOpToken || op.symbol === currentOpToken))) ??
    operators[0];

  const typeValue = selectedKind ? (parsed.negate ? `not:${selectedKind}` : selectedKind) : "";

  const emit = (kind: string, negate: boolean, opToken: string, val: string, expected: string) => {
    const body = buildBody(kind, val, opToken, expected, context);
    onChange(negate ? `not:${body}` : body);
  };

  const handleTypeChange = (next: string) => {
    if (!next) return;
    if (next === "not") {
      emit(activeKind, true, currentOpToken, currentVal, currentExpected);
      return;
    }
    if (next.startsWith("not:")) {
      emit(next.slice(4), true, currentOpToken, currentVal, currentExpected);
      return;
    }
    emit(next, false, currentOpToken, currentVal, currentExpected);
  };

  const problems = value.trim() ? validateCondition(value, context) : [];
  const showOperator = selectedKind !== null && OPERATOR_KINDS.includes(selectedKind);
  const showValue = selectedKind === "permission" || selectedKind === "plugin" || selectedKind === "placeholder";
  const showExpected = selectedKind === "placeholder";

  return (
    <div className="space-y-1">
      <div className={showOperator ? "grid grid-cols-2 gap-1" : ""}>
        <div>
          <label htmlFor={`${uid}-type`} className="text-[10px] text-brand-muted block mb-0.5">
            Type
          </label>
          <select
            id={`${uid}-type`}
            className="ui-input text-xs w-full"
            value={typeValue}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            {!selectedKind && <option value="">— choose a type —</option>}
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
            {negationSupported && <option value="not">not</option>}
            {negationSupported &&
              kinds.map((kind) => (
                <option key={`not:${kind}`} value={`not:${kind}`}>
                  {`not:${kind}`}
                </option>
              ))}
          </select>
        </div>
        {showOperator && (
          <div>
            <label htmlFor={`${uid}-operator`} className="text-[10px] text-brand-muted block mb-0.5">
              Operator
            </label>
            <select
              id={`${uid}-operator`}
              className="ui-input text-xs w-full"
              value={operatorToken(matchedOperator)}
              onChange={(e) => emit(activeKind, parsed.negate, e.target.value, currentVal, currentExpected)}
            >
              {operators.map((op) => {
                const token = operatorToken(op);
                return (
                  <option key={token} value={token}>
                    {token}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {showValue && (
        <div>
          <label htmlFor={`${uid}-value`} className="text-[10px] text-brand-muted block mb-0.5">
            Value
          </label>
          <BufferedInput
            id={`${uid}-value`}
            className="ui-input text-xs w-full"
            value={currentVal}
            onCommit={(v) => emit(activeKind, parsed.negate, currentOpToken, v, currentExpected)}
          />
        </div>
      )}

      {showExpected && (
        <div>
          <label htmlFor={`${uid}-expected`} className="text-[10px] text-brand-muted block mb-0.5">
            Expected
          </label>
          <BufferedInput
            id={`${uid}-expected`}
            className="ui-input text-xs w-full"
            value={currentExpected}
            onCommit={(v) => emit(activeKind, parsed.negate, currentOpToken, currentVal, v)}
          />
        </div>
      )}

      {problems.length > 0 && (
        <div className="text-[10px] text-brand-danger space-y-0.5">
          {problems.map((p, i) => (
            <div key={i}>{p}</div>
          ))}
        </div>
      )}
    </div>
  );
}
