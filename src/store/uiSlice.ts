import { StateCreator } from "zustand";

export interface UiSlice {
  dirty: boolean;
  isWizardOpen: boolean;
  setDirty: (dirty: boolean) => void;
  setIsWizardOpen: (open: boolean) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  dirty: false,
  isWizardOpen: false,
  setDirty: (dirty) => set({ dirty }),
  setIsWizardOpen: (isWizardOpen) => set({ isWizardOpen })
});
