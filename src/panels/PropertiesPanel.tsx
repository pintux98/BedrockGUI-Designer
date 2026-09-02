import React from "react";
import { useDesignerStore } from "../core/store";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BufferedInput, BufferedTextArea } from "../components/BufferedInput";
import { VisualActionEditor } from "../actions/VisualActionEditor";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { ConditionBuilder } from "../components/ConditionBuilder";
import { FormChainVisualizer } from "../components/FormChainVisualizer";
import { nextSequentialId } from "../core/ids";

export function PropertiesPanel() {
  const {
    activeForm,
    setBedrock,
    setGlobalActions,
    selectedBedrockButtonId,
    setSelectedBedrockButtonId,
    selectedBedrockComponentId,
    setSelectedBedrockComponentId
  } = useDesignerStore();
  const bedrock = activeForm().bedrock;
  const globalActions = bedrock.globalActions;

  const buttonRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const componentRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    if (!selectedBedrockButtonId) return;
    const el = buttonRefs.current[selectedBedrockButtonId];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedBedrockButtonId]);

  React.useEffect(() => {
    if (!selectedBedrockComponentId) return;
    const el = componentRefs.current[selectedBedrockComponentId];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedBedrockComponentId]);

  return (
    <div className="ui-panel flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col">
      <div className="ui-panel-title shrink-0">Properties</div>
      <div className="p-2">
      {bedrock && (
        <div className="space-y-2">
          <div className="ui-chip">Bedrock</div>
          <CollapsibleSection title="Form Settings" icon="⚙️">
            <div className="space-y-2 pt-2">
              <BufferedInput
                className="ui-input"
                value={bedrock.command ?? ""}
                placeholder="command (optional)"
                onCommit={(v) => setBedrock({ ...bedrock, command: v }, "Updated command")}
              />
              <BufferedInput
                className="ui-input"
                value={bedrock.commandIntercept ?? ""}
                placeholder="command_intercept (optional)"
                onCommit={(v) => setBedrock({ ...bedrock, commandIntercept: v }, "Updated command intercept")}
              />
              <BufferedInput
                className="ui-input"
                value={bedrock.permission ?? ""}
                placeholder="permission (optional)"
                onCommit={(v) => setBedrock({ ...bedrock, permission: v }, "Updated permission")}
              />
              <BufferedInput
                className="ui-input"
                value={bedrock.title}
                maxLength={64}
                onCommit={(v) => setBedrock({ ...bedrock, title: v }, "Updated title")}
              />
              {"content" in bedrock && (
                <BufferedTextArea
                  className="ui-textarea"
                  value={Array.isArray(bedrock.content) ? bedrock.content.join("\n") : bedrock.content ?? ""}
                  onCommit={(v) => setBedrock({ ...bedrock, content: v }, "Updated content")}
                />
              )}
              {bedrock.type === "MODAL" && (
                <div className="text-xs text-yellow-300">
                  Layout locked; content areas are editable.
                </div>
              )}
            </div>
          </CollapsibleSection>
          {(bedrock.type === "SIMPLE" || bedrock.type === "MODAL") && "buttons" in bedrock && (
            <CollapsibleSection title="Buttons" icon="🔘" headerRight={
              bedrock.type === "SIMPLE" && (
                <button
                  className="ui-btn-secondary px-2 py-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    const id = nextSequentialId("button", bedrock.buttons.map((b) => b.id));
                    const buttons = [...bedrock.buttons, { id, text: `Button ${id.split("_")[1]}` }];
                    setBedrock({ ...bedrock, buttons }, "Added button");
                  }}
                >
                  Add
                </button>
              )
            }>
              <div className="pt-2">
              {selectedBedrockButtonId && (
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-brand.accent">Editing button: {selectedBedrockButtonId}</div>
                  <button
                    className="ui-btn-ghost px-2 py-1 text-xs"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedBedrockButtonId(null);
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
              <SortableContext
                items={bedrock.buttons.map((b) => `bedrock-button-${b.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {bedrock.buttons.map((b, idx) => (
                  <SortableCard
                    key={b.id}
                    id={`bedrock-button-${b.id}`}
                    selected={selectedBedrockButtonId === b.id}
                    onSelect={() => {
                      setSelectedBedrockButtonId(b.id);
                      setSelectedBedrockComponentId(null);
                    }}
                    registerRef={(el) => {
                      buttonRefs.current[b.id] = el;
                    }}
                  >
                  <BufferedInput
                    className="ui-input text-xs mb-2"
                    value={b.id}
                    disabled={bedrock.type === "MODAL"}
                    onCommit={(v) => {
                      const trimmed = v.trim();
                      if (!trimmed) return;
                      if (bedrock.buttons.some((other, i) => i !== idx && other.id === trimmed)) return;
                      const buttons = [...bedrock.buttons];
                      buttons[idx] = { ...b, id: trimmed };
                      setBedrock({ ...bedrock, buttons }, "Renamed button ID");
                    }}
                  />
                  <div className="flex gap-2 mb-2">
                    <BufferedTextArea
                      className="flex-1 ui-textarea px-2 py-1 text-xs h-14"
                      value={b.text}
                      maxLength={bedrock.type === "MODAL" ? 64 : 128}
                      placeholder="text (supports new lines)"
                      onCommit={(v) => {
                        const buttons = [...bedrock.buttons];
                        buttons[idx] = { ...b, text: v };
                        setBedrock({ ...bedrock, buttons }, "Updated button text");
                      }}
                    />
                    {bedrock.type === "SIMPLE" && (
                      <button
                        className="ui-btn-secondary px-2 py-1 text-xs"
                        onClick={() => {
                          const buttons = bedrock.buttons.filter((_, i) => i !== idx);
                          setBedrock({
                            ...bedrock,
                            buttons: buttons.length ? buttons : [{ id: "button_1", text: "Button 1" }]
                          }, "Removed button");
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <BufferedInput
                    className="ui-input text-xs mb-2"
                    value={b.image ?? ""}
                    placeholder='image (URL / "Notch" / %player_name% / base64)'
                    onCommit={(v) => {
                      const buttons = [...bedrock.buttons];
                      buttons[idx] = { ...b, image: v ? v : undefined };
                      setBedrock({ ...bedrock, buttons }, "Updated button image");
                    }}
                  />
                  {bedrock.type === "SIMPLE" && (
                    <CollapsibleSection title="Conditions" icon="🔀" defaultExpanded={false}>
                      <div className="pt-2 space-y-2">
                        <div>
                          <div className="text-[10px] text-brand-muted mb-1">Show Condition</div>
                          <BufferedInput
                            className="ui-input text-xs"
                            placeholder="e.g. permission:my.perm or placeholder:{vault_eco_balance} >= 100"
                            value={b.showCondition ?? ""}
                            onCommit={(v) => {
                              const buttons = [...bedrock.buttons];
                              buttons[idx] = { ...b, showCondition: v || undefined };
                              setBedrock({ ...bedrock, buttons }, "Updated show condition");
                            }}
                          />
                        </div>
                        {(b.showCondition || b.alternativeText || b.alternativeImage) && (
                          <>
                            <div>
                              <div className="text-[10px] text-brand-muted mb-1">Alternative Text</div>
                              <BufferedInput
                                className="ui-input text-xs"
                                placeholder="Text when condition is false"
                                value={b.alternativeText ?? ""}
                                onCommit={(v) => {
                                  const buttons = [...bedrock.buttons];
                                  buttons[idx] = { ...b, alternativeText: v || undefined };
                                  setBedrock({ ...bedrock, buttons }, "Updated alternative text");
                                }}
                              />
                            </div>
                            <div>
                              <div className="text-[10px] text-brand-muted mb-1">Alternative Image</div>
                              <BufferedInput
                                className="ui-input text-xs"
                                placeholder="Image when condition is false"
                                value={b.alternativeImage ?? ""}
                                onCommit={(v) => {
                                  const buttons = [...bedrock.buttons];
                                  buttons[idx] = { ...b, alternativeImage: v || undefined };
                                  setBedrock({ ...bedrock, buttons }, "Updated alternative image");
                                }}
                              />
                            </div>
                          </>
                        )}
                        <ConditionBuilder
                          rules={(b.conditions ?? []).map((c) => ({ id: c.id, condition: c.condition, property: c.property, value: c.value }))}
                          onChange={(rules) => {
                            const buttons = [...bedrock.buttons];
                            buttons[idx] = {
                              ...b,
                              conditions: rules.map((r) => ({ id: r.id, condition: r.condition, property: r.property, value: r.value }))
                            };
                            setBedrock({ ...bedrock, buttons }, "Updated conditions");
                          }}
                        />
                      </div>
                    </CollapsibleSection>
                  )}
                  <VisualActionEditor
                    value={(b.onClick ?? []).map((a) => a.raw ?? "").filter(Boolean)}
                    onChange={(blocks) => {
                      const buttons = [...bedrock.buttons];
                      buttons[idx] = {
                        ...b,
                        onClick: blocks.filter(Boolean).map((raw) => ({ id: "raw", params: raw, raw }))
                      };
                      setBedrock({ ...bedrock, buttons }, "Updated button actions");
                    }}
                  />
                  </SortableCard>
                ))}
              </SortableContext>
              </div>
            </CollapsibleSection>
          )}
          {bedrock.type === "CUSTOM" && "components" in bedrock && (
            <CollapsibleSection title="Components" icon="📦">
              <div className="pt-2">
              {selectedBedrockComponentId && (
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-brand.accent">Editing: {selectedBedrockComponentId}</div>
                  <button
                    className="ui-btn-ghost px-2 py-1 text-xs"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedBedrockComponentId(null);
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
              <SortableContext
                items={bedrock.components.map((c) => `bedrock-component-${c.id}`)}
                strategy={verticalListSortingStrategy}
              >
              {bedrock.components.map((c, ci) => (
                <SortableCard
                  key={c.id}
                  id={`bedrock-component-${c.id}`}
                  selected={selectedBedrockComponentId === c.id}
                  onSelect={() => {
                    setSelectedBedrockComponentId(c.id);
                    setSelectedBedrockButtonId(null);
                  }}
                  registerRef={(el) => {
                    componentRefs.current[c.id] = el;
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs">{c.type}</div>
                    <button
                      className="ui-btn-secondary px-2 py-1 text-xs"
                      onClick={() => {
                        const components = bedrock.components.filter((x) => x.id !== c.id);
                        setBedrock({ ...bedrock, components }, "Removed component");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <BufferedInput
                    className="ui-input text-xs mb-2"
                    value={c.id}
                    onCommit={(v) => {
                      const components = [...bedrock.components];
                      components[ci] = { ...c, id: v };
                      setBedrock({ ...bedrock, components }, "Renamed component ID");
                    }}
                  />
                  <ComponentPropsEditor
                    type={c.type}
                    props={c.props}
                    onChange={(props) => {
                      const components = [...bedrock.components];
                      components[ci] = { ...c, props };
                      setBedrock({ ...bedrock, components }, `Updated ${c.type} props`);
                    }}
                  />
                  <VisualActionEditor
                    value={(c.action ?? []).map((a) => a.raw ?? "").filter(Boolean)}
                    onChange={(blocks) => {
                      const components = [...bedrock.components];
                      components[ci] = {
                        ...c,
                        action: blocks.filter(Boolean).map((raw) => ({ id: "raw", params: raw, raw }))
                      };
                      setBedrock({ ...bedrock, components }, "Updated component action");
                    }}
                  />
                </SortableCard>
              ))}
              </SortableContext>
              </div>
            </CollapsibleSection>
          )}
          <CollapsibleSection title="Global Actions" icon="⚡" defaultExpanded={false}>
            <div className="pt-2">
            <VisualActionEditor
              value={(globalActions ?? []).map((a) => a.raw ?? "").filter(Boolean)}
              onChange={(blocks) => {
                setGlobalActions(blocks.filter(Boolean).map((raw) => ({ id: "raw", params: raw, raw })));
              }}
            />
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Form Chains" icon="🔗" defaultExpanded={false}>
            <div className="pt-2">
              <FormChainVisualizer />
            </div>
          </CollapsibleSection>
        </div>
      )}
      </div>
    </div>
  );
}

function SortableCard({
  id,
  selected,
  onSelect,
  registerRef,
  children
}: {
  id: string;
  selected?: boolean;
  onSelect?: () => void;
  registerRef?: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1
  };
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        registerRef?.(node);
      }}
      style={style}
      onClick={onSelect}
      className={`mb-2 bg-brand-surface2 p-2 border ${selected ? "border-brand.accent" : "border-brand-border"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-brand-muted">Drag</div>
        <div className="px-2 py-1 bg-brand-surface text-xs cursor-move select-none border border-brand-border" {...attributes} {...listeners}>
          ⋮⋮
        </div>
      </div>
      {children}
    </div>
  );
}

function ComponentPropsEditor({
  type,
  props,
  onChange
}: {
  type: string;
  props: Record<string, any>;
  onChange: (p: Record<string, any>) => void;
}) {
  if (type === "label") {
    return (
      <BufferedInput
        className="w-full ui-input px-2 py-1 mb-2"
        placeholder="text"
        value={props.text ?? ""}
        onCommit={(v) => onChange({ ...props, text: v })}
      />
    );
  }
  if (type === "input") {
    return (
      <div className="space-y-2 mb-2">
        <BufferedInput
          className="w-full ui-input px-2 py-1"
          placeholder="text"
          value={props.text ?? ""}
          onCommit={(v) => onChange({ ...props, text: v })}
        />
        <BufferedInput
          className="w-full ui-input px-2 py-1"
          placeholder="placeholder"
          value={props.placeholder ?? ""}
          onCommit={(v) => onChange({ ...props, placeholder: v })}
        />
        <BufferedInput
          className="w-full ui-input px-2 py-1"
          placeholder="default"
          value={props.default ?? ""}
          onCommit={(v) => onChange({ ...props, default: v })}
        />
      </div>
    );
  }
  if (type === "dropdown") {
    return (
      <div className="space-y-2 mb-2">
        <BufferedInput
          className="w-full ui-input px-2 py-1"
          placeholder="text"
          value={props.text ?? ""}
          onCommit={(v) => onChange({ ...props, text: v })}
        />
        <BufferedTextArea
          className="ui-textarea h-20 text-xs"
          placeholder="options (one per line)"
          value={Array.isArray(props.options) ? props.options.join("\n") : ""}
          onCommit={(v) =>
            onChange({
              ...props,
              options: v.split("\n").map((s) => s.trim()).filter(Boolean)
            })
          }
        />
        <BufferedInput
          className="w-full ui-input px-2 py-1"
          type="number"
          placeholder="default index"
          value={props.default ?? 0}
          onCommit={(v) => onChange({ ...props, default: Number(v) })}
        />
      </div>
    );
  }
  if (type === "toggle") {
    return (
      <div className="space-y-2 mb-2">
        <BufferedInput
          className="w-full ui-input px-2 py-1"
          placeholder="text"
          value={props.text ?? ""}
          onCommit={(v) => onChange({ ...props, text: v })}
        />
        <label className="flex items-center gap-2 text-xs text-brand-muted">
          <input
            type="checkbox"
            checked={Boolean(props.default)}
            onChange={(e) => onChange({ ...props, default: e.target.checked })}
          />
          default
        </label>
      </div>
    );
  }
  if (type === "slider") {
    return (
      <div className="space-y-2 mb-2">
        <BufferedInput
          className="w-full ui-input px-2 py-1"
          placeholder="text"
          value={props.text ?? ""}
          onCommit={(v) => onChange({ ...props, text: v })}
        />
        <div className="grid grid-cols-4 gap-2">
          <BufferedInput
            className="ui-input px-2 py-1"
            type="number"
            placeholder="min"
            value={props.min ?? 0}
            onCommit={(v) => onChange({ ...props, min: Number(v) })}
          />
          <BufferedInput
            className="ui-input px-2 py-1"
            type="number"
            placeholder="max"
            value={props.max ?? 10}
            onCommit={(v) => onChange({ ...props, max: Number(v) })}
          />
          <BufferedInput
            className="ui-input px-2 py-1"
            type="number"
            placeholder="step"
            value={props.step ?? 1}
            onCommit={(v) => onChange({ ...props, step: Number(v) })}
          />
          <BufferedInput
            className="ui-input px-2 py-1"
            type="number"
            placeholder="default"
            value={props.default ?? 0}
            onCommit={(v) => onChange({ ...props, default: Number(v) })}
          />
        </div>
      </div>
    );
  }
  return null;
}
