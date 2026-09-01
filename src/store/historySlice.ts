import { StateCreator } from "zustand";
import { FormDoc, findForm } from "../core/project";
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

export interface HistorySlice {
  history: Record<string, FormHistory>;
  pushHistory: (formId: string, description: string) => void;
  undo: () => void;
  redo: () => void;
}

const EMPTY: FormHistory = { undo: [], redo: [] };

export const createHistorySlice: StateCreator<
  ProjectSlice & HistorySlice & UiSlice & SelectionSlice, [], [], HistorySlice
> = (set, get) => ({
  history: {},

  pushHistory: (formId, description) => {
    const form = findForm(get().project, formId);
    if (!form) return;
    set((s) => {
      const current = s.history[formId] ?? EMPTY;
      return {
        history: {
          ...s.history,
          [formId]: {
            undo: [...current.undo, { form: structuredClone(form), description, timestamp: Date.now() }],
            redo: []
          }
        }
      };
    });
  },

  undo: () =>
    set((s) => {
      const id = s.project.activeFormId;
      const current = s.history[id] ?? EMPTY;
      const previous = current.undo[current.undo.length - 1];
      const live = findForm(s.project, id);
      if (!previous || !live) return s;
      return {
        project: {
          ...s.project,
          forms: s.project.forms.map((f) => (f.id === id ? { ...f, bedrock: previous.form.bedrock } : f))
        },
        history: {
          ...s.history,
          [id]: {
            undo: current.undo.slice(0, -1),
            redo: [...current.redo, { form: structuredClone(live), description: previous.description, timestamp: Date.now() }]
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
      const current = s.history[id] ?? EMPTY;
      const next = current.redo[current.redo.length - 1];
      const live = findForm(s.project, id);
      if (!next || !live) return s;
      return {
        project: {
          ...s.project,
          forms: s.project.forms.map((f) => (f.id === id ? { ...f, bedrock: next.form.bedrock } : f))
        },
        history: {
          ...s.history,
          [id]: {
            undo: [...current.undo, { form: structuredClone(live), description: next.description, timestamp: Date.now() }],
            redo: current.redo.slice(0, -1)
          }
        },
        dirty: true,
        selectedBedrockButtonId: null,
        selectedBedrockComponentId: null
      };
    })
});
