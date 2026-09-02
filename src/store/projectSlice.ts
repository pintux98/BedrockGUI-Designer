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

  loadProject: (project) =>
    set({ project, dirty: false, history: {}, projectHistory: { undo: [], redo: [] } }),

  setActiveForm: (id) =>
    set((s) => (findForm(s.project, id) ? { project: { ...s.project, activeFormId: id } } : s)),

  addForm: (id) => {
    if (!id.trim() || findForm(get().project, id)) return;
    get().pushProjectHistory(`Added form ${id}`);
    set((s) => ({ project: { ...s.project, forms: [...s.project.forms, createForm(id)] }, dirty: true }));
  },

  renameForm: (from, to) => {
    if (!to.trim() || findForm(get().project, to) || !findForm(get().project, from)) return;
    get().pushProjectHistory(`Renamed form ${from} to ${to}`);
    set((s) => {
      const { [from]: movedHistory, ...restHistory } = s.history;
      return {
        project: {
          ...s.project,
          forms: s.project.forms.map((f) => (f.id === from ? { ...f, id: to, fileName: `${to}.yml` } : f)),
          activeFormId: s.project.activeFormId === from ? to : s.project.activeFormId
        },
        history: movedHistory ? { ...restHistory, [to]: movedHistory } : restHistory,
        dirty: true
      };
    });
  },

  duplicateForm: (id) => {
    const source = findForm(get().project, id);
    if (!source) return;
    get().pushProjectHistory(`Duplicated form ${id}`);
    set((s) => {
      let copyId = `${id}_copy`;
      let n = 2;
      while (findForm(s.project, copyId)) copyId = `${id}_copy_${n++}`;
      const copy: FormDoc = { ...structuredClone(source), id: copyId, fileName: `${copyId}.yml` };
      return { project: { ...s.project, forms: [...s.project.forms, copy] }, dirty: true };
    });
  },

  removeForm: (id) => {
    if (get().project.forms.length <= 1) return;
    get().pushProjectHistory(`Deleted form ${id}`);
    set((s) => {
      const forms = s.project.forms.filter((f) => f.id !== id);
      const { [id]: _removedHistory, ...restHistory } = s.history;
      return {
        project: {
          ...s.project,
          forms,
          activeFormId: s.project.activeFormId === id ? forms[0].id : s.project.activeFormId
        },
        history: restHistory,
        dirty: true
      };
    });
  },

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

  setAssets: (assets) => {
    get().pushProjectHistory("Updated assets configuration");
    set((s) => ({ project: { ...s.project, assets }, dirty: true }));
  },

  setPlatformTarget: (platformTarget) => {
    get().pushProjectHistory(`Set platform target to ${platformTarget}`);
    set((s) => ({ project: { ...s.project, platformTarget }, dirty: true }));
  }
});
