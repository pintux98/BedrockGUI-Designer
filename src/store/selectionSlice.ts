import { StateCreator } from "zustand";

export interface SelectionSlice {
  selectedBedrockButtonId: string | null;
  selectedBedrockComponentId: string | null;
  setSelectedBedrockButtonId: (id: string | null) => void;
  setSelectedBedrockComponentId: (id: string | null) => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice, [], [], SelectionSlice> = (set) => ({
  selectedBedrockButtonId: null,
  selectedBedrockComponentId: null,
  setSelectedBedrockButtonId: (selectedBedrockButtonId) => set({ selectedBedrockButtonId }),
  setSelectedBedrockComponentId: (selectedBedrockComponentId) => set({ selectedBedrockComponentId })
});
