import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createEmptyProject, createForm, FormDoc, Project } from "../core/project";
import { useDesignerStore } from "../core/store";
import { validateProject } from "../core/validateProject";
import { ValidationPanel } from "../panels/ValidationPanel";
import { BedrockForm } from "../core/types";

/** Give a form a single button whose onClick is the supplied raw action block. */
function withOnClick(form: FormDoc, ...raws: string[]): FormDoc {
  return {
    ...form,
    bedrock: {
      ...form.bedrock,
      type: "SIMPLE",
      buttons: [
        {
          id: "b1",
          text: "B",
          onClick: raws.map((raw, i) => ({ id: `a${i}`, params: {}, raw }))
        }
      ]
    } as BedrockForm
  };
}

function withCommand(form: FormDoc, command: string): FormDoc {
  return { ...form, bedrock: { ...form.bedrock, command } as BedrockForm };
}

function projectWith(...forms: FormDoc[]): Project {
  return { ...createEmptyProject(), forms, activeFormId: forms[0].id };
}

function openBlock(...targets: string[]): string {
  return `open {\n${targets.map((t) => `  - ${JSON.stringify(t)}`).join("\n")}\n}`;
}

const messages = (issues: { message: string }[]) => issues.map((i) => i.message).join("\n");

describe("validateProject — open targets", () => {
  it("reports an open target that is neither a project form nor an addon id", () => {
    const issues = validateProject(projectWith(withOnClick(createForm("main_menu"), openBlock("ghost_menu"))));
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
    expect(errors[0].formId).toBe("main_menu");
  });

  it("accepts a project form as an open target with no issue at all", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("shop")), "/menu");
    const issues = validateProject(projectWith(main, createForm("shop")));
    expect(issues).toEqual([]);
  });

  it("accepts an addon target and names the addon", () => {
    const issues = validateProject(projectWith(withOnClick(createForm("main_menu"), openBlock("bw_arena_main"))));
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    const warnings = issues.filter((i) => i.level === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("Bedwars");
    expect(warnings[0].message).toContain("bw_arena_main");
  });

  it("says nothing about an open target that is a runtime placeholder", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("category_{selected}")), "/menu");
    expect(validateProject(projectWith(main))).toEqual([]);
  });

  it("does not report the same unknown target twice when two blocks in one form open it", () => {
    const main = withOnClick(createForm("main_menu"), openBlock("ghost_menu"), openBlock("ghost_menu"));
    expect(validateProject(projectWith(main)).filter((i) => i.level === "error")).toHaveLength(1);
  });
});

describe("validateProject — open line[0] is a menu, the tail may be arguments", () => {
  it("leaves the tail alone when it does not all resolve — those lines are arguments, not menus", () => {
    // The plugin's shouldTreatValuesAsMenuChain fails here, so 'diamond_sword' is an
    // argument passed to shop, never a menu name. Reporting it would be a false error.
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("shop", "diamond_sword")), "/menu");
    const issues = validateProject(projectWith(main, createForm("shop")));
    expect(messages(issues)).not.toContain("diamond_sword");
    expect(issues).toEqual([]);
  });

  it("still validates line[0] when the tail is arguments", () => {
    const main = withOnClick(createForm("main_menu"), openBlock("ghost_menu", "some_argument"));
    const errors = validateProject(projectWith(main)).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
    expect(messages(errors)).not.toContain("some_argument");
  });

  it("does not treat a resolving tail line as reached when a later tail line does not resolve", () => {
    // shop resolves but 'not_a_menu' does not, so the whole tail is arguments and
    // shop is never actually opened by main_menu.
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("hub", "shop", "not_a_menu")), "/menu");
    const issues = validateProject(projectWith(main, createForm("hub"), createForm("shop")));
    expect(messages(issues)).not.toContain("not_a_menu");
    const unreachable = issues.filter((i) => i.level === "warning" && i.formId === "shop");
    expect(unreachable).toHaveLength(1);
  });

  it("marks every line reached when all lines of an open block resolve", () => {
    const hub = withCommand(withOnClick(createForm("hub"), openBlock("a", "b")), "/hub");
    const issues = validateProject(projectWith(hub, createForm("a"), createForm("b")));
    expect(issues).toEqual([]);
  });
});

