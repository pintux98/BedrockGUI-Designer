import type { IconName } from "../components/Icon";
import type { BedrockComponentType } from "./types";

export const COMPONENT_META: Record<
  BedrockComponentType,
  { label: string; description: string; icon: IconName; defaults: Record<string, unknown> }
> = {
  label: {
    label: "Label",
    description: "Plain text between fields",
    icon: "text",
    defaults: { text: "Some text" }
  },
  input: {
    label: "Text input",
    description: "Player types a value",
    icon: "input",
    defaults: { text: "Input", placeholder: "Type here...", default: "" }
  },
  dropdown: {
    label: "Dropdown",
    description: "Pick one option from a list",
    icon: "dropdown",
    defaults: { text: "Dropdown", options: ["Option 1", "Option 2"], default: 0 }
  },
  toggle: {
    label: "Toggle",
    description: "On or off",
    icon: "toggle",
    defaults: { text: "Toggle", default: false }
  },
  slider: {
    label: "Slider",
    description: "A number in a range",
    icon: "slider",
    defaults: { text: "Slider", min: 0, max: 10, step: 1, default: 5 }
  },
  step_slider: {
    label: "Step slider",
    description: "Slide between named steps",
    icon: "steps",
    defaults: { text: "Step slider", steps: ["Low", "Medium", "High"], default: 0 }
  }
};

export function choiceList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" && value.trim() ? value.split(",").map((s) => s.trim()) : [];
}
