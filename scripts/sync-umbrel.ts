import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsyaml from "js-yaml";
import YAML from "yaml";
import { transpileCompose } from "./transpiler/compose.ts";
import { copyAndPrepareAppDataFiles, parseUmbrelExports } from "./transpiler/exports-hooks.ts";
import { generateAppLogo } from "./transpiler/icon.ts";
import { buildRuntipiConfigAndDescription } from "./transpiler/manifest.ts";
import { PortAllocator } from "./transpiler/ports.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

interface SyncAppState {
  tipi_version: number;
  version: string;
  port: number;
  created_at: number;
  updated_at: number;
  upstream_hash: string;
}

interface SyncStateFile {
  last_synced_at: string;
  apps: Record<string, SyncAppState>;
}

function computeAppSourceHash(appDir: string): string {
  const hash = crypto.createHash("sha256");
  function walk(dir: string, rel = ""): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rPath = rel ? `${rel}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, rPath);
      } else {
        hash.update(rPath);
        hash.update(fs.readFileSync(full));
      }
    }
  }
  walk(appDir);
  return hash.digest("hex");
}

function parseCliArgs(argv: string[]) {
  let umbrelDir = "";
  let galleryDir = "";
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--umbrel-dir" && argv[i + 1]) {
      umbrelDir = path.resolve(argv[++i]);
    } else if (arg === "--gallery-dir" && argv[i + 1]) {
      galleryDir = path.resolve(argv[++i]);
    } else if (arg === "--force") {
      force = true;
    }
  }

  return { umbrelDir, galleryDir, force };
}

function ensureUpstreamRepos(options: { umbrelDir: string; galleryDir: string }) {
  const tmpDir = path.join(ROOT_DIR, ".tmp");
  const umbrelDir = options.umbrelDir || path.join(tmpDir, "umbrel-apps");
  const galleryDir = options.galleryDir || path.join(tmpDir, "umbrel-apps-gallery");

  if (!fs.existsSync(umbrelDir)) {
    fs.mkdirSync(path.dirname(umbrelDir), { recursive: true });
    console.log(`Cloning getumbrel/umbrel-apps into ${umbrelDir}...`);
    execFileSync("git", ["clone", "--depth", "1", "https://github.com/getumbrel/umbrel-apps.git", umbrelDir], {
      stdio: "inherit",
    });
  }

  if (!fs.existsSync(galleryDir)) {
    fs.mkdirSync(path.dirname(galleryDir), { recursive: true });
    console.log(`Cloning getumbrel/umbrel-apps-gallery into ${galleryDir}...`);
    execFileSync(
      "git",
      ["clone", "--depth", "1", "https://github.com/getumbrel/umbrel-apps-gallery.git", galleryDir],
      { stdio: "inherit" },
    );
  }

  return { umbrelDir, galleryDir };
}

export async function runSync() {
  const cli = parseCliArgs(process.argv.slice(2));
  const { umbrelDir, galleryDir } = ensureUpstreamRepos(cli);

  const blacklistPath = path.join(ROOT_DIR, "blacklist.json");
  const blacklist = JSON.parse(fs.readFileSync(blacklistPath, "utf8"));
  const blacklistedIds = new Set<string>(blacklist.blacklisted_umbrel_ids || []);
  const officialRuntipiIds = new Set<string>((blacklist.runtipi_official_apps || []).map((a: any) => a.id));

  const statePath = path.join(ROOT_DIR, "state", "sync-state.json");
  let syncState: SyncStateFile = {
    last_synced_at: new Date(Date.now() - 5000).toISOString(),
    apps: {},
  };
  if (fs.existsSync(statePath)) {
    try {
      syncState = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch {
      // start fresh state
    }
  }

  const existingPortMap: Record<string, number> = {};
  for (const [id, st] of Object.entries(syncState.apps)) {
    if (st.port) existingPortMap[id] = st.port;
  }

  const portAllocator = new PortAllocator(blacklist.reserved_runtipi_ports || [], existingPortMap);
  const appsOutputDir = path.join(ROOT_DIR, "apps");
  fs.mkdirSync(appsOutputDir, { recursive: true });

  const candidateDirs = fs
    .readdirSync(umbrelDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith(".") &&
        fs.existsSync(path.join(umbrelDir, d.name, "umbrel-app.yml")) &&
        fs.existsSync(path.join(umbrelDir, d.name, "docker-compose.yml")),
    )
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let skippedBlacklistCount = 0;

  const portedSummary: Array<{ id: string; name: string; version: string; port: number; categories: string[] }> = [];

  for (const dirName of candidateDirs) {
    const srcAppDir = path.join(umbrelDir, dirName);
    const manifestRaw = fs.readFileSync(path.join(srcAppDir, "umbrel-app.yml"), "utf8");
    const manifest = YAML.parse(manifestRaw) as Record<string, any>;
    const appId = String(manifest.id || dirName).trim();

    if (manifest.disabled === true || blacklistedIds.has(appId) || officialRuntipiIds.has(appId)) {
      skippedBlacklistCount++;
      continue;
    }

    const upstreamHash = computeAppSourceHash(srcAppDir);
    const prev = syncState.apps[appId];
    const nowSafe = Date.now() - 10000;

    const allocatedPort = portAllocator.allocatePort(appId, Number(manifest.port));
    const isNew = !prev;
    const isChanged = isNew || prev.upstream_hash !== upstreamHash;

    const tipiVersion = isNew ? 1 : isChanged ? prev.tipi_version + 1 : prev.tipi_version;
    const createdAt = isNew ? nowSafe - 60000 : prev.created_at;
    const updatedAt = isChanged ? nowSafe : prev.updated_at;

    const destAppDir = path.join(appsOutputDir, appId);
    const destMetadataDir = path.join(destAppDir, "metadata");
    fs.mkdirSync(destMetadataDir, { recursive: true });

    if (isChanged || cli.force || !fs.existsSync(path.join(destAppDir, "config.json"))) {
      const exportsPath = path.join(srcAppDir, "exports.sh");
      const exportsRaw = fs.existsSync(exportsPath) ? fs.readFileSync(exportsPath, "utf8") : "";
      const { formFields: initialFormFields, staticExports } = parseUmbrelExports(
        exportsRaw,
        String(manifest.name || appId),
      );

      const composeRaw = fs.readFileSync(path.join(srcAppDir, "docker-compose.yml"), "utf8");
      const umbrelCompose = YAML.parse(composeRaw) as Record<string, any>;

      const hasDeps = Array.isArray(manifest.dependencies) && manifest.dependencies.length > 0;
      const transpiled = transpileCompose({
        appId,
        appName: String(manifest.name || appId),
        manifestPort: Number(manifest.port) || allocatedPort,
        allocatedPort,
        umbrelCompose,
        staticExports,
        initialFormFields,
        hasDependencies: hasDeps,
      });

      const { config, descriptionMd } = buildRuntipiConfigAndDescription({
        appId,
        umbrelManifest: manifest,
        allocatedPort,
        mainImageTag: transpiled.mainImageTag,
        formFields: transpiled.formFields,
        tipiVersion,
        createdAt,
        updatedAt,
        uid: transpiled.uid,
        gid: transpiled.gid,
      });

      // Write config.json, docker-compose.json, docker-compose.yml, metadata/description.md
      fs.writeFileSync(path.join(destAppDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
      fs.writeFileSync(
        path.join(destAppDir, "docker-compose.json"),
        `${JSON.stringify(transpiled.composeJson, null, 2)}\n`,
        "utf8",
      );
      const ymlDump = jsyaml.dump(transpiled.composeYamlObj, {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
        indent: 2,
      });
      fs.writeFileSync(path.join(destAppDir, "docker-compose.yml"), ymlDump, "utf8");
      fs.writeFileSync(path.join(destMetadataDir, "description.md"), descriptionMd, "utf8");

      // Copy seed data files and render templates
      copyAndPrepareAppDataFiles(srcAppDir, destAppDir, appId, transpiled.serviceRenameMap);

      // Generate 512x512 JPEG logo
      await generateAppLogo(
        appId,
        String(manifest.name || appId),
        galleryDir,
        path.join(destMetadataDir, "logo.jpg"),
      );

      syncState.apps[appId] = {
        tipi_version: tipiVersion,
        version: config.version,
        port: allocatedPort,
        created_at: createdAt,
        updated_at: updatedAt,
        upstream_hash: upstreamHash,
      };

      if (isNew) createdCount++;
      else updatedCount++;

      portedSummary.push({
        id: appId,
        name: config.name,
        version: config.version,
        port: allocatedPort,
        categories: config.categories,
      });
    } else {
      unchangedCount++;
      const existingConfig = JSON.parse(fs.readFileSync(path.join(destAppDir, "config.json"), "utf8"));
      portedSummary.push({
        id: appId,
        name: existingConfig.name,
        version: existingConfig.version,
        port: existingConfig.port,
        categories: existingConfig.categories,
      });
    }
  }

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  syncState.last_synced_at = new Date().toISOString();
  fs.writeFileSync(statePath, `${JSON.stringify(syncState, null, 2)}\n`, "utf8");

  // Generate README.md
  const readmeRows = portedSummary
    .map(
      (a, idx) =>
        `| ${idx + 1} | \`${a.id}\` | **${a.name}** | \`${a.version}\` | \`${a.port}\` | \`${a.categories.join(", ")}\` |`,
    )
    .join("\n");

  const readmeContent = `# uRuntipiAppStore — UmbrelOS App Store Port for Runtipi

Automated, tested port of **${portedSummary.length}** non-duplicate apps from [\`getumbrel/umbrel-apps\`](https://github.com/getumbrel/umbrel-apps) to the [Runtipi](https://runtipi.io) App Store format (\`schema_version: 2\` YAML + Dynamic Compose JSON v2).

- **Architecture & Engineering Plan**: [\`PLANO_PORT_UMBREL_RUNTIPI.md\`](./PLANO_PORT_UMBREL_RUNTIPI.md)
- **Official Runtipi & Disabled Apps Blacklist**: [\`blacklist.json\`](./blacklist.json)

## Summary Statistics

- **Ported Active Apps**: **${portedSummary.length}**
- **Blacklisted Duplicates / Disabled Apps**: **${skippedBlacklistCount}**

## Ported Apps Catalog (${portedSummary.length} Apps)

| # | App ID | Name | Version | Port | Categories |
| :---: | :--- | :--- | :---: | :---: | :--- |
${readmeRows}
`;

  fs.writeFileSync(path.join(ROOT_DIR, "README.md"), readmeContent, "utf8");

  console.log(
    `Sync complete: ${portedSummary.length} total apps (${createdCount} created, ${updatedCount} updated, ${unchangedCount} unchanged, ${skippedBlacklistCount} skipped via blacklist).`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runSync().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
