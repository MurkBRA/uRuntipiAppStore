import fs from "node:fs";
import path from "node:path";
import jsyaml from "js-yaml";
import { describe, expect, test } from "vitest";
import { isDatabaseImage } from "../../scripts/transpiler/compose.ts";

const blacklist = JSON.parse(fs.readFileSync("./blacklist.json", "utf8"));
const blacklistedUmbrelIds = new Set<string>(blacklist.blacklisted_umbrel_ids || []);
const officialRuntipiIds = new Set<string>((blacklist.runtipi_official_apps || []).map((r: any) => r.id));
const reservedRuntipiPorts = new Set<number>((blacklist.reserved_runtipi_ports || []).map((p: any) => p.port));

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

function getPortedAppDirs(): string[] {
  if (!fs.existsSync("./apps")) return [];
  return fs
    .readdirSync("./apps", { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("__") && fs.existsSync(`./apps/${d.name}/config.json`))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

describe("Umbrel -> Runtipi Port Integrity & Security Suite", () => {
  const appIds = getPortedAppDirs();

  test("No blacklisted or duplicate Runtipi app is present in apps/", () => {
    for (const id of appIds) {
      expect(blacklistedUmbrelIds.has(id), `App ${id} is in blacklisted_umbrel_ids`).toBe(false);
      expect(officialRuntipiIds.has(id), `App ${id} collides with an official Runtipi app id`).toBe(false);
    }
  });

  test("No ported app port collides with official Runtipi reserved ports", () => {
    for (const id of appIds) {
      const cfg = JSON.parse(fs.readFileSync(`./apps/${id}/config.json`, "utf8"));
      expect(
        reservedRuntipiPorts.has(cfg.port),
        `App ${id} uses port ${cfg.port} which is reserved by runtipi-appstore`,
      ).toBe(false);
    }
  });

  describe("Per-app zero-leak, digest removal, DNS rewrite, and JPEG magic header validation", () => {
    for (const id of appIds) {
      test(id, () => {
        const appDir = path.join("./apps", id);
        const composeYmlRaw = fs.readFileSync(path.join(appDir, "docker-compose.yml"), "utf8");
        const composeJsonRaw = fs.readFileSync(path.join(appDir, "docker-compose.json"), "utf8");
        const composeYml = jsyaml.load(composeYmlRaw) as Record<string, any>;
        const composeJson = JSON.parse(composeJsonRaw);

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

        // 3. No residual Umbrel container DNS pattern <appId>_<service>_1
        const residualDnsRegex = new RegExp(`\\b${id.replace(/-/g, "\\-")}_[a-zA-Z0-9_-]+_1\\b`);
        expect(residualDnsRegex.test(composeYmlRaw)).toBe(false);
        expect(residualDnsRegex.test(composeJsonRaw)).toBe(false);

        // 4. No unmapped upstream container_name references in URLs or host variables
        // If an upstream service defined a custom container_name that differs from its final Runtipi service name,
        // it must not leak into compose as an unresolved hostname.
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
            } catch {}
          }
        }

        for (const unmapped of unmappedNames) {
          // Unmapped container name must not appear as URL host
          const unmappedUrlRegex = new RegExp(`://[^:/\\s"']+@?${unmapped}(?::\\d+)?(?:/|["'\\s]|$)`);
          expect(
            unmappedUrlRegex.test(composeYmlRaw),
            `Found unmapped upstream container_name "${unmapped}" in ${id}/docker-compose.yml`,
          ).toBe(false);
          expect(
            unmappedUrlRegex.test(composeJsonRaw),
            `Found unmapped upstream container_name "${unmapped}" in ${id}/docker-compose.json`,
          ).toBe(false);

          // And must not appear as a standalone host assignment (e.g. DB_HOST=unmapped)
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

        // 7. Verify no hardcoded networks: block in docker-compose.yml (Runtipi dynamically manages app isolation networks)
        expect(
          composeYml.networks,
          `App ${id}/docker-compose.yml must not specify hardcoded "networks:" (Runtipi manages dynamic network isolation)`,
        ).toBeUndefined();

        // 8. Specific app regression checks
        if (id === "airtrail") {
          const configJson = JSON.parse(fs.readFileSync(path.join(appDir, "config.json"), "utf8"));
          expect(
            configJson.form_fields,
            "airtrail must not define form_fields (such as APP_CONTAINER_USER)",
          ).toBeUndefined();
          for (const [sName, sVal] of Object.entries(composeYml.services || {})) {
            expect((sVal as any).user, `airtrail service "${sName}" must not specify user:`).toBeUndefined();
          }
        }

        if (id === "arcane") {
          const configJson = JSON.parse(fs.readFileSync(path.join(appDir, "config.json"), "utf8"));
          const descMd = fs.readFileSync(path.join(appDir, "metadata", "description.md"), "utf8");
          // Encryption key must not be mislabeled as password
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_PASSWORD")).toBe(false);
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_ENCRYPTION_KEY")).toBe(true);
          expect(descMd).toContain("`arcane-admin`");
          expect(descMd).not.toContain("Generated automatically via the `APP_PASSWORD` field");
          expect(composeYmlRaw).toContain("ENCRYPTION_KEY=${APP_ENCRYPTION_KEY:-${APP_PASSWORD}}");
          expect(composeJsonRaw).toContain("${APP_ENCRYPTION_KEY:-${APP_PASSWORD}}");
        }

        if (id === "endurain") {
          const configJson = JSON.parse(fs.readFileSync(path.join(appDir, "config.json"), "utf8"));
          const descMd = fs.readFileSync(path.join(appDir, "metadata", "description.md"), "utf8");
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_PASSWORD")).toBe(false);
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_SECRET_KEY")).toBe(true);
          expect(descMd).toContain("- **Password**: `admin`");
          expect(descMd).not.toContain("Generated automatically via the `APP_PASSWORD` field");
          expect(composeYmlRaw).toContain("SECRET_KEY=${APP_SECRET_KEY:-${APP_PASSWORD}}");
        }

        if (id === "bffless") {
          // bffless nginx container requires DNS hostname "backend" to resolve upstream backend:3000
          expect(composeYml.services.backend, "bffless must retain 'backend' service name for nginx upstream").toBeDefined();
          expect(composeYml.services["bffless-backend"], "bffless must not rename backend to bffless-backend").toBeUndefined();
          expect(composeYml.services.bffless.depends_on).toContain("backend");
          expect(composeJson.services.some((s: any) => s.name === "backend")).toBe(true);
          expect(composeJson.services.some((s: any) => s.name === "bffless-backend")).toBe(false);
          const backendSvc = composeJson.services.find((s: any) => s.name === "backend");
          const backendHostEnv = backendSvc?.environment?.find((e: any) => e.key === "BACKEND_HOST");
          expect(backendHostEnv?.value).toBe("backend");
        }

        if (id === "frigate") {
          const configJson = JSON.parse(fs.readFileSync(path.join(appDir, "config.json"), "utf8"));
          const descMd = fs.readFileSync(path.join(appDir, "metadata", "description.md"), "utf8");
          // RTSP stream password must not be mislabeled as admin login password
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_PASSWORD")).toBe(false);
          expect(configJson.form_fields.some((f: any) => f.env_variable === "APP_RTSP_PASSWORD")).toBe(true);
          const rtspField = configJson.form_fields.find((f: any) => f.env_variable === "APP_RTSP_PASSWORD");
          expect(rtspField.label).toContain("RTSP");
          expect(descMd).toContain("console/logs");
          expect(descMd).toContain("APP_RTSP_PASSWORD");
          expect(descMd).not.toContain("Generated automatically via the `APP_PASSWORD` field");
          expect(composeYmlRaw).toContain("FRIGATE_RTSP_PASSWORD=${APP_RTSP_PASSWORD:-${APP_PASSWORD}}");
          expect(composeJsonRaw).toContain("${APP_RTSP_PASSWORD:-${APP_PASSWORD}}");
        }

        if (id === "gitingest") {
          const configJson = JSON.parse(fs.readFileSync(path.join(appDir, "config.json"), "utf8"));
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
          const configJson = JSON.parse(fs.readFileSync(path.join(appDir, "config.json"), "utf8"));
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
          const configJson = JSON.parse(fs.readFileSync(path.join(appDir, "config.json"), "utf8"));
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
          const composeJson = JSON.parse(fs.readFileSync(path.join(appDir, "docker-compose.json"), "utf8"));
          const gitlabSvc = composeJson.services.find((s: any) => s.name === "gitlab");
          expect(gitlabSvc).toBeDefined();
          expect(gitlabSvc.hostname).toBeDefined();
          expect(gitlabSvc.hostname).not.toMatch(/:/);
          expect(gitlabSvc.hostname).toBe("gitlab");
          expect(composeYmlRaw).toContain("external_url '${APP_PROTOCOL:-http}://${APP_DOMAIN}'");
          expect(composeJsonRaw).toContain("external_url '${APP_PROTOCOL:-http}://${APP_DOMAIN}'");
          expect(composeYmlRaw).not.toContain("${APP_DOMAIN}:");
          expect(composeYmlRaw).toContain("gitlab_rails['nginx']['listen_port'] = 8929");
          expect(composeYmlRaw).toContain("gitlab_rails['nginx']['listen_https'] = false");
          expect(composeYmlRaw).not.toContain("PUID=1000");
          expect(composeYmlRaw).not.toContain("PGID=1000");
        }

        // 9. Verify descriptions do NOT leak umbrelOS or Umbrel platform references in prose
        const configJsonPath = path.join(appDir, "config.json");
        const appConfig = JSON.parse(fs.readFileSync(configJsonPath, "utf8"));
        const descMdPath = path.join(appDir, "metadata", "description.md");
        const descMd = fs.existsSync(descMdPath) ? fs.readFileSync(descMdPath, "utf8") : "";

        const stripProtected = (str: string) =>
          str
            .replace(/https?:\/\/[^\s)\]]+/g, "")
            .replace(/```[\s\S]*?```/g, "")
            .replace(/`[^`]+`/g, "");

        const descProse = stripProtected(descMd);
        const configDescProse = stripProtected(`${appConfig.description || ""} ${appConfig.short_desc || ""}`);

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

        // 10. Credentials integrity: if description mentions generated APP_PASSWORD, the app MUST declare that form field and use it
        if (descMd.includes("Generated automatically via the `APP_PASSWORD` field")) {
          expect(
            appConfig.form_fields?.some((f: any) => f.env_variable === "APP_PASSWORD"),
            `App ${id} promises generated APP_PASSWORD in description.md but has no APP_PASSWORD form_field in config.json`,
          ).toBe(true);
          expect(
            composeYmlRaw.includes("APP_PASSWORD"),
            `App ${id} promises generated APP_PASSWORD in description.md but does not use APP_PASSWORD in docker-compose.yml`,
          ).toBe(true);
        }
      });
    }
  });
});
