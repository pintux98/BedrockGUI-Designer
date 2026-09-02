import { StateCreator } from "zustand";
import { FormDoc, Project, findForm } from "../core/project";
import { ProjectSlice } from "./projectSlice";
import { SelectionSlice } from "./selectionSlice";
import { UiSlice } from "./uiSlice";

export interface HistoryEntry {
  form: FormDoc;
  description: string;
  /**
   * Strictly monotonic counter used to order this entry against every other
   * history entry — the other forms' stacks as well as project history.
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
  pushProjectHistory: (description: string) => void;
  undo: () => void;
  redo: () => void;
}

const EMPTY: FormHistory = { undo: [], redo: [] };
const EMPTY_PROJECT_HISTORY: ProjectHistory = { undo: [], redo: [] };
const PROJECT_HISTORY_LIMIT = 20;
const FORM_HISTORY_LIMIT = 100;

let lastTimestamp = 0;
function nextTimestamp(): number {
  const now = Date.now();
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1;
  return lastTimestamp;
}

/**
 * The newest entry on any form's `stack`, not just the active form's.
 *
 * Ctrl+Z has to undo the last thing the USER did, wherever it happened. Reading
 * only the active form's stack meant an empty active stack fell through to
 * project history unconditionally and deleted the form on screen, and it meant
 * an edit made on another form could be stepped over entirely.
 *
 * Stacks whose form is no longer in the project are ignored: there is nothing to
 * restore the snapshot onto, and undoing the structural change that removed the
 * form brings its stack back with it.
 */
function newestFormEntry(
  history: Record<string, FormHistory>,
  project: Project,
  stack: "undo" | "redo"
): { formId: string; entry: HistoryEntry } | undefined {
  let best: { formId: string; entry: HistoryEntry } | undefined;
  for (const [formId, value] of Object.entries(history)) {
    const entry = value[stack][value[stack].length - 1];
    if (!entry) continue;
    if (!findForm(project, formId)) continue;
    if (!best || entry.timestamp > best.entry.timestamp) best = { formId, entry };
  }
  return best;
}

/** One row of the user-visible history timeline, from either stack. */
export interface HistoryRow {
  description: string;
  timestamp: number;
}

/**
 * Every entry on one side of the timeline, across all forms plus project history,
 * oldest first.
 *
 * undo()/redo() choose across every form's stack, not just the active form's, so
 * anything that reports on "what can be undone" has to scan the same set or it
 * disagrees with the button it is describing. TopBar and HistoryPanel both use
 * this rather than keeping their own idea of the timeline.
 */
export function allHistoryRows(
  history: Record<string, FormHistory>,
  project: Project,
  projectHistory: ProjectHistory,
  stack: "undo" | "redo"
): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const [formId, value] of Object.entries(history)) {
    if (!findForm(project, formId)) continue;
    for (const entry of value[stack]) rows.push({ description: entry.description, timestamp: entry.timestamp });
  }
  for (const entry of projectHistory[stack]) {
    rows.push({ description: entry.description, timestamp: entry.timestamp });
  }
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

/** Every form's stack with its redo cleared — a new action invalidates all redos. */
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
      const undo = [
        ...current.undo,
        { form: structuredClone(form), description, timestamp: nextTimestamp() }
      ];

      history[formId] = { undo: undo.slice(-FORM_HISTORY_LIMIT), redo: [] };
      return {
        history,
        projectHistory: { ...s.projectHistory, redo: [] }
      };
    });
  },

  pushProjectHistory: (description) => {
    const project = get().project;
    const historySnapshot = get().history;
    set((s) => ({
      history: withClearedRedo(s.history),
      projectHistory: {
        undo: [
          ...s.projectHistory.undo,
          {
            project: structuredClone(project),
            history: structuredClone(historySnapshot),
            description,
            timestamp: nextTimestamp()
          }
        ].slice(-PROJECT_HISTORY_LIMIT),
        redo: []
      }
    }));
  },

  undo: () =>
    set((s) => {
      const projectEntry = s.projectHistory.undo[s.projectHistory.undo.length - 1];
      const newest = newestFormEntry(s.history, s.project, "undo");

      // nextTimestamp() is strictly monotonic, so no two entries can tie.
      if (projectEntry && (!newest || projectEntry.timestamp > newest.entry.timestamp)) {
        return {
          project: projectEntry.project,
          history: projectEntry.history,
          projectHistory: {
            undo: s.projectHistory.undo.slice(0, -1),
            redo: [
              ...s.projectHistory.redo,
              {
                project: structuredClone(s.project),
                history: structuredClone(s.history),
                description: projectEntry.description,
                timestamp: nextTimestamp()
              }
            ]
          },
          dirty: true,
          selectedBedrockButtonId: null,
          selectedBedrockComponentId: null
        };
      }

      if (!newest) return s;
      const { formId, entry } = newest;
      const live = findForm(s.project, formId);
      if (!live) return s;
      const stack = s.history[formId] ?? EMPTY;
      return {
        // Follow the change: reverting a form the user cannot see reads as
        // nothing having happened, or as the wrong thing having changed.
        project: {
          ...s.project,
          activeFormId: formId,
          forms: s.project.forms.map((f) => (f.id === formId ? { ...f, bedrock: entry.form.bedrock } : f))
        },
        history: {
          ...s.history,
          [formId]: {
            undo: stack.undo.slice(0, -1),
            redo: [
              ...stack.redo,
              { form: structuredClone(live), description: entry.description, timestamp: nextTimestamp() }
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
      const projectEntry = s.projectHistory.redo[s.projectHistory.redo.length - 1];
      const newest = newestFormEntry(s.history, s.project, "redo");

      if (projectEntry && (!newest || projectEntry.timestamp > newest.entry.timestamp)) {
        return {
          project: projectEntry.project,
          history: projectEntry.history,
          projectHistory: {
            undo: [
              ...s.projectHistory.undo,
              {
                project: structuredClone(s.project),
                history: structuredClone(s.history),
                description: projectEntry.description,
                timestamp: nextTimestamp()
              }
            ],
            redo: s.projectHistory.redo.slice(0, -1)
          },
          dirty: true,
          selectedBedrockButtonId: null,
          selectedBedrockComponentId: null
        };
      }

      if (!newest) return s;
      const { formId, entry } = newest;
      const live = findForm(s.project, formId);
      if (!live) return s;
      const stack = s.history[formId] ?? EMPTY;
      return {
        project: {
          ...s.project,
          activeFormId: formId,
          forms: s.project.forms.map((f) => (f.id === formId ? { ...f, bedrock: entry.form.bedrock } : f))
        },
        history: {
          ...s.history,
          [formId]: {
            undo: [
              ...stack.undo,
              { form: structuredClone(live), description: entry.description, timestamp: nextTimestamp() }
            ],
            redo: stack.redo.slice(0, -1)
          }
        },
        dirty: true,
        selectedBedrockButtonId: null,
        selectedBedrockComponentId: null
      };
    })
});
