import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
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

export interface SyncAppState {
  tipi_version: number;
  version: string;
  port: number;
  created_at: number;
  updated_at: number;
  upstream_hash: string;
}

export interface SyncStateFile {
  last_synced_at: string;
  apps: Record<string, SyncAppState>;
}

export interface ReadmeAppEntry {
  id: string;
  name: string;
  version: string;
  port: number;
  categories: string[];
}

export type AppCatalogEntry = ReadmeAppEntry;

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

export function normalizeConfigForDiff(configObj: Record<string, any>): Record<string, any> {
  const { tipi_version: _tv, created_at: _ca, updated_at: _ua, ...rest } = configObj;
  return rest;
}

function collectFilesRelative(dirPath: string): Map<string, { content: Buffer; isExec: boolean }> {
  const result = new Map<string, { content: Buffer; isExec: boolean }>();
  if (!fs.existsSync(dirPath)) return result;

  function walk(currentDir: string, rel = ""): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        result.set(relPath, {
          content: fs.readFileSync(fullPath),
          isExec: (stat.mode & 0o111) !== 0,
        });
      }
    }
  }

  walk(dirPath);
  return result;
}

export function areRenderedAppsSemanticallyEqual(existingAppDir: string, stagedAppDir: string): boolean {
  try {
    const existingCfg = JSON.parse(fs.readFileSync(path.join(existingAppDir, "config.json"), "utf8"));
    const stagedCfg = JSON.parse(fs.readFileSync(path.join(stagedAppDir, "config.json"), "utf8"));
    if (JSON.stringify(normalizeConfigForDiff(existingCfg)) !== JSON.stringify(normalizeConfigForDiff(stagedCfg))) {
      return false;
    }

    for (const relFile of ["docker-compose.json", "docker-compose.yml", "metadata/description.md"]) {
      const aPath = path.join(existingAppDir, relFile);
      const bPath = path.join(stagedAppDir, relFile);
      if (!fs.existsSync(aPath) || !fs.existsSync(bPath)) return false;
      const aBuf = fs.readFileSync(aPath);
      const bBuf = fs.readFileSync(bPath);
      if (!aBuf.equals(bBuf)) return false;
    }

    const existingData = collectFilesRelative(path.join(existingAppDir, "data"));
    const stagedData = collectFilesRelative(path.join(stagedAppDir, "data"));
    if (existingData.size !== stagedData.size) return false;
    for (const [relPath, stagedFile] of stagedData.entries()) {
      const existingFile = existingData.get(relPath);
      if (!existingFile) return false;
      if (existingFile.isExec !== stagedFile.isExec) return false;
      if (!existingFile.content.equals(stagedFile.content)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

function parseCliArgs(argv: string[]) {
  let umbrelDir = "";
  let galleryDir = "";
  let force = false;
  let only = "";
  let readmeOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--umbrel-dir" && argv[i + 1]) {
      umbrelDir = path.resolve(argv[++i]);
    } else if (arg.startsWith("--umbrel-dir=")) {
      umbrelDir = path.resolve(arg.slice("--umbrel-dir=".length).trim());
    } else if (arg === "--gallery-dir" && argv[i + 1]) {
      galleryDir = path.resolve(argv[++i]);
    } else if (arg.startsWith("--gallery-dir=")) {
      galleryDir = path.resolve(arg.slice("--gallery-dir=".length).trim());
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--readme-only") {
      readmeOnly = true;
    } else if (arg.startsWith("--only=")) {
      only = arg.slice("--only=".length).trim();
    } else if (arg === "--only" && argv[i + 1]) {
      only = argv[++i].trim();
    }
  }

  return { umbrelDir, galleryDir, force, only, readmeOnly };
}

function resolveSkippedBlacklistCount(rootDir: string): number {
  const readmePath = path.join(rootDir, "README.md");
  if (fs.existsSync(readmePath)) {
    const existing = fs.readFileSync(readmePath, "utf8");
    const match = existing.match(/Blacklisted Duplicates \/ Disabled Apps\*\*:\s*\*\*(\d+)\*\*/);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }

  const blacklistPath = path.join(rootDir, "blacklist.json");
  if (fs.existsSync(blacklistPath)) {
    try {
      const blacklist = JSON.parse(fs.readFileSync(blacklistPath, "utf8"));
      return Number(
        blacklist.stats?.total_unique_blacklisted_umbrel_ids ?? blacklist.blacklisted_umbrel_ids?.length ?? 0,
      );
    } catch {
      return 0;
    }
  }

  return 0;
}

export function generateReadme(options?: {
  rootDir?: string;
  entries?: ReadmeAppEntry[];
  skippedBlacklistCount?: number;
}): string {
  const rootDir = options?.rootDir ?? ROOT_DIR;
  let entries = options?.entries;

  if (!entries) {
    const appsDir = path.join(rootDir, "apps");
    entries = [];
    if (fs.existsSync(appsDir)) {
      const dirs = fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b));

      for (const appId of dirs) {
        const configPath = path.join(appsDir, appId, "config.json");
        if (!fs.existsSync(configPath)) continue;
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
        entries.push({
          id: cfg.id || appId,
          name: cfg.name || appId,
          version: String(cfg.version ?? "latest"),
          port: Number(cfg.port ?? 0),
          categories: Array.isArray(cfg.categories) ? cfg.categories : ["utilities"],
        });
      }
    }
  } else {
    entries = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  }

  const skippedCount = options?.skippedBlacklistCount ?? resolveSkippedBlacklistCount(rootDir);
  const readmeRows = entries
    .map(
      (a, idx) =>
        `| ${idx + 1} | \`${a.id}\` | **${a.name}** | \`${a.version}\` | \`${a.port}\` | \`${a.categories.join(", ")}\` |`,
    )
    .join("\n");

  const readmeContent = `# uRuntipiAppStore — UmbrelOS App Store Port for Runtipi

Automated, tested port of **${entries.length}** non-duplicate apps from [\`getumbrel/umbrel-apps\`](https://github.com/getumbrel/umbrel-apps) to the [Runtipi](https://runtipi.io) App Store format (\`schema_version: 2\` YAML + Dynamic Compose JSON v2).

- **Architecture & Engineering Plan**: [\`PLANO_PORT_UMBREL_RUNTIPI.md\`](./PLANO_PORT_UMBREL_RUNTIPI.md)
- **Official Runtipi & Disabled Apps Blacklist**: [\`blacklist.json\`](./blacklist.json)
- **License & Third-Party Scope**: [\`LICENSE\`](./LICENSE) (MIT for original tooling) · [\`NOTICE\`](./NOTICE) (Third-party rights & attribution)

## Summary Statistics

- **Ported Active Apps**: **${entries.length}**
- **Blacklisted Duplicates / Disabled Apps**: **${skippedCount}**

## Ported Apps Catalog (${entries.length} Apps)

| # | App ID | Name | Version | Port | Categories |
| :---: | :--- | :--- | :---: | :---: | :--- |
${readmeRows}

## License & Third-Party Notices

- **Original code & tooling**: All scripts under \`scripts/\`, test suites under \`scripts/__tests__/\` and \`apps/__tests__/\`, GitHub Actions workflows, and repository documentation are licensed under the [MIT License](./LICENSE).
- **Third-party packages & assets (\`apps/\`)**: Generated app definitions, auxiliary files under \`apps/*/data/\`, descriptions, logos, and referenced container images originate from [\`getumbrel/umbrel-apps\`](https://github.com/getumbrel/umbrel-apps), [\`getumbrel/umbrel-apps-gallery\`](https://github.com/getumbrel/umbrel-apps-gallery), and their respective upstream projects. They are **not relicensed under MIT** and remain subject to their original authors' copyrights, trademarks, and licenses. See [\`NOTICE\`](./NOTICE) for full details and removal requests.
- **No affiliation**: This is an independent community project and is not affiliated with Umbrel Inc. or Runtipi.
`;

  const readmePath = path.join(rootDir, "README.md");
  const prevContent = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
  if (prevContent !== readmeContent) {
    fs.writeFileSync(readmePath, readmeContent, "utf8");
  }
  return readmeContent;
}

