import * as yaml from "js-yaml";
import { FormDoc } from "../core/project";

export function buildConfigSnippet(forms: FormDoc[]): string {
  return yaml.dump(
    { forms: Object.fromEntries(forms.map((f) => [f.id, { file: f.fileName }])) },
    { lineWidth: -1, noRefs: true, forceQuotes: true, quoteStyle: "double" }
  );
}
