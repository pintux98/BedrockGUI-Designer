import { describe, it, expect } from "vitest";
import { closestCenter } from "@dnd-kit/core";
import { computeDropResult, computeReorderResult, sortableAwareClosestCenter } from "../app/DndHost";
import { BedrockForm } from "../core/types";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";

const customForm: BedrockForm = {
  type: "CUSTOM",
  title: "Form",
  components: []
};

const simpleForm: BedrockForm = {
  type: "SIMPLE",
  title: "Form",
  buttons: [{ id: "button_1", text: "Button 1" }]
};

describe("computeDropResult", () => {
  it("ignores a drop with type: label onto a CUSTOM form and creates no component", () => {
    const result = computeDropResult(customForm, "bedrock-components", "label");
    expect(result).toBeNull();
  });

  it("ignores a drop with an unknown type onto a CUSTOM form", () => {
    const result = computeDropResult(customForm, "bedrock-components", "stepper");
    expect(result).toBeNull();
  });

  it("creates a component for a valid BedrockComponentType", () => {
    const result = computeDropResult(customForm, "bedrock-components", "input");
    expect(result).not.toBeNull();
    if (result?.type !== "CUSTOM") throw new Error("expected CUSTOM");
    expect(result.components).toHaveLength(1);
    expect(result.components[0].type).toBe("input");
  });

  it("creates a button for a SIMPLE form with a unique id", () => {
    const result = computeDropResult(simpleForm, "bedrock-buttons", "button");
    expect(result).not.toBeNull();
    if (result?.type !== "SIMPLE") throw new Error("expected SIMPLE");
    expect(result.buttons.map((b) => b.id)).toEqual(["button_1", "button_2"]);
  });

  it("ignores a button drop onto a CUSTOM form's component zone", () => {
    const result = computeDropResult(customForm, "bedrock-components", "button");
    expect(result).toBeNull();
  });
});

const simpleThree: BedrockForm = {
  type: "SIMPLE",
  title: "Form",
  buttons: [
    { id: "button_1", text: "One" },
    { id: "button_2", text: "Two" },
    { id: "button_3", text: "Three" }
  ]
};

const customThree: BedrockForm = {
  type: "CUSTOM",
  title: "Form",
  components: [
    { id: "component_1", type: "input", props: {} },
    { id: "component_2", type: "toggle", props: {} },
    { id: "component_3", type: "slider", props: {} }
  ]
};

/**
 * The preview and the PropertiesPanel are two SortableContexts over the same model, so they
 * must use different dnd-kit ids (one DndContext, one id namespace) but resolve to the same
 * reorder. Every id below is written out as a literal: if either surface renames its prefix,
 * these go red rather than quietly following along.
 */
describe("computeReorderResult", () => {
  it("reorders buttons dragged inside the preview", () => {
    const result = computeReorderResult(
      simpleThree,
      "bedrock-preview-button-button_1",
      "bedrock-preview-button-button_3"
    );
    if (result?.next.type !== "SIMPLE") throw new Error("expected SIMPLE");
    expect(result.next.buttons.map((b) => b.id)).toEqual(["button_2", "button_3", "button_1"]);
    expect(result.description).toBe("Reordered buttons");
  });

  it("reorders buttons dragged inside the PropertiesPanel exactly the same way", () => {
    const result = computeReorderResult(simpleThree, "bedrock-button-button_3", "bedrock-button-button_1");
    if (result?.next.type !== "SIMPLE") throw new Error("expected SIMPLE");
    expect(result.next.buttons.map((b) => b.id)).toEqual(["button_3", "button_1", "button_2"]);
    expect(result.description).toBe("Reordered buttons");
  });

  it("carries the button payload across, not just the ids", () => {
    const result = computeReorderResult(
      simpleThree,
      "bedrock-preview-button-button_1",
      "bedrock-preview-button-button_2"
    );
    if (result?.next.type !== "SIMPLE") throw new Error("expected SIMPLE");
    expect(result.next.buttons.map((b) => b.text)).toEqual(["Two", "One", "Three"]);
  });

  it("reorders components dragged inside the preview", () => {
    const result = computeReorderResult(
      customThree,
      "bedrock-preview-component-component_3",
      "bedrock-preview-component-component_1"
    );
    if (result?.next.type !== "CUSTOM") throw new Error("expected CUSTOM");
    expect(result.next.components.map((c) => c.id)).toEqual([
      "component_3",
      "component_1",
      "component_2"
    ]);
    expect(result.description).toBe("Reordered components");
  });

  it("returns null when a preview row is dropped on the canvas rather than another row", () => {
    // No reorder, and — because it is null rather than a same-order form — the caller is
    // free to fall through without writing a pointless history entry.
    expect(computeReorderResult(simpleThree, "bedrock-preview-button-button_1", "bedrock-buttons")).toBeNull();
  });

  it("returns null when a row is dropped on itself", () => {
    expect(
      computeReorderResult(simpleThree, "bedrock-preview-button-button_2", "bedrock-preview-button-button_2")
    ).toBeNull();
  });

  it("returns null for an id that is not in the form", () => {
    expect(
      computeReorderResult(simpleThree, "bedrock-preview-button-button_1", "bedrock-preview-button-button_9")
    ).toBeNull();
  });

  it("refuses to reorder buttons on a MODAL form", () => {
    const modal: BedrockForm = {
      type: "MODAL",
      title: "Form",
      buttons: [
        { id: "yes", text: "Yes" },
        { id: "no", text: "No" }
      ]
    };
    expect(computeReorderResult(modal, "bedrock-button-yes", "bedrock-button-no")).toBeNull();
  });

  it("refuses to move a button id through the component prefix", () => {
    expect(
      computeReorderResult(simpleThree, "bedrock-preview-component-button_1", "bedrock-preview-component-button_2")
    ).toBeNull();
  });

  it("leaves the input form untouched", () => {
    computeReorderResult(simpleThree, "bedrock-preview-button-button_1", "bedrock-preview-button-button_3");
    if (simpleThree.type !== "SIMPLE") throw new Error("expected SIMPLE");
    expect(simpleThree.buttons.map((b) => b.id)).toEqual(["button_1", "button_2", "button_3"]);
  });
});

