import React, { useEffect, useState } from "react";
import { Palette } from "../panels/Palette";
import { PropertiesPanel } from "../panels/PropertiesPanel";
import { FormTypePanel } from "../panels/FormTypePanel";
import { FormSwitcher } from "../panels/FormSwitcher";
import { Canvas } from "../canvas/Canvas";
import { ErrorBoundary } from "./ErrorBoundary";
import { TopBar } from "./TopBar";
import { YamlEditorPanel } from "../panels/YamlEditorPanel";
import { useDesignerStore } from "../core/store";
import { DndHost } from "./DndHost";
import { ValidationPanel } from "../panels/ValidationPanel";
import { Wizard } from "../components/Wizard";
import { HistoryPanel } from "../panels/HistoryPanel";
import { ResizablePanel } from "../components/ResizablePanel";
import { useUndoShortcuts } from "./useUndoShortcuts";

type LeftPanelTab = "components" | "history";
type RightPanelTab = "properties" | "yaml";

export function DesignerShell() {
  const { isWizardOpen } = useDesignerStore();
  useUndoShortcuts();
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("components");
  const [rightTab, setRightTab] = useState<RightPanelTab>("properties");
  const [mobileTab, setMobileTab] = useState<"tools" | "canvas" | "properties">("canvas");
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";
  const isDesktop = viewport === "desktop";

  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 768) {
        setViewport("mobile");
        return;
      }
      if (window.innerWidth < 1280) {
        setViewport("tablet");
        return;
      }
      setViewport("desktop");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setLeftPanelOpen(true);
      setRightPanelOpen(true);
    } else if (isTablet) {
      setLeftPanelOpen(false);
      setRightPanelOpen(false);
    }
  }, [isDesktop, isTablet]);

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-brand-bg text-brand-text relative">
      <TopBar />
      {isWizardOpen && <Wizard />}
      <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
        <DndHost>
          <ErrorBoundary>
            <div className={`flex flex-1 overflow-hidden min-h-0 ${isMobile ? "flex-col" : "flex-row"}`}>
              {/* Left Panel Toggle (Tablet/Desktop) */}
              {!isMobile && (
                <button
                  className={`shrink-0 w-7 flex items-center justify-center bg-brand-surface border-r border-brand-border hover:bg-brand-surface-raised transition-colors z-20 ${!leftPanelOpen ? "border-r-0" : ""}`}
                  onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                  aria-label={leftPanelOpen ? "Collapse left panel" : "Expand left panel"}
                >
                  <span className="text-xs text-brand-muted">{leftPanelOpen ? "◀" : "▶"}</span>
                </button>
              )}

              {/* Left Panel */}
              {(!isMobile && leftPanelOpen) && (
                <ResizablePanel
                  initialSize={isTablet ? 280 : 320}
                  minSize={220}
                  maxSize={450}
                  side="left"
                  persistenceKey="left_panel_width"
                  className="border-r border-brand-border h-full bg-brand-surface"
                >
                  <div className="flex flex-col h-full overflow-hidden">
                    {/* Left Panel Tabs */}
                    <div className="flex border-b border-brand-border shrink-0">
                      <button
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${leftTab === "components" ? "text-brand-accent border-b-2 border-brand-accent bg-brand-surface2/50" : "text-brand-muted hover:text-brand-text"}`}
                        onClick={() => setLeftTab("components")}
                      >
                        Components
                      </button>
                      <button
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${leftTab === "history" ? "text-brand-accent border-b-2 border-brand-accent bg-brand-surface2/50" : "text-brand-muted hover:text-brand-text"}`}
                        onClick={() => setLeftTab("history")}
                      >
                        History
                      </button>
                    </div>
                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
                      {leftTab === "components" && (
                        <div className="p-2 space-y-2">
                          <FormSwitcher />
                          <FormTypePanel />
                          <Palette />
                        </div>
                      )}
                      {leftTab === "history" && <HistoryPanel />}
                    </div>
                  </div>
                </ResizablePanel>
              )}

              {/* Mobile Tools Tab */}
              {isMobile && (
                <div className={`w-full flex-1 flex flex-col overflow-hidden ${mobileTab === "tools" ? "flex" : "hidden"}`}>
                  <div className="flex border-b border-brand-border shrink-0">
                    <button
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${leftTab === "components" ? "text-brand-accent border-b-2 border-brand-accent bg-brand-surface2/50" : "text-brand-muted hover:text-brand-text"}`}
                      onClick={() => setLeftTab("components")}
                    >
                      Components
                    </button>
                    <button
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${leftTab === "history" ? "text-brand-accent border-b-2 border-brand-accent bg-brand-surface2/50" : "text-brand-muted hover:text-brand-text"}`}
                      onClick={() => setLeftTab("history")}
                    >
                      History
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {leftTab === "components" && (
                      <div className="p-2 space-y-2">
                        <FormSwitcher />
                        <FormTypePanel />
                        <Palette />
                      </div>
                    )}
                    {leftTab === "history" && <HistoryPanel />}
                  </div>
                </div>
              )}

              {/* Center Canvas */}
              <div className={`flex-1 flex flex-col min-w-0 min-h-0 relative bg-brand-surface2/40 ${isMobile && mobileTab !== "canvas" ? "hidden" : "flex"}`}>
                <div className="flex-1 overflow-hidden relative">
                  <Canvas />
                </div>
                <div className="border-t border-brand-border shrink-0">
                  <ValidationPanel />
                </div>
              </div>

              {/* Right Panel Toggle (Tablet/Desktop) */}
              {!isMobile && (
                <button
                  className={`shrink-0 w-7 flex items-center justify-center bg-brand-surface border-l border-brand-border hover:bg-brand-surface-raised transition-colors z-20 ${!rightPanelOpen ? "border-l-0" : ""}`}
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                  aria-label={rightPanelOpen ? "Collapse right panel" : "Expand right panel"}
                >
                  <span className="text-xs text-brand-muted">{rightPanelOpen ? "▶" : "◀"}</span>
                </button>
              )}

              {/* Right Panel */}
              {(!isMobile && rightPanelOpen) && (
                <ResizablePanel
                  initialSize={isTablet ? 320 : 400}
                  minSize={280}
                  maxSize={600}
                  side="right"
                  persistenceKey="right_panel_width"
                  className="border-l border-brand-border h-full bg-brand-surface"
                >
                  <div className="flex flex-col h-full overflow-hidden">
                    {/* Right Panel Tabs */}
                    <div className="flex border-b border-brand-border shrink-0">
                      <button
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${rightTab === "properties" ? "text-brand-accent border-b-2 border-brand-accent bg-brand-surface2/50" : "text-brand-muted hover:text-brand-text"}`}
                        onClick={() => setRightTab("properties")}
                      >
                        Properties
                      </button>
                      <button
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${rightTab === "yaml" ? "text-brand-accent border-b-2 border-brand-accent bg-brand-surface2/50" : "text-brand-muted hover:text-brand-text"}`}
                        onClick={() => setRightTab("yaml")}
                      >
                        YAML
                      </button>
                    </div>
                    {/* Tab Content */}
                    <div className="flex-1 overflow-hidden min-h-0">
                      {rightTab === "properties" && (
                        <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
                          <PropertiesPanel />
                        </div>
                      )}
                      {rightTab === "yaml" && <YamlEditorPanel defaultExpanded />}
                    </div>
                  </div>
                </ResizablePanel>
              )}

              {/* Mobile Properties Tab */}
              {isMobile && (
                <div className={`w-full flex-1 flex flex-col overflow-hidden min-h-0 ${mobileTab === "properties" ? "flex" : "hidden"}`}>
                  <div className="flex border-b border-brand-border shrink-0">
                    <button
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${rightTab === "properties" ? "text-brand-accent border-b-2 border-brand-accent bg-brand-surface2/50" : "text-brand-muted hover:text-brand-text"}`}
                      onClick={() => setRightTab("properties")}
                    >
                      Properties
                    </button>
                    <button
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${rightTab === "yaml" ? "text-brand-accent border-b-2 border-brand-accent bg-brand-surface2/50" : "text-brand-muted hover:text-brand-text"}`}
                      onClick={() => setRightTab("yaml")}
                    >
                      YAML
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden min-h-0">
                    {rightTab === "properties" && (
                      <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
                        <PropertiesPanel />
                      </div>
                    )}
                    {rightTab === "yaml" && <YamlEditorPanel defaultExpanded />}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Bottom Tab Bar */}
            {isMobile && (
              <div className="min-h-14 bg-brand-surface border-t border-brand-border shrink-0 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] z-50">
                <button 
                  onClick={() => setMobileTab("tools")}
                  className={`flex flex-col items-center justify-center min-h-11 w-20 py-1 rounded transition-colors ${mobileTab === "tools" ? "text-brand-accent" : "text-brand-muted"}`}
                  aria-label="Tools tab"
                  aria-pressed={mobileTab === "tools"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  <span className="text-[10px] font-medium mt-0.5">Tools</span>
                </button>
                <button 
                  onClick={() => setMobileTab("canvas")}
                  className={`flex flex-col items-center justify-center min-h-11 w-20 py-1 rounded transition-colors ${mobileTab === "canvas" ? "text-brand-accent" : "text-brand-muted"}`}
                  aria-label="Canvas tab"
                  aria-pressed={mobileTab === "canvas"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="text-[10px] font-medium mt-0.5">Preview</span>
                </button>
                <button 
                  onClick={() => setMobileTab("properties")}
                  className={`flex flex-col items-center justify-center min-h-11 w-20 py-1 rounded transition-colors ${mobileTab === "properties" ? "text-brand-accent" : "text-brand-muted"}`}
                  aria-label="Properties tab"
                  aria-pressed={mobileTab === "properties"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  <span className="text-[10px] font-medium mt-0.5">Props</span>
                </button>
              </div>
            )}
          </ErrorBoundary>
        </DndHost>
      </div>
    </div>
  );
}
