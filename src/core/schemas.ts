import { z } from "zod";

export const actionSchema = z.object({
  id: z.string(),
  params: z.any().optional(),
  raw: z.string().optional()
});

const bedrockButtonConditionPropertySchema = z.enum(["text", "image", "onClick"]);

export const bedrockButtonSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  image: z.string().optional(),
  onClick: z.array(actionSchema).optional(),
  showCondition: z.string().optional(),
  alternativeText: z.string().optional(),
  alternativeImage: z.string().optional(),
  alternativeOnClick: z.string().optional(),
  conditions: z
    .array(
      z.object({
        id: z.string().min(1),
        condition: z.string().min(1),
        property: bedrockButtonConditionPropertySchema,
        value: z.string()
      })
    )
    .optional()
});

export const bedrockComponentSchema = z.object({
  id: z.string(),
  type: z.enum(["input", "slider", "dropdown", "toggle"]),
  props: z.record(z.string(), z.any()),
  action: z.array(actionSchema).optional()
});

export const bedrockBaseSchema = z.object({
  type: z.enum(["SIMPLE", "MODAL", "CUSTOM"]),
  title: z.string().min(1),
  content: z.union([z.string(), z.array(z.string())]).optional(),
  description: z.string().optional(),
  command: z.string().optional(),
  commandIntercept: z.string().optional(),
  permission: z.string().optional(),
  globalActions: z.array(actionSchema).optional()
});

export const bedrockSimpleSchema = bedrockBaseSchema.extend({
  type: z.literal("SIMPLE"),
  buttons: z.array(bedrockButtonSchema).min(1)
});

export const bedrockModalSchema = bedrockBaseSchema.extend({
  type: z.literal("MODAL"),
  buttons: z.array(bedrockButtonSchema).length(2)
});

export const bedrockCustomSchema = bedrockBaseSchema.extend({
  type: z.literal("CUSTOM"),
  components: z.array(bedrockComponentSchema).min(1)
});

export const designerSchema = z.object({
  configVersion: z.literal("1.0.0"),
  menuName: z.string().min(1),
  platform: z.literal("bedrock"),
  bedrock: z.union([bedrockSimpleSchema, bedrockModalSchema, bedrockCustomSchema]).optional(),
  globalActions: z.array(actionSchema).optional()
});
