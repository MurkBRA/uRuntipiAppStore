import fs from "node:fs";
import path from "node:path";
import jsyaml from "js-yaml";
import { describe, expect, test } from "vitest";
import { isDatabaseImage } from "../../scripts/transpiler/compose.ts";

const blacklist = JSON.parse(fs.readFileSync("./blacklist.json", "utf8"));
const blacklistedUmbrelIds = new Set<string>(blacklist.blacklisted_umbrel_ids || []);
const officialRuntipiIds = new Set<string>((blacklist.runtipi_official_apps || []).map((r: any) => r.id));
const reservedRuntipiPorts = new Set<number>((blacklist.reserved_runtipi_ports || []).map((p: any) => p.port));

const RUNTIPI_BUILTINS = new Set([
  "APP_DATA_DIR",
  "APP_DOMAIN",
  "APP_PROTOCOL",
  "APP_PORT",
  "LOCAL_DOMAIN",
  "INTERNAL_IP",
  "ROOT_FOLDER_HOST",
  "DNS_IP",
  "TZ",
  "TIPI_VERSION",
  "APP_CONTAINER_USER",
]);

const FORBIDDEN_UMBREL_VARS = [
  "DEVICE_DOMAIN_NAME",
  "DEVICE_HOSTNAME",
  "APP_PROXY_PORT",
  "UMBREL_ROOT",
  "EXPORTS_APP_DATA_DIR",
  "EXPORTS_APP_DIR",
  "EXPORTS_DATA_ROOT",
  "EXPORTS_TOR_DATA_DIR",
  "APP_HIDDEN_SERVICE",
  "NETWORK_IP",
  "local_ips",
];

const RFC1123_HOST_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

interface PortedAppData {
  id: string;
  appDir: string;
  configJson: Record<string, any>;
  composeYmlRaw: string;
  composeJsonRaw: string;
  composeYml: Record<string, any>;
  composeJson: Record<string, any>;
  descMd: string;
}

let cachedPortedApps: PortedAppData[] | null = null;

