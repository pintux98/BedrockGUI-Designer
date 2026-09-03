import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createEmptyProject, createForm, FormDoc, Project } from "../core/project";
import { useDesignerStore } from "../core/store";
import { validateProject } from "../core/validateProject";
import { ValidationPanel } from "../panels/ValidationPanel";
import { BedrockButton, BedrockForm } from "../core/types";

/** Give a form a single button whose onClick is the supplied raw action block. */
function withOnClick(form: FormDoc, ...raws: string[]): FormDoc {
  return withButton(form, { id: "b1", text: "B", onClick: raws.map((raw, i) => ({ id: `a${i}`, params: {}, raw })) });
}

function withButton(form: FormDoc, button: BedrockButton): FormDoc {
  return { ...form, bedrock: { ...form.bedrock, type: "SIMPLE", buttons: [button] } as BedrockForm };
}

function withGlobalActions(form: FormDoc, ...raws: string[]): FormDoc {
  return {
    ...form,
    bedrock: { ...form.bedrock, globalActions: raws.map((raw, i) => ({ id: `g${i}`, params: {}, raw })) } as BedrockForm
  };
}

/** A CUSTOM form whose single component carries the supplied raw action block. */
function withComponentAction(form: FormDoc, raw: string): FormDoc {
  return {
    ...form,
    bedrock: {
      type: "CUSTOM",
      title: "T",
      content: "",
      components: [{ id: "c1", type: "input", props: {}, action: [{ id: "a0", params: {}, raw }] }]
    } as BedrockForm
  };
}

function withCommand(form: FormDoc, command: string): FormDoc {
  return { ...form, bedrock: { ...form.bedrock, command } as BedrockForm };
}

function withCommandIntercept(form: FormDoc, commandIntercept: string): FormDoc {
  return { ...form, bedrock: { ...form.bedrock, commandIntercept } as BedrockForm };
}

function projectWith(...forms: FormDoc[]): Project {
  return { ...createEmptyProject(), forms, activeFormId: forms[0].id };
}

function openBlock(...targets: string[]): string {
  return `open {\n${targets.map((t) => `  - ${JSON.stringify(t)}`).join("\n")}\n}`;
}

function conditionalBlock(branch: "true" | "false", inner: string): string {
  return [
    "conditional {",
    '  check: "permission:some.node"',
    `  ${branch}:`,
    "    - |",
    ...inner.split("\n").map((line) => `      ${line}`),
    "}"
  ].join("\n");
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

  it("says nothing about an open target that is a runtime placeholder", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("category_{selected}")), "/menu");
    expect(validateProject(projectWith(main))).toEqual([]);
  });

  it("does not report the same unknown target twice when two blocks in one form open it", () => {
    const main = withOnClick(createForm("main_menu"), openBlock("ghost_menu"), openBlock("ghost_menu"));
    expect(validateProject(projectWith(main)).filter((i) => i.level === "error")).toHaveLength(1);
  });
});

