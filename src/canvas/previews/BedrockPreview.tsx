import React from "react";
import { BedrockButton, BedrockComponent, BedrockForm } from "../../core/types";
import { useDesignerStore } from "../../core/store";
import { MinecraftText } from "../../components/MinecraftText";
import { resolveImageForPreview } from "../../core/resolveImage";
import { choiceList } from "../../core/componentMeta";
import { ONLINE_PLAYERS_TOKEN } from "../../plugin/placeholders";
import { InlineTextEditor } from "../InlineEditor";

const SAMPLE_PLAYERS = ["Steve", "Alex"];

function contentToString(content?: string | string[]): string {
  return Array.isArray(content) ? content.join("\n") : content ?? "";
}

export function BedrockPreview({
  form,
  conditionsMet = true
}: {
  form: BedrockForm;
  conditionsMet?: boolean;
}) {
  const { selectedBedrockButtonId, setSelectedBedrockButtonId, selectedBedrockComponentId, setSelectedBedrockComponentId, setBedrock } =
    useDesignerStore();
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [editingButton, setEditingButton] = React.useState<string | null>(null);
  const refs = React.useRef<Record<string, HTMLElement | null>>({});
  const selectedId = selectedBedrockButtonId ?? selectedBedrockComponentId;

  React.useEffect(() => {
    if (selectedId) refs.current[selectedId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const selectButton = (id: string) => {
    setSelectedBedrockComponentId(null);
    setSelectedBedrockButtonId(id);
  };
  const selectComponent = (id: string) => {
    setSelectedBedrockButtonId(null);
    setSelectedBedrockComponentId(id);
  };
  const clearSelection = () => {
    setSelectedBedrockButtonId(null);
    setSelectedBedrockComponentId(null);
  };

  const ring = (selected: boolean) =>
    selected
      ? "outline outline-2 outline-offset-2 outline-[rgb(var(--ui-accent))]"
      : "hover:outline hover:outline-1 hover:outline-offset-2 hover:outline-[rgb(var(--ui-accent)/0.6)]";

  const content = form.type !== "CUSTOM" ? contentToString(form.content) : "";
  const buttons =
    form.type === "CUSTOM" ? [] : (form.buttons ?? []).map((b) => ({ base: b, display: buttonDisplay(b, conditionsMet) }));

  return (
    <div
      className="bedrock-form mx-auto w-full max-w-[480px] select-none"
      onClick={(e) => e.target === e.currentTarget && clearSelection()}
    >
      <div className="relative flex min-h-11 items-center justify-center px-10 py-2" style={{ background: "var(--bf-header)" }}>
        {editingTitle ? (
          <InlineTextEditor
            value={form.title}
            maxLength={64}
            className="w-full text-center text-[17px]"
            onSubmit={(v) => {
              setBedrock({ ...form, title: v }, "Updated title inline");
              setEditingTitle(false);
            }}
            onCancel={() => setEditingTitle(false)}
          />
        ) : (
          <div
            className="cursor-text truncate text-[17px]"
            style={{ color: "var(--bf-title)" }}
            onDoubleClick={() => setEditingTitle(true)}
            title="Double-click to edit"
          >
            {form.title ? <MinecraftText shadow text={form.title} /> : <span className="opacity-40">No title</span>}
          </div>
        )}
        <span aria-hidden="true" className="bedrock-btn absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center text-[13px] leading-none">
          ×
        </span>
      </div>

      <div className="space-y-2 p-3" onClick={(e) => e.target === e.currentTarget && clearSelection()}>
        {content && (
          <div className={`whitespace-pre-wrap px-1 pb-1 text-[15px] leading-snug ${form.type === "MODAL" ? "min-h-20" : ""}`}>
            <MinecraftText shadow text={content} />
          </div>
        )}

        {form.type === "SIMPLE" && buttons.length === 0 && (
          <p className="px-1 py-6 text-center text-[14px] opacity-60">No buttons yet. Use Add button on the left.</p>
        )}

        {form.type !== "CUSTOM" && (
          <div className={`space-y-1.5 ${form.type === "SIMPLE" ? "max-h-[420px] overflow-y-auto pr-0.5" : ""}`}>
            {buttons.map(({ base, display }) => (
              <div
                key={base.id}
                ref={(el) => {
                  refs.current[base.id] = el;
                }}
                role="button"
                tabIndex={0}
                data-button-id={base.id}
                aria-label={`Select button ${base.id}`}
                aria-pressed={selectedBedrockButtonId === base.id}
                onClick={() => selectButton(base.id)}
                onDoubleClick={() => setEditingButton(base.id)}
                onKeyDown={(e) => {
                  if (editingButton === base.id) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectButton(base.id);
                  }
                }}
                className={`bedrock-btn relative flex min-h-12 w-full items-center px-2 py-1.5 text-[15px] ${ring(selectedBedrockButtonId === base.id)} ${
                  display.hidden ? "opacity-35 [border-style:dashed]" : ""
                }`}
              >
                {form.type === "SIMPLE" && (
                  <span className="flex size-8 shrink-0 items-center justify-center">
                    {display.image && <ButtonImage image={display.image} />}
                  </span>
                )}
                <span className="flex-1 whitespace-pre-wrap px-1 text-center leading-tight">
                  {editingButton === base.id ? (
                    <InlineTextEditor
                      value={base.text}
                      className="w-full text-center"
                      onSubmit={(v) => {
                        setBedrock(
                          { ...form, buttons: form.buttons.map((b) => (b.id === base.id ? { ...b, text: v } : b)) },
                          "Updated button text inline"
                        );
                        setEditingButton(null);
                      }}
                      onCancel={() => setEditingButton(null)}
                    />
                  ) : (
                    <MinecraftText shadow text={display.text} />
                  )}
                </span>
                {form.type === "SIMPLE" && <span className="size-8 shrink-0" />}
                {display.hidden && (
                  <span className="absolute right-1.5 top-1 font-sans text-[10.5px] opacity-80">hidden</span>
                )}
              </div>
            ))}
          </div>
        )}

        {form.type === "CUSTOM" && (
          <>
            {!form.components?.length && (
              <p className="px-1 py-6 text-center text-[14px] opacity-60">No fields yet. Use Add field on the left.</p>
            )}
            <div className="space-y-3">
              {(form.components ?? []).map((c) => (
                <div
                  key={c.id}
                  ref={(el) => {
                    refs.current[c.id] = el;
                  }}
                  role="button"
                  tabIndex={0}
                  data-component-id={c.id}
                  aria-label={`Select field ${c.id}`}
                  aria-pressed={selectedBedrockComponentId === c.id}
                  onClick={() => selectComponent(c.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), selectComponent(c.id))}
                  className={`cursor-pointer px-1 py-0.5 ${ring(selectedBedrockComponentId === c.id)}`}
                >
                  <ComponentView component={c} />
                </div>
              ))}
            </div>
            <div className="bedrock-btn mt-2 flex min-h-10 items-center justify-center text-[15px]" aria-hidden="true">
              Submit
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ComponentView({ component }: { component: BedrockComponent }) {
  const p = component.props as Record<string, any>;
  const text = String(p.text ?? "");
  const label = text ? <MinecraftText shadow text={text} /> : null;

  if (component.type === "label") {
    return <div className="whitespace-pre-wrap text-[15px] leading-snug">{label ?? <span className="opacity-40">Empty label</span>}</div>;
  }
  if (component.type === "input") {
    const value = String(p.default ?? "");
    return (
      <div className="space-y-1">
        <div className="text-[15px]">{label}</div>
        <div className="bedrock-field px-2 py-1.5 text-[15px]">
          {value ? <MinecraftText shadow text={value} /> : <span className="opacity-50">{String(p.placeholder ?? "")}</span>}
        </div>
      </div>
    );
  }
  if (component.type === "dropdown") {
    const options = expandPlayers(choiceList(p.options));
    return (
      <div className="space-y-1">
        <div className="text-[15px]">{label}</div>
        <div className="bedrock-btn flex items-center justify-between px-2 py-1.5 text-[15px]">
          <MinecraftText shadow text={options[Number(p.default ?? 0)] ?? options[0] ?? ""} />
          <span aria-hidden="true">▾</span>
        </div>
      </div>
    );
  }
  if (component.type === "toggle") {
    const on = p.default === true || p.default === "true";
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px]">{label}</div>
        <span className="bedrock-field relative h-6 w-12 shrink-0" style={{ background: on ? "var(--bf-fill)" : undefined }}>
          <span className="bedrock-btn absolute top-0 h-5 w-5" style={{ left: on ? "calc(100% - 20px)" : 0 }} />
        </span>
      </div>
    );
  }
  if (component.type === "slider" || component.type === "step_slider") {
    let pct = 0;
    let shown = "";
    let ticks = 0;
    if (component.type === "slider") {
      const min = Number(p.min ?? 0);
      const max = Number(p.max ?? 10);
      const value = Number(p.default ?? min);
      pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
      shown = String(value);
    } else {
      const steps = expandPlayers(choiceList(p.steps));
      const index = Math.min(Math.max(Number(p.default ?? 0), 0), Math.max(steps.length - 1, 0));
      pct = steps.length > 1 ? (index / (steps.length - 1)) * 100 : 0;
      shown = steps[index] ?? "";
      ticks = steps.length;
    }
    pct = Math.max(0, Math.min(100, pct));
    return (
      <div className="space-y-1.5">
        <div className="text-[15px]">
          {label}
          {label && ": "}
          <MinecraftText shadow text={shown} />
        </div>
        <div className="bedrock-field relative h-3">
          <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: "var(--bf-fill)" }} />
          {ticks > 1 &&
            Array.from({ length: ticks }, (_, i) => (
              <span key={i} className="absolute top-0 h-full w-0.5 bg-black/40" style={{ left: `${(i / (ticks - 1)) * 100}%` }} />
            ))}
          <span className="bedrock-btn absolute -top-1.5 h-5 w-3 -translate-x-1/2" style={{ left: `${pct}%` }} />
        </div>
      </div>
    );
  }
  return <div className="text-[15px] opacity-60">{component.type}</div>;
}

function expandPlayers(list: string[]): string[] {
  return list.flatMap((o) => (o.trim().toLowerCase() === ONLINE_PLAYERS_TOKEN ? SAMPLE_PLAYERS : [o]));
}

function ButtonImage({ image }: { image: string }) {
  const assets = useDesignerStore((s) => s.project.assets);
  const { src, label } = resolveImageForPreview(image, assets);
  if (src) return <img src={src} alt="" title={label} className="image-rendering-pixelated size-7" />;
  return (
    <span
      title={label}
      className="flex size-7 items-center justify-center border-2 border-[#373737] bg-[#8b8b8b] font-sans text-[9px] font-semibold leading-none text-white"
    >
      {image.replace(/^.*[/:]/, "").trim().slice(0, 2).toUpperCase()}
    </span>
  );
}

function buttonDisplay(button: BedrockButton, conditionsMet: boolean): { text: string; image?: string; hidden: boolean } {
  const rules = button.conditions ?? [];
  const pick = (prop: string) => rules.find((r) => r.property === prop)?.value;
  if (conditionsMet) {
    return { text: pick("text") ?? button.text, image: pick("image") ?? button.image, hidden: false };
  }
  const hasShow = Boolean(button.showCondition?.trim());
  return {
    text: button.alternativeText ?? button.text,
    image: button.alternativeImage ?? button.image,
    hidden: hasShow && !button.alternativeText && !button.alternativeImage
  };
}
