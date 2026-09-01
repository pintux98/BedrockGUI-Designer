import { create } from "zustand";
import { DesignerState, BedrockForm, ActionInstance } from "./types";

const initialState: DesignerState = {
  configVersion: "1.0.0",
  menuName: "example",
  platform: "bedrock",
  bedrock: {
    type: "SIMPLE",
    title: "Example Form",
    content: "Content",
    buttons: [{ id: "button_1", text: "Click me" }]
  }
};

type Actions = {
  setMenuName: (name: string) => void;
  setBedrock: (form: BedrockForm | undefined, description?: string) => void;
  setGlobalActions: (a: ActionInstance[] | undefined, description?: string) => void;
  setDirty: (dirty: boolean) => void;
  setSelectedBedrockButtonId: (id: string | null) => void;
  setSelectedBedrockComponentId: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  setIsWizardOpen: (open: boolean) => void;
  jumpToHistory: (index: number) => void;
  loadState: (state: DesignerState) => void;
};

interface HistoryEntry {
  state: DesignerState;
  description: string;
  timestamp: number;
}

const getSnapshot = (state: any): DesignerState => ({
  configVersion: state.configVersion,
  menuName: state.menuName,
  platform: state.platform,
  bedrock: state.bedrock,
  globalActions: state.globalActions
});

export const useDesignerStore = create<
  DesignerState &
    Actions & {
      dirty: boolean;
      selectedBedrockButtonId: string | null;
      selectedBedrockComponentId: string | null;
      undoStack: HistoryEntry[];
      redoStack: HistoryEntry[];
      isWizardOpen: boolean;
    }
>()((set, get) => ({
  ...initialState,
  dirty: false,
  selectedBedrockButtonId: null,
  selectedBedrockComponentId: null,
  undoStack: [],
  redoStack: [],
  isWizardOpen: false,

  setMenuName: (menuName) => {
    const snap = getSnapshot(get());
    set((s) => ({
      menuName,
      dirty: true,
      undoStack: [...s.undoStack, { state: snap, description: "Changed menu name", timestamp: Date.now() }],
      redoStack: []
    }));
  },

  setBedrock: (bedrock, description = "Updated Bedrock form") => {
    const snap = getSnapshot(get());
    set((s) => ({
      bedrock,
      dirty: true,
      undoStack: [...s.undoStack, { state: snap, description, timestamp: Date.now() }],
      redoStack: []
    }));
  },

  setGlobalActions: (globalActions, description = "Updated global actions") => {
    const snap = getSnapshot(get());
    set((s) => ({
      globalActions,
      dirty: true,
      undoStack: [...s.undoStack, { state: snap, description, timestamp: Date.now() }],
      redoStack: []
    }));
  },

  setDirty: (dirty) => set({ dirty }),
  setSelectedBedrockButtonId: (selectedBedrockButtonId) => set({ selectedBedrockButtonId }),
  setSelectedBedrockComponentId: (selectedBedrockComponentId) => set({ selectedBedrockComponentId }),

  undo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const current = getSnapshot(get());
    set({
      ...prev.state,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { state: current, description: prev.description, timestamp: Date.now() }],
      selectedBedrockButtonId: null,
      selectedBedrockComponentId: null
    });
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const current = getSnapshot(get());
    set({
      ...next.state,
      undoStack: [...undoStack, { state: current, description: next.description, timestamp: Date.now() }],
      redoStack: redoStack.slice(0, -1),
      selectedBedrockButtonId: null,
      selectedBedrockComponentId: null
    });
  },

  setIsWizardOpen: (isWizardOpen: boolean) => set({ isWizardOpen }),
  
  jumpToHistory: (index: number) => {
    const { undoStack, redoStack } = get();
    const current = getSnapshot(get());
    
    if (index < undoStack.length) {
       const target = undoStack[index];
       const newUndo = undoStack.slice(0, index);
       const toRedo = [...undoStack.slice(index + 1), { state: current, description: "Reverted state", timestamp: Date.now() }, ...redoStack.slice().reverse()];
       
       set({
         ...target.state,
         undoStack: newUndo,
         redoStack: toRedo.reverse().map(x => ({...x, timestamp: Date.now()})) as HistoryEntry[], 
         selectedBedrockButtonId: null,
         selectedBedrockComponentId: null
       });
    }
  },

  loadState: (state: DesignerState) => {
    const snap = getSnapshot(get());
    set((s) => ({
      ...state,
      configVersion: state.configVersion ?? "1.0.0",
      dirty: false,
      undoStack: [...s.undoStack, { state: snap, description: "Loaded project", timestamp: Date.now() }],
      redoStack: [],
      selectedBedrockButtonId: null,
      selectedBedrockComponentId: null,
      isWizardOpen: false
    }));
  }
}));
