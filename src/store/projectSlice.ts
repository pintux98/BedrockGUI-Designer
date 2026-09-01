import { StateCreator } from "zustand";
import { AssetsConfig, FormDoc, Project, createEmptyProject, createForm, findForm } from "../core/project";
import { PlatformTarget } from "../plugin/platforms";
import { ActionInstance, BedrockForm } from "../core/types";
import { HistorySlice } from "./historySlice";
import { UiSlice } from "./uiSlice";

export interface ProjectSlice {
  project: Project;
  activeForm: () => FormDoc;
  loadProject: (project: Project) => void;
  setActiveForm: (id: string) => void;
  addForm: (id: string) => void;
  renameForm: (from: string, to: string) => void;
  duplicateForm: (id: string) => void;
  removeForm: (id: string) => void;
  setBedrock: (form: BedrockForm, description?: string) => void;
  setGlobalActions: (actions: ActionInstance[] | undefined, description?: string) => void;
  setAssets: (assets: AssetsConfig) => void;
  setPlatformTarget: (target: PlatformTarget) => void;
}

export const createProjectSlice: StateCreator<
  ProjectSlice & HistorySlice & UiSlice, [], [], ProjectSlice
> = (set, get) => ({
  project: createEmptyProject(),

  activeForm: () => {
    const { project } = get();
    return findForm(project, project.activeFormId) ?? project.forms[0];
  },

  loadProject: (project) => set({ project, dirty: false, history: {} }),

  setActiveForm: (id) =>
    set((s) => (findForm(s.project, id) ? { project: { ...s.project, activeFormId: id } } : s)),

  addForm: (id) =>
    set((s) => {
      if (!id.trim() || findForm(s.project, id)) return s;
      return { project: { ...s.project, forms: [...s.project.forms, createForm(id)] }, dirty: true };
    }),

  renameForm: (from, to) =>
    set((s) => {
      if (!to.trim() || findForm(s.project, to) || !findForm(s.project, from)) return s;
      return {
        project: {
          ...s.project,
          forms: s.project.forms.map((f) => (f.id === from ? { ...f, id: to, fileName: `${to}.yml` } : f)),
          activeFormId: s.project.activeFormId === from ? to : s.project.activeFormId
        },
        dirty: true
      };
    }),

  duplicateForm: (id) =>
    set((s) => {
      const source = findForm(s.project, id);
      if (!source) return s;
      let copyId = `${id}_copy`;
      let n = 2;
      while (findForm(s.project, copyId)) copyId = `${id}_copy_${n++}`;
      const copy: FormDoc = { ...structuredClone(source), id: copyId, fileName: `${copyId}.yml` };
      return { project: { ...s.project, forms: [...s.project.forms, copy] }, dirty: true };
    }),

  removeForm: (id) =>
    set((s) => {
      if (s.project.forms.length <= 1) return s;
      const forms = s.project.forms.filter((f) => f.id !== id);
      return {
        project: {
          ...s.project,
          forms,
          activeFormId: s.project.activeFormId === id ? forms[0].id : s.project.activeFormId
        },
        dirty: true
      };
    }),

  setBedrock: (bedrock, description = "Updated form") => {
    const id = get().project.activeFormId;
    get().pushHistory(id, description);
    set((s) => ({
      project: {
        ...s.project,
        forms: s.project.forms.map((f) => (f.id === id ? { ...f, bedrock } : f))
      },
      dirty: true
    }));
  },

  setGlobalActions: (globalActions, description = "Updated global actions") => {
    const active = get().activeForm();
    get().setBedrock({ ...active.bedrock, globalActions } as BedrockForm, description);
  },

  setAssets: (assets) => set((s) => ({ project: { ...s.project, assets }, dirty: true })),

  setPlatformTarget: (platformTarget) =>
    set((s) => ({ project: { ...s.project, platformTarget }, dirty: true }))
});
