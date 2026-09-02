import { Project } from "../core/project";
import { serializeFormDocument } from "./form";

export async function serializeProjectToZip(project: Project): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  for (const form of project.forms) {
    files[`forms/${form.fileName}`] = strToU8(serializeFormDocument(form));
  }
  return zipSync(files);
}
