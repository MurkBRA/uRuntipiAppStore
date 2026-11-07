import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const GENERIC_IMAGES = new Set([
  "postgres",
  "postgis",
  "mariadb",
  "mysql",
  "redis",
  "valkey",
  "mongo",
  "mongodb",
  "nginx",
  "caddy",
  "alpine",
  "node",
  "python",
  "busybox",
  "traefik",
  "meilisearch",
  "minio",
]);

function normalizeRepoUrl(url: string): string {
  if (!url) return "";
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

function normalizeImageName(image: string): string {
  if (!image) return "";
  const withoutDigest = image.toLowerCase().trim().split("@sha256:")[0];
  const withoutTag = withoutDigest.split(":")[0];
  const lastSlash = withoutTag.lastIndexOf("/");
  const baseName = lastSlash >= 0 ? withoutTag.slice(lastSlash + 1) : withoutTag;
  return baseName;
}

function ensureRuntipiRepo(): string {
  const targetDir = path.join(ROOT_DIR, ".tmp", "runtipi-appstore");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    execFileSync("git", ["clone", "--depth", "1", "https://github.com/runtipi/runtipi-appstore.git", targetDir], {
      stdio: "inherit",
    });
  } else {
    try {
      execFileSync("git", ["pull", "--ff-only"], { cwd: targetDir, stdio: "inherit" });
    } catch {
      // ignore
    }
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
  const officialRepoUrls = new Set<string>();
  const officialImages = new Set<string>();

  for (const dir of dirs) {
    const cfg = JSON.parse(fs.readFileSync(path.join(appsRoot, dir, "config.json"), "utf8"));
    const composePath = path.join(appsRoot, dir, "docker-compose.yml");
    const images: string[] = [];
    if (fs.existsSync(composePath)) {
      try {
        const parsed = YAML.parse(fs.readFileSync(composePath, "utf8"));
        for (const s of Object.values(parsed?.services || {}) as any[]) {
          if (s?.image) {
            const rawImg = String(s.image);
            images.push(rawImg);
            const normImg = normalizeImageName(rawImg);
            if (normImg && !GENERIC_IMAGES.has(normImg)) {
              officialImages.add(normImg);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (cfg.source) {
      const normSource = normalizeRepoUrl(cfg.source);
      if (normSource && (normSource.includes("github.com") || normSource.includes("gitlab.com"))) {
        officialRepoUrls.add(normSource);
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

  const newReservedPorts = runtipiOfficialApps
    .filter((r) => r.port !== null)
    .map((r) => ({ port: r.port, runtipi_id: r.id }))
    .sort((a, b) => a.port - b.port);

  // Blacklist official Runtipi app IDs and deduplicate against existing local apps
  const blacklistedSet = new Set<string>(blacklist.blacklisted_umbrel_ids || []);
  for (const app of runtipiOfficialApps) {
    blacklistedSet.add(app.id);
  }

  // Cross-check apps currently in apps/ against official repo URLs & main container images
  const localAppsDir = path.join(ROOT_DIR, "apps");
  if (fs.existsSync(localAppsDir)) {
    const localDirs = fs
      .readdirSync(localAppsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("__"));

    for (const d of localDirs) {
      const cfgPath = path.join(localAppsDir, d.name, "config.json");
      if (!fs.existsSync(cfgPath)) continue;
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
        const normSource = normalizeRepoUrl(cfg.source || "");
        if (normSource && officialRepoUrls.has(normSource)) {
          blacklistedSet.add(d.name);
        }
      } catch {
        // ignore
      }
    }
  }

  const updatedBlacklistedIds = Array.from(blacklistedSet).sort((a, b) => a.localeCompare(b));

  const prevComparable = JSON.stringify({
    apps: blacklist.runtipi_official_apps,
    ports: blacklist.reserved_runtipi_ports,
    blocked: blacklist.blacklisted_umbrel_ids,
  });
  const nextComparable = JSON.stringify({
    apps: runtipiOfficialApps,
    ports: newReservedPorts,
    blocked: updatedBlacklistedIds,
  });

  // Clean up cloned runtipi repository to avoid keeping foreign tests and temporary files
  try {
    fs.rmSync(runtipiDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  if (prevComparable === nextComparable) {
    console.log(`blacklist.json is already up to date (${runtipiOfficialApps.length} official Runtipi apps).`);
    return;
  }

  blacklist.generated_at = new Date().toISOString();
  blacklist.blacklisted_umbrel_ids = updatedBlacklistedIds;
  blacklist.runtipi_official_apps = runtipiOfficialApps;
  blacklist.stats.runtipi_official_total = runtipiOfficialApps.length;
  blacklist.reserved_runtipi_ports = newReservedPorts;

  fs.writeFileSync(blacklistPath, `${JSON.stringify(blacklist, null, 2)}\n`, "utf8");
  console.log(`Updated blacklist.json with ${runtipiOfficialApps.length} official Runtipi apps.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  updateBlacklist();
}
