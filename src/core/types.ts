export type BedrockFormType = "SIMPLE" | "MODAL" | "CUSTOM";

export interface BedrockFormBase {
  type: BedrockFormType;
  title: string;
  content?: string | string[];
  description?: string;
  command?: string;
  commandIntercept?: string;
  permission?: string;
  cooldown?: string;
  openCondition?: string;
  openConditionMessage?: string;
  onClose?: ActionInstance[];
  globalActions?: ActionInstance[];
}

export interface BedrockSimple extends BedrockFormBase {
  type: "SIMPLE";
  buttons: BedrockButton[];
}

export interface BedrockModal extends BedrockFormBase {
  type: "MODAL";
  buttons: BedrockButton[];
}

export interface BedrockCustom extends BedrockFormBase {
  type: "CUSTOM";
  components: BedrockComponent[];
}

export type BedrockForm = BedrockSimple | BedrockModal | BedrockCustom;

export interface BedrockButton {
  id: string;
  text: string;
  image?: string;
  onClick?: ActionInstance[];
  showCondition?: string;
  alternativeText?: string;
  alternativeImage?: string;
  alternativeOnClick?: string;
  cooldown?: string;
  conditions?: BedrockButtonConditionRule[];
}

export type BedrockButtonConditionProperty = "text" | "image" | "onClick";

export interface BedrockButtonConditionRule {
  id: string;
  condition: string;
  property: BedrockButtonConditionProperty;
  value: string;
}

export type BedrockComponentType = "label" | "input" | "dropdown" | "toggle" | "slider" | "step_slider";

export const BEDROCK_COMPONENT_TYPES: BedrockComponentType[] = ["label", "input", "dropdown", "toggle", "slider", "step_slider"];

export function isBedrockComponentType(value: string): value is BedrockComponentType {
  return (BEDROCK_COMPONENT_TYPES as string[]).includes(value);
}

export interface BedrockComponent {
  id: string;
  type: BedrockComponentType;
  props: Record<string, unknown>;
  action?: ActionInstance[];
}

export interface ActionInstance {
  id: string;
  params: any;
  raw?: string;
}
