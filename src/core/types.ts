export type BedrockFormType = "SIMPLE" | "MODAL" | "CUSTOM";

export type ConfigVersion = "1.0.0";

export interface BedrockFormBase {
  type: BedrockFormType;
  title: string;
  content?: string | string[];
  description?: string;
  command?: string;
  commandIntercept?: string;
  permission?: string;
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
  conditions?: BedrockButtonConditionRule[];
}

export type BedrockButtonConditionProperty = "text" | "image" | "onClick";

export interface BedrockButtonConditionRule {
  id: string;
  condition: string;
  property: BedrockButtonConditionProperty;
  value: string;
}

export type BedrockComponentType = "input" | "slider" | "dropdown" | "toggle";

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