export const rebuildStoreReadme = generateReadme;

function ensureUpstreamRepos(options: { umbrelDir: string; galleryDir: string }) {
  const tmpDir = path.join(ROOT_DIR, ".tmp");
  const umbrelDir = options.umbrelDir || path.join(tmpDir, "umbrel-apps");
  const galleryDir = options.galleryDir || path.join(tmpDir, "umbrel-apps-gallery");
  const gitTimeoutMs = 5 * 60 * 1000;
  const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

  if (!fs.existsSync(umbrelDir)) {
    fs.mkdirSync(path.dirname(umbrelDir), { recursive: true });
    console.log(`Cloning getumbrel/umbrel-apps into ${umbrelDir}...`);
    execFileSync("git", ["clone", "--depth", "1", "https://github.com/getumbrel/umbrel-apps.git", umbrelDir], {
      stdio: "inherit",
      timeout: gitTimeoutMs,
      env: gitEnv,
    });
  } else {
    try {
      console.log(`Pulling latest changes in ${umbrelDir}...`);
      execFileSync("git", ["pull", "--ff-only"], {
        cwd: umbrelDir,
        stdio: "inherit",
        timeout: gitTimeoutMs,
        env: gitEnv,
      });
    } catch (err) {
      console.warn(`Warning: failed to git pull in ${umbrelDir}:`, (err as Error).message);
    }
  }

  if (!fs.existsSync(galleryDir)) {
    fs.mkdirSync(path.dirname(galleryDir), { recursive: true });
    console.log(`Cloning getumbrel/umbrel-apps-gallery into ${galleryDir}...`);
    execFileSync("git", ["clone", "--depth", "1", "https://github.com/getumbrel/umbrel-apps-gallery.git", galleryDir], {
      stdio: "inherit",
      timeout: gitTimeoutMs,
      env: gitEnv,
    });
  } else {
    try {
      console.log(`Pulling latest changes in ${galleryDir}...`);
      execFileSync("git", ["pull", "--ff-only"], {
        cwd: galleryDir,
        stdio: "inherit",
        timeout: gitTimeoutMs,
        env: gitEnv,
      });
    } catch (err) {
      console.warn(`Warning: failed to git pull in ${galleryDir}:`, (err as Error).message);
    }
  }

  return { umbrelDir, galleryDir };
}

