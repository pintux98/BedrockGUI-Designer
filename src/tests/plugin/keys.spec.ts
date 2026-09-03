import { describe, it, expect } from "vitest";
import { BUTTON_KEYS, CONFIG_KEYS, DOCUMENT_KEYS, FORM_KEYS } from "../../plugin/keys";

/**
 * These assertions spell every key out as a literal on purpose.
 *
 * The golden fixtures pin most of `keys.ts` for free: rename a constant and the
 * re-serialized form stops matching the file the plugin ships. That guard has a
 * hole — a key that appears in no fixture is read and written through the same
 * constant, so parse and serialize go wrong together and the round-trip still
 * agrees with itself. Only a literal, checked against the Java, closes it.
 *
 * Plugin source of truth: BedrockGUI 2.0.11 (read-only, alongside this repo).
 */

describe("the form-file envelope", () => {
  it("names the two top-level keys exactly as FormMenuUtil rebases onto them", () => {
    // FormMenuUtil.java:124-125 — when forms.<key>.file names a separate file:
    //   bedrockBase = "bedrock";
    //   javaBase = "java";
    expect(DOCUMENT_KEYS.bedrock).toBe("bedrock");
    expect(DOCUMENT_KEYS.java).toBe("java");
  });

  it("exposes the envelope as its own table, not as entries of FORM_KEYS", () => {
    // FORM_KEYS describes what lives *inside* `bedrock:`; the envelope wraps it.
    expect(Object.keys(FORM_KEYS)).not.toContain("bedrock");
    expect(Object.keys(FORM_KEYS)).not.toContain("java");
    expect(Object.keys(DOCUMENT_KEYS)).toEqual(["bedrock", "java"]);
  });
});

describe("form keys that no golden fixture exercises", () => {
  it("reads and writes the form permission as `permission`", () => {
    // FormMenuUtil.java:138 — cfg.getString(bedrockBase + ".permission")
    expect(FORM_KEYS.permission).toBe("permission");
  });

  it("keeps `description` as the read-side legacy alias for content", () => {
    // FormMenuUtil.java:142-143 — description is read, then content wins:
    //   String description = readMultilineText(cfg, bedrockBase + ".description");
    //   String resolvedContent = contentVal != null ? contentVal : description;
    // The designer mirrors that on import and never emits it again.
    expect(FORM_KEYS.description).toBe("description");
    expect(FORM_KEYS.content).toBe("content");
  });
});

describe("button keys that no golden fixture exercises", () => {
  it("spells the alternative onClick with the plugin's mixed-case tail", () => {
    // FormMenuUtil.java:210 —
    //   cfg.getString(base + ".buttons." + button + ".alternative_onClick")
    // Not alternative_on_click and not alternativeOnClick: the plugin really
    // does mix snake_case and camelCase in this one key, matching `onClick`.
    expect(BUTTON_KEYS.alternativeOnClick).toBe("alternative_onClick");
    expect(BUTTON_KEYS.onClick).toBe("onClick");
    expect(BUTTON_KEYS.alternativeText).toBe("alternative_text");
    expect(BUTTON_KEYS.alternativeImage).toBe("alternative_image");
  });
});

describe("config.yml keys", () => {
  it("names the registry and version keys the server config uses", () => {
    // ConfigMigrator.java:23 — DEFAULT_VERSION_KEY = "config-version"
    expect(CONFIG_KEYS.configVersion).toBe("config-version");
    // FormMenuUtil.java:117-118 — config.getKeys("forms"), then
    //   config.getString("forms." + key + ".file")
    expect(CONFIG_KEYS.forms).toBe("forms");
    expect(CONFIG_KEYS.formFile).toBe("file");
  });

  it("names the asset-server section", () => {
    // AssetServer.java:62-64 — assets.enabled / assets.host / assets.port
    expect(CONFIG_KEYS.assets).toBe("assets");
    expect(CONFIG_KEYS.assetsEnabled).toBe("enabled");
    expect(CONFIG_KEYS.assetsHost).toBe("host");
    expect(CONFIG_KEYS.assetsPort).toBe("port");
  });

  it("is declared but not yet wired — src/parse/config.ts still spells these inline", () => {
    // Documented deliberately: CONFIG_KEYS has no consumer yet, so nothing but
    // this spec would notice it drifting. Pointing parse/config.ts at it is a
    // follow-up; until then this test is the only thing holding the spellings.
    expect(Object.keys(CONFIG_KEYS)).toEqual([
      "configVersion",
      "forms",
      "formFile",
      "assets",
      "assetsEnabled",
      "assetsHost",
      "assetsPort"
    ]);
  });
});
