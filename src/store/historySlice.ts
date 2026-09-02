import { StateCreator } from "zustand";
import { FormDoc, Project, findForm } from "../core/project";
import { ProjectSlice } from "./projectSlice";
import { SelectionSlice } from "./selectionSlice";
import { UiSlice } from "./uiSlice";

export interface HistoryEntry {
  form: FormDoc;
  description: string;
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

let lastTimestamp = 0;
function nextTimestamp(): number {
  const now = Date.now();
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1;
  return lastTimestamp;
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
      const history: Record<string, FormHistory> = {};
      for (const [key, value] of Object.entries(s.history)) {
        history[key] = { undo: value.undo, redo: [] };
      }
      history[formId] = {
        undo: [...current.undo, { form: structuredClone(form), description, timestamp: nextTimestamp() }],
        redo: []
      };
      return {
        history,
        projectHistory: { ...s.projectHistory, redo: [] }
      };
    });
  },

  pushProjectHistory: (description) => {
    const project = get().project;
    const historySnapshot = get().history;
    set((s) => {
      const history: Record<string, FormHistory> = {};
      for (const [key, value] of Object.entries(s.history)) {
        history[key] = { undo: value.undo, redo: [] };
      }
      return {
        history,
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
      };
    });
  },

  undo: () =>
    set((s) => {
      const id = s.project.activeFormId;
      const formStack = s.history[id] ?? EMPTY;
      const formEntry = formStack.undo[formStack.undo.length - 1];
      const projectEntry = s.projectHistory.undo[s.projectHistory.undo.length - 1];

      if (!formEntry && !projectEntry) return s;

      if (projectEntry && (!formEntry || projectEntry.timestamp >= formEntry.timestamp)) {
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

      const live = findForm(s.project, id);
      if (!formEntry || !live) return s;
      return {
        project: {
          ...s.project,
          forms: s.project.forms.map((f) => (f.id === id ? { ...f, bedrock: formEntry.form.bedrock } : f))
        },
        history: {
          ...s.history,
          [id]: {
            undo: formStack.undo.slice(0, -1),
            redo: [...formStack.redo, { form: structuredClone(live), description: formEntry.description, timestamp: nextTimestamp() }]
          }
        },
        dirty: true,
        selectedBedrockButtonId: null,
        selectedBedrockComponentId: null
      };
    }),

  redo: () =>
    set((s) => {
      const id = s.project.activeFormId;
      const formStack = s.history[id] ?? EMPTY;
      const formEntry = formStack.redo[formStack.redo.length - 1];
      const projectEntry = s.projectHistory.redo[s.projectHistory.redo.length - 1];

      if (!formEntry && !projectEntry) return s;

      if (projectEntry && (!formEntry || projectEntry.timestamp >= formEntry.timestamp)) {
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

      const live = findForm(s.project, id);
      if (!formEntry || !live) return s;
      return {
        project: {
          ...s.project,
          forms: s.project.forms.map((f) => (f.id === id ? { ...f, bedrock: formEntry.form.bedrock } : f))
        },
        history: {
          ...s.history,
          [id]: {
            undo: [...formStack.undo, { form: structuredClone(live), description: formEntry.description, timestamp: nextTimestamp() }],
            redo: formStack.redo.slice(0, -1)
          }
        },
        dirty: true,
        selectedBedrockButtonId: null,
        selectedBedrockComponentId: null
      };
    })
});
