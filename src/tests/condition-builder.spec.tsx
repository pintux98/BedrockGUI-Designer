import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConditionBuilder } from "../components/ConditionBuilder";
import { operatorsFor, validateCondition, type ConditionContext } from "../plugin/conditions";

afterEach(() => cleanup());

/**
 * These expectations are written out as literal strings on purpose. Asserting
 * `validateCondition(emitted) === []` proves nothing: the builder picks the kinds
 * it offers by running that same validator over the same string it is about to
 * emit, so the two agree even when the string is the wrong condition entirely.
 */
const COLON_EMISSIONS: Record<string, string> = {
  permission: "permission:my.permission",
  placeholder: "placeholder:{some_placeholder}:equals:value",
  plugin: "plugin:SomePlugin",
  bedrock_player: "bedrock_player:true",
  java_player: "java_player:true",
  not: "not:permission:my.permission",
  "not:permission": "not:permission:my.permission",
  "not:placeholder": "not:placeholder:{some_placeholder}:equals:value",
  "not:plugin": "not:plugin:SomePlugin",
  "not:bedrock_player": "not:bedrock_player:true",
  "not:java_player": "not:java_player:true"
};

/** A conditional `check:` understands only placeholder: and permission:, and no not:. */
const SYMBOL_EMISSIONS: Record<string, string> = {
  permission: "permission:my.permission",
  placeholder: "placeholder:{some_placeholder} == value"
};

const EMISSIONS: Record<ConditionContext, Record<string, string>> = {
  colon: COLON_EMISSIONS,
  symbol: SYMBOL_EMISSIONS
};

function typeSelect(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: /type/i }) as HTMLSelectElement;
}

function optionValues(select: HTMLSelectElement): string[] {
  return Array.from(select.querySelectorAll("option")).map((o) => (o as HTMLOptionElement).value);
}

function pickType(value: string) {
  fireEvent.change(typeSelect(), { target: { value } });
}

describe("ConditionBuilder", () => {
  it("emits the exact condition string documented for every type it offers", () => {
    for (const context of ["colon", "symbol"] as ConditionContext[]) {
      const expected = EMISSIONS[context];

      const { unmount: unmountProbe } = render(
        <ConditionBuilder value="" context={context} onChange={vi.fn()} />
      );
      // "" is the unset placeholder option, not a type the builder can emit.
      const offered = optionValues(typeSelect()).filter((v) => v !== "");
      unmountProbe();

      expect([...offered].sort()).toEqual(Object.keys(expected).sort());

      for (const typeValue of offered) {
        const onChange = vi.fn();
        const { unmount } = render(<ConditionBuilder value="" context={context} onChange={onChange} />);
        pickType(typeValue);
        expect(onChange.mock.calls.at(-1)?.[0]).toBe(expected[typeValue]);
        // Secondary: the literal above is itself legal, so the table cannot drift
        // away from the plugin contract without one of the two assertions failing.
        expect(validateCondition(expected[typeValue], context)).toEqual([]);
        unmount();
      }
    }
  });

  it("round-trips a negated permission", () => {
    render(<ConditionBuilder value="not:permission:my.perm" context="colon" onChange={vi.fn()} />);
    expect(typeSelect()).toHaveValue("not:permission");
    expect(screen.getByRole("textbox", { name: /value/i })).toHaveValue("my.perm");
  });

  it("offers only the operators legal in the current context", () => {
    const { rerender } = render(
      <ConditionBuilder value="placeholder:%x%:equals:5" context="colon" onChange={vi.fn()} />
    );
    expect(screen.getByRole("option", { name: /greater_than/ })).toBeInTheDocument();
    rerender(<ConditionBuilder value="placeholder:%x% == 5" context="symbol" onChange={vi.fn()} />);
    expect(screen.queryByRole("option", { name: /greater_than/ })).toBeNull();
    expect(screen.getByRole("option", { name: ">=" })).toBeInTheDocument();
  });

  it("offers only the atoms a conditional check supports", () => {
    render(<ConditionBuilder value="" context="symbol" onChange={vi.fn()} />);
    expect(screen.queryByRole("option", { name: /bedrock_player/ })).toBeNull();
    expect(screen.getByRole("option", { name: /permission/ })).toBeInTheDocument();
  });

  // ─── Finding 2: only placeholder conditions take an operator ───────────────
  // ConditionEvaluator.evaluateSingle reads parts[offset + 2] as the operator for
  // `placeholder` alone. permission:/plugin: stop at their value, and
  // bedrock_player:/java_player: ignore theirs, so an operator picked for any of
  // them would never reach the plugin.
  describe("the Operator control", () => {
    const OPERATORLESS: Array<[ConditionContext, string]> = [
      ["colon", "permission:my.perm"],
      ["colon", "plugin:Vault"],
      ["colon", "bedrock_player:true"],
      ["colon", "java_player:true"],
      ["colon", "not:permission:my.perm"],
      ["symbol", "permission:my.perm"]
    ];

    it.each(OPERATORLESS)("is not offered in the %s context for %s", (context, value) => {
      render(<ConditionBuilder value={value} context={context} onChange={vi.fn()} />);
      expect(typeSelect()).not.toHaveValue("");
      expect(screen.queryByRole("combobox", { name: /operator/i })).toBeNull();
    });

    it.each([
      ["colon" as ConditionContext, "placeholder:%x%:equals:5"],
      ["symbol" as ConditionContext, "placeholder:%x% == 5"]
    ])("is offered in the %s context for %s", (context, value) => {
      render(<ConditionBuilder value={value} context={context} onChange={vi.fn()} />);
      expect(screen.getByRole("combobox", { name: /operator/i })).toBeInTheDocument();
    });

    it("rewrites a placeholder condition with the operator that was picked", () => {
      for (const context of ["colon", "symbol"] as ConditionContext[]) {
        for (const op of operatorsFor(context)) {
          const token = context === "symbol" ? op.symbol! : op.word!;
          // Start from a different operator so the select really changes value.
          const other = context === "symbol" ? (token === "==" ? "!=" : "==") : token === "equals" ? "contains" : "equals";
          const start =
            context === "symbol" ? `placeholder:%x% ${other} 5` : `placeholder:%x%:${other}:5`;
          const expected =
            context === "symbol" ? `placeholder:%x% ${token} 5` : `placeholder:%x%:${token}:5`;

          const onChange = vi.fn();
          const { unmount } = render(
            <ConditionBuilder value={start} context={context} onChange={onChange} />
          );
          const operatorSelect = screen.getByRole("combobox", { name: /operator/i });
          expect(operatorSelect).toHaveValue(other);
          fireEvent.change(operatorSelect, { target: { value: token } });
          expect(onChange).toHaveBeenCalledTimes(1);
          expect(onChange.mock.calls[0][0]).toBe(expected);
          unmount();
        }
      }
    });
  });

  // ─── Finding 2 (related): an empty condition must not display a type ───────
  it("shows no type for an empty condition, so picking the first one still fires", () => {
    const onChange = vi.fn();
    render(<ConditionBuilder value="" context="colon" onChange={onChange} />);

    const select = typeSelect();
    expect(select).toHaveValue("");
    expect(optionValues(select)).toContain("");
    expect(screen.queryByRole("combobox", { name: /operator/i })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /value/i })).toBeNull();

    // The select displayed "permission" while the model held "", so this very
    // change event never fired and the control could not set what it was showing.
    pickType("permission");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe("permission:my.permission");
  });
});
