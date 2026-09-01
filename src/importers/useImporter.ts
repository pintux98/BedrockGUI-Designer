import * as yaml from "js-yaml";
import { useDesignerStore } from "../core/store";
import { FormDoc } from "../core/project";
import { parseConfigDocument } from "../parse/config";
import { parseFormDocument } from "../parse/form";
import { parseLegacyInlineConfig } from "../parse/legacy";
import { toast } from "../core/toast";

export function useImporter() {
  const importYaml = async (file: File) => {
    const text = await file.text();
    const doc = (yaml.load(text) ?? {}) as Record<string, any>;

    let forms: FormDoc[];
    if (doc.forms && typeof doc.forms === "object") {
      forms = parseLegacyInlineConfig(text);
      if (!forms.length) {
        const config = parseConfigDocument(text);
        const state = useDesignerStore.getState();
        state.setAssets(config.assets);
        toast.info(
          "Imported assets settings from config.yml. Its registered forms must be imported individually, one file at a time.",
          6000
        );
        return;
      }
    } else {
      forms = [parseFormDocument(text, deriveFormId(file.name))];
    }

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

    state.loadProject({ ...project, forms: nextForms, activeFormId });
  };

  return { importYaml };
}

function deriveFormId(fileName: string): string {
  return fileName.replace(/\.(ya?ml)$/i, "").trim() || "imported_form";
}
