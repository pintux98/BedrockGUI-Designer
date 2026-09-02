import { Project, FormDoc, createEmptyProject } from "../core/project";
import { parseConfigDocument } from "./config";
import { parseFormDocument } from "./form";

const FORM_FILE_PATTERN = /\.(ya?ml)$/i;

export async function parseProjectFromZip(bytes: Uint8Array): Promise<{ project: Project; notes: string[] }> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const notes: string[] = [];
  const project = createEmptyProject();
  const forms: FormDoc[] = [];

  const configEntry = files["config.yml"];
  let registry: Array<{ id: string; file: string }> | null = null;
  if (configEntry) {
    try {
      const config = parseConfigDocument(strFromU8(configEntry));
      project.assets = config.assets;
      registry = config.registry;
    } catch (e) {
      notes.push(
        `config.yml could not be read (${errorMessage(e)}) — form ids were derived from file names instead.`
      );
    }
  }

  if (registry) {
    for (const { id, file } of registry) {
      const entry = files[`forms/${file}`];
      if (!entry) {
        notes.push(`config.yml registers '${id}' as forms/${file}, but that file is not in the archive — skipped.`);
        continue;
      }
      try {
        const doc = parseFormDocument(strFromU8(entry), id);
        doc.fileName = file;
        forms.push(doc);
      } catch (e) {
        notes.push(`forms/${file} could not be parsed (${errorMessage(e)}) — skipped.`);
      }
    }
  } else {
    if (!configEntry) {
      notes.push("No config.yml in the archive — every forms/*.yml was imported using its file name as the form id.");
    }
    for (const path of Object.keys(files).sort()) {
      if (path === "config.yml") continue;
      if (!path.startsWith("forms/") || !FORM_FILE_PATTERN.test(path)) {
        notes.push(`Skipped archive entry '${path}' — not a recognized form file.`);
        continue;
      }
      const file = path.slice("forms/".length);
      const id = file.replace(FORM_FILE_PATTERN, "");
      try {
        const doc = parseFormDocument(strFromU8(files[path]), id);
        doc.fileName = file;
        forms.push(doc);
      } catch (e) {
        notes.push(`forms/${file} could not be parsed (${errorMessage(e)}) — skipped.`);
      }
    }
  }

  if (forms.length) {
    project.forms = forms;
    project.activeFormId = forms[0].id;
  } else {
    notes.push("No forms were found in the archive — an empty project was created instead.");
  }

  return { project, notes };
}

function errorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return message.split("\n")[0];
}
