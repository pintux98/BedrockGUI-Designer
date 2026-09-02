import { zipSync, strToU8 } from "fflate";
import { Project } from "../core/project";
import { serializeFormDocument } from "./form";
import { serializeConfigDocument } from "./config";

export function serializeProjectToZip(project: Project): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "config.yml": strToU8(serializeConfigDocument(project))
  };
  for (const form of project.forms) {
    files[`forms/${form.fileName}`] = strToU8(serializeFormDocument(form));
  }
  return zipSync(files);
}
