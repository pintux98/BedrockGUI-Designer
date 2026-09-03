import { StateCreator } from "zustand";
import { FormDoc, Project, findForm } from "../core/project";
import { toast } from "../core/toast";
import { ProjectSlice } from "./projectSlice";
import { SelectionSlice } from "./selectionSlice";
import { UiSlice } from "./uiSlice";

export interface HistoryEntry {
  form: FormDoc;
  description: string;
  /**
   * Strictly monotonic counter, unique across every stack.
   *
   * Nothing compares it *across* stacks any more — undo is per form — but it
   * still orders a single stack for display, and `undoProject` uses it to tell
   * a live structural toast from a stale one.
   */
  timestamp: number;
}

export interface FormHistory {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

export interface ProjectHistoryEntry {
  project: Project;
  history: Record<string, FormHistory>;
  description: string;
  timestamp: number;
}

export interface ProjectHistory {
  undo: ProjectHistoryEntry[];
  redo: ProjectHistoryEntry[];
}

export interface HistorySlice {
  history: Record<string, FormHistory>;
  projectHistory: ProjectHistory;
  pushHistory: (formId: string, description: string) => void;
  /**
   * Record a structural change. `undoToast` raises a toast carrying an Undo
   * button — reserved for changes a user cannot trivially reverse by hand.
   * Deleting a form takes it; adding, renaming and duplicating one do not,
   * because a toast per structural action is noise and they are all reachable
   * from the History panel's Project section anyway.
   */
  pushProjectHistory: (description: string, options?: { undoToast?: boolean }) => void;
  /** Undo one edit **on the form currently on screen**, or nothing at all. */
  undo: () => void;
  /** Redo one edit on the form currently on screen, or nothing at all. */
  redo: () => void;
  /**
   * Undo one structural change. Reached only from the toast raised when the
   * change happened and from the History panel's Project section — never from
   * ctrl+z. `timestamp`, when given, pins the entry the caller means: a stale
   * toast is a no-op rather than an undo of something newer.
   */
  undoProject: (timestamp?: number) => void;
  redoProject: () => void;
}

/**
 * History snapshots are stored **by reference, never cloned.**
 *
 * That is safe because the whole store is replace-only: every write path builds
 * a new object at each level it touches and leaves the old one alone. Nothing
 * anywhere mutates a `Project`, a `FormDoc`, a `BedrockForm`, a button, a
 * component, a `FormHistory` or a history array in place — the panels all edit
 * through `{ ...x, field }` / `[...arr]` / `.map` / `.filter`, and the store
 * actions do the same. So an object handed to a snapshot is frozen in practice
 * the moment the action that captured it returns: the next edit replaces it
 * rather than changing it, and the snapshot keeps pointing at the old value.
 *
 * The code already depended on this before the clones were dropped — the project
 * branch of `undo` installs `projectEntry.project`/`projectEntry.history`
 * *directly* as live state, and the form branch aliases `entry.form.bedrock`
 * into the live project. Deep-cloning on the way in never protected those.
 *
 * The clones were not merely wasted work, they were the cost: `structuredClone`
 * denies every entry any structural sharing, so a 20-entry project stack
 * carrying a 100-entry form stack retained 20 x 100 independent deep copies of
 * the form. Storing references lets the 99 unchanged buttons of consecutive
 * entries be one set of objects.
 *
 * **If you ever make some path mutate stored state in place, this breaks** —
 * and it breaks history correctness generally, not just here. Keep the store
 * replace-only. `store.spec.ts` -> "keeps a project-history snapshot isolated
 * from every later edit" is the regression guard.
 */
const EMPTY: FormHistory = { undo: [], redo: [] };
const EMPTY_PROJECT_HISTORY: ProjectHistory = { undo: [], redo: [] };
const PROJECT_HISTORY_LIMIT = 20;
const FORM_HISTORY_LIMIT = 100;

/**
 * How long a structural change's undo toast stays up.
 *
 * Longer than the 2.5s default because this toast is not a notification — it is
 * the only immediate way back from a form delete, and the user has to read it
 * and aim at a button.
 */
const STRUCTURAL_UNDO_TOAST_MS = 8000;

let lastTimestamp = 0;
function nextTimestamp(): number {
  const now = Date.now();
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1;
  return lastTimestamp;
}

/**
 * The one stack `undo()`/`redo()` act on: the active form's, oldest entry first.
 *
 * Anything that reports on what ctrl+z will do has to read exactly this, or it
 * describes a different button than the one the user presses. The TopBar's
 * Undo/Redo gates and the History panel's "This form" section both call it.
 *
 * It replaces `allHistoryRows`, which merged every form's stack with project
 * history. That was the honest answer while undo chose across all of them; it
 * is the wrong answer now, and there is no caller left that wants the union —
 * the panel's Project section reads `projectHistory` directly, because
 * `ProjectHistoryEntry` already carries the description and timestamp a row
 * needs.
 */
export function activeFormStack(
  history: Record<string, FormHistory>,
  project: Project,
  stack: "undo" | "redo"
): HistoryEntry[] {
  return history[project.activeFormId]?.[stack] ?? [];
}

/**
 * Every form's stack with its redo cleared — a new action invalidates all redos.
 *
 * This builds a new record and new `FormHistory` values and never writes into
 * the ones it was given. That is required, not stylistic: `pushProjectHistory`
 * snapshots the record it is replacing by reference, so clearing the redos in
 * place would empty the snapshot's redo stacks too.
 */
function withClearedRedo(history: Record<string, FormHistory>): Record<string, FormHistory> {
  const next: Record<string, FormHistory> = {};
  for (const [key, value] of Object.entries(history)) {
    next[key] = { undo: value.undo, redo: [] };
  }
  return next;
}

export const createHistorySlice: StateCreator<
  ProjectSlice & HistorySlice & UiSlice & SelectionSlice, [], [], HistorySlice
> = (set, get) => ({
  history: {},
  projectHistory: EMPTY_PROJECT_HISTORY,

  pushHistory: (formId, description) => {
    const form = findForm(get().project, formId);
    if (!form) return;
    set((s) => {
      const current = s.history[formId] ?? EMPTY;
      const history = withClearedRedo(s.history);

      // One push, one undo step. Entries are never merged. A description is not
      // an identity — two "Added button" clicks, two different buttons both
      // "Updated button text", a drag-reorder and a palette drop both falling
      // through to "Updated form" — so collapsing on it silently threw away
      // steps the user still needed. Editors that fire per keystroke buffer
      // their own writes instead of being retro-merged here.
      //
      // `form` is the live FormDoc as it stands *before* the edit. setBedrock's
      // own set() is about to swap it for a fresh `{ ...f, bedrock }`, so this
      // reference is orphaned from live state the moment we return.
      const undo = [
        ...current.undo,
        { form, description, timestamp: nextTimestamp() }
      ];

      history[formId] = { undo: undo.slice(-FORM_HISTORY_LIMIT), redo: [] };
      return {
        history,
        projectHistory: { ...s.projectHistory, redo: [] }
      };
    });
  },

  pushProjectHistory: (description, options) => {
    // Both are read before the structural action's own set() runs, and both are
    // replaced by it — `project` by `{ ...s.project, ... }` in projectSlice, and
    // `history` by the withClearedRedo() below, which builds a whole new record
    // rather than clearing the redos in place. So neither reference is reachable
    // from live state afterwards, and neither can drift.
    const project = get().project;
    const historySnapshot = get().history;
    const timestamp = nextTimestamp();
    set((s) => ({
      history: withClearedRedo(s.history),
      projectHistory: {
        undo: [
          ...s.projectHistory.undo,
          { project, history: historySnapshot, description, timestamp }
        ].slice(-PROJECT_HISTORY_LIMIT),
        redo: []
      }
    }));

    // Ctrl+Z is scoped to the form on screen and deliberately never reaches
    // project history, so this toast and the History panel's Project section
    // are the whole recovery story for a structural change. Raising it here
    // rather than in each caller is what makes that true for *every* structural
    // action, `setAssets` included — some of their panels have
    // never known anything about undo, and a toast they have to opt into is a
    // toast that goes missing.
    if (options?.undoToast) {
      toast.info(description, STRUCTURAL_UNDO_TOAST_MS, {
        label: "Undo",
        onClick: () => get().undoProject(timestamp)
      });
    }
  },

  /**
   * Undo the last edit to the form on screen. Nothing else, ever.
   *
   * The bug this shape has to keep avoiding was structural, not a missing
   * check: the old per-form undo read the active form's entry, and when that
   * entry was `undefined` it *fell through* to a project branch that ran
   * unconditionally — so ctrl+z on a form the user had never edited deleted a
   * different form, and the button's own tooltip lied about it.
   *
   * There is no branch to fall through to here. `undoProject` is a separate
   * action with its own callers (the structural toast, the History panel's
   * Project section), so the only thing an empty stack can do is return `s`
   * unchanged. It also never reassigns `activeFormId`: the entry belongs to the
   * form already on screen, so there is nothing to follow.
   */
  undo: () =>
    set((s) => {
      const formId = s.project.activeFormId;
      const stack = s.history[formId] ?? EMPTY;
      const entry = stack.undo[stack.undo.length - 1];
      if (!entry) return s;
      const live = findForm(s.project, formId);
      if (!live) return s;
      return {
        project: {
          ...s.project,
          forms: s.project.forms.map((f) => (f.id === formId ? { ...f, bedrock: entry.form.bedrock } : f))
        },
        history: {
          ...s.history,
          [formId]: {
            undo: stack.undo.slice(0, -1),
            // The project above replaces this FormDoc with a fresh
            // `{ ...f, bedrock }`, so `live` leaves the project as we store it.
            redo: [
              ...stack.redo,
              { form: live, description: entry.description, timestamp: nextTimestamp() }
            ]
          }
        },
        dirty: true,
        selectedBedrockButtonId: null,
        selectedBedrockComponentId: null
      };
    }),

  redo: () =>
    set((s) => {
      const formId = s.project.activeFormId;
      const stack = s.history[formId] ?? EMPTY;
      const entry = stack.redo[stack.redo.length - 1];
      if (!entry) return s;
      const live = findForm(s.project, formId);
      if (!live) return s;
      return {
        project: {
          ...s.project,
          forms: s.project.forms.map((f) => (f.id === formId ? { ...f, bedrock: entry.form.bedrock } : f))
        },
        history: {
          ...s.history,
          [formId]: {
            // `live` is orphaned by the project rebuild above — see undo().
            undo: [
              ...stack.undo,
              { form: live, description: entry.description, timestamp: nextTimestamp() }
            ],
            redo: stack.redo.slice(0, -1)
          }
        },
        dirty: true,
        selectedBedrockButtonId: null,
        selectedBedrockComponentId: null
      };
    }),

  undoProject: (timestamp) =>
    set((s) => {
      const entry = s.projectHistory.undo[s.projectHistory.undo.length - 1];
      if (!entry) return s;
      // A structural toast carries the timestamp of the change it was raised
      // for. Once a newer structural change lands, that toast is stale, and
      // popping the stack for it would undo something the user never pointed
      // at — the same "it undid the wrong thing" complaint that made undo
      // per-form. The newer change has a toast of its own.
      if (timestamp !== undefined && entry.timestamp !== timestamp) return s;
      return {
        // Restoring a whole-project snapshot also rewinds form content edited
        // since. That is what project history has always been — the History
        // panel's Project section has the same reach — and the timestamp guard
        // is what keeps the toast from doing it behind the user's back.
        project: entry.project,
        history: entry.history,
        projectHistory: {
          undo: s.projectHistory.undo.slice(0, -1),
          redo: [
            ...s.projectHistory.redo,
            {
              // This same set() replaces `project` and `history` wholesale
              // with the snapshot's, so the outgoing pair is orphaned.
              project: s.project,
              history: s.history,
              description: entry.description,
              timestamp: nextTimestamp()
            }
          ]
        },
        dirty: true,
        selectedBedrockButtonId: null,
        selectedBedrockComponentId: null
      };
    }),

  redoProject: () =>
    set((s) => {
      const entry = s.projectHistory.redo[s.projectHistory.redo.length - 1];
      if (!entry) return s;
      return {
        project: entry.project,
        history: entry.history,
        projectHistory: {
          undo: [
            ...s.projectHistory.undo,
            {
              // Replaced by the snapshot in this same set() — see undoProject().
              project: s.project,
              history: s.history,
              description: entry.description,
              timestamp: nextTimestamp()
            }
          ],
          redo: s.projectHistory.redo.slice(0, -1)
        },
        dirty: true,
        selectedBedrockButtonId: null,
        selectedBedrockComponentId: null
      };
    })
});