export async function runSync() {
  const cli = parseCliArgs(process.argv.slice(2));
  if (cli.readmeOnly) {
    generateReadme({ rootDir: ROOT_DIR });
    console.log("Regenerated README.md from apps/ directory.");
    return;
  }

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
  let hashOnlyUpdatedCount = 0;
  let skippedBlacklistCount = 0;
  let stateChanged = false;

  const portedSummary: ReadmeAppEntry[] = [];

  // In full sync mode, discover all valid upstream app IDs to detect and remove zombie apps
  if (!cli.only) {
    const upstreamAppIds = new Set<string>();
    for (const dirName of candidateDirs) {
      const srcAppDir = path.join(umbrelDir, dirName);
      try {
        const manifestRaw = fs.readFileSync(path.join(srcAppDir, "umbrel-app.yml"), "utf8");
        const manifest = YAML.parse(manifestRaw) as Record<string, any>;
        const id = String(manifest?.id || dirName).trim();
        if (manifest?.disabled !== true && !blacklistedIds.has(id) && !officialRuntipiIds.has(id)) {
          upstreamAppIds.add(id);
        }
      } catch {
        // ignore
      }
    }

    const localAppDirs = fs
      .readdirSync(appsOutputDir, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() && !d.name.startsWith("__") && fs.existsSync(path.join(appsOutputDir, d.name, "config.json")),
      )
      .map((d) => d.name);

    for (const localId of localAppDirs) {
      if (!upstreamAppIds.has(localId)) {
        console.log(`Removing zombie app '${localId}' deleted from upstream...`);
        fs.rmSync(path.join(appsOutputDir, localId), { recursive: true, force: true });
        if (syncState.apps[localId]) {
          delete syncState.apps[localId];
          stateChanged = true;
        }
        updatedCount++;
      }
    }
  }

  for (const dirName of candidateDirs) {
    const srcAppDir = path.join(umbrelDir, dirName);
    const manifestRaw = fs.readFileSync(path.join(srcAppDir, "umbrel-app.yml"), "utf8");
    const manifest = YAML.parse(manifestRaw) as Record<string, any>;
    const appId = String(manifest.id || dirName).trim();

    if (cli.only && appId !== cli.only && dirName !== cli.only) {
      continue;
    }

    if (manifest.disabled === true || blacklistedIds.has(appId) || officialRuntipiIds.has(appId)) {
      skippedBlacklistCount++;
      // If a previously ported app became disabled or blacklisted, remove it from apps/ and state
      const staleDir = path.join(appsOutputDir, appId);
      if (fs.existsSync(staleDir)) {
        fs.rmSync(staleDir, { recursive: true, force: true });
        updatedCount++;
      }
      if (syncState.apps[appId]) {
        delete syncState.apps[appId];
        stateChanged = true;
      }
      continue;
    }

    const upstreamHash = computeAppSourceHash(srcAppDir);
    const prev = syncState.apps[appId];
    const nowSafe = Date.now() - 10000;

    const allocatedPort = portAllocator.allocatePort(appId, Number(manifest.port));
    const destAppDir = path.join(appsOutputDir, appId);
    const existingConfigPath = path.join(destAppDir, "config.json");
    const existingLogoPath = path.join(destAppDir, "metadata", "logo.jpg");

    const isNew = !prev || !fs.existsSync(existingConfigPath);
    const isUpstreamHashChanged = isNew || prev.upstream_hash !== upstreamHash;

    if (isUpstreamHashChanged || cli.force || !fs.existsSync(existingLogoPath)) {
      const exportsPath = path.join(srcAppDir, "exports.sh");
      const exportsRaw = fs.existsSync(exportsPath) ? fs.readFileSync(exportsPath, "utf8") : "";
      const { formFields: initialFormFields, staticExports } = parseUmbrelExports(
        exportsRaw,
        String(manifest.name || appId),
      );

      const composeRaw = fs.readFileSync(path.join(srcAppDir, "docker-compose.yml"), "utf8");
      const umbrelCompose = YAML.parse(composeRaw, { merge: true }) as Record<string, any>;

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

      const tipiVersion = isNew ? 1 : prev.tipi_version + 1;
      const createdAt = isNew ? nowSafe - 60000 : prev.created_at;
      const updatedAt = nowSafe;

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

      const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "uruntipi-stage-"));
      try {
        fs.chmodSync(stagingDir, 0o755);
        const stagingMetaDir = path.join(stagingDir, "metadata");
        fs.mkdirSync(stagingMetaDir, { recursive: true });
        fs.writeFileSync(path.join(stagingDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
        fs.writeFileSync(
          path.join(stagingDir, "docker-compose.json"),
          `${JSON.stringify(transpiled.composeJson, null, 2)}\n`,
          "utf8",
        );
        const ymlDump = jsyaml.dump(transpiled.composeYamlObj, {
          lineWidth: -1,
          noRefs: true,
          sortKeys: false,
          indent: 2,
        });
        fs.writeFileSync(path.join(stagingDir, "docker-compose.yml"), ymlDump, "utf8");
        fs.writeFileSync(path.join(stagingMetaDir, "description.md"), descriptionMd, "utf8");

        copyAndPrepareAppDataFiles(srcAppDir, stagingDir, appId, transpiled.serviceRenameMap, {
          resolvedStaticExports: transpiled.resolvedStaticExports,
          keepTor: transpiled.keepTor,
          referencedTemplates: transpiled.referencedTemplates,
        });

        const hasExistingApp = !isNew && fs.existsSync(existingConfigPath) && fs.existsSync(existingLogoPath);
        if (hasExistingApp && areRenderedAppsSemanticallyEqual(destAppDir, stagingDir)) {
          // Semantic output is identical: only update upstream_hash if it actually changed
          if (prev.upstream_hash !== upstreamHash) {
            syncState.apps[appId] = {
              ...prev,
              upstream_hash: upstreamHash,
            };
            stateChanged = true;
            hashOnlyUpdatedCount++;
          }
          unchangedCount++;

          const existingConfig = JSON.parse(fs.readFileSync(existingConfigPath, "utf8"));
          portedSummary.push({
            id: appId,
            name: existingConfig.name,
            version: existingConfig.version,
            port: existingConfig.port,
            categories: existingConfig.categories,
          });
        } else {
          await generateAppLogo(
            appId,
            String(manifest.name || appId),
            galleryDir,
            path.join(stagingMetaDir, "logo.jpg"),
          );

          fs.rmSync(destAppDir, { recursive: true, force: true });
          fs.cpSync(stagingDir, destAppDir, { recursive: true, preserveTimestamps: false });
          fs.chmodSync(destAppDir, 0o755);

          // Ensure executable permissions survive cpSync consistently
          const stagedDataFiles = collectFilesRelative(path.join(stagingDir, "data"));
          for (const [relFile, info] of stagedDataFiles.entries()) {
            if (info.isExec) {
              fs.chmodSync(path.join(destAppDir, "data", relFile), 0o755);
            }
          }

          syncState.apps[appId] = {
            tipi_version: tipiVersion,
            version: config.version,
            port: allocatedPort,
            created_at: createdAt,
            updated_at: updatedAt,
            upstream_hash: upstreamHash,
          };
          stateChanged = true;

          if (isNew) createdCount++;
          else updatedCount++;

          portedSummary.push({
            id: appId,
            name: config.name,
            version: config.version,
            port: allocatedPort,
            categories: config.categories,
          });
        }
      } finally {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    } else {
      unchangedCount++;
      const existingConfig = JSON.parse(fs.readFileSync(existingConfigPath, "utf8"));
      portedSummary.push({
        id: appId,
        name: existingConfig.name,
        version: existingConfig.version,
        port: existingConfig.port,
        categories: existingConfig.categories,
      });
    }
  }

  // Prune any orphaned state entries whose app directory no longer exists (in full sync mode)
  if (!cli.only) {
    for (const id of Object.keys(syncState.apps)) {
      if (!fs.existsSync(path.join(appsOutputDir, id, "config.json"))) {
        delete syncState.apps[id];
        stateChanged = true;
      }
    }
  }

  if (stateChanged || createdCount > 0 || updatedCount > 0 || !fs.existsSync(statePath)) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    syncState.last_synced_at = new Date().toISOString();
    fs.writeFileSync(statePath, `${JSON.stringify(syncState, null, 2)}\n`, "utf8");
  }

  // Generate README.md (only when doing full sync)
  if (!cli.only) {
    generateReadme({
      rootDir: ROOT_DIR,
      entries: portedSummary,
      skippedBlacklistCount,
    });
  }

  console.log(
    `Sync complete: ${portedSummary.length} total apps (${createdCount} created, ${updatedCount} updated, ${unchangedCount} unchanged [${hashOnlyUpdatedCount} hash-only skipped], ${skippedBlacklistCount} skipped via blacklist).`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runSync().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
