import { StateCreator } from "zustand";

export interface UiSlice {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  dirty: false,
  setDirty: (dirty) => set({ dirty })
});
