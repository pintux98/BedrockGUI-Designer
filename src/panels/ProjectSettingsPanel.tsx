import React from "react";
import { useDesignerStore } from "../core/store";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { ACTION_IDS, actionsForPlatform, PlatformTarget } from "../plugin";

const PLATFORM_TARGETS: PlatformTarget[] = ["paper", "velocity", "bungee"];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ProjectSettingsPanel() {
  const { project, setPlatformTarget } = useDesignerStore();
  const { platformTarget } = project;

  const unavailable = ACTION_IDS.filter(
    (id) => !actionsForPlatform(platformTarget).some((a) => a.id === id)
  );

  return (
    <CollapsibleSection title="Platform Target" icon="🛠️">
      <div className="space-y-3 pt-2">
        <div>
          <label htmlFor="project-settings-platform" className="block text-[10px] text-brand-muted uppercase tracking-wider mb-1">
            Platform
          </label>
          <select
            id="project-settings-platform"
            className="ui-input w-full text-xs"
            value={platformTarget}
            onChange={(e) => setPlatformTarget(e.target.value as PlatformTarget)}
          >
            {PLATFORM_TARGETS.map((platform) => (
              <option key={platform} value={platform}>
                {capitalize(platform)}
              </option>
            ))}
          </select>
          {unavailable.length > 0 && (
            <div className="text-[10px] text-yellow-300 mt-1">
              {capitalize(platformTarget)} cannot run: {unavailable.join(", ")}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}
