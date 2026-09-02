import { Project, FormDoc, createEmptyProject } from "../core/project";
import { parseConfigDocument } from "./config";
import { parseFormDocument } from "./form";
import { parseProject } from "../core/projectSchemas";

export async function parseProjectFromZip(bytes: Uint8Array): Promise<{ project: Project; notes: string[] }> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const notes: string[] = [];
  const project = createEmptyProject();
  const forms: FormDoc[] = [];

  const configEntry = files["config.yml"];
  if (configEntry) {
    const config = parseConfigDocument(strFromU8(configEntry));
    project.assets = config.assets;
    for (const { id, file } of config.registry) {
      const entry = files[`forms/${file}`];
      if (!entry) {
        notes.push(`config.yml registers '${id}' as forms/${file}, but that file is not in the archive — skipped.`);
        continue;
      }
      const doc = parseFormDocument(strFromU8(entry), id);
      doc.fileName = file;
      forms.push(doc);
    }
  } else {
    notes.push("No config.yml in the archive — every forms/*.yml was imported using its file name as the form id.");
    for (const path of Object.keys(files).sort()) {
      if (!path.startsWith("forms/") || !path.endsWith(".yml")) continue;
      const file = path.slice("forms/".length);
      const id = file.replace(/\.yml$/, "");
      const doc = parseFormDocument(strFromU8(files[path]), id);
      doc.fileName = file;
      forms.push(doc);
    }
  }

  if (forms.length) {
    project.forms = forms;
    project.activeFormId = forms[0].id;
  } else {
    notes.push("No forms were found in the archive — an empty project was created instead.");
  }

  const validated = parseProject(project);
  if (!validated.ok) notes.push(...validated.problems);
  return { project, notes };
}
