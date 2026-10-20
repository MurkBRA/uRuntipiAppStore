import fs from "node:fs";
import path from "node:path";
import jsyaml from "js-yaml";
import { describe, expect, test } from "vitest";

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

        // 4. Verify logo.jpg has genuine JPEG magic bytes (FF D8 FF)
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
      });
    }
  });
});
