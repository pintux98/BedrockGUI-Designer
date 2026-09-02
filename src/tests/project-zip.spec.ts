import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import * as yaml from "js-yaml";
import { createEmptyProject, createForm } from "../core/project";
import { serializeProjectToZip } from "../serialize/project";
import { serializeFormDocument } from "../serialize/form";
import { parseFormDocument } from "../parse/form";

describe("serializeProjectToZip", () => {
  it("writes a config.yml and one file per form", async () => {
    const project = createEmptyProject();
    project.forms.push(createForm("shop"));
    const files = unzipSync(await serializeProjectToZip(project));
    expect(Object.keys(files).sort()).toEqual([
      "config.yml",
      "forms/main_menu.yml",
      "forms/shop.yml"
    ]);
    const config = yaml.load(strFromU8(files["config.yml"])) as any;
    expect(config["config-version"]).toBe(1);
    expect(config.forms.shop.file).toBe("shop.yml");
    const form = yaml.load(strFromU8(files["forms/shop.yml"])) as any;
    expect(form.bedrock.type).toBe("SIMPLE");
  });

  it("registers a form by id even when its filename differs", async () => {
    const project = createEmptyProject();
    const f = createForm("shop");
    f.fileName = "store.yml";
    project.forms.push(f);
    const files = unzipSync(await serializeProjectToZip(project));
    expect(files["forms/store.yml"]).toBeDefined();
    const config = yaml.load(strFromU8(files["config.yml"])) as any;
    expect(config.forms.shop.file).toBe("store.yml");
  });

  it("carries a real plugin fixture through the zip byte-identically", async () => {
    const fixturePath = path.resolve(__dirname, "fixtures/plugin-forms/economy_shop.yml");
    const original = fs.readFileSync(fixturePath, "utf8");
    const formDoc = parseFormDocument(original, "economy_shop");
    const directSerialization = serializeFormDocument(formDoc);

    const project = createEmptyProject();
    project.forms = [formDoc];
    project.activeFormId = formDoc.id;
    const files = unzipSync(await serializeProjectToZip(project));

    expect(strFromU8(files["forms/economy_shop.yml"])).toBe(directSerialization);
  });
});
