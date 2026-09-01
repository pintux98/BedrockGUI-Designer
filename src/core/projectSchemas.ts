import { z } from "zod";
import { Project } from "./project";
import { bedrockCustomSchema, bedrockModalSchema, bedrockSimpleSchema } from "./schemas";

export const assetsSchema = z.object({
  enabled: z.boolean(),
  port: z.number().int().min(0).max(65535),
  host: z.string()
});

export const formDocSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  bedrock: z.union([bedrockSimpleSchema, bedrockModalSchema, bedrockCustomSchema]),
  javaRaw: z.unknown().optional()
});

export const projectSchema = z
  .object({
    pluginTarget: z.literal("2.0.11"),
    configVersion: z.literal(1),
    assets: assetsSchema,
    platformTarget: z.enum(["paper", "velocity", "bungee"]),
    forms: z.array(formDocSchema).min(1),
    activeFormId: z.string().min(1)
  })
  .superRefine((p, ctx) => {
    if (!p.forms.some((f) => f.id === p.activeFormId)) {
      ctx.addIssue({
        code: "custom",
        path: ["activeFormId"],
        message: `activeFormId "${p.activeFormId}" does not match any form`
      });
    }
    const seen = new Set<string>();
    for (const f of p.forms) {
      if (seen.has(f.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["forms"],
          message: `duplicate form id "${f.id}"`
        });
      }
      seen.add(f.id);
    }
  });

export function parseProject(value: unknown):
  | { ok: true; project: Project }
  | { ok: false; problems: string[] } {
  const result = projectSchema.safeParse(value);
  if (result.success) return { ok: true, project: result.data as Project };
  return {
    ok: false,
    problems: result.error.issues.map((i) => {
      const path = i.path.join(".");
      return path ? `${path}: ${i.message}` : i.message;
    })
  };
}
