import React from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";

// This spec is about what the shell's right-hand pane does and does not render. The top
// bar (covered in ui.spec.tsx) and the centre canvas (covered in preview.spec.tsx) are
// stubbed so an unrelated failure in either cannot silently empty the tree via
// ErrorBoundary and turn the absence assertions below into passes for the wrong reason.
vi.mock("../app/TopBar", () => ({ TopBar: () => null }));
vi.mock("../canvas/Canvas", () => ({ Canvas: () => null }));

import { DesignerShell } from "../app/DesignerShell";

const DESKTOP_WIDTH = 1400;
let originalWidth = 0;

beforeEach(() => {
  originalWidth = window.innerWidth;
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: DESKTOP_WIDTH });
  useDesignerStore.getState().loadProject(createEmptyProject());
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: originalWidth });
});

// The project used to carry a Platform Target selector here. Forms behave the same on
// Paper, Velocity and Bungee, so the selector is gone; project.platformTarget survives in
// the data model only because an imported config can still set it.
it("renders no Platform Target selector in the properties pane", () => {
  render(<DesignerShell />);

  // Proves the right-hand pane really rendered, so the absences below mean something.
  expect(screen.getByText("Form Settings")).toBeInTheDocument();

  expect(screen.queryByText("Platform Target")).toBeNull();
  expect(screen.queryByText("Platform")).toBeNull();
  expect(screen.queryByRole("combobox", { name: /platform/i })).toBeNull();
  expect(screen.queryByText("Paper")).toBeNull();
  expect(screen.queryByText("Velocity")).toBeNull();
  expect(screen.queryByText("Bungee")).toBeNull();
});

it("keeps platformTarget in the project even though nothing in the UI sets it", () => {
  render(<DesignerShell />);
  expect(useDesignerStore.getState().project.platformTarget).toBe("paper");
});