function rect(top: number, left: number, width: number, height: number) {
  return { top, left, width, height, right: left + width, bottom: top + height };
}

function droppable(id: string, containerId?: string) {
  return {
    id,
    key: id,
    disabled: false,
    node: { current: null },
    rect: { current: null },
    data: { current: containerId ? { sortable: { containerId, index: 0, items: [] } } : undefined }
  };
}

/**
 * The geometry below is the real failure this filter exists for: the preview's row list sits
 * inside the `bedrock-buttons` canvas droppable, whose centre lands right on the dragged row.
 * Unfiltered, closestCenter hands back the container and the drop reorders nothing.
 */
describe("sortableAwareClosestCenter", () => {
  const collisionRect = rect(200, 100, 400, 40); // dragged row, centre (300, 220)
  const droppableRects = new Map([
    ["bedrock-buttons", rect(100, 100, 400, 240)], // centre (300, 220) — exactly under the row
    ["bedrock-preview-button-button_2", rect(250, 100, 400, 40)] // centre (300, 270)
  ]);
  const droppableContainers = [
    droppable("bedrock-buttons"),
    droppable("bedrock-preview-button-button_2", "preview-buttons")
  ];

  it("picks the neighbouring row over the container the row lives in", () => {
    const args: any = {
      active: {
        id: "bedrock-preview-button-button_1",
        data: { current: { sortable: { containerId: "preview-buttons", index: 0, items: [] } } },
        rect: { current: { initial: null, translated: null } }
      },
      collisionRect,
      droppableRects,
      droppableContainers,
      pointerCoordinates: null
    };
    expect(sortableAwareClosestCenter(args)[0].id).toBe("bedrock-preview-button-button_2");
    // Control: the same geometry through the untouched algorithm picks the container, which
    // is exactly the silent no-op this wrapper is here to prevent.
    expect(closestCenter(args)[0].id).toBe("bedrock-buttons");
  });

  it("keeps a palette drag on the canvas droppable and off the preview rows", () => {
    // Mirror image of the case above: a palette tile sitting nearer a preview row than the
    // container's centre. `computeDropResult` only accepts the container ids, so resolving
    // to a row would mean the drop adds nothing at all.
    const paletteArgs: any = {
      active: {
        id: "palette-button",
        data: { current: { type: "button" } },
        rect: { current: { initial: null, translated: null } }
      },
      collisionRect: rect(400, 0, 80, 40), // palette tile, centre (40, 420)
      droppableRects: new Map([
        ["bedrock-buttons", rect(100, 100, 400, 600)], // centre (300, 400)
        ["bedrock-preview-button-button_2", rect(400, 60, 200, 40)] // centre (160, 420) — nearer
      ]),
      droppableContainers,
      pointerCoordinates: null
    };
    expect(sortableAwareClosestCenter(paletteArgs)[0].id).toBe("bedrock-buttons");
    // Control: unfiltered, the palette tile would target a row and the drop would be a no-op.
    expect(closestCenter(paletteArgs)[0].id).toBe("bedrock-preview-button-button_2");
  });
});

/**
 * The reorder has to land in the store the way every other edit does — one undoable step,
 * described. This drives the store through the same two calls DndHost's onDragEnd makes.
 */
describe("a preview reorder in the store", () => {
  it("changes the button order and leaves exactly one undoable step behind", () => {
    useDesignerStore.getState().loadProject(createEmptyProject());
    const start = useDesignerStore.getState().activeForm().bedrock;
    if (start.type !== "SIMPLE") throw new Error("expected the empty project to start SIMPLE");
    useDesignerStore.getState().setBedrock(
      {
        ...start,
        buttons: [
          { id: "button_1", text: "One" },
          { id: "button_2", text: "Two" }
        ]
      },
      "Seeded buttons"
    );

    const bedrock = useDesignerStore.getState().activeForm().bedrock;
    const reorder = computeReorderResult(
      bedrock,
      "bedrock-preview-button-button_1",
      "bedrock-preview-button-button_2"
    );
    if (!reorder) throw new Error("expected a reorder");
    useDesignerStore.getState().setBedrock(reorder.next, reorder.description);

    const after = useDesignerStore.getState().activeForm().bedrock;
    if (after.type !== "SIMPLE") throw new Error("expected SIMPLE");
    expect(after.buttons.map((b) => b.id)).toEqual(["button_2", "button_1"]);
    const formId = useDesignerStore.getState().project.activeFormId;
    const undoStack = useDesignerStore.getState().history[formId].undo;
    expect(undoStack[undoStack.length - 1].description).toBe("Reordered buttons");

    useDesignerStore.getState().undo();
    const undone = useDesignerStore.getState().activeForm().bedrock;
    if (undone.type !== "SIMPLE") throw new Error("expected SIMPLE");
    expect(undone.buttons.map((b) => b.id)).toEqual(["button_1", "button_2"]);
  });
});
