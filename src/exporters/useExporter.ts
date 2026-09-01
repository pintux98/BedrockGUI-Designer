import { useDesignerStore } from "../core/store";
import { stateToYaml } from "../core/yaml";

export function useExporter() {
  const { activeForm } = useDesignerStore();
  const exportYaml = () => {
    const form = activeForm();
    const doc = stateToYaml(form.bedrock);
    const blob = new Blob([doc], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.id}.yml`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return { exportYaml };
}