function loadPortedApps(): PortedAppData[] {
  if (cachedPortedApps) return cachedPortedApps;
  if (!fs.existsSync("./apps")) {
    cachedPortedApps = [];
    return [];
  }

  const dirs = fs
    .readdirSync("./apps", { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("__") && fs.existsSync(`./apps/${d.name}/config.json`))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  cachedPortedApps = dirs.map((id) => {
    const appDir = path.join("./apps", id);
    const composeYmlRaw = fs.readFileSync(path.join(appDir, "docker-compose.yml"), "utf8");
    const composeJsonRaw = fs.readFileSync(path.join(appDir, "docker-compose.json"), "utf8");
    const configJson = JSON.parse(fs.readFileSync(path.join(appDir, "config.json"), "utf8"));
    const descMdPath = path.join(appDir, "metadata", "description.md");
    return {
      id,
      appDir,
      configJson,
      composeYmlRaw,
      composeJsonRaw,
      composeYml: jsyaml.load(composeYmlRaw) as Record<string, any>,
      composeJson: JSON.parse(composeJsonRaw),
      descMd: fs.existsSync(descMdPath) ? fs.readFileSync(descMdPath, "utf8") : "",
    };
  });

  return cachedPortedApps;
}

function collectFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursive(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function findUnboundEnvVars(content: string, declaredFormVars: Set<string>): string[] {
  const unbound = new Set<string>();
  let i = 0;

  while (i < content.length) {
    if (content[i] !== "$") {
      i++;
      continue;
    }
    if (content[i + 1] === "$") {
      i += 2;
      continue;
    }
    if (content[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      while (j < content.length && depth > 0) {
        if (content[j] === "{") depth++;
        else if (content[j] === "}") depth--;
        j++;
      }
      if (depth === 0) {
        const inner = content.slice(i + 2, j - 1);
        const m = inner.match(/^([A-Za-z_][A-Za-z0-9_]*)(?::-([\s\S]*))?$/);
        if (m) {
          const [, varName, fallback] = m;
          if (fallback === undefined && !RUNTIPI_BUILTINS.has(varName) && !declaredFormVars.has(varName)) {
            unbound.add(varName);
          }
          i = j;
          continue;
        }
      }
    }
    i++;
  }

  return Array.from(unbound);
}

function findUnbracedBuiltins(content: string): string[] {
  const matches = new Set<string>();
  for (const builtin of RUNTIPI_BUILTINS) {
    const regex = new RegExp(`(?<!\\$)\\$${builtin}\\b`, "g");
    if (regex.test(content)) {
      matches.add(builtin);
    }
  }
  return Array.from(matches);
}

describe("Umbrel -> Runtipi Port Integrity & Security Suite", () => {
  const apps = loadPortedApps();
  const appIds = apps.map((a) => a.id);

  test("No blacklisted or duplicate Runtipi app is present in apps/", () => {
    for (const id of appIds) {
      expect(blacklistedUmbrelIds.has(id), `App ${id} is in blacklisted_umbrel_ids`).toBe(false);
      expect(officialRuntipiIds.has(id), `App ${id} collides with an official Runtipi app id`).toBe(false);
    }
  });

  test("No ported app port collides with official Runtipi reserved ports", () => {
    for (const { id, configJson } of apps) {
      expect(
        reservedRuntipiPorts.has(configJson.port),
        `App ${id} uses port ${configJson.port} which is reserved by runtipi-appstore`,
      ).toBe(false);
    }
  });

  test("state/sync-state.json is strictly synchronized with apps/", () => {
    const syncState = JSON.parse(fs.readFileSync("./state/sync-state.json", "utf8"));
    const stateIds = Object.keys(syncState.apps || {}).sort((a, b) => a.localeCompare(b));
    expect(stateIds).toEqual(appIds);

    for (const { id, configJson } of apps) {
      const stateEntry = syncState.apps[id];
      expect(stateEntry.version, `${id} sync-state version mismatch`).toBe(configJson.version);
      expect(stateEntry.port, `${id} sync-state port mismatch`).toBe(configJson.port);
      expect(stateEntry.tipi_version, `${id} sync-state tipi_version mismatch`).toBe(configJson.tipi_version);
    }
  });

  test("README.md catalog matches ported apps count and entries", () => {
    const readme = fs.readFileSync("./README.md", "utf8");
    expect(readme).toContain(`Ported Active Apps**: **${appIds.length}**`);
    for (const id of appIds) {
      expect(readme).toContain(`\`${id}\``);
    }
  });

  describe("Per-app zero-leak, digest removal, DNS rewrite, and JPEG magic header validation", () => {
    for (const { id, appDir, configJson, composeYmlRaw, composeJsonRaw, composeYml, composeJson, descMd } of apps) {
      test(id, () => {
        // 1. No app_proxy or @sha256 digest
        expect(composeYml.services.app_proxy).toBeUndefined();
        expect(composeYmlRaw).not.toContain("@sha256:");
        expect(composeJsonRaw).not.toContain("@sha256:");

        // 2. No leaked Umbrel-exclusive platform variable references (${VAR} or $VAR) or broken default braces
        expect(composeYmlRaw).not.toContain("}:-");
        expect(composeJsonRaw).not.toContain("}:-");
        for (const forbidden of FORBIDDEN_UMBREL_VARS) {
          const varRefRegex = new RegExp(`\\$\\{?${forbidden}\\b`);
          expect(varRefRegex.test(composeYmlRaw), `Leaked $${forbidden} in ${id}/docker-compose.yml`).toBe(false);
          expect(varRefRegex.test(composeJsonRaw), `Leaked $${forbidden} in ${id}/docker-compose.json`).toBe(false);
        }

        // 2b. No unbound ${VAR} references without fallback and no unbraced Runtipi builtins ($APP_DATA_DIR, etc.)
        const declaredFormVars = new Set<string>(
          (configJson.form_fields || []).map((f: any) => String(f.env_variable || "")).filter(Boolean),
        );
        expect(
          findUnboundEnvVars(composeYmlRaw, declaredFormVars),
          `Unbound variable(s) in ${id}/docker-compose.yml`,
        ).toEqual([]);
        expect(
          findUnboundEnvVars(composeJsonRaw, declaredFormVars),
          `Unbound variable(s) in ${id}/docker-compose.json`,
        ).toEqual([]);
        expect(findUnbracedBuiltins(composeYmlRaw), `Unbraced Runtipi builtin(s) in ${id}/docker-compose.yml`).toEqual(
          [],
        );
        expect(
          findUnbracedBuiltins(composeJsonRaw),
          `Unbraced Runtipi builtin(s) in ${id}/docker-compose.json`,
        ).toEqual([]);

        // 3. No residual Umbrel container DNS pattern <appId>_<service>_1
        const residualDnsRegex = new RegExp(`\\b${id.replace(/-/g, "\\-")}_[a-zA-Z0-9_-]+_1\\b`);
        expect(residualDnsRegex.test(composeYmlRaw)).toBe(false);
        expect(residualDnsRegex.test(composeJsonRaw)).toBe(false);

        // 4. No unmapped upstream container_name references in URLs or host variables
        const knownUpstreamCustomContainers: Record<string, string[]> = {
          adventurelog: ["adventurelogserver1"],
          seafile: ["seafile-mysql"],
          plane: ["plane-minio-1"],
        };

        const upstreamDirs = [path.join(".tmp", "umbrel-apps", id), path.join(".tmp", "umbrel-apps-gallery", id)];
        const unmappedNames = new Set<string>(knownUpstreamCustomContainers[id] || []);
        for (const uDir of upstreamDirs) {
          const uCompose = path.join(uDir, "docker-compose.yml");
          if (fs.existsSync(uCompose)) {
            try {
              const uDoc = jsyaml.load(fs.readFileSync(uCompose, "utf8")) as Record<string, any>;
              if (uDoc?.services) {
                for (const svc of Object.values(uDoc.services)) {
                  if (typeof (svc as any)?.container_name === "string") {
                    const cName = (svc as any).container_name.trim();
                    if (!composeYml.services[cName]) {
                      unmappedNames.add(cName);
                    }
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }

        for (const unmapped of unmappedNames) {
          const unmappedUrlRegex = new RegExp(`://[^:/\\s"']+@?${unmapped}(?::\\d+)?(?:/|["'\\s]|$)`);
          expect(
            unmappedUrlRegex.test(composeYmlRaw),
            `Found unmapped upstream container_name "${unmapped}" in ${id}/docker-compose.yml`,
          ).toBe(false);
          expect(
            unmappedUrlRegex.test(composeJsonRaw),
            `Found unmapped upstream container_name "${unmapped}" in ${id}/docker-compose.json`,
          ).toBe(false);

          const unmappedHostRegex = new RegExp(`(?:HOST|.*_(?:HOST|IP))=['"]?${unmapped}['"]?`, "i");
          expect(
            unmappedHostRegex.test(composeYmlRaw),
            `Found unmapped upstream container_name "${unmapped}" in host env in ${id}/docker-compose.yml`,
          ).toBe(false);
          expect(
            unmappedHostRegex.test(composeJsonRaw),
            `Found unmapped upstream container_name "${unmapped}" in host env in ${id}/docker-compose.json`,
          ).toBe(false);
        }

        // 5. Verify logo.jpg has genuine JPEG magic bytes (FF D8 FF)
        const logoPath = path.join(appDir, "metadata", "logo.jpg");
        const stat = fs.statSync(logoPath);
        expect(stat.size).toBeGreaterThan(100);
        const buf = Buffer.alloc(3);
        const fd = fs.openSync(logoPath, "r");
        fs.readSync(fd, buf, 0, 3, 0);
        fs.closeSync(fd);
        expect(buf[0]).toBe(0xff);
        expect(buf[1]).toBe(0xd8);
        expect(buf[2]).toBe(0xff);

        // 6. Verify database services do NOT have user specified (avoids permission crash on first install)
        for (const [svcName, svc] of Object.entries(composeYml.services || {})) {
          const img = (svc as any)?.image || "";
          if (isDatabaseImage(img)) {
            expect(
              (svc as any).user,
              `Database service "${svcName}" with image "${img}" in ${id}/docker-compose.yml must not specify "user:"`,
            ).toBeUndefined();
          }
        }
        for (const svc of composeJson.services || []) {
          if (isDatabaseImage(svc.image)) {
            expect(
              svc.user,
              `Database service "${svc.name}" with image "${svc.image}" in ${id}/docker-compose.json must not specify "user"`,
            ).toBeUndefined();
          }
        }

        // 7. Verify no hardcoded networks: block in docker-compose.yml
        expect(
          composeYml.networks,
          `App ${id}/docker-compose.yml must not specify hardcoded "networks:" (Runtipi manages dynamic network isolation)`,
        ).toBeUndefined();

        // 7b. Structural integrity: single isMain === id, yml/json service parity, depends_on & healthcheck validity, RFC1123 hostnames
        const jsonServices = (composeJson.services || []) as Array<Record<string, any>>;
        const ymlServices = (composeYml.services || {}) as Record<string, any>;
        const mainJsonSvcs = jsonServices.filter((s) => s.isMain === true);
        expect(mainJsonSvcs.length, `${id} must have exactly 1 isMain service`).toBe(1);
        expect(mainJsonSvcs[0]?.name, `${id} main service name must match app id`).toBe(id);

        const jsonServiceMap = new Map(jsonServices.map((s) => [s.name, s]));
        expect(Object.keys(ymlServices).sort()).toEqual(Array.from(jsonServiceMap.keys()).sort());

        for (const svc of jsonServices) {
          const ySvc = ymlServices[svc.name];
          expect(ySvc?.image).toBe(svc.image);
          const resolveHostVars = (h: string) => h.replace(/\$\{(?:APP_DOMAIN|LOCAL_DOMAIN)\}/g, "app.tipi.local");
          if (svc.hostname !== undefined) {
            expect(resolveHostVars(svc.hostname), `Invalid hostname "${svc.hostname}" in ${id}`).toMatch(
              RFC1123_HOST_REGEX,
            );
          }
          if (ySvc?.hostname !== undefined) {
            expect(resolveHostVars(ySvc.hostname), `Invalid YML hostname "${ySvc.hostname}" in ${id}`).toMatch(
              RFC1123_HOST_REGEX,
            );
          }

          // Validate dependsOn references exist and service_healthy targets have healthCheck
          if (Array.isArray(svc.dependsOn)) {
            for (const dep of svc.dependsOn) {
              expect(jsonServiceMap.has(dep), `${id}/${svc.name} dependsOn missing service "${dep}"`).toBe(true);
            }
          } else if (svc.dependsOn && typeof svc.dependsOn === "object") {
            for (const [dep, cfg] of Object.entries(svc.dependsOn)) {
              const targetSvc = jsonServiceMap.get(dep);
              expect(targetSvc, `${id}/${svc.name} dependsOn missing service "${dep}"`).toBeDefined();
              if ((cfg as any)?.condition === "service_healthy") {
                expect(
                  targetSvc?.healthCheck,
                  `${id}/${svc.name} waits for service_healthy on "${dep}", which lacks healthCheck`,
                ).toBeDefined();
              }
            }
          }
        }

        // 7c. Validate form_fields have unique env_variable names and valid regex patterns
        if (Array.isArray(configJson.form_fields)) {
          const seenFieldVars = new Set<string>();
          for (const field of configJson.form_fields) {
            expect(seenFieldVars.has(field.env_variable), `Duplicate form_field ${field.env_variable} in ${id}`).toBe(
              false,
            );
            seenFieldVars.add(field.env_variable);
            if (field.regex) {
              expect(() => new RegExp(field.regex)).not.toThrow();
            }
            expect(
              field.default,
              `App ${id} has unhandled form field ${field.env_variable} with default: "default"`,
            ).not.toBe("default");
          }
        }

        // 7d. Verify no Umbrel platform variables or residual <id>_<svc>_1 leak inside apps/<id>/data/
        const dataFiles = collectFilesRecursive(path.join(appDir, "data"));
        for (const file of dataFiles) {
          if (!/\.(conf|cfg|ya?ml|json|toml|sh|txt|ini|env|properties|template|js|ts|py|xml)$/i.test(file)) continue;
          const fileRaw = fs.readFileSync(file, "utf8");
          for (const forbidden of FORBIDDEN_UMBREL_VARS) {
            expect(new RegExp(`\\$\\{?${forbidden}\\b`).test(fileRaw), `Leaked $${forbidden} inside ${file}`).toBe(
              false,
            );
          }
          expect(residualDnsRegex.test(fileRaw), `Residual Umbrel DNS name inside ${file}`).toBe(false);
        }

        // 8. Specific app regression checks
        if (id === "airtrail") {
          expect(
            configJson.form_fields,
            "airtrail must not define form_fields (such as APP_CONTAINER_USER)",
          ).toBeUndefined();
          for (const [sName, sVal] of Object.entries(composeYml.services || {})) {
            expect((sVal as any).user, `airtrail service "${sName}" must not specify user:`).toBeUndefined();
          }
        }

        if (id === "arcane") {
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_PASSWORD")).toBe(false);
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_ENCRYPTION_KEY")).toBe(true);
          expect(descMd).toContain("`arcane-admin`");
          expect(descMd).not.toContain("Generated automatically via the `APP_PASSWORD` field");
          expect(composeYmlRaw).toContain("ENCRYPTION_KEY=${APP_ENCRYPTION_KEY:-${APP_PASSWORD}}");
          expect(composeJsonRaw).toContain("${APP_ENCRYPTION_KEY:-${APP_PASSWORD}}");
        }

        if (id === "endurain") {
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_PASSWORD")).toBe(false);
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_SECRET_KEY")).toBe(true);
          expect(descMd).toContain("- **Password**: `admin`");
          expect(descMd).not.toContain("Generated automatically via the `APP_PASSWORD` field");
          expect(composeYmlRaw).toContain("SECRET_KEY=${APP_SECRET_KEY:-${APP_PASSWORD}}");
        }

        if (id === "bffless") {
          expect(
            composeYml.services.backend,
            "bffless must retain 'backend' service name for nginx upstream",
          ).toBeDefined();
          expect(
            composeYml.services["bffless-backend"],
            "bffless must not rename backend to bffless-backend",
          ).toBeUndefined();
          expect(composeYml.services.bffless.depends_on).toContain("backend");
          expect(composeJson.services.some((s: any) => s.name === "backend")).toBe(true);
          expect(composeJson.services.some((s: any) => s.name === "bffless-backend")).toBe(false);
          const backendSvc = composeJson.services.find((s: any) => s.name === "backend");
          const backendHostEnv = backendSvc?.environment?.find((e: any) => e.key === "BACKEND_HOST");
          expect(backendHostEnv?.value).toBe("backend");
        }

        if (id === "frigate") {
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_PASSWORD")).toBe(false);
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_RTSP_PASSWORD")).toBe(true);
          const rtspField = configJson.form_fields.find((f: any) => f.env_variable === "APP_RTSP_PASSWORD");
          expect(rtspField.label).toContain("RTSP");
          expect(descMd).toContain("console/logs");
          expect(descMd).toContain("APP_RTSP_PASSWORD");
          expect(descMd).not.toContain("Generated automatically via the `APP_PASSWORD` field");
          expect(composeYmlRaw).toContain("FRIGATE_RTSP_PASSWORD=${APP_RTSP_PASSWORD:-${APP_PASSWORD}}");
          expect(composeJsonRaw).toContain("${APP_RTSP_PASSWORD:-${APP_PASSWORD}}");
          const frigateSvc = composeJson.services.find((s: any) => s.name === "frigate");
          expect(frigateSvc?.shmSize).toBe("256mb");
          expect(frigateSvc?.privileged).toBe(true);
          expect(frigateSvc?.addPorts?.some((p: any) => p.hostPort === 8555 && p.tcp)).toBe(true);
          expect(frigateSvc?.addPorts?.some((p: any) => p.hostPort === 8555 && p.udp)).toBe(true);
        }

        if (id === "wger") {
          const wgerSvc = composeJson.services.find((s: any) => s.name === "wger");
          expect(wgerSvc?.image).toContain("nginx");
          expect(wgerSvc?.dependsOn).toContain("wger-web");
          expect(wgerSvc?.dependsOn).toContain("wger-powersync");
          const webSvc = composeJson.services.find((s: any) => s.name === "wger-web");
          const csrfEnv = webSvc?.environment?.find((e: any) => e.key === "CSRF_TRUSTED_ORIGINS");
          expect(csrfEnv?.value).toContain("${APP_PROTOCOL:-http}://${APP_DOMAIN}");
          const nginxConf = fs.readFileSync(path.join(appDir, "data", "config", "nginx.conf"), "utf8");
          expect(nginxConf).toContain("server wger-web:8000;");
          expect(nginxConf).toContain("server wger-powersync:8080;");
        }

        if (id === "gitingest") {
          expect(configJson.form_fields.some((f: any) => f.env_variable === "local_ips")).toBe(false);
          const hostField = configJson.form_fields.find((f: any) => f.env_variable === "APP_ALLOWED_HOSTS");
          expect(hostField).toBeDefined();
          expect(hostField.hint).toBe("Allowed hosts. Enter * to allow all.");
          expect(hostField.default).toContain("${APP_DOMAIN}");
          expect(hostField.default).toContain("${LOCAL_DOMAIN}");
          expect(hostField.default).toContain("${INTERNAL_IP}");
          expect(hostField.default).toContain("${APP_PORT}");
          expect(composeYmlRaw).toContain("ALLOWED_HOSTS=${APP_ALLOWED_HOSTS:-");
          expect(composeJsonRaw).toContain('"key": "ALLOWED_HOSTS"');
          expect(composeJsonRaw).toContain("${APP_ALLOWED_HOSTS:-");
        }

        if (id === "paperclip") {
          expect(configJson.form_fields.some((f: any) => f.env_variable === "local_ips")).toBe(false);
          const hostField = configJson.form_fields.find((f: any) => f.env_variable === "APP_ALLOWED_HOSTNAMES");
          expect(hostField).toBeDefined();
          expect(hostField.hint).toBe("Allowed hosts. Enter * to allow all.");
          expect(hostField.default).toContain("${APP_DOMAIN}");
          expect(composeYmlRaw).toContain("PAPERCLIP_ALLOWED_HOSTNAMES=${APP_ALLOWED_HOSTNAMES:-");
          expect(composeJsonRaw).toContain('"key": "PAPERCLIP_ALLOWED_HOSTNAMES"');
          expect(composeJsonRaw).toContain("${APP_ALLOWED_HOSTNAMES:-");
        }

        if (id === "solidtime") {
          expect(configJson.form_fields.some((f: any) => f.env_variable === "local_ips")).toBe(false);
          const hostField = configJson.form_fields.find((f: any) => f.env_variable === "APP_TRUSTED_HOSTS");
          expect(hostField).toBeDefined();
          expect(hostField.hint).toBe("Allowed hosts. Enter * to allow all.");
          expect(hostField.default).toContain("${APP_DOMAIN}");
          expect(composeYmlRaw).toContain("TRUSTED_HOSTS=${APP_TRUSTED_HOSTS:-");
          expect(composeJsonRaw).toContain('"key": "TRUSTED_HOSTS"');
          expect(composeJsonRaw).toContain("${APP_TRUSTED_HOSTS:-");
        }

        if (id === "gitlab") {
          const gitlabSvc = composeJson.services.find((s: any) => s.name === "gitlab");
          expect(gitlabSvc).toBeDefined();
          expect(gitlabSvc.hostname).toBe("gitlab");
          expect(composeYmlRaw).toContain("external_url '${APP_PROTOCOL:-http}://${APP_DOMAIN}'");
          expect(composeJsonRaw).toContain("external_url '${APP_PROTOCOL:-http}://${APP_DOMAIN}'");
          expect(composeYmlRaw).not.toContain("${APP_DOMAIN}:");
          expect(composeYmlRaw).toContain("gitlab_rails['nginx']['listen_port'] = 8929");
          expect(composeYmlRaw).toContain("gitlab_rails['nginx']['listen_https'] = false");
          expect(composeYmlRaw).not.toContain("PUID=1000");
          expect(composeYmlRaw).not.toContain("PGID=1000");
        }

        if (id === "home-assistant-fusion-ui") {
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_HAFUSION_MACHINE_IP")).toBe(false);
          const hassUrlField = configJson.form_fields.find((f: any) => f.env_variable === "HASS_URL");
          expect(hassUrlField).toBeDefined();
          expect(hassUrlField.default).toBe("http://homeassistant-1:8123");
          expect(composeYmlRaw).toContain("host.docker.internal:host-gateway");
          expect(composeYmlRaw).not.toContain("${APP_HAFUSION_MACHINE_IP}");
          expect(composeJsonRaw).toContain("host.docker.internal:host-gateway");
          expect(composeJsonRaw).not.toContain("${APP_HAFUSION_MACHINE_IP}");
          expect(composeYml.services["home-assistant-fusion-ui"]["x-runtipi"].internal_port).toBe(5050);
          expect(composeJson.services.find((s: any) => s.name === "home-assistant-fusion-ui").internalPort).toBe(5050);
        }

        // 9. Verify descriptions do NOT leak umbrelOS or Umbrel platform references in prose
        const stripProtected = (str: string) =>
          str
            .replace(/https?:\/\/[^\s)\]]+/g, "")
            .replace(/```[\s\S]*?```/g, "")
            .replace(/`[^`]+`/g, "");

        const descProse = stripProtected(descMd);
        const configDescProse = stripProtected(`${configJson.description || ""} ${configJson.short_desc || ""}`);

        expect(descProse, `App ${id}/metadata/description.md leaks "umbrelOS" or "Umbrel" in prose`).not.toMatch(
          /\b(?:umbrelOS|umbrel\s*os)\b/i,
        );
        expect(descProse, `App ${id}/metadata/description.md leaks "Umbrel" platform reference in prose`).not.toMatch(
          /\bUmbrel\b/,
        );
        expect(
          configDescProse,
          `App ${id}/config.json leaks "umbrelOS" or "Umbrel" in description/short_desc`,
        ).not.toMatch(/\b(?:umbrelOS|umbrel\s*os)\b/i);
        expect(
          configDescProse,
          `App ${id}/config.json leaks "Umbrel" platform reference in description/short_desc`,
        ).not.toMatch(/\bUmbrel\b/);

        // 10. Credentials integrity
        if (descMd.includes("Generated automatically via the `APP_PASSWORD` field")) {
          expect(
            configJson.form_fields?.some((f: any) => f.env_variable === "APP_PASSWORD"),
            `App ${id} promises generated APP_PASSWORD in description.md but has no APP_PASSWORD form_field in config.json`,
          ).toBe(true);
          expect(
            composeYmlRaw.includes("APP_PASSWORD"),
            `App ${id} promises generated APP_PASSWORD in description.md but does not use APP_PASSWORD in docker-compose.yml`,
          ).toBe(true);
        }

        // 11. No broken /curl healthcheck binaries in docker-compose.yml
        expect(composeYmlRaw, `App ${id} docker-compose.yml contains broken /curl healthcheck binary`).not.toMatch(
          /\b\/curl\b/,
        );

        // 12. Volume container paths must never contain ${APP_DATA_DIR}
        for (const svc of composeJson.services || []) {
          for (const vol of svc.volumes || []) {
            expect(
              vol.containerPath,
              `App ${id} service ${svc.name} has host variable in containerPath: ${vol.containerPath}`,
            ).not.toContain("${APP_DATA_DIR}");
          }
        }
      });
    }
  });
});
