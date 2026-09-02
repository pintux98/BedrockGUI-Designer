import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConditionBuilder } from "../components/ConditionBuilder";
import { ATOM_KINDS, operatorsFor, validateCondition, type ConditionContext } from "../plugin/conditions";

afterEach(() => cleanup());

describe("ConditionBuilder", () => {
  it("emits only conditions its own validator accepts", () => {
    for (const kind of ATOM_KINDS) {
      const onChange = vi.fn();
      render(<ConditionBuilder value="" context="colon" onChange={onChange} />);
      fireEvent.change(screen.getByRole("combobox", { name: /type/i }), { target: { value: kind } });
      const emitted = onChange.mock.calls.at(-1)![0];
      expect(validateCondition(emitted, "colon")).toEqual([]);
      cleanup();
    }
  });

  it("round-trips a negated permission", () => {
    render(<ConditionBuilder value="not:permission:my.perm" context="colon" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: /type/i })).toHaveValue("not:permission");
    expect(screen.getByRole("textbox", { name: /value/i })).toHaveValue("my.perm");
  });

  it("offers only the operators legal in the current context", () => {
    const { rerender } = render(<ConditionBuilder value="" context="colon" onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: /greater_than/ })).toBeInTheDocument();
    rerender(<ConditionBuilder value="" context="symbol" onChange={vi.fn()} />);
    expect(screen.queryByRole("option", { name: /greater_than/ })).toBeNull();
  });

  it("offers only the atoms a conditional check supports", () => {
    render(<ConditionBuilder value="" context="symbol" onChange={vi.fn()} />);
    expect(screen.queryByRole("option", { name: /bedrock_player/ })).toBeNull();
    expect(screen.getByRole("option", { name: /permission/ })).toBeInTheDocument();
  });

  it("every type option offered in each context emits a condition that validates clean", () => {
    for (const context of ["colon", "symbol"] as ConditionContext[]) {
      const probe = vi.fn();
      const { unmount: unmountProbe } = render(<ConditionBuilder value="" context={context} onChange={probe} />);
      const typeSelect = screen.getByRole("combobox", { name: /type/i });
      const typeOptions = Array.from(typeSelect.querySelectorAll("option")).map(
        (o) => (o as HTMLOptionElement).value
      );
      unmountProbe();

      expect(typeOptions.length).toBeGreaterThan(0);

      for (const typeValue of typeOptions) {
        const onChange = vi.fn();
        const { unmount } = render(<ConditionBuilder value="" context={context} onChange={onChange} />);
        fireEvent.change(screen.getByRole("combobox", { name: /type/i }), { target: { value: typeValue } });
        const emitted = onChange.mock.calls.at(-1)![0];
        expect(validateCondition(emitted, context)).toEqual([]);
        unmount();
      }
    }
  });

  it("every operator option offered for a placeholder in each context emits a condition that validates clean", () => {
    for (const context of ["colon", "symbol"] as ConditionContext[]) {
      for (const op of operatorsFor(context)) {
        const token = op.word ?? op.symbol!;
        const onChange = vi.fn();
        const { rerender, unmount } = render(<ConditionBuilder value="" context={context} onChange={onChange} />);

        fireEvent.change(screen.getByRole("combobox", { name: /type/i }), { target: { value: "placeholder" } });
        const afterType = onChange.mock.calls.at(-1)![0];
        expect(validateCondition(afterType, context)).toEqual([]);
        rerender(<ConditionBuilder value={afterType} context={context} onChange={onChange} />);

        fireEvent.change(screen.getByRole("combobox", { name: /operator/i }), { target: { value: token } });
        const emitted = onChange.mock.calls.at(-1)![0];
        expect(validateCondition(emitted, context)).toEqual([]);
        unmount();
      }
    }
  });
});