describe("validateProject — an addon id is never an open target", () => {
  it("errors on an addon action id used as an open target and names the working form", () => {
    // FormMenuUtil.hasMenu reads formMenus, filled only from config.getKeys("forms").
    // bw_arena_main is a registered action handler, never a key under forms:, so the
    // open fails with ACTION_FORM_NOT_FOUND however the server is set up.
    const issues = validateProject(projectWith(withOnClick(createForm("main_menu"), openBlock("bw_arena_main"))));
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].formId).toBe("main_menu");
    expect(errors[0].message).toContain("bw_arena_main");
    expect(errors[0].message).toContain("Bedwars Addon");
    expect(errors[0].message).toContain("BedrockGUI-BedwarsAddon.jar");
    expect(errors[0].message).toContain("is an action type");
    expect(errors[0].message).toContain("ACTION_FORM_NOT_FOUND");
    expect(errors[0].message).toContain("'bw_arena_main { }'");
  });

  it("never downgrades an addon target to a needs-that-addon warning", () => {
    const issues = validateProject(projectWith(withOnClick(createForm("main_menu"), openBlock("pd_duel"))));
    expect(issues.filter((i) => i.level === "warning" && i.formId === "main_menu")).toEqual([]);
    expect(messages(issues)).not.toContain("only works on servers");
  });

  it("keeps the author's own payload in the suggested usage", () => {
    const issues = validateProject(projectWith(withOnClick(createForm("main_menu"), openBlock("hs_region_menu:spawn"))));
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Homestead Addon");
    expect(errors[0].message).toContain("Write it as its own action instead: 'hs_region_menu:spawn'.");
    expect(errors[0].message).not.toContain("hs_region_menu { }");
  });

  it("suggests the empty-block form when the addon id carries no payload", () => {
    const issues = validateProject(projectWith(withOnClick(createForm("main_menu"), openBlock("hs_region_menu"))));
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Write it as its own action instead: 'hs_region_menu { }'.");
  });

  it("does not let an addon id complete a menu chain", () => {
    // shouldTreatValuesAsMenuChain calls hasMenu on every line; bw_shop_main fails it,
    // so the plugin opens shop and hands 'bw_shop_main' to it as an argument.
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("shop", "bw_shop_main")), "/menu");
    const issues = validateProject(projectWith(main, createForm("shop")));
    expect(messages(issues)).not.toContain("bw_shop_main");
    expect(issues).toEqual([]);
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

describe("validateProject — an argument line still has to be a well-formed name", () => {
  // ActionExecutor.executeSingleAction calls handler.isValidAction(valueStr) at :106 and
  // only reaches handler.execute at :113 if it passed. OpenFormActionHandler.isValidAction
  // (:271-303) runs parseNewFormatValues over the whole block and returns false as soon as
  // any one value fails isValidMenuName, so a malformed argument kills the whole action.

  it("reports an argument line that is not a usable menu name and says the whole action dies", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("shop", "diamond sword")), "/menu");
    const errors = validateProject(projectWith(main, createForm("shop"))).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].formId).toBe("main_menu");
    expect(errors[0].message).toBe(
      "Form 'main_menu' opens 'shop' and passes 'diamond sword' to it as an argument, but 'diamond sword' is not a usable menu name — only letters, digits, '_', '.' and '-' are allowed, up to 100 characters. The plugin checks every line of an 'open' block before running it, argument lines included, so the whole action is rejected and 'shop' never opens."
    );
  });

  it("stops counting the head as reached once a malformed argument kills the action", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("shop", "diamond sword")), "/menu");
    const warnings = validateProject(projectWith(main, createForm("shop"))).filter((i) => i.level === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].formId).toBe("shop");
    expect(warnings[0].message).toBe(
      "Form 'shop' is not opened by any other form and registers no command or command_intercept of its own. Only '/bedrockgui open shop' can reach it."
    );
  });

  it("stays silent on a well-formed argument that matches no form, and reports only the malformed one", () => {
    // This is the case the module exists to NOT report: 'diamond_sword' is a legal menu
    // name, so isValidAction passes and the plugin hands it to shop as an argument.
    const hub = withCommand(createForm("hub"), "/hub");
    const ok = withCommand(withOnClick(createForm("ok"), openBlock("hub", "diamond_sword")), "/ok");
    const bad = withCommand(withOnClick(createForm("bad"), openBlock("hub", "diamond sword")), "/bad");
    const issues = validateProject(projectWith(hub, ok, bad));
    expect(issues).toHaveLength(1);
    expect(issues[0].formId).toBe("bad");
    expect(issues[0].message).toContain("passes 'diamond sword' to it as an argument");
    expect(messages(issues)).not.toContain("diamond_sword");
  });

  it("says nothing about an argument line that is a runtime placeholder", () => {
    // FormMenuUtil.handleOnClick substitutes {key}/$key (PlaceholderUtil
    // .processDynamicPlaceholders) and %…% (messageData.replaceVariables) before
    // actionExecutor.executeAction runs, so isValidAction only ever sees the expansion.
    const main = withCommand(
      withOnClick(createForm("main_menu"), openBlock("shop", "{selected}"), openBlock("shop", "%player_name%")),
      "/menu"
    );
    expect(validateProject(projectWith(main, createForm("shop")))).toEqual([]);
  });

  it("checks every argument line, not just the first one after the head", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("shop", "sword", "gold ingot")), "/menu");
    const errors = validateProject(projectWith(main, createForm("shop"))).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("passes 'gold ingot' to it as an argument");
    expect(messages(errors)).not.toContain("'sword'");
  });

  it("reports the same malformed argument once however many blocks carry it", () => {
    const main = withCommand(
      withOnClick(createForm("main_menu"), openBlock("shop", "diamond sword"), openBlock("shop", "diamond sword")),
      "/menu"
    );
    expect(validateProject(projectWith(main, createForm("shop"))).filter((i) => i.level === "error")).toHaveLength(1);
  });

  it("reports an argument line past the plugin's 100-character limit", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("shop", "a".repeat(101))), "/menu");
    const errors = validateProject(projectWith(main, createForm("shop"))).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("up to 100 characters");
  });

  it("accepts an argument line of exactly 100 characters", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("shop", "a".repeat(100))), "/menu");
    expect(validateProject(projectWith(main, createForm("shop")))).toEqual([]);
  });

  it("still reports a broken head alongside the malformed argument", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("ghost_menu", "diamond sword")), "/menu");
    const errors = validateProject(projectWith(main)).filter((i) => i.level === "error");
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain("'ghost_menu', which is not a form in this project");
    expect(errors[1].message).toContain("passes 'diamond sword' to it as an argument");
  });

  it("leaves a malformed single-value open block on the head path, which already reads correctly", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), openBlock("diamond sword")), "/menu");
    const errors = validateProject(projectWith(main)).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe(
      "Form 'main_menu' opens 'diamond sword', which is not a usable menu name — only letters, digits, '_', '.' and '-' are allowed, up to 100 characters. The plugin rejects the action outright rather than looking for a menu."
    );
  });
});

