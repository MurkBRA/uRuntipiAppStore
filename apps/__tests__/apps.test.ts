import fs from "node:fs";
import path from "node:path";
import { appInfoSchema, dynamicComposeSchemaYaml, parseComposeJson } from "@runtipi/common/schemas";
import { type } from "arktype";
import jsyaml from "js-yaml";
import { describe, expect, it, test } from "vitest";

interface StoreFormField {
  type: string;
  required?: boolean;
  env_variable?: string;
}

interface StoreAppManifest {
  $schema?: string;
  id: string;
  name: string;
  available: boolean;
  port: number;
  categories: string[];
  description: string;
  short_desc: string;
  version?: string;
  tipi_version: number;
  author: string;
  source: string;
  supported_architectures: string[];
  dynamic_config: boolean;
  created_at: number;
  updated_at: number;
  url_suffix?: string;
  form_fields?: StoreFormField[];
  requirements?: {
    ports?: number[];
  };
}

interface StorePackageSnapshot {
  dir: string;
  manifest: StoreAppManifest;
  composeJsonPath: string;
  composeJson: Record<string, any> | null;
  composeYamlPath: string;
  composeYaml: Record<string, any> | null;
}

const APPS_ROOT = path.resolve("apps");

function loadStorePackages(): StorePackageSnapshot[] {
  if (!fs.existsSync(APPS_ROOT)) return [];

  const entries = fs
    .readdirSync(APPS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("__") && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  const packages: StorePackageSnapshot[] = [];
  for (const folder of entries) {
    const dir = path.join(APPS_ROOT, folder);
    const manifestPath = path.join(dir, "config.json");
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as StoreAppManifest;
    if (!manifest.available) continue;

    const composeJsonPath = path.join(dir, "docker-compose.json");
    const composeYamlPath = path.join(dir, "docker-compose.yml");

    const composeJson = fs.existsSync(composeJsonPath)
      ? (JSON.parse(fs.readFileSync(composeJsonPath, "utf8")) as Record<string, any>)
      : null;
    const composeYaml = fs.existsSync(composeYamlPath)
      ? (jsyaml.load(fs.readFileSync(composeYamlPath, "utf8")) as Record<string, any>)
      : null;

    packages.push({
      dir,
      manifest,
      composeJsonPath,
      composeJson,
      composeYamlPath,
      composeYaml,
    });
  }

  return packages;
}

function parseImageTag(imageRef: string): string {
  const withoutDigest = imageRef.split("@sha256:")[0].trim();
  const slashIdx = withoutDigest.lastIndexOf("/");
  const colonIdx = withoutDigest.lastIndexOf(":");
  return colonIdx > slashIdx ? withoutDigest.slice(colonIdx + 1) : "latest";
}

describe("Runtipi Store Format & Schema Compatibility Suite", () => {
  const packages = loadStorePackages();

  it("discovers at least one available app package", () => {
    expect(packages.length).toBeGreaterThan(0);
  });

  describe("config.json satisfies @runtipi/common appInfoSchema", () => {
    for (const pkg of packages) {
      test(pkg.manifest.id, () => {
        const candidate: Record<string, any> = { ...pkg.manifest, urn: `${pkg.manifest.id}:local` };
        Reflect.deleteProperty(candidate, "$schema");
        const result = appInfoSchema(candidate);
        expect(result instanceof type.errors, result instanceof type.errors ? result.summary : undefined).toBe(false);
      });
    }
  });

  describe("docker-compose.json satisfies @runtipi/common parseComposeJson", () => {
    for (const pkg of packages) {
      test(pkg.manifest.id, () => {
        expect(pkg.composeJson).not.toBeNull();
        expect(parseComposeJson(pkg.composeJson)).toBeDefined();
      });
    }
  });

  describe("docker-compose.yml satisfies @runtipi/common dynamicComposeSchemaYaml v2", () => {
    for (const pkg of packages) {
      test(pkg.manifest.id, () => {
        expect(pkg.composeYaml).not.toBeNull();
        const { "x-runtipi": meta, ...composeBody } = pkg.composeYaml!;
        expect(meta?.schema_version).toBe(2);
        const result = dynamicComposeSchemaYaml(composeBody);
        expect(result instanceof type.errors, result instanceof type.errors ? result.summary : undefined).toBe(false);
      });
    }
  });

  describe("package files, versions, form_fields, and timestamps are consistent", () => {
    for (const pkg of packages) {
      const { manifest, dir, composeYaml } = pkg;
      test(manifest.id, () => {
        expect(manifest.id).toBeTruthy();
        expect(manifest.name).toBeTruthy();
        expect(manifest.description).toBeTruthy();
        expect(Array.isArray(manifest.categories) && manifest.categories.length > 0).toBe(true);
        expect(Array.isArray(manifest.supported_architectures) && manifest.supported_architectures.length > 0).toBe(
          true,
        );
        expect(manifest.version).toBeTruthy();
        expect(manifest.tipi_version).toBeGreaterThan(0);

        // Required package files
        for (const rel of [
          "docker-compose.yml",
          "docker-compose.json",
          path.join("metadata", "description.md"),
          path.join("metadata", "logo.jpg"),
        ]) {
          expect(fs.existsSync(path.join(dir, rel)), `Missing ${rel} for ${manifest.id}`).toBe(true);
        }

        // Main service image tag must correspond to manifest version
        const mainService = composeYaml?.services?.[manifest.id];
        expect(mainService?.image, `Main service "${manifest.id}" image missing`).toBeTruthy();
        expect(parseImageTag(String(mainService.image))).toContain(manifest.version);

        // Random form fields must remain optional
        for (const field of manifest.form_fields || []) {
          if (field.type === "random") {
            expect(Boolean(field.required)).toBe(false);
          }
        }

        // Timestamps must be plausible epoch milliseconds from 2023 up to now
        const now = Date.now();
        for (const ts of [manifest.created_at, manifest.updated_at]) {
          expect(ts).toBeGreaterThan(0);
          expect(ts).toBeLessThan(now);
          expect(new Date(ts).getFullYear()).toBeGreaterThanOrEqual(2023);
        }
      });
    }
  });

  test("all available apps use unique IDs and unique ports", () => {
    const ids = packages.map((p) => p.manifest.id);
    expect(new Set(ids).size).toBe(ids.length);

    const ports = packages.map((p) => p.manifest.port).filter(Boolean);
    expect(new Set(ports).size).toBe(ports.length);
  });

  test("optional url_suffix values start with '/' or '?'", () => {
    for (const { manifest } of packages) {
      if (manifest.url_suffix) {
        expect(manifest.url_suffix).toMatch(/^[/?]/);
      }
    }
  });
});
