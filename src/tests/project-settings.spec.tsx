import { beforeEach, afterEach, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProjectSettingsPanel } from "../panels/ProjectSettingsPanel";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";
import { actionsForPlatform } from "../plugin";

beforeEach(() => useDesignerStore.getState().loadProject(createEmptyProject()));
afterEach(() => cleanup());

it("edits the asset server settings", () => {
  render(<ProjectSettingsPanel />);
  fireEvent.click(screen.getByRole("checkbox", { name: /Enable asset server/ }));
  expect(useDesignerStore.getState().project.assets.enabled).toBe(true);
});

it("changes the platform target and narrows the available actions", () => {
  render(<ProjectSettingsPanel />);
  fireEvent.change(screen.getByRole("combobox", { name: /Platform/ }), { target: { value: "velocity" } });
  expect(useDesignerStore.getState().project.platformTarget).toBe("velocity");
  expect(actionsForPlatform("velocity").map((a) => a.id)).not.toContain("sound");
});

it("warns that sound and economy are unavailable on a proxy", () => {
  useDesignerStore.getState().setPlatformTarget("bungee");
  render(<ProjectSettingsPanel />);
  expect(screen.getByText(/sound.*economy/i)).toBeInTheDocument();
});
