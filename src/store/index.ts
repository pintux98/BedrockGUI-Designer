import { create } from "zustand";
import { createProjectSlice, ProjectSlice } from "./projectSlice";
import { createSelectionSlice, SelectionSlice } from "./selectionSlice";
import { createHistorySlice, HistorySlice } from "./historySlice";
import { createUiSlice, UiSlice } from "./uiSlice";

export type DesignerStore = ProjectSlice & SelectionSlice & HistorySlice & UiSlice;

export const useDesignerStore = create<DesignerStore>()((...a) => ({
  ...createUiSlice(...(a as Parameters<typeof createUiSlice>)),
  ...createSelectionSlice(...(a as Parameters<typeof createSelectionSlice>)),
  ...createHistorySlice(...a),
  ...createProjectSlice(...a)
}));