describe("validateProject — nested actions", () => {
  it("finds an open hidden inside a random entry", () => {
    const raw = 'random {\n  - "open:ghost_menu@1"\n  - "message:nothing"\n}';
    const errors = validateProject(projectWith(withOnClick(createForm("main_menu"), raw))).filter(
      (i) => i.level === "error"
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
  });

  it("finds an open inside a conditional branch", () => {
    const raw = [
      "conditional {",
      '  check: "permission:some.node"',
      "  true:",
      "    - |",
      "      open {",
      '        - "ghost_menu"',
      "      }",
      "}"
    ].join("\n");
    const errors = validateProject(projectWith(withOnClick(createForm("main_menu"), raw))).filter(
      (i) => i.level === "error"
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
  });

  it("counts a colon-form open as reaching its target", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), "open:shop"), "/menu");
    expect(validateProject(projectWith(main, createForm("shop")))).toEqual([]);
  });
});

describe("validateProject — file names", () => {
  it("reports duplicate file names across forms", () => {
    const a = withCommand(createForm("main_menu"), "/menu");
    const b = { ...withCommand(createForm("other"), "/other"), fileName: "main_menu.yml" };
    const errors = validateProject(projectWith(a, b)).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("main_menu.yml");
    expect(errors[0].message).toContain("other");
  });

  it("does not report distinct file names", () => {
    const a = withCommand(createForm("main_menu"), "/menu");
    const b = withCommand(createForm("other"), "/other");
    expect(validateProject(projectWith(a, b)).filter((i) => i.level === "error")).toEqual([]);
  });
});

describe("validateProject — reachability", () => {
  it("reports a form no other form can reach", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("shop")), "/menu");
    const issues = validateProject(projectWith(main, createForm("shop"), createForm("orphan")));
    const unreachable = issues.filter((i) => i.level === "warning");
    expect(unreachable).toHaveLength(1);
    expect(unreachable[0].formId).toBe("orphan");
    expect(unreachable[0].message).toMatch(/reach/i);
  });

  it("never reports reachability for a single-form project", () => {
    expect(validateProject(projectWith(createForm("main_menu")))).toEqual([]);
  });

  it("treats a form that registers a command as reachable", () => {
    const main = withCommand(createForm("main_menu"), "/menu");
    const other = withCommand(createForm("other"), "/other");
    expect(validateProject(projectWith(main, other))).toEqual([]);
  });

  it("does not let a form reach itself", () => {
    const main = withCommand(createForm("main_menu"), "/menu");
    const loop = withOnClick(createForm("loop"), openBlock("loop"));
    const issues = validateProject(projectWith(main, loop));
    expect(issues.filter((i) => i.level === "warning" && i.formId === "loop")).toHaveLength(1);
  });
});

describe("ValidationPanel — project section", () => {
  afterEach(() => cleanup());

  function renderExpandedFor(project: Project) {
    useDesignerStore.setState({
      project,
      history: {},
      dirty: false,
      selectedBedrockButtonId: null,
      selectedBedrockComponentId: null
    } as never);
    const result = render(React.createElement(ValidationPanel));
    const summary = result.container.querySelector(".cursor-pointer");
    if (summary) fireEvent.click(summary);
    return result;
  }

  it("shows a cross-form issue from a form other than the active one", () => {
    const main = withCommand(createForm("main_menu"), "/menu");
    const other = withCommand(withOnClick(createForm("other"), openBlock("ghost_menu")), "/other");
    const { container } = renderExpandedFor(projectWith(main, other));
    expect(container.textContent).toContain("Project");
    expect(container.textContent).toContain("ghost_menu");
  });

  it("stays quiet on a clean single-form project", () => {
    const { container } = renderExpandedFor(projectWith(createForm("main_menu")));
    expect(container.textContent).toContain("No validation issues");
  });
});
