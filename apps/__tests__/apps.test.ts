import fs from "node:fs";
import { appInfoSchema, dynamicComposeSchemaYaml, parseComposeJson } from "@runtipi/common/schemas";
import { type } from "arktype";
import jsyaml from "js-yaml";
import { describe, expect, it, test } from "vitest";

interface FormField {
  type: string;
  required?: boolean;
  env_variable?: string;
}

interface AppConfig {
  $schema?: string;
  id: string;
  port: number;
  categories: string[];
  requirements?: {
    ports?: number[];
  };
  name: string;
  description: string;
  version?: string;
  tipi_version: number;
  short_desc: string;
  author: string;
  source: string;
  available: boolean;
  form_fields?: FormField[];
  supported_architectures: string[];
  dynamic_config: boolean;
  created_at: number;
  updated_at: number;
  url_suffix?: string;
}

interface LoadedApp {
  config: AppConfig;
  composeJsonRaw: string;
  composeJson: Record<string, any>;
  composeYmlRaw: string;
  composeYml: Record<string, any>;
}

let cachedApps: LoadedApp[] | null = null;

function getLoadedApps(): LoadedApp[] {
  if (cachedApps) return cachedApps;

  const apps: LoadedApp[] = [];
  if (!fs.existsSync("./apps")) {
    cachedApps = apps;
    return apps;
  }

  const dirs = fs
    .readdirSync("./apps")
    .filter((app) => !app.startsWith("__") && !app.startsWith("."))
    .sort((a, b) => a.localeCompare(b));

  for (const app of dirs) {
    const configPath = `./apps/${app}/config.json`;
    const composeJsonPath = `./apps/${app}/docker-compose.json`;
    const composeYmlPath = `./apps/${app}/docker-compose.yml`;
    if (!fs.existsSync(configPath)) continue;

    const config: AppConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!config.available) continue;

    const composeJsonRaw = fs.existsSync(composeJsonPath) ? fs.readFileSync(composeJsonPath, "utf8") : "";
    const composeYmlRaw = fs.existsSync(composeYmlPath) ? fs.readFileSync(composeYmlPath, "utf8") : "";

    apps.push({
      config,
      composeJsonRaw,
      composeJson: composeJsonRaw ? JSON.parse(composeJsonRaw) : {},
      composeYmlRaw,
      composeYml: composeYmlRaw ? (jsyaml.load(composeYmlRaw) as Record<string, any>) : {},
    });
  }

  cachedApps = apps;
  return apps;
}

function extractImageTag(image: string): string {
  const withoutDigest = image.split("@sha256:")[0].trim();
  const lastColon = withoutDigest.lastIndexOf(":");
  const lastSlash = withoutDigest.lastIndexOf("/");
  return lastColon > lastSlash ? withoutDigest.slice(lastColon + 1) : "latest";
}

describe("Runtipi Official App Configs Suite", () => {
  const apps = getLoadedApps();

  it("Get app config should return at least one app", () => {
    expect(apps.length).toBeGreaterThan(0);
  });

  describe("Each app config.json should match @runtipi/common appInfoSchema", () => {
    for (const { config: app } of apps) {
      test(app.id, () => {
        const { $schema: _, ...rest } = app;
        const validated = appInfoSchema({
          ...rest,
          urn: `${app.id}:local`,
        });
        expect(validated instanceof type.errors, validated instanceof type.errors ? validated.summary : undefined).toBe(
          false,
        );
      });
    }
  });

  describe("Each app docker-compose.json should be parsable by @runtipi/common", () => {
    for (const { config: app, composeJson } of apps) {
      test(app.id, () => {
        expect(fs.existsSync(`./apps/${app.id}/docker-compose.json`)).toBe(true);
        const res = parseComposeJson(composeJson);
        expect(res).toBeDefined();
      });
    }
  });

  describe("Each app docker-compose.yml should match @runtipi/common dynamicComposeSchemaYaml", () => {
    for (const { config: app, composeYml } of apps) {
      test(app.id, () => {
        expect(fs.existsSync(`./apps/${app.id}/docker-compose.yml`)).toBe(true);
        const { "x-runtipi": xRuntipi, ...rest } = composeYml;
        expect(xRuntipi?.schema_version).toBe(2);
        const validated = dynamicComposeSchemaYaml(rest);
        expect(validated instanceof type.errors).toBe(false);
      });
    }
  });

  describe("Each app should have required metadata, files, and valid fields", () => {
    for (const { config: app, composeYml } of apps) {
      test(app.id, () => {
        expect(app.id).toBeDefined();
        expect(app.name).toBeDefined();
        expect(app.description).toBeDefined();
        expect(app.categories).toBeInstanceOf(Array);
        expect(app.categories.length).toBeGreaterThan(0);
        expect(app.supported_architectures).toBeInstanceOf(Array);
        expect(app.version).toBeDefined();
        expect(app.tipi_version).toBeGreaterThan(0);

        // Files
        expect(fs.existsSync(`./apps/${app.id}/docker-compose.yml`)).toBe(true);
        expect(fs.existsSync(`./apps/${app.id}/docker-compose.json`)).toBe(true);
        expect(fs.existsSync(`./apps/${app.id}/metadata/description.md`)).toBe(true);
        expect(fs.existsSync(`./apps/${app.id}/metadata/logo.jpg`)).toBe(true);

        // Version match between config.json and docker-compose.yml main service
        expect(composeYml.services[app.id]).toBeDefined();
        expect(composeYml.services[app.id]?.image).toBeDefined();
        const dockerImage = String(composeYml.services[app.id]?.image);
        expect(extractImageTag(dockerImage)).toContain(app.version);

        // Random form fields must not be required
        if (app.form_fields) {
          for (const field of app.form_fields) {
            if (field.type === "random") {
              expect(Boolean(field.required)).toBe(false);
            }
          }
        }

        // Timestamps
        expect(app.created_at).toBeGreaterThan(0);
        expect(app.created_at).toBeLessThan(Date.now());
        expect(new Date(app.created_at).getFullYear()).toBeGreaterThanOrEqual(2023);
        expect(app.updated_at).toBeGreaterThan(0);
        expect(app.updated_at).toBeLessThan(Date.now());
        expect(new Date(app.updated_at).getFullYear()).toBeGreaterThanOrEqual(2023);
      });
    }
  });

  test("Each app should have a unique port", () => {
    const ports = apps.map(({ config }) => config.port).filter(Boolean);
    expect(new Set(ports).size).toBe(ports.length);
  });

  test("Each app should have a unique id", () => {
    const ids = apps.map(({ config }) => config.id);
    expect(new Set(ids).size).toBe(apps.length);
  });

  test("Any app with url_suffix should start with '/' or '?'", () => {
    for (const { config } of apps) {
      if (config.url_suffix) {
        expect(config.url_suffix).toMatch(/^[/?]/);
      }
    }
  });
});
