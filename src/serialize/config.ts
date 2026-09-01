import * as yaml from "js-yaml";
import { Project } from "../core/project";

export function serializeConfigDocument(project: Project): string {
  return yaml.dump(
    {
      "config-version": project.configVersion,
      assets: {
        enabled: project.assets.enabled,
        port: project.assets.port,
        host: project.assets.host
      },
      forms: Object.fromEntries(project.forms.map((f) => [f.id, { file: f.fileName }]))
    },
    { lineWidth: -1, noRefs: true }
  );
}
