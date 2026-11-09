import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { gaPageView } from "./analytics";
import { useDesignerStore } from "./core/store";
import { parseProject } from "./core/projectSchemas";
import "./styles.css";

const DRAFT_KEY = "bedrockgui.designer.draft";

try {
  localStorage.removeItem("bedrockgui.designer.assets.v1");
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft) {
    const result = parseProject(JSON.parse(draft));
    if (result.ok) useDesignerStore.getState().loadProject(result.project);
  }
} catch {}

let timer: ReturnType<typeof setTimeout> | undefined;
useDesignerStore.subscribe((state, prev) => {
  if (state.project === prev.project) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(useDesignerStore.getState().project));
    } catch {}
  }, 400);
});

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(<App />);

try {
  gaPageView();
} catch {}
