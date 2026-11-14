import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// Apps that require excessive RAM (>5GB), long compilations, blockchain sync, or specific hardware/kernel devices.
// For these apps, we validate syntax (config -q) and pull images, but bypass container startup unless forced.
const SKIP_CONTAINER_STARTUP = new Set([
  "gitlab", // Needs 6GB+ RAM and 15m Chef bootstrap
  "bitcoin",
  "bitcoind",
  "electrs",
  "lightning",
  "core-lightning",
  "lnd", // Blockchain sync
  "dcrpulse", // Decred blockchain daemon full node
  "peerswap", // Lightning/Elements node dependency
  "bitcoin-regtest-dashboard", // Blockchain mining setup
  "syslog-ng", // Kernel syslog streaming
  "tailscale",
  "wireguard",
  "openvpn",
  "netbird", // Kernel network tun/tap devices
  "torbrowser", // Needs X11 / display server
  "frigate", // Needs /dev/dri or Coral TPU
  "zigbee2mqtt", // Needs /dev/ttyUSB
  "immich",
  "immich-machine-learning", // Heavy ML models
  "nextcloud", // Multi-container complex bootstrap
]);

export interface AppTestResult {
  appId: string;
  status: "SUCCESS" | "SKIPPED_HARDWARE" | "PULL_FAILED" | "START_FAILED" | "CRASHED" | "CONFIG_FAILED";
  durationSeconds: number;
  details?: string;
  logFile?: string;
  portWarning?: boolean;
}

