import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function ensureRuntipiRepo(): string {
  const targetDir = path.join(ROOT_DIR, ".tmp", "runtipi-appstore");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    execFileSync("git", ["clone", "--depth", "1", "https://github.com/runtipi/runtipi-appstore.git", targetDir], {
      stdio: "inherit",
    });
  } else {
    execFileSync("git", ["pull", "--ff-only"], { cwd: targetDir, stdio: "inherit" });
  }
  return targetDir;
}

export function updateBlacklist(): void {
  const blacklistPath = path.join(ROOT_DIR, "blacklist.json");
  const blacklist = JSON.parse(fs.readFileSync(blacklistPath, "utf8"));
  const runtipiDir = ensureRuntipiRepo();
  const appsRoot = path.join(runtipiDir, "apps");

  const dirs = fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(appsRoot, d.name, "config.json")))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  const runtipiOfficialApps = [];
  for (const dir of dirs) {
    const cfg = JSON.parse(fs.readFileSync(path.join(appsRoot, dir, "config.json"), "utf8"));
    const composePath = path.join(appsRoot, dir, "docker-compose.yml");
    const images: string[] = [];
    if (fs.existsSync(composePath)) {
      try {
        const parsed = YAML.parse(fs.readFileSync(composePath, "utf8"));
        for (const s of Object.values(parsed?.services || {}) as any[]) {
          if (s?.image) images.push(String(s.image));
        }
      } catch {
        // ignore
      }
    }
    runtipiOfficialApps.push({
      id: cfg.id || dir,
      name: cfg.name,
      port: cfg.port ?? null,
      categories: cfg.categories || [],
      source: cfg.source || "",
      website: cfg.website || "",
      available: cfg.available,
      deprecated: Boolean(cfg.deprecated),
      images,
    });
  }

  blacklist.generated_at = new Date().toISOString();
  blacklist.runtipi_official_apps = runtipiOfficialApps;
  blacklist.stats.runtipi_official_total = runtipiOfficialApps.length;
  blacklist.reserved_runtipi_ports = runtipiOfficialApps
    .filter((r) => r.port !== null)
    .map((r) => ({ port: r.port, runtipi_id: r.id }))
    .sort((a, b) => a.port - b.port);

  fs.writeFileSync(blacklistPath, `${JSON.stringify(blacklist, null, 2)}\n`, "utf8");
  console.log(`Updated blacklist.json with ${runtipiOfficialApps.length} official Runtipi apps.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  updateBlacklist();
}