describe("validateProject — the colon form carries exactly one menu name", () => {
  it("counts a colon-form open as reaching its target", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), "open:shop"), "/menu");
    expect(validateProject(projectWith(main, createForm("shop")))).toEqual([]);
  });

  it("treats a space-separated remainder as one malformed name, not a menu plus arguments", () => {
    // ActionExecutor.parseAction splits on the first colon only, and
    // BaseActionHandler.parseActionData adds the remainder whole when it is neither a
    // { } block nor a [ ] list. So this is a menu literally named
    // "shop diamond_sword", which isValidAction rejects before execute ever runs —
    // there is no head/arguments rule in the colon form, and shop is not opened.
    const main = withCommand(withOnClick(createForm("main_menu"), "open:shop diamond_sword"), "/menu");
    const issues = validateProject(projectWith(main, createForm("shop")));
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("shop diamond_sword");
    expect(errors[0].message).toContain("not a usable menu name");
    const warnings = issues.filter((i) => i.level === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].formId).toBe("shop");
  });

  it("separates a malformed name from a well-formed one that simply does not exist", () => {
    const bad = withOnClick(createForm("bad"), "open:has spaces");
    const missing = withOnClick(createForm("missing"), openBlock("ghost_menu"));
    const errors = validateProject(projectWith(bad, missing)).filter((i) => i.level === "error");
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain("not a usable menu name");
    expect(errors[1].message).toContain("is not a form in this project");
    expect(errors[1].message).not.toContain("not a usable menu name");
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

  it("finds an open inside the true branch of a conditional", () => {
    const raw = conditionalBlock("true", openBlock("ghost_menu"));
    const errors = validateProject(projectWith(withOnClick(createForm("main_menu"), raw))).filter(
      (i) => i.level === "error"
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
  });

  it("finds an open inside the false branch of a conditional", () => {
    const raw = conditionalBlock("false", openBlock("ghost_menu"));
    const errors = validateProject(projectWith(withOnClick(createForm("main_menu"), raw))).filter(
      (i) => i.level === "error"
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
  });

  it("counts a form opened only from the false branch of a conditional as reached", () => {
    const main = withCommand(withOnClick(createForm("main_menu"), conditionalBlock("false", openBlock("shop"))), "/menu");
    expect(validateProject(projectWith(main, createForm("shop")))).toEqual([]);
  });
});

describe("validateProject — every place an action can live", () => {
  it("scans a button's alternative_onClick", () => {
    const main = withButton(createForm("main_menu"), {
      id: "b1",
      text: "B",
      showCondition: "permission:vip",
      alternativeOnClick: openBlock("ghost_menu")
    });
    const errors = validateProject(projectWith(main)).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
  });

  it("counts a form opened only from alternative_onClick as reached", () => {
    const main = withCommand(
      withButton(createForm("main_menu"), {
        id: "b1",
        text: "B",
        showCondition: "permission:vip",
        alternativeOnClick: openBlock("shop")
      }),
      "/menu"
    );
    expect(validateProject(projectWith(main, createForm("shop")))).toEqual([]);
  });

  it("scans a conditions rule whose property is onClick", () => {
    const main = withButton(createForm("main_menu"), {
      id: "b1",
      text: "B",
      conditions: [{ id: "r1", condition: "permission:vip", property: "onClick", value: openBlock("ghost_menu") }]
    });
    const errors = validateProject(projectWith(main)).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
  });

  it("counts a form opened only from a conditions onClick rule as reached", () => {
    const main = withCommand(
      withButton(createForm("main_menu"), {
        id: "b1",
        text: "B",
        conditions: [{ id: "r1", condition: "permission:vip", property: "onClick", value: openBlock("shop") }]
      }),
      "/menu"
    );
    expect(validateProject(projectWith(main, createForm("shop")))).toEqual([]);
  });

  it("does not read a conditions rule that overrides text as if it were an action", () => {
    const main = withCommand(
      withButton(createForm("main_menu"), {
        id: "b1",
        text: "B",
        conditions: [{ id: "r1", condition: "permission:vip", property: "text", value: "open:ghost_menu" }]
      }),
      "/menu"
    );
    expect(validateProject(projectWith(main))).toEqual([]);
  });

  it("scans globalActions", () => {
    const main = withGlobalActions(createForm("main_menu"), openBlock("ghost_menu"));
    const errors = validateProject(projectWith(main)).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
  });

  it("counts a form opened only from globalActions as reached", () => {
    const main = withCommand(withGlobalActions(createForm("main_menu"), openBlock("shop")), "/menu");
    expect(validateProject(projectWith(main, createForm("shop")))).toEqual([]);
  });

  it("scans a CUSTOM component's action", () => {
    const main = withComponentAction(createForm("main_menu"), openBlock("ghost_menu"));
    const errors = validateProject(projectWith(main)).filter((i) => i.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost_menu");
  });

  it("counts a form opened only from a CUSTOM component action as reached", () => {
    const main = withCommand(withComponentAction(createForm("main_menu"), openBlock("shop")), "/menu");
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

  it("treats a form that registers only a command_intercept as reachable", () => {
    // BedrockGUI.java:186-193 and :232-239 both call api.openMenu on an intercept
    // match, exactly as they do for form_command.
    const main = withCommand(createForm("main_menu"), "/menu");
    const warp = withCommandIntercept(createForm("warp"), "/warp");
    expect(validateProject(projectWith(main, warp))).toEqual([]);
  });

  it("still reports a form whose command_intercept is blank", () => {
    const main = withCommand(createForm("main_menu"), "/menu");
    const warp = withCommandIntercept(createForm("warp"), "   ");
    const warnings = validateProject(projectWith(main, warp)).filter((i) => i.level === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].formId).toBe("warp");
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