function isDockerAvailable(): boolean {
  try {
    execFileSync("docker", ["--version"], { stdio: "ignore" });
    execFileSync("docker", ["compose", "version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getAvailableDiskSpaceGb(): number {
  try {
    const out = execFileSync("df", ["-k", "/"], { encoding: "utf8" });
    const lines = out.trim().split("\n");
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      const availKb = Number.parseInt(parts[3], 10);
      if (Number.isFinite(availKb)) {
        return availKb / (1024 * 1024);
      }
    }
  } catch {
    // ignore
  }
  return 50;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneDockerDisk(log: (m: string) => void, aggressive = false): void {
  try {
    execFileSync("docker", ["image", "prune", "-af"], { stdio: "ignore" });
    if (aggressive || getAvailableDiskSpaceGb() < 12) {
      log("  Disk space still low (< 12GB). Running aggressive docker system prune...");
      execFileSync("docker", ["system", "prune", "-af", "--volumes"], { stdio: "ignore" });
    }
  } catch {
    // ignore
  }
}

export function parseCliArgs(argv: string[]) {
  let baseRef = "";
  let appArg = "";
  let changed = false;
  let all = false;
  let shard = "";
  let maxUp = 9999;
  let logsDir = "";
  let reportJson = "";
  let reportMd = "";
  let jsonFailures = "";
  let prune = false;
  let waitSec = 20;
  let forceAll = false;
  let help = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg.startsWith("--base=")) {
      baseRef = arg.slice("--base=".length).trim();
    } else if (arg === "--base" && argv[i + 1]) {
      baseRef = argv[++i].trim();
    } else if (arg.startsWith("--app=")) {
      appArg = arg.slice("--app=".length).trim();
    } else if (arg === "--app" && argv[i + 1]) {
      appArg = argv[++i].trim();
    } else if (arg.startsWith("--apps=")) {
      appArg = arg.slice("--apps=".length).trim();
    } else if (arg === "--apps" && argv[i + 1]) {
      appArg = argv[++i].trim();
    } else if (arg === "--changed") {
      changed = true;
    } else if (arg === "--all") {
      all = true;
    } else if (arg.startsWith("--shard=")) {
      shard = arg.slice("--shard=".length).trim();
    } else if (arg.startsWith("--max-up=")) {
      maxUp = Number.parseInt(arg.slice("--max-up=".length), 10) || 9999;
    } else if (arg.startsWith("--logs-dir=")) {
      logsDir = arg.slice("--logs-dir=".length).trim();
    } else if (arg.startsWith("--report-json=")) {
      reportJson = arg.slice("--report-json=".length).trim();
    } else if (arg.startsWith("--report-md=")) {
      reportMd = arg.slice("--report-md=".length).trim();
    } else if (arg.startsWith("--json-failures=")) {
      jsonFailures = arg.slice("--json-failures=".length).trim();
    } else if (arg.startsWith("--wait=")) {
      waitSec = Number.parseInt(arg.slice("--wait=".length), 10) || 20;
    } else if (arg === "--prune") {
      prune = true;
    } else if (arg === "--force-all") {
      forceAll = true;
    }
  }

  return {
    baseRef,
    appArg,
    changed,
    all,
    shard,
    maxUp,
    logsDir,
    reportJson,
    reportMd,
    jsonFailures,
    prune,
    waitSec,
    forceAll,
    help,
  };
}

function getAllApps(rootDir = ROOT_DIR): string[] {
  const appsDir = path.join(rootDir, "apps");
  if (!fs.existsSync(appsDir)) return [];
  return fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .filter((d) => fs.existsSync(path.join(appsDir, d.name, "docker-compose.yml")))
    .map((d) => d.name)
    .sort();
}

export function getChangedApps(baseRef?: string, rootDir = ROOT_DIR): string[] {
  const apps = new Set<string>();

  if (baseRef) {
    try {
      const diff = execFileSync("git", ["diff", "--name-only", `${baseRef}...HEAD`], {
        cwd: rootDir,
        encoding: "utf8",
      });
      for (const line of diff.split(/\r?\n/)) {
        const match = line.trim().match(/^apps\/([^/_]+)\//);
        if (match && fs.existsSync(path.join(rootDir, "apps", match[1], "docker-compose.yml"))) {
          apps.add(match[1]);
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not diff against ${baseRef}:`, (err as Error).message);
    }
  }

  try {
    const status = execFileSync("git", ["status", "--porcelain", "-uall", "--", "apps/"], {
      cwd: rootDir,
      encoding: "utf8",
    });
    for (const line of status.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const rawPath = line.replace(/^\s*[?!MADRCU]{1,2}\s+/, "").trim();
      const targetPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").pop()! : rawPath;
      const cleanPath = targetPath.replace(/^"|"$/g, "");
      const match = cleanPath.match(/^apps\/([^/_]+)\//);
      if (match && fs.existsSync(path.join(rootDir, "apps", match[1], "docker-compose.yml"))) {
        apps.add(match[1]);
      }
    }
  } catch {
    // ignore
  }

  return Array.from(apps).sort();
}

function getAppWeight(appId: string, rootDir = ROOT_DIR): number {
  const composePath = path.join(rootDir, "apps", appId, "docker-compose.yml");
  if (!fs.existsSync(composePath)) return 1;
  try {
    const raw = fs.readFileSync(composePath, "utf8");
    const count = (raw.match(/^\s{2}[a-zA-Z0-9_-]+:/gm) || []).length;
    const hasDb = /postgres|mysql|mariadb|mongo|redis/i.test(raw);
    return Math.max(1, count * 2 + (hasDb ? 2 : 0) + 1);
  } catch {
    return 1;
  }
}

export function applySharding(apps: string[], shardStr: string, rootDir = ROOT_DIR): string[] {
  const match = shardStr.match(/^(\d+)\/(\d+)$/);
  if (!match) return apps;
  const shardIndex = Number.parseInt(match[1], 10);
  const totalShards = Number.parseInt(match[2], 10);
  if (shardIndex < 1 || shardIndex > totalShards) return apps;

  // Weight-based Greedy Bin-Packing
  const weighted = apps.map((app) => ({ app, weight: getAppWeight(app, rootDir) }));
  weighted.sort((a, b) => b.weight - a.weight || a.app.localeCompare(b.app));

  const bins: Array<{ totalWeight: number; apps: string[] }> = Array.from({ length: totalShards }, () => ({
    totalWeight: 0,
    apps: [],
  }));

  for (const item of weighted) {
    let minBin = bins[0];
    for (let i = 1; i < bins.length; i++) {
      if (bins[i].totalWeight < minBin.totalWeight) {
        minBin = bins[i];
      }
    }
    minBin.apps.push(item.app);
    minBin.totalWeight += item.weight;
  }

  const selected = bins[shardIndex - 1]?.apps || [];
  return selected.sort((a, b) => a.localeCompare(b));
}

function makeScriptsExecutable(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      makeScriptsExecutable(full);
    } else if (entry.isFile()) {
      try {
        fs.chmodSync(full, 0o755);
      } catch {
        // ignore
      }
    }
  }
}

export function buildAppEnv(
  appId: string,
  options?: { rootDir?: string; dataBaseDir?: string },
): Record<string, string> {
  const rootDir = options?.rootDir ?? ROOT_DIR;
  const dataBaseDir = options?.dataBaseDir ?? "/tmp/runtipi-smoke-data";
  const configPath = path.join(rootDir, "apps", appId, "config.json");
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};

  const appDataDir = path.join(dataBaseDir, appId);
  fs.mkdirSync(appDataDir, { recursive: true });

  // Copy real app data directory from repository so scripts, templates and configs exist
  const repoDataDir = path.join(rootDir, "apps", appId, "data");
  if (fs.existsSync(repoDataDir)) {
    try {
      fs.cpSync(repoDataDir, path.join(appDataDir, "data"), { recursive: true });
    } catch {
      // ignore
    }
  }
  makeScriptsExecutable(appDataDir);

  const inheritedEnv = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );

  const env: Record<string, string> = {
    ...inheritedEnv,
    APP_DATA_DIR: appDataDir,
    APP_DOMAIN: "localhost",
    APP_PROTOCOL: "http",
    LOCAL_DOMAIN: "tipi.local",
    INTERNAL_IP: "127.0.0.1",
    APP_PORT: String(config.port || 8080),
    APP_PASSWORD: "smoketestpassword1234567890123456",
    APP_SEED: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    APP_JWT_SECRET: "smoketestjwtsecret1234567890123456",
    APP_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    APP_WANDERER_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    TZ: "UTC",
    ADMIN_EMAIL: "admin@example.com",
    APP_ADMIN_EMAIL: "admin@example.com",
    TOR_PROXY_IP: "127.0.0.1",
    TOR_PROXY_PORT: "9050",
    TOR_PASSWORD: "smoketesttorpassword123456789012",
    GATEWAY_IP: "172.17.0.1",
    PGDATA: "/var/lib/postgresql/data",
    POSTGRES_DB: "tipi_db",
    POSTGRES_USER: "tipi_user",
  };

  // Populate custom form fields declared in config.json
  if (Array.isArray(config.form_fields)) {
    for (const field of config.form_fields) {
      if (!field?.env_variable) continue;
      const key = field.env_variable;
      if (key.includes("DIR") || key.includes("PATH")) {
        const mockDir = path.join(appDataDir, "mock", key.toLowerCase());
        fs.mkdirSync(mockDir, { recursive: true });
        env[key] = mockDir;
      } else if (field.default !== undefined && field.default !== null) {
        env[key] = String(field.default);
      } else if (field.type === "random") {
        const targetLen = typeof field.min === "number" ? field.min : 64;
        env[key] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
          .repeat(Math.ceil(targetLen / 64))
          .slice(0, targetLen);
      } else if (field.type === "number") {
        env[key] = "1000";
      } else if (field.type === "boolean") {
        env[key] = "true";
      } else {
        env[key] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      }
    }
  }

  // Pre-create host directories referenced in docker-compose.yml volumes (both ${APP_DATA_DIR} and $APP_DATA_DIR)
  const composePath = path.join(rootDir, "apps", appId, "docker-compose.yml");
  if (fs.existsSync(composePath)) {
    const content = fs.readFileSync(composePath, "utf8");
    const volMatches = content.matchAll(/\$\{?APP_DATA_DIR\}?\/([^\s:'"]+)/g);
    for (const match of volMatches) {
      const relPath = match[1];
      const fullPath = path.join(appDataDir, relPath);
      const isFile =
        /\.(conf|cfg|ya?ml|json|toml|sh|txt|key|crt|pem|env|ini|sql|xml|properties|passwd|htpasswd|pub|cert)$/i.test(
          path.basename(relPath),
        ) && !relPath.endsWith("/");
      const dirToCreate = isFile ? path.dirname(fullPath) : fullPath;
      try {
        fs.mkdirSync(dirToCreate, { recursive: true });
        if (isFile && !fs.existsSync(fullPath)) {
          fs.writeFileSync(fullPath, "");
          fs.chmodSync(fullPath, 0o755);
        }
      } catch {
        // ignore
      }
    }

    // Auto-fill unresolved ${APP_...} or ${VAR} found in docker-compose.yml
    const envMatches = content.matchAll(/\$\{([A-Z0-9_]+)(?::-[^}]*)?\}/g);
    for (const match of envMatches) {
      const varName = match[1];
      if (!env[varName]) {
        if (varName.includes("PASS") || varName.includes("KEY") || varName.includes("SECRET")) {
          env[varName] = "0123456789abcdef0123456789abcdef";
        } else if (varName.includes("DIR") || varName.includes("PATH")) {
          const mockDir = path.join(appDataDir, "mock", varName.toLowerCase());
          fs.mkdirSync(mockDir, { recursive: true });
          env[varName] = mockDir;
        } else if (varName.includes("PORT")) {
          env[varName] = "8080";
        } else if (varName.includes("HOST") || varName.includes("DOMAIN") || varName.includes("IP")) {
          env[varName] = "127.0.0.1";
        } else {
          env[varName] = "default";
        }
      }
    }
  }

  return env;
}

async function pullImagesWithRetry(
  composePath: string,
  env: Record<string, string>,
  log: (m: string) => void,
): Promise<{ success: boolean; error?: string }> {
  const maxAttempts = 3;
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`  - Pull attempt ${attempt}/${maxAttempts}...`);
    const res = spawnSync("docker", ["compose", "-f", composePath, "pull"], {
      env,
      encoding: "utf8",
      timeout: 180000,
    });
    if (res.status === 0) {
      return { success: true };
    }
    lastErr = res.stderr || res.stdout || "Unknown error";
    if (attempt < maxAttempts) {
      const delaySec = attempt === 1 ? 2 : 5;
      log(`    ⚠️ Pull failed (attempt ${attempt}). Retrying in ${delaySec}s... Details: ${lastErr.slice(0, 100)}`);
      await delay(delaySec * 1000);
    }
  }
  return { success: false, error: lastErr };
}

function probePort(containerIp: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(true);
      }
    });
    socket.once("timeout", () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.once("error", () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    try {
      socket.connect(port, containerIp);
    } catch {
      resolve(false);
    }
  });
}

export async function runSmokeTests() {
  const cli = parseCliArgs(process.argv);
  if (cli.help) {
    console.log(
      "Usage: npm run test:smoke -- [--changed [--base=<ref>] | --all | --app=<id1,id2>] [--shard=i/N] [--max-up=N] [--wait=sec] [--prune] [--force-all] [--logs-dir=dir] [--report-json=file] [--report-md=file] [--json-failures=file]",
    );
    return;
  }

  if (!isDockerAvailable()) {
    console.error("❌ Docker and Docker Compose must be installed and running.");
    process.exit(1);
  }

  let targetApps: string[] = [];

  if (cli.appArg) {
    const requested = cli.appArg
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    for (const app of requested) {
      if (fs.existsSync(path.join(ROOT_DIR, "apps", app, "docker-compose.yml"))) {
        targetApps.push(app);
      } else {
        console.warn(`Warning: app "${app}" not found under apps/`);
      }
    }
  } else if (cli.changed) {
    targetApps = getChangedApps(cli.baseRef || undefined);
    if (targetApps.length === 0) {
      console.log("ℹ️ No app changes detected via git diff. Nothing to smoke test.");
      process.exit(0);
    }
    console.log(`Found ${targetApps.length} changed app(s): ${targetApps.join(", ")}`);
  } else if (cli.all) {
    targetApps = getAllApps();
  } else {
    targetApps = getChangedApps(cli.baseRef || undefined);
    if (targetApps.length === 0) {
      console.log("No changed apps detected. Use --all to test the entire store.");
      process.exit(0);
    }
  }

  if (cli.shard) {
    const totalBefore = targetApps.length;
    targetApps = applySharding(targetApps, cli.shard);
    console.log(
      `⚖️ Shard ${cli.shard} (weighted): selected ${targetApps.length} of ${totalBefore} app(s): ${targetApps.join(", ")}`,
    );
  }

  if (targetApps.length === 0) {
    console.log("No apps to test in current selection.");
    process.exit(0);
  }

  console.log(`\n🚀 Starting Docker Smoke Tests for ${targetApps.length} app(s)...`);

  const results: AppTestResult[] = [];
  let upCount = 0;

  let prefetchProcess: ChildProcess | null = null;
  let prefetchExitPromise: Promise<number | null> | null = null;
  let prefetchedAppId: string | null = null;

  try {
    for (let idx = 0; idx < targetApps.length; idx++) {
      const appId = targetApps[idx];
      const composePath = path.join(ROOT_DIR, "apps", appId, "docker-compose.yml");
      const configPath = path.join(ROOT_DIR, "apps", appId, "config.json");
      const projectName = `smoke-${appId}`;
      const logFilePath = cli.logsDir ? path.join(cli.logsDir, `${appId}.log`) : undefined;
      const logLines: string[] = [];
      const startTime = Date.now();

      function log(msg: string) {
        console.log(msg);
        logLines.push(msg);
      }

      log("\n======================================================");
      log(`[${idx + 1}/${targetApps.length}] 🧪 Smoke Testing: ${appId}`);
      log(`Timestamp: ${new Date().toISOString()}`);
      log("======================================================");

      if (!fs.existsSync(composePath)) {
        log(`⚠️ Skipping "${appId}": docker-compose.yml not found.`);
        results.push({
          appId,
          status: "CONFIG_FAILED",
          durationSeconds: 0,
          details: "docker-compose.yml not found",
          logFile: logFilePath,
        });
        saveLog(logFilePath, logLines);
        continue;
      }

      const env = buildAppEnv(appId);
      let didStart = false;

      try {
        // 1. Validate syntax and variables with docker compose config
        log("[1/3] Validating Docker Compose configuration...");
        const configRes = spawnSync("docker", ["compose", "-p", projectName, "-f", composePath, "config"], {
          env,
          encoding: "utf8",
        });
        if (configRes.status !== 0) {
          log(`❌ docker compose config failed for app "${appId}":`);
          log(configRes.stderr || configRes.stdout || "");
          results.push({
            appId,
            status: "CONFIG_FAILED",
            durationSeconds: (Date.now() - startTime) / 1000,
            details: (configRes.stderr || "").slice(0, 200),
            logFile: logFilePath,
          });
          continue;
        }
        log("  ✓ Syntax and variable interpolation valid.");

        // Check skip list
        if (!cli.forceAll && SKIP_CONTAINER_STARTUP.has(appId)) {
          log(`  ℹ App "${appId}" is in resource-heavy/hardware bypass list. Skipping live container startup.`);
          results.push({
            appId,
            status: "SKIPPED_HARDWARE",
            durationSeconds: (Date.now() - startTime) / 1000,
            details: "Bypassed live startup (requires external hardware / kernel device / excessive memory)",
            logFile: logFilePath,
          });
          continue;
        }

        if (upCount >= cli.maxUp) {
          log(`  ℹ Reached maximum live container limit (${cli.maxUp}). Syntax validated.`);
          results.push({
            appId,
            status: "SUCCESS",
            durationSeconds: (Date.now() - startTime) / 1000,
            details: "Syntax valid (max-up limit reached)",
            logFile: logFilePath,
          });
          continue;
        }

        // 2. Pull images with retry and disk safeguard
        log("[2/3] Pulling images (with backoff & prefetch check)...");
        if (prefetchedAppId === appId && prefetchProcess) {
          log(`  ℹ Prefetch background worker active for ${appId}. Awaiting completion...`);
          if (prefetchExitPromise) {
            await Promise.race([prefetchExitPromise, delay(180_000)]);
          }
          if (prefetchProcess.exitCode === null) {
            try {
              prefetchProcess.kill("SIGTERM");
            } catch {
              // ignore
            }
          }
          prefetchProcess = null;
          prefetchExitPromise = null;
          prefetchedAppId = null;
        }

        if (getAvailableDiskSpaceGb() < 15) {
          log("  Free disk space < 15GB before pull. Pruning unused Docker artifacts...");
          pruneDockerDisk(log, true);
        }

        const pullRes = await pullImagesWithRetry(composePath, env, log);
        if (!pullRes.success) {
          log(`❌ docker compose pull failed for app "${appId}":`);
          log(pullRes.error || "");
          results.push({
            appId,
            status: "PULL_FAILED",
            durationSeconds: (Date.now() - startTime) / 1000,
            details: (pullRes.error || "").slice(0, 200),
            logFile: logFilePath,
          });
          continue;
        }
        log("  ✓ Images successfully pulled from registry.");

        // Start background prefetch for next app only when prune mode is off and ample disk is available
        if (!cli.prune && upCount + 1 < cli.maxUp && idx + 1 < targetApps.length && getAvailableDiskSpaceGb() >= 20) {
          const nextAppId = targetApps[idx + 1];
          const nextCompose = path.join(ROOT_DIR, "apps", nextAppId, "docker-compose.yml");
          if (fs.existsSync(nextCompose) && (!SKIP_CONTAINER_STARTUP.has(nextAppId) || cli.forceAll)) {
            const nextEnv = buildAppEnv(nextAppId);
            prefetchedAppId = nextAppId;
            try {
              if (prefetchProcess && prefetchProcess.exitCode === null) {
                prefetchProcess.kill("SIGTERM");
              }
            } catch {
              // ignore
            }
            prefetchProcess = spawn("docker", ["compose", "-f", nextCompose, "pull", "--quiet"], {
              env: nextEnv,
              stdio: "ignore",
            });
            const activeChild = prefetchProcess;
            prefetchExitPromise = new Promise<number | null>((resolve) => {
              activeChild.once("exit", (code) => resolve(code));
              activeChild.once("error", () => resolve(null));
            });
          }
        }

        // 3. Up in background and monitor
        log(`[3/3] Starting container(s) and verifying health (max wait ${cli.waitSec}s)...`);
        upCount++;
        didStart = true;
        let testSuccess = true;
        let failureDetail = "";
        let portWarning = false;

        const rawCompose = fs.existsSync(composePath) ? fs.readFileSync(composePath, "utf8") : "";
        const count = (rawCompose.match(/^\s{2}[a-zA-Z0-9_-]+:/gm) || []).length;
        const hasCondition =
          rawCompose.includes("condition: service_healthy") ||
          rawCompose.includes("condition: service_completed_successfully");
        // Heavy multi-container or migration-dependent stacks require more headroom during cold boot
        const upTimeoutMs = count > 4 || hasCondition ? 300000 : 120000;

        const upRes = spawnSync("docker", ["compose", "-p", projectName, "-f", composePath, "up", "-d"], {
          env,
          encoding: "utf8",
          timeout: upTimeoutMs,
        });
        if (upRes.status !== 0) {
          log(`❌ docker compose up failed for app "${appId}":`);
          const errOutput = upRes.stderr || upRes.stdout || upRes.error?.message || "";
          log(errOutput);
          testSuccess = false;
          failureDetail = errOutput.slice(0, 200);
          results.push({
            appId,
            status: "START_FAILED",
            durationSeconds: (Date.now() - startTime) / 1000,
            details: failureDetail,
            logFile: logFilePath,
          });
          continue;
        }

        // Polling loop
        const pollStart = Date.now();
        let lastLines: string[] = [];

        while ((Date.now() - pollStart) / 1000 < cli.waitSec) {
          await delay(2000);
          const psOut = execFileSync(
            "docker",
            [
              "compose",
              "-p",
              projectName,
              "-f",
              composePath,
              "ps",
              "--format",
              "{{.Service}}|{{.State}}|{{.ExitCode}}",
            ],
            { env, encoding: "utf8" },
          );
          lastLines = psOut.trim().split("\n").filter(Boolean);

          let hasCrash = false;
          let allRunning = lastLines.length > 0;

          for (const line of lastLines) {
            const [, state, exitCode] = line.split("|");
            if (state === "restarting" || (state === "exited" && exitCode !== "0")) {
              hasCrash = true;
              break;
            }
            if (state !== "running" && !(state === "exited" && exitCode === "0")) {
              allRunning = false;
            }
          }

          if (hasCrash) break;
          if (allRunning && (Date.now() - pollStart) / 1000 >= 8) break;
        }

        for (const line of lastLines) {
          const [svcName, state, exitCode] = line.split("|");
          log(`    - Service "${svcName}": status=${state}, exit=${exitCode}`);
          if (state === "restarting" || (state === "exited" && exitCode !== "0")) {
            testSuccess = false;
            failureDetail = `Service "${svcName}" crashed (state=${state}, exit=${exitCode})`;
            log(`\n❌ Service "${svcName}" crashed!`);
          }
        }

        // Inspect container restart count and probe port if container is running
        if (testSuccess) {
          const psIds = spawnSync("docker", ["compose", "-p", projectName, "-f", composePath, "ps", "-q"], {
            env,
            encoding: "utf8",
          });
          const containerIds = (psIds.stdout || "").trim().split("\n").filter(Boolean);

          for (const cid of containerIds) {
            try {
              const rawInspect = execFileSync("docker", ["inspect", cid], { encoding: "utf8" });
              const parsed = JSON.parse(rawInspect)[0];
              const restartCount = parsed?.RestartCount || 0;
              if (restartCount > 0) {
                testSuccess = false;
                failureDetail = `Container ${parsed.Name} restarted ${restartCount} time(s) (restart loop detected)`;
                log(`\n❌ Container ${parsed.Name} entered restart loop!`);
                break;
              }

              // Probe internal_port on main container
              if (testSuccess && fs.existsSync(configPath)) {
                const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
                const portToProbe = cfg.port;
                const networks = parsed?.NetworkSettings?.Networks || {};
                const firstNet = Object.values(networks)[0] as any;
                const ipAddress = firstNet?.IPAddress;

                if (ipAddress && portToProbe) {
                  const portResponded = await probePort(ipAddress, portToProbe, 2000);
                  if (portResponded) {
                    log(`    ✓ Internal port ${portToProbe} actively listening on container bridge IP ${ipAddress}.`);
                  } else {
                    portWarning = true;
                    log(
                      `    ⚠️ PORT_WARNING: Container healthy, but port ${portToProbe} did not respond during smoke test window (cold boot / internal TLS / background queue).`,
                    );
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }

        // Fetch container logs
        log(`\n--- Container Logs (${appId}) ---`);
        const logsOut = execFileSync(
          "docker",
          ["compose", "-p", projectName, "-f", composePath, "logs", "--tail", "200"],
          { env, encoding: "utf8" },
        );
        log(logsOut || "(no output in container logs)");

        if (!testSuccess) {
          results.push({
            appId,
            status: "CRASHED",
            durationSeconds: (Date.now() - startTime) / 1000,
            details: failureDetail,
            logFile: logFilePath,
            portWarning,
          });
        } else {
          log("  ✓ Container(s) verified running without crashloops.");
          results.push({
            appId,
            status: "SUCCESS",
            durationSeconds: (Date.now() - startTime) / 1000,
            details: lastLines.join(", "),
            logFile: logFilePath,
            portWarning,
          });
        }
      } catch (err) {
        log(`❌ Exception during smoke test: ${(err as Error).message}`);
        results.push({
          appId,
          status: "START_FAILED",
          durationSeconds: (Date.now() - startTime) / 1000,
          details: (err as Error).message,
          logFile: logFilePath,
        });
      } finally {
        if (didStart) {
          log("  Cleaning up container(s) (instant teardown -t 0)...");
          spawnSync(
            "docker",
            ["compose", "-p", projectName, "-f", composePath, "down", "-v", "--remove-orphans", "-t", "0"],
            {
              env,
              stdio: "ignore",
            },
          );
        }

        // Prune unused Docker images when --prune is requested or disk space drops below 14 GB
        if (cli.prune || getAvailableDiskSpaceGb() < 14) {
          log("  Pruning unused Docker images to reclaim disk space...");
          if (prefetchProcess && prefetchProcess.exitCode === null) {
            try {
              prefetchProcess.kill("SIGTERM");
            } catch {
              // ignore
            }
            prefetchProcess = null;
            prefetchExitPromise = null;
            prefetchedAppId = null;
          }
          pruneDockerDisk(log, getAvailableDiskSpaceGb() < 12);
        }

        try {
          fs.rmSync(env.APP_DATA_DIR, { recursive: true, force: true });
        } catch {
          // ignore
        }

        saveLog(logFilePath, logLines);
      }
    }
  } finally {
    if (prefetchProcess && prefetchProcess.exitCode === null) {
      try {
        prefetchProcess.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
  }

  writeReports(results, cli.reportJson, cli.reportMd, cli.jsonFailures);

  const failedCount = results.filter(
    (r) =>
      r.status === "CRASHED" ||
      r.status === "START_FAILED" ||
      r.status === "PULL_FAILED" ||
      r.status === "CONFIG_FAILED",
  ).length;

  if (failedCount > 0) {
    console.error(`\n❌ Smoke tests failed for ${failedCount} app(s).`);
    process.exit(1);
  }

  console.log("\n🎉 All tested apps completed smoke testing successfully!");
}

function saveLog(logFilePath: string | undefined, lines: string[]): void {
  if (!logFilePath) return;
  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.writeFileSync(logFilePath, lines.join("\n"), "utf8");
  } catch (err) {
    console.warn(`Could not write log to ${logFilePath}:`, (err as Error).message);
  }
}

function writeReports(
  results: AppTestResult[],
  reportJson?: string,
  reportMd?: string,
  jsonFailuresPath?: string,
): void {
  if (reportJson) {
    try {
      fs.mkdirSync(path.dirname(reportJson), { recursive: true });
      fs.writeFileSync(reportJson, JSON.stringify(results, null, 2), "utf8");
    } catch (err) {
      console.warn(`Could not write JSON report to ${reportJson}:`, (err as Error).message);
    }
  }

  if (jsonFailuresPath) {
    try {
      fs.mkdirSync(path.dirname(jsonFailuresPath), { recursive: true });
      const failedApps = results
        .filter(
          (r) =>
            r.status === "CRASHED" ||
            r.status === "START_FAILED" ||
            r.status === "PULL_FAILED" ||
            r.status === "CONFIG_FAILED",
        )
        .map((r) => ({
          appId: r.appId,
          status: r.status,
          duration: r.durationSeconds,
          details: r.details,
          logFile: r.logFile,
        }));
      fs.writeFileSync(jsonFailuresPath, JSON.stringify(failedApps, null, 2), "utf8");
    } catch (err) {
      console.warn(`Could not write JSON failures to ${jsonFailuresPath}:`, (err as Error).message);
    }
  }

  if (reportMd) {
    try {
      fs.mkdirSync(path.dirname(reportMd), { recursive: true });
      const successCount = results.filter((r) => r.status === "SUCCESS").length;
      const skippedCount = results.filter((r) => r.status === "SKIPPED_HARDWARE").length;
      const failedCount = results.filter((r) => r.status !== "SUCCESS" && r.status !== "SKIPPED_HARDWARE").length;

      let md = "## 🧪 Docker Smoke Test Summary\n\n";
      md += `- **Total Tested**: ${results.length}\n`;
      md += `- **Running / Healthy**: ${successCount} ✅\n`;
      md += `- **Hardware / Bypass**: ${skippedCount} ℹ️\n`;
      md += `- **Failures / Crashes**: ${failedCount} ❌\n\n`;

      md += "| App | Status | Duration | Details |\n";
      md += "| :--- | :---: | :---: | :--- |\n";

      for (const res of results) {
        let icon = "✅";
        if (res.status === "SKIPPED_HARDWARE") icon = "ℹ️";
        else if (res.status !== "SUCCESS") icon = "❌";

        const warnNote = res.portWarning ? " *(PORT_WARNING)*" : "";
        md += `| \`${res.appId}\` | ${icon} ${res.status} | ${res.durationSeconds.toFixed(1)}s | ${(res.details || "-") + warnNote} |\n`;
      }

      fs.writeFileSync(reportMd, md, "utf8");
    } catch (err) {
      console.warn(`Could not write Markdown report to ${reportMd}:`, (err as Error).message);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runSmokeTests();
}
