import { useDesignerStore } from "../core/store";
import { serializeFormDocument } from "../serialize/form";
import { serializeProjectToZip } from "../serialize/project";

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function useExporter() {
  const { activeForm, project } = useDesignerStore();
  const exportYaml = () => {
    const form = activeForm();
    const doc = serializeFormDocument(form);
    download(new Blob([doc], { type: "text/yaml" }), form.fileName);
  };
  const exportProjectZip = async () => {
    const zip = await serializeProjectToZip(project);
    download(new Blob([zip.slice().buffer as ArrayBuffer], { type: "application/zip" }), "bedrockgui-forms.zip");
  };
  return { exportYaml, exportProjectZip };
}
