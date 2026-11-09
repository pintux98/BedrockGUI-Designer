import { Project, FormDoc, createEmptyProject } from "../core/project";
import { parseConfigDocument } from "./config";
import { parseFormDocument } from "./form";

const FORM_FILE_PATTERN = /\.(ya?ml)$/i;
const SERVER_FILES = new Set(["config.yml", "messages.yml"]);

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export async function parseProjectFromZip(bytes: Uint8Array): Promise<{ project: Project; notes: string[] }> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const paths = Object.keys(files)
    .filter((p) => !p.endsWith("/") && !p.split("/").some((part) => part.startsWith(".") || part === "__MACOSX"))
    .sort();
  const notes: string[] = [];
  const project = createEmptyProject();
  const forms: FormDoc[] = [];

  const configPath = paths
    .filter((p) => baseName(p) === "config.yml")
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  let registry: Array<{ id: string; file: string }> | null = null;
  if (configPath) {
    try {
      const config = parseConfigDocument(strFromU8(files[configPath]));
      project.assets = config.assets;
      registry = config.registry;
    } catch (e) {
      notes.push(`config.yml could not be read (${errorMessage(e)}) — form ids were derived from file names instead.`);
    }
  }

  const parseInto = (path: string, id: string, file: string) => {
    try {
      const doc = parseFormDocument(strFromU8(files[path]), id);
      doc.fileName = file;
      forms.push(doc);
    } catch (e) {
      notes.push(`${file} could not be parsed (${errorMessage(e)}) — skipped.`);
    }
  };

  if (registry) {
    const root = configPath.slice(0, configPath.length - "config.yml".length);
    for (const { id, file } of registry) {
      const path = [`${root}forms/${file}`, `${root}${file}`].find((p) => files[p]) ?? paths.find((p) => p.endsWith(`/${file}`));
      if (!path) {
        notes.push(`config.yml registers '${id}' as forms/${file}, but that file is not in the archive — skipped.`);
        continue;
      }
      parseInto(path, id, file);
    }
  } else {
    if (!configPath) notes.push("No config.yml in the archive, so each form is named after its file.");
    const skipped: string[] = [];
    for (const path of paths) {
      const file = baseName(path);
      if (SERVER_FILES.has(file.toLowerCase())) continue;
      if (!FORM_FILE_PATTERN.test(file)) {
        skipped.push(path);
        continue;
      }
      parseInto(path, file.replace(FORM_FILE_PATTERN, ""), file);
    }
    if (skipped.length) {
      notes.push(`Skipped archive entry ${skipped.map((s) => `'${s}'`).join(", ")} — not a form file.`);
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
