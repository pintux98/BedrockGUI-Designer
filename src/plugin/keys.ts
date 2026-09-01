export const FORM_KEYS = {
  type: "type",
  title: "title",
  content: "content",
  description: "description",
  permission: "permission",
  command: "command",
  commandIntercept: "command_intercept",
  buttons: "buttons",
  components: "components",
  globalActions: "global_actions"
} as const;

export const CONDITION_KEYS = {
  condition: "condition",
  property: "property",
  value: "value"
} as const;

export const BUTTON_KEYS = {
  text: "text",
  image: "image",
  onClick: "onClick",
  showCondition: "show_condition",
  alternativeText: "alternative_text",
  alternativeImage: "alternative_image",
  alternativeOnClick: "alternative_onClick",
  conditions: "conditions"
} as const;

export const COMPONENT_KEYS = {
  type: "type",
  text: "text",
  placeholder: "placeholder",
  default: "default",
  min: "min",
  max: "max",
  step: "step",
  options: "options",
  action: "action"
} as const;

export const IGNORED_KEYS = ["translations", "priority", "priority_condition"] as const;
