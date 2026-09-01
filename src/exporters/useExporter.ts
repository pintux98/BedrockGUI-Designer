import { useDesignerStore } from "../core/store";
import { serializeFormDocument } from "../serialize/form";

export function useExporter() {
  const { activeForm } = useDesignerStore();
  const exportYaml = () => {
    const form = activeForm();
    const doc = serializeFormDocument(form);
    const blob = new Blob([doc], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = form.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  return { exportYaml };
}
