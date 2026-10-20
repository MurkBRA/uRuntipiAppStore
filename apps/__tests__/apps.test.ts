import fs from "node:fs";
import { dynamicComposeSchemaYaml, parseComposeJson } from "@runtipi/common/schemas";
import { type } from "arktype";
import jsyaml from "js-yaml";
import { describe, expect, it, test } from "vitest";

type FormField = {
  type: string;
  required?: boolean;
};

interface AppConfig {
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
}

const getAppConfigs = (): AppConfig[] => {
  const apps: AppConfig[] = [];
  if (!fs.existsSync("./apps")) return apps;

  const appsDir = fs.readdirSync("./apps");

  for (const app of appsDir) {
    if (app.startsWith("__")) continue;
    const configPath = `./apps/${app}/config.json`;

    if (fs.existsSync(configPath)) {
      const configFile = fs.readFileSync(configPath, "utf8");
      const config: AppConfig = JSON.parse(configFile);
      if (config.available) {
        apps.push(config);
      }
    }
  }

  return apps;
};

describe("Runtipi Official App Configs Suite", () => {
  it("Get app config should return at least one app", () => {
    const apps = getAppConfigs();
    expect(apps.length).toBeGreaterThan(0);
  });

  describe("Each app docker-compose.json should be parsable by @runtipi/common", () => {
    const apps = getAppConfigs();

    for (const app of apps) {
      test(app.id, () => {
        expect(fs.existsSync(`./apps/${app.id}/docker-compose.json`)).toBe(true);
        const dockerComposeFile = fs.readFileSync(`./apps/${app.id}/docker-compose.json`, "utf8");
        const composeJson = JSON.parse(dockerComposeFile);
        const res = parseComposeJson(composeJson);
        expect(res).toBeDefined();
      });
    }
  });

  describe("Each app docker-compose.yml should match @runtipi/common dynamicComposeSchemaYaml", () => {
    const apps = getAppConfigs();

    for (const app of apps) {
      test(app.id, () => {
        expect(fs.existsSync(`./apps/${app.id}/docker-compose.yml`)).toBe(true);
        const rawYml = fs.readFileSync(`./apps/${app.id}/docker-compose.yml`, "utf8");
        const parsedYml = jsyaml.load(rawYml) as Record<string, any>;
        const { "x-runtipi": xRuntipi, ...rest } = parsedYml;
        expect(xRuntipi?.schema_version).toBe(2);
        const validated = dynamicComposeSchemaYaml(rest);
        expect(validated instanceof type.errors).toBe(false);
      });
    }
  });

  describe("Each app should have required metadata, files, and valid fields", () => {
    const apps = getAppConfigs();

    for (const app of apps) {
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
        const dockerComposeFile = fs.readFileSync(`./apps/${app.id}/docker-compose.yml`, "utf8");
        const dockerCompose = jsyaml.load(dockerComposeFile) as { services: Record<string, { image: string }> };
        expect(dockerCompose.services[app.id]).toBeDefined();
        expect(dockerCompose.services[app.id]?.image).toBeDefined();
        const dockerImage = dockerCompose.services[app.id]?.image;
        const version = dockerImage?.split(":")[1];
        expect(version).toContain(app.version);

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
    const appConfigs = getAppConfigs();
    const ports = appConfigs.map((app) => app.port).filter(Boolean);
    expect(new Set(ports).size).toBe(ports.length);
  });

  test("Each app should have a unique id", () => {
    const appConfigs = getAppConfigs();
    const ids = appConfigs.map((app) => app.id);
    expect(new Set(ids).size).toBe(appConfigs.length);
  });
});
