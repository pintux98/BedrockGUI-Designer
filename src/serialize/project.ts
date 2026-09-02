import { Project } from "../core/project";
import { serializeFormDocument } from "./form";
import { serializeConfigDocument } from "./config";

export async function serializeProjectToZip(project: Project): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {
    "config.yml": strToU8(serializeConfigDocument(project))
  };
  for (const form of project.forms) {
    files[`forms/${form.fileName}`] = strToU8(serializeFormDocument(form));
  }
  return zipSync(files);
}
