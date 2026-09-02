import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8, zipSync, strToU8 } from "fflate";
import * as yaml from "js-yaml";
import { createEmptyProject, createForm } from "../core/project";
import { serializeProjectToZip } from "../serialize/project";
import { serializeFormDocument } from "../serialize/form";
import { serializeConfigDocument } from "../serialize/config";
import { parseFormDocument } from "../parse/form";
import { parseProjectFromZip } from "../parse/project";

describe("serializeProjectToZip", () => {
  it("writes only forms/ entries, one file per form, and no config.yml", async () => {
    const project = createEmptyProject();
    project.forms.push(createForm("shop"));
    const files = unzipSync(await serializeProjectToZip(project));
    expect(Object.keys(files).sort()).toEqual([
      "forms/main_menu.yml",
      "forms/shop.yml"
    ]);
    expect(files["config.yml"]).toBeUndefined();
    const form = yaml.load(strFromU8(files["forms/shop.yml"])) as any;
    expect(form.bedrock.type).toBe("SIMPLE");
  });

  it("names a form's file entry after its fileName even when that differs from its id", async () => {
    const project = createEmptyProject();
    const f = createForm("shop");
    f.fileName = "store.yml";
    project.forms.push(f);
    const files = unzipSync(await serializeProjectToZip(project));
    expect(files["forms/store.yml"]).toBeDefined();
    expect(files["forms/shop.yml"]).toBeUndefined();
    const form = yaml.load(strFromU8(files["forms/store.yml"])) as any;
    expect(form.bedrock.title).toBe(f.bedrock.title);
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

describe("parseProjectFromZip", () => {
  it("round-trips a project's forms through our own export ZIP, but assets do not survive since we never write config.yml", async () => {
    const project = createEmptyProject();
    project.forms.push(createForm("shop"));
    project.assets = { enabled: true, port: 8123, host: "mc.example.com" };
    const zip = await serializeProjectToZip(project);
    const { project: back, notes } = await parseProjectFromZip(zip);
    expect(back.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(back.assets).toEqual({ enabled: false, port: 0, host: "" });
    expect(notes.join(" ")).toContain("config.yml");
  });

  it("resolves form ids from the config.yml registry key, not the filename", async () => {
    const project = createEmptyProject();
    const shop = createForm("shop");
    shop.fileName = "store.yml";
    project.forms.push(shop);
    const files: Record<string, Uint8Array> = {
      "config.yml": strToU8(serializeConfigDocument(project)),
      "forms/main_menu.yml": strToU8(serializeFormDocument(project.forms[0])),
      "forms/store.yml": strToU8(serializeFormDocument(shop))
    };
    const { project: back, notes } = await parseProjectFromZip(zipSync(files));
    expect(back.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    const imported = back.forms.find((f) => f.id === "shop")!;
    expect(imported.fileName).toBe("store.yml");
    expect(notes.join(" ")).not.toContain("skipped");
  });

  it("reports a form registered in config.yml whose file is missing", async () => {
    const project = createEmptyProject();
    project.forms.push(createForm("shop"));
    const files: Record<string, Uint8Array> = {
      "config.yml": strToU8(serializeConfigDocument(project)),
      "forms/main_menu.yml": strToU8(serializeFormDocument(project.forms[0])),
      "forms/shop.yml": strToU8(serializeFormDocument(project.forms[1]))
    };
    delete files["forms/shop.yml"];
    const { project: back, notes } = await parseProjectFromZip(zipSync(files));
    expect(back.forms.map((f) => f.id)).toEqual(["main_menu"]);
    expect(notes.join(" ")).toContain("shop.yml");
  });

  it("imports a ZIP holding form files but no config.yml, using each file name as the form id", async () => {
    const files: Record<string, Uint8Array> = {
      "forms/a.yml": strToU8(serializeFormDocument(createForm("a")))
    };
    const { project, notes } = await parseProjectFromZip(zipSync(files));
    expect(project.forms.map((f) => f.id)).toEqual(["a"]);
    expect(notes.join(" ")).toContain("config.yml");
  });

  it("falls back to an empty project and says so when the archive holds no forms at all", async () => {
    const { project, notes } = await parseProjectFromZip(zipSync({}));
    expect(project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    expect(notes.join(" ")).toContain("No forms were found");
  });

  it("skips a malformed form file and still imports the good ones, naming the bad file and the parse error", async () => {
    let parseError = "";
    try {
      yaml.load("foo: [1, 2");
    } catch (e) {
      parseError = (e as Error).message.split("\n")[0];
    }
    const files: Record<string, Uint8Array> = {
      "forms/good1.yml": strToU8(serializeFormDocument(createForm("good1"))),
      "forms/bad.yml": strToU8("foo: [1, 2"),
      "forms/good2.yml": strToU8(serializeFormDocument(createForm("good2")))
    };
    const { project, notes } = await parseProjectFromZip(zipSync(files));
    expect(project.forms.map((f) => f.id)).toEqual(["good1", "good2"]);
    expect(notes.join(" ")).toContain("bad.yml");
    expect(notes.join(" ")).toContain(parseError);
  });

  it("falls back to filename-derived ids and explains why when config.yml itself is malformed", async () => {
    const files: Record<string, Uint8Array> = {
      "config.yml": strToU8("forms: [unterminated"),
      "forms/a.yml": strToU8(serializeFormDocument(createForm("a")))
    };
    const { project, notes } = await parseProjectFromZip(zipSync(files));
    expect(project.forms.map((f) => f.id)).toEqual(["a"]);
    expect(notes.join(" ")).toContain("config.yml");
    expect(notes.join(" ")).toMatch(/could not be read/);
  });

  it("imports a .yaml form file, not just .yml, when there is no config.yml", async () => {
    const files: Record<string, Uint8Array> = {
      "forms/a.yaml": strToU8(serializeFormDocument(createForm("a")))
    };
    const { project, notes } = await parseProjectFromZip(zipSync(files));
    expect(project.forms.map((f) => f.id)).toEqual(["a"]);
    expect(notes.join(" ")).not.toContain("Skipped archive entry");
  });
});
