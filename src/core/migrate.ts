import { Project, createEmptyProject, createForm } from "./project";
import { ActionInstance, BedrockForm } from "./types";

const IGNORED_BUTTON_KEYS = ["translations", "priority", "priorityCondition"] as const;

export function isLegacyDesign(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, any>;
  return !Array.isArray(v.forms) && !!v.bedrock && typeof v.bedrock === "object";
}

export function migrateLegacyDesign(value: unknown): { project: Project; notes: string[] } {
  const legacy = (value ?? {}) as Record<string, any>;
  const notes: string[] = [];
  const project = createEmptyProject();

  const id =
    typeof legacy.menuName === "string" && legacy.menuName.trim() ? legacy.menuName.trim() : "main_menu";
  const form = createForm(id);

  if (legacy.bedrock && typeof legacy.bedrock === "object") {
    form.bedrock = stripForm(legacy.bedrock as BedrockForm, notes);
  }
  if (Array.isArray(legacy.globalActions) && legacy.globalActions.length) {
    form.bedrock = { ...form.bedrock, globalActions: flagUrl(legacy.globalActions, notes) } as BedrockForm;
  }

  project.forms = [form];
  project.activeFormId = form.id;
  return { project, notes };
}

function stripForm(form: BedrockForm, notes: string[]): BedrockForm {
  const next = { ...form } as any;
  if (Array.isArray(next.buttons)) next.buttons = next.buttons.map((b: any) => stripButton(b, notes));
  if (Array.isArray(next.components)) {
    next.components = next.components.map((c: any) => ({ ...c, action: flagUrl(c.action, notes) }));
  }
  if (next.globalActions) next.globalActions = flagUrl(next.globalActions, notes);
  return next as BedrockForm;
}

function stripButton(button: Record<string, any>, notes: string[]) {
  const next = { ...button };
  for (const key of IGNORED_BUTTON_KEYS) {
    if (next[key] !== undefined) {
      delete next[key];
      note(notes, `Removed ${key} — BedrockGUI 2.0.11 does not read it.`);
    }
  }
  next.onClick = flagUrl(next.onClick, notes);
  return next;
}

function flagUrl(actions: ActionInstance[] | undefined, notes: string[]) {
  if (!actions?.length) return actions;
  for (const action of actions) {
    if (typeof action.raw === "string" && /^\s*url\s*\{/.test(action.raw)) {
      note(
        notes,
        "Kept a url action as raw text — the url action was removed from the plugin and fails at runtime."
      );
    }
  }
  return actions;
}

function note(notes: string[], message: string) {
  if (!notes.includes(message)) notes.push(message);
}
