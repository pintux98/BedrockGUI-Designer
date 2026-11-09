import React from "react";
import { useExporter } from "../exporters/useExporter";
import { useImporter } from "../importers/useImporter";
import { useDesignerStore } from "../core/store";
import { activeFormStack } from "../store/historySlice";
import { toast } from "../core/toast";
import { confirmDialog } from "../core/confirm";
import { isLegacyDesign, migrateLegacyDesign } from "../core/migrate";
import { parseProject } from "../core/projectSchemas";
import { createEmptyProject } from "../core/project";
import { buildConfigSnippet } from "../serialize/configSnippet";
import { ConfigSnippetDialog } from "../components/ConfigSnippetDialog";
import { Icon } from "../components/Icon";
import { useValidation } from "../core/useValidation";

const DEFAULT_NAME = "Untitled project";

const LINKS = [
  { label: "Documentation", href: "https://pintux.gitbook.io/pintux-support" },
  { label: "GitHub", href: "https://github.com/pintux98/BedrockGUI" },
  { label: "Modrinth", href: "https://modrinth.com/plugin/bedrockgui" },
  { label: "SpigotMC", href: "https://www.spigotmc.org/resources/bedrockgui-spigot-and-bungeecord-support.119592/" },
  { label: "Support on Ko-fi", href: "https://ko-fi.com/pintux" }
];

function savedProjectNames(): string[] {
  const list: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("project_")) list.push(key.slice("project_".length));
    }
  } catch {}
  return list.sort((a, b) => a.localeCompare(b));
}

