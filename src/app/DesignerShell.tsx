import React from "react";
import { PropertiesPanel } from "../panels/PropertiesPanel";
import { FormSwitcher } from "../panels/FormSwitcher";
import { Outline } from "../panels/Outline";
import { Canvas } from "../canvas/Canvas";
import { ErrorBoundary } from "./ErrorBoundary";
import { TopBar } from "./TopBar";
import { YamlEditorPanel } from "../panels/YamlEditorPanel";
import { DndHost } from "./DndHost";
import { ValidationPanel } from "../panels/ValidationPanel";
import { HistoryPanel } from "../panels/HistoryPanel";
import { ResizablePanel } from "../components/ResizablePanel";
import { useUndoShortcuts } from "./useUndoShortcuts";
import { useDesignerStore } from "../core/store";
import { Icon, IconName } from "../components/Icon";

type RightTab = "edit" | "yaml" | "history";
type MobileTab = "forms" | "preview" | "edit";

const RIGHT_TABS: { id: RightTab; label: string }[] = [
  { id: "edit", label: "Edit" },
  { id: "yaml", label: "YAML" },
  { id: "history", label: "History" }
];

const MOBILE_TABS: { id: MobileTab; label: string; icon: IconName }[] = [
  { id: "forms", label: "Forms", icon: "list" },
  { id: "preview", label: "Preview", icon: "eye" },
  { id: "edit", label: "Edit", icon: "pencil" }
];

function useIsMobile() {
  const query = "(max-width: 767px)";
  const [mobile, setMobile] = React.useState(() => window.matchMedia?.(query).matches ?? false);
  React.useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

function LeftColumn() {
  return (
    <div className="h-full overflow-y-auto">
      <FormSwitcher />
      <div className="mx-3 my-2 h-px bg-brand-border" />
      <Outline />
    </div>
  );
}

function RightColumn({ tab, onTab }: { tab: RightTab; onTab: (t: RightTab) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Side panel" className="flex shrink-0 gap-1 border-b border-brand-border px-2 pt-1.5">
        {RIGHT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            className={`-mb-px border-b-2 px-2.5 pb-2 pt-1 text-[13px] font-medium ${
              tab === t.id ? "border-brand-accent text-brand-text" : "border-transparent text-brand-muted hover:text-brand-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
        {tab === "edit" && <PropertiesPanel />}
        {tab === "yaml" && <YamlEditorPanel defaultExpanded />}
        {tab === "history" && <HistoryPanel />}
      </div>
    </div>
  );
}

export function DesignerShell() {
  useUndoShortcuts();
  const isMobile = useIsMobile();
  const [rightTab, setRightTab] = React.useState<RightTab>("edit");
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("preview");
  const selection = useDesignerStore((s) => s.selectedBedrockButtonId ?? s.selectedBedrockComponentId);

  React.useEffect(() => {
    if (selection) setRightTab("edit");
  }, [selection]);

  const center = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <Canvas />
      </div>
      <ValidationPanel />
    </div>
  );

  return (
    <div className="flex h-dvh w-full flex-col bg-brand-bg text-brand-text">
      <TopBar />
      <DndHost>
        <ErrorBoundary>
          {isMobile ? (
            <>
              <main className="flex min-h-0 flex-1 flex-col bg-brand-surface">
                {mobileTab === "forms" && <LeftColumn />}
                {mobileTab === "preview" && center}
                {mobileTab === "edit" && <RightColumn tab={rightTab} onTab={setRightTab} />}
              </main>
              <nav aria-label="Workspace" className="flex shrink-0 border-t border-brand-border bg-brand-surface pb-[env(safe-area-inset-bottom)]">
                {MOBILE_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={mobileTab === t.id}
                    onClick={() => setMobileTab(t.id)}
                    className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11.5px] font-medium ${
                      mobileTab === t.id ? "text-brand-accent" : "text-brand-muted"
                    }`}
                  >
                    <Icon name={t.icon} size={19} />
                    {t.label}
                  </button>
                ))}
              </nav>
            </>
          ) : (
            <div className="flex min-h-0 flex-1">
              <aside aria-label="Forms and elements" className="w-56 shrink-0 border-r border-brand-border bg-brand-surface lg:w-64">
                <LeftColumn />
              </aside>
              {center}
              <ResizablePanel
                initialSize={380}
                minSize={320}
                maxSize={560}
                side="right"
                persistenceKey="right_panel_width"
                className="h-full border-l border-brand-border bg-brand-surface"
              >
                <RightColumn tab={rightTab} onTab={setRightTab} />
              </ResizablePanel>
            </div>
          )}
        </ErrorBoundary>
      </DndHost>
    </div>
  );
}
