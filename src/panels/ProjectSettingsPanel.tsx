import React from "react";
import { useDesignerStore } from "../core/store";
import { BufferedInput } from "../components/BufferedInput";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { ACTION_IDS, actionsForPlatform, PlatformTarget } from "../plugin";

const PLATFORM_TARGETS: PlatformTarget[] = ["paper", "velocity", "bungee"];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ProjectSettingsPanel() {
  const { project, setAssets, setPlatformTarget } = useDesignerStore();
  const { assets, platformTarget } = project;

  const unavailable = ACTION_IDS.filter(
    (id) => !actionsForPlatform(platformTarget).some((a) => a.id === id)
  );

  return (
    <CollapsibleSection title="Project Settings" icon="🛠️">
      <div className="space-y-3 pt-2">
        <div>
          <div className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Asset Server</div>
          <label className="flex items-center gap-2 text-xs text-brand-text mb-2">
            <input
              type="checkbox"
              checked={assets.enabled}
              onChange={(e) => setAssets({ ...assets, enabled: e.target.checked })}
            />
            Enable asset server
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="project-settings-port" className="block text-[10px] text-brand-muted mb-1">
                Port
              </label>
              <BufferedInput
                id="project-settings-port"
                className="ui-input text-xs"
                type="number"
                value={assets.port}
                onCommit={(v) => setAssets({ ...assets, port: Number(v) })}
              />
            </div>
            <div>
              <label htmlFor="project-settings-host" className="block text-[10px] text-brand-muted mb-1">
                Host
              </label>
              <BufferedInput
                id="project-settings-host"
                className="ui-input text-xs"
                value={assets.host}
                placeholder="auto-detect"
                onCommit={(v) => setAssets({ ...assets, host: v })}
              />
            </div>
          </div>
        </div>
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
