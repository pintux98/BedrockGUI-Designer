import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  ConditionField,
  ConditionWizard,
  buildCondition,
  describeCondition,
  kindsFor,
  parseConditionParts
} from "../components/ConditionWizard";
import { validateCondition, type ConditionContext } from "../plugin/conditions";

afterEach(() => cleanup());

const COLON: [Parameters<typeof buildCondition>[0], string][] = [
  [{ kind: "permission", negate: false, value: "vip.kit", op: "", expected: "" }, "permission:vip.kit"],
  [{ kind: "plugin", negate: false, value: "Vault", op: "", expected: "" }, "plugin:Vault"],
  [{ kind: "placeholder", negate: false, value: "%vault_eco_balance%", op: "greater_equal", expected: "100" }, "placeholder:%vault_eco_balance%:greater_equal:100"],
  [{ kind: "placeholder", negate: false, value: "%x%", op: "empty", expected: "" }, "placeholder:%x%:empty:x"],
  [{ kind: "permission", negate: true, value: "vip.kit", op: "", expected: "" }, "not:permission:vip.kit"]
];

const SYMBOL: [Parameters<typeof buildCondition>[0], string][] = [
  [{ kind: "permission", negate: false, value: "vip.kit", op: "", expected: "" }, "permission:vip.kit"],
  [{ kind: "placeholder", negate: false, value: "%level%", op: ">=", expected: "10" }, "placeholder:%level% >= 10"],
  [{ kind: "permission", negate: true, value: "vip.kit", op: "", expected: "" }, "permission:vip.kit"]
];

describe("condition strings", () => {
  for (const [context, table] of [["colon", COLON], ["symbol", SYMBOL]] as [ConditionContext, typeof COLON][]) {
    it(`builds the exact plugin string in the ${context} context, and the plugin grammar accepts it`, () => {
      for (const [parts, expected] of table) {
        const built = buildCondition(parts, context);
        expect(built).toBe(expected);
        expect(validateCondition(built, context)).toEqual([]);
      }
    });

    it(`parses what it builds back into the same parts in the ${context} context`, () => {
      for (const [parts, expected] of table) {
        if (parts.negate && context === "symbol") continue;
        const back = parseConditionParts(expected, context);
        expect(back.kind).toBe(parts.kind);
        expect(back.negate).toBe(parts.negate);
        expect(back.value).toBe(parts.value);
      }
    });
  }

  it("offers only permission and value checks inside a conditional action", () => {
    expect(kindsFor("symbol")).toEqual(["permission", "placeholder"]);
    expect(kindsFor("colon")).toEqual(["permission", "placeholder", "plugin"]);
  });

  it("treats a combined condition as custom", () => {
    expect(parseConditionParts("permission:a && plugin:b", "colon").kind).toBeNull();
    expect(describeCondition("permission:a && plugin:b")).toBe("Custom: permission:a && plugin:b");
  });

  it("describes conditions as plain sentences", () => {
    expect(describeCondition("permission:vip.kit")).toBe("Player has the permission vip.kit");
    expect(describeCondition("not:plugin:Vault")).toBe("Server does not have the plugin Vault");
    expect(describeCondition("bedrock_player:true")).toBe("Custom: bedrock_player:true");
    expect(describeCondition("placeholder:%bal%:greater_equal:100")).toBe("%bal% is at least 100");
  });
});

describe("ConditionWizard", () => {
  it("walks from a choice to a saved permission condition", () => {
    const onSave = vi.fn();
    render(<ConditionWizard title="Show only when" value="" context="colon" onCancel={vi.fn()} onSave={onSave} />);
    fireEvent.click(document.querySelector('[data-condition-kind="permission"]')!);
    expect(screen.getByRole("button", { name: "Save condition" })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("vip.kit"), { target: { value: "vip.kit" } });
    fireEvent.click(screen.getByLabelText(/Reverse it/));
    fireEvent.click(screen.getByRole("button", { name: "Save condition" }));
    expect(onSave).toHaveBeenCalledWith("not:permission:vip.kit");
  });

  it("builds a value comparison with plain-language operators", () => {
    const onSave = vi.fn();
    render(<ConditionWizard title="Only if" value="" context="symbol" onCancel={vi.fn()} onSave={onSave} />);
    expect(document.querySelector('[data-condition-kind="plugin"]')).toBeNull();
    fireEvent.click(document.querySelector('[data-condition-kind="placeholder"]')!);
    fireEvent.change(screen.getByPlaceholderText("%vault_eco_balance%"), { target: { value: "%level%" } });
    fireEvent.change(screen.getByLabelText("Is"), { target: { value: ">=" } });
    fireEvent.change(screen.getByPlaceholderText("100"), { target: { value: "10" } });
    expect(screen.queryByLabelText(/Reverse it/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save condition" }));
    expect(onSave).toHaveBeenCalledWith("placeholder:%level% >= 10");
  });

  it("opens an existing condition straight on its fields", () => {
    render(<ConditionWizard title="Show only when" value="plugin:Vault" context="colon" onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByPlaceholderText("Vault")).toHaveValue("Vault");
  });
});

describe("ConditionField", () => {
  it("shows the condition as a sentence and can remove it", () => {
    const onChange = vi.fn();
    render(<ConditionField label="Show only when" value="permission:vip.kit" onChange={onChange} />);
    expect(screen.getByText("Player has the permission vip.kit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove show only when condition" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