function useDismiss(open: boolean, close: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function TopBar() {
  const { exportProject } = useExporter();
  const { importYaml } = useImporter();
  const { undo, redo, history, project, setProjectName, loadProject: loadProjectIntoStore } = useDesignerStore();
  const canUndo = activeFormStack(history, project, "undo").length > 0;
  const canRedo = activeFormStack(history, project, "redo").length > 0;
  const name = project.name ?? DEFAULT_NAME;
  const { errorCount } = useValidation();

  const [menu, setMenu] = React.useState<"project" | "help" | null>(null);
  const [projects, setProjects] = React.useState<string[]>(savedProjectNames);
  const [configSnippet, setConfigSnippet] = React.useState<string | null>(null);
  const close = React.useCallback(() => setMenu(null), []);
  const projectRef = useDismiss(menu === "project", close);
  const helpRef = useDismiss(menu === "help", close);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (errorCount > 0) {
      const ok = await confirmDialog({
        title: "Export with errors?",
        message: `${errorCount} ${errorCount === 1 ? "error" : "errors"} will break these forms on the server. Open the problems bar under the preview to see and fix them.`,
        confirmText: "Export anyway",
        cancelText: "Fix first"
      });
      if (!ok) return;
    }
    try {
      await exportProject();
      setConfigSnippet(buildConfigSnippet(project.forms));
    } catch (e) {
      console.error("Failed to export project", e);
      toast.error("Failed to export the project.");
    }
  };

  const saveProject = React.useCallback(() => {
    const current = useDesignerStore.getState().project;
    const projectName = (current.name ?? DEFAULT_NAME).trim();
    if (!projectName) {
      toast.error("Give the project a name before saving.");
      return;
    }
    const result = parseProject(current);
    if (!result.ok) {
      console.error("Failed to save project", result.problems);
      toast.error(`Project '${projectName}' is invalid and was not saved: ${result.problems.slice(0, 3).join("; ")}`);
      return;
    }
    try {
      localStorage.setItem(`project_${projectName}`, JSON.stringify(current));
    } catch {
      toast.error("This browser blocked saving. Export the project instead.");
      return;
    }
    setProjects(savedProjectNames());
    toast.success(`Saved '${projectName}' in this browser.`);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveProject();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveProject]);

  const loadProject = (key: string) => {
    let data: string | null = null;
    try {
      data = localStorage.getItem(`project_${key}`);
    } catch {}
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (isLegacyDesign(parsed)) {
        const { project: legacy, notes } = migrateLegacyDesign(parsed);
        const migrated = parseProject(legacy);
        if (!migrated.ok) {
          toast.error(`Project '${key}' is in an old format and could not be migrated: ${migrated.problems.slice(0, 3).join("; ")}`);
          return;
        }
        loadProjectIntoStore({ ...migrated.project, name: key });
        close();
        toast.info(`Project '${key}' was saved in an old format and has been migrated.`, 6000);
        for (const noteText of notes) toast.info(noteText, 8000);
        return;
      }
      const result = parseProject(parsed);
      if (!result.ok) {
        toast.error(`Failed to load project '${key}': ${result.problems.slice(0, 3).join("; ")}`);
        return;
      }
      loadProjectIntoStore({ ...result.project, name: result.project.name ?? key });
      close();
      toast.success(`Opened '${key}'.`);
    } catch (e) {
      console.error("Failed to load project", e);
      toast.error(`Failed to load project '${key}'.`);
    }
  };

  const deleteProject = async (key: string) => {
    const ok = await confirmDialog({
      title: "Delete saved project",
      message: `Delete '${key}' from this browser? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (!ok) return;
    try {
      localStorage.removeItem(`project_${key}`);
    } catch {}
    setProjects(savedProjectNames());
  };

  const newProject = async () => {
    if (useDesignerStore.getState().dirty) {
      const ok = await confirmDialog({
        title: "Start a new project",
        message: "Unsaved changes to this project will be lost.",
        confirmText: "Start new",
        cancelText: "Cancel"
      });
      if (!ok) return;
    }
    loadProjectIntoStore({ ...createEmptyProject(), name: DEFAULT_NAME });
    close();
  };

  return (
    <header className="relative z-20 flex min-h-12 shrink-0 items-center gap-1.5 border-b border-brand-border bg-brand-surface px-2 pt-[env(safe-area-inset-top)] sm:gap-2 sm:px-3">
      <div className="flex items-center gap-2 pr-1">
        <img src="/favicon.svg" alt="" width="28" height="28" className="size-7" />
        <span className="hidden text-[14px] font-semibold tracking-tight lg:inline">BedrockGUI Designer</span>
      </div>

      <span className="hidden h-5 w-px bg-brand-border sm:block" />

      <div ref={projectRef} className="relative min-w-0">
        <button
          type="button"
          className="ui-btn-ghost max-w-[38vw] text-brand-text sm:max-w-72"
          aria-haspopup="dialog"
          aria-expanded={menu === "project"}
          onClick={() => setMenu(menu === "project" ? null : "project")}
        >
          <Icon name="folder" size={15} className="text-brand-muted" />
          <span className="truncate">{name}</span>
          <Icon name="chevronDown" size={13} className="text-brand-muted" />
        </button>
        {menu === "project" && (
          <div role="dialog" aria-label="Project" className="ui-menu absolute left-0 top-full mt-1.5 w-80 max-w-[calc(100vw-1rem)] p-0">
            <div className="border-b border-brand-border p-3">
              <label className="ui-label" htmlFor="project-name">
                Project name
              </label>
              <input
                id="project-name"
                className="ui-input"
                value={project.name ?? ""}
                placeholder={DEFAULT_NAME}
                onChange={(e) => setProjectName(e.target.value)}
              />
              <div className="mt-2.5 flex gap-2">
                <button type="button" className="ui-btn-primary flex-1" onClick={saveProject}>
                  <Icon name="save" size={14} /> Save in browser
                </button>
                <button type="button" className="ui-btn-secondary" onClick={newProject}>
                  New
                </button>
              </div>
              <p className="ui-hint">Ctrl+S saves. Saved projects stay in this browser only.</p>
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              <div className="px-2.5 pb-1 pt-1.5 text-[12px] font-medium text-brand-muted">Saved projects</div>
              {projects.length === 0 && <p className="px-2.5 pb-2 text-[12.5px] text-brand-muted">Nothing saved yet.</p>}
              {projects.map((p) => (
                <div key={p} className="group flex items-center">
                  <button type="button" className="ui-menu-item flex-1 truncate" onClick={() => loadProject(p)} aria-current={p === name}>
                    <span className={`size-1.5 shrink-0 rounded-full ${p === name ? "bg-brand-accent" : "bg-transparent"}`} />
                    <span className="truncate">{p}</span>
                  </button>
                  <button type="button" className="ui-icon-btn mr-1 hover:!text-brand-danger" aria-label={`Delete ${p}`} title="Delete" onClick={() => deleteProject(p)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center">
        <button type="button" className="ui-icon-btn size-8" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
          <Icon name="undo" size={16} />
        </button>
        <button type="button" className="ui-icon-btn size-8" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Y)">
          <Icon name="redo" size={16} />
        </button>
      </div>

      <div className="flex-1" />

      <div ref={helpRef} className="relative">
        <button
          type="button"
          className="ui-icon-btn size-8"
          aria-label="Help and links"
          aria-haspopup="menu"
          aria-expanded={menu === "help"}
          onClick={() => setMenu(menu === "help" ? null : "help")}
        >
          <Icon name="help" size={17} />
        </button>
        {menu === "help" && (
          <div role="menu" className="ui-menu absolute right-0 top-full mt-1.5 w-56">
            {LINKS.map((l) => (
              <a key={l.href} role="menuitem" href={l.href} target="_blank" rel="noreferrer" className="ui-menu-item justify-between" onClick={close}>
                {l.label}
                <Icon name="external" size={13} className="text-brand-muted" />
              </a>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="ui-btn-secondary" onClick={() => fileRef.current?.click()} aria-label="Import" title="Import .yml, .yaml or .zip">
        <Icon name="upload" size={14} />
        <span className="hidden sm:inline">Import</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".yml,.yaml,.zip"
        className="hidden"
        data-testid="import-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importYaml(file);
          e.target.value = "";
        }}
      />
      <button type="button" className="ui-btn-primary" onClick={() => void handleExport()} aria-label="Export" title="Download the form files">
        <Icon name="download" size={14} />
        <span className="hidden sm:inline">Export</span>
      </button>

      <ConfigSnippetDialog open={configSnippet !== null} onClose={() => setConfigSnippet(null)} snippet={configSnippet ?? ""} />
    </header>
  );
}
