import * as yaml from "js-yaml";
import { useDesignerStore } from "../core/store";
import { AssetsConfig, FormDoc, Project } from "../core/project";
import { parseConfigDocument } from "../parse/config";
import { parseFormDocument } from "../parse/form";
import { parseLegacyInlineConfig } from "../parse/legacy";
import { parseProjectFromZip } from "../parse/project";
import { parseProject } from "../core/projectSchemas";
import { toast } from "../core/toast";

export function useImporter() {
  const importYaml = async (file: File) => {
    if (file.name.toLowerCase().endsWith(".zip")) {
      await importZip(file);
      return;
    }

    const text = await file.text();
    const doc = (yaml.load(text) ?? {}) as Record<string, any>;

    if (doc.forms && typeof doc.forms === "object") {
      const forms = parseLegacyInlineConfig(text);
      const config = parseConfigDocument(text);
      if (!forms.length) {
        useDesignerStore.getState().setAssets(config.assets);
        toast.info(
          "config.yml registers form ids but not form content. Import each registered form file individually.",
          6000
        );
        return;
      }
      mergeFormsIntoProject(forms, config.assets);
      return;
    }

    mergeFormsIntoProject([parseFormDocument(text, deriveFormId(file.name))]);
  };

  return { importYaml };
}

async function importZip(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { project, notes } = await parseProjectFromZip(bytes);
  for (const note of notes) toast.info(note, 8000);

  const result = parseProject(project);
  if (!result.ok) return;

  useDesignerStore.getState().loadProject(result.project);
  toast.success(`Imported ${result.project.forms.length} form(s) from ${file.name}.`);
}

function mergeFormsIntoProject(forms: FormDoc[], assets?: AssetsConfig) {
  const state = useDesignerStore.getState();
  const project = state.project;
  const nextForms = [...project.forms];
  let activeFormId = project.activeFormId;

  for (const form of forms) {
    const idx = nextForms.findIndex((f) => f.id === form.id);
    if (idx === -1) {
      nextForms.push(form);
      activeFormId = form.id;
    } else if (form.id === project.activeFormId) {
      nextForms[idx] = form;
      activeFormId = form.id;
    } else {
      toast.error(`Cannot import: a form named "${form.id}" already exists. Rename or remove it first.`);
      return;
    }
  }

  const candidate: Project = { ...project, forms: nextForms, activeFormId, assets: assets ?? project.assets };
  const result = parseProject(candidate);
  if (!result.ok) {
    toast.error(`Import failed: ${result.problems.slice(0, 3).join("; ")}`);
    return;
  }
  state.loadProject(result.project);
}

function deriveFormId(fileName: string): string {
  return fileName.replace(/\.(ya?ml)$/i, "").trim() || "imported_form";
}
