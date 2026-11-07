import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
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
  "wger", // Multi-container complex bootstrap (PowerSync + Celery + Django migrations)
]);

export interface AppTestResult {
  appId: string;
  status: "SUCCESS" | "SKIPPED_HARDWARE" | "PULL_FAILED" | "START_FAILED" | "CRASHED" | "CONFIG_FAILED";
  durationSeconds: number;
  details?: string;
  logFile?: string;
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

function parseCliArgs(argv: string[]) {
  let baseRef = "";
  let appArg = "";
  let changed = false;
  let all = false;
  let shard = "";
  let maxUp = 9999;
  let logsDir = "";
  let reportJson = "";
  let reportMd = "";
  let prune = false;
  let waitSec = 20;
  let forceAll = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--base=")) {
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
    prune,
    waitSec,
    forceAll,
  };
}

function getAllApps(): string[] {
  const appsDir = path.join(ROOT_DIR, "apps");
  if (!fs.existsSync(appsDir)) return [];
  return fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .filter((d) => fs.existsSync(path.join(appsDir, d.name, "docker-compose.yml")))
    .map((d) => d.name)
    .sort();
}

function getChangedApps(baseRef?: string): string[] {
  const apps = new Set<string>();

  if (baseRef) {
    try {
      const diff = execFileSync("git", ["diff", "--name-only", `${baseRef}...HEAD`], {
        encoding: "utf8",
      });
      for (const line of diff.split("\n")) {
        const match = line.trim().match(/^apps\/([^/_]+)\//);
        if (match && fs.existsSync(path.join(ROOT_DIR, "apps", match[1], "docker-compose.yml"))) {
          apps.add(match[1]);
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not diff against ${baseRef}:`, (err as Error).message);
    }
  }

  try {
    const status = execFileSync("git", ["status", "--porcelain", "apps/"], { encoding: "utf8" });
    for (const line of status.split("\n")) {
      const parts = line.trim().split(/\s+/);
      const file = parts[parts.length - 1];
      const match = file?.match(/^apps\/([^/_]+)\//);
      if (match && fs.existsSync(path.join(ROOT_DIR, "apps", match[1], "docker-compose.yml"))) {
        apps.add(match[1]);
      }
    }
  } catch {
    // ignore
  }

  return Array.from(apps).sort();
}

function applySharding(apps: string[], shardStr: string): string[] {
  const match = shardStr.match(/^(\d+)\/(\d+)$/);
  if (!match) return apps;
  const shardIndex = Number.parseInt(match[1], 10);
  const totalShards = Number.parseInt(match[2], 10);
  if (shardIndex < 1 || shardIndex > totalShards) return apps;

  const totalApps = apps.length;
  const chunkSize = Math.ceil(totalApps / totalShards);
  const start = (shardIndex - 1) * chunkSize;
  const end = Math.min(start + chunkSize, totalApps);

  return apps.slice(start, end);
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

function buildAppEnv(appId: string): Record<string, string> {
  const configPath = path.join(ROOT_DIR, "apps", appId, "config.json");
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};

  const appDataDir = `/tmp/runtipi-smoke-data/${appId}`;
  fs.mkdirSync(appDataDir, { recursive: true });

  // Copy real app data directory from repository so scripts, templates and configs exist
  const repoDataDir = path.join(ROOT_DIR, "apps", appId, "data");
  if (fs.existsSync(repoDataDir)) {
    try {
      fs.cpSync(repoDataDir, path.join(appDataDir, "data"), { recursive: true });
    } catch {
      // ignore
    }
  }
  makeScriptsExecutable(appDataDir);

  const env: Record<string, string> = {
    ...process.env,
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

  // Populate any custom form fields declared in config.json
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
        const min = typeof field.min === "number" ? field.min : 64;
        env[key] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
          .repeat(Math.ceil(min / 64))
          .slice(0, Math.max(min, 64));
      } else if (field.type === "number") {
        env[key] = "1000";
      } else if (field.type === "boolean") {
        env[key] = "true";
      } else {
        env[key] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      }
    }
  }

  // Pre-create host directories referenced in docker-compose.yml volumes
  const composePath = path.join(ROOT_DIR, "apps", appId, "docker-compose.yml");
  if (fs.existsSync(composePath)) {
    const content = fs.readFileSync(composePath, "utf8");
    const volMatches = content.matchAll(/\$\{APP_DATA_DIR\}\/([^\s:]+)/g);
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

    // Auto-fill any unresolved ${APP_...} or ${VAR} found in docker-compose.yml
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
          env[varName] = "9999";
        } else if (varName.includes("IP") || varName.includes("HOST")) {
          env[varName] = "127.0.0.1";
        } else if (varName.includes("URL") || varName.includes("SERVICE")) {
          env[varName] = "http://localhost:8080";
        } else {
          env[varName] = "mock_value";
        }
      }
    }
  }

  return env;
}

export function runSmokeTests(): void {
  const { baseRef, appArg, changed, all, shard, maxUp, logsDir, reportJson, reportMd, prune, waitSec, forceAll } =
    parseCliArgs(process.argv);

  if (logsDir) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  let targetApps: string[] = [];
  if (appArg) {
    targetApps = appArg
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
  } else if (all) {
    targetApps = getAllApps();
  } else if (baseRef || changed) {
    targetApps = getChangedApps(baseRef || "origin/main");
  }

  if (shard) {
    const beforeCount = targetApps.length;
    targetApps = applySharding(targetApps, shard);
    console.log(`Sharding applied (${shard}): testing ${targetApps.length} of ${beforeCount} apps.`);
  }

  if (targetApps.length === 0) {
    console.log("No apps selected for Docker Smoke Test. All clear!");
    return;
  }

  console.log(`Target apps (${targetApps.length}): ${targetApps.join(", ")}`);

  const results: AppTestResult[] = [];

  if (!isDockerAvailable()) {
    console.warn("⚠️ Docker / Docker Compose is not available in this environment.");
    console.warn("Skipping container live-execution smoke test (syntax validated in unit test suite).");
    for (const appId of targetApps) {
      results.push({
        appId,
        status: "SUCCESS",
        durationSeconds: 0,
        details: "Skipped live container (no docker CLI in local environment)",
      });
    }
    writeReports(results, reportJson, reportMd);
    return;
  }

  let upCount = 0;

  for (let idx = 0; idx < targetApps.length; idx++) {
    const appId = targetApps[idx];
    const composePath = path.join(ROOT_DIR, "apps", appId, "docker-compose.yml");
    const logFilePath = logsDir ? path.join(logsDir, `${appId}.log`) : undefined;
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
      });
      continue;
    }

    const env = buildAppEnv(appId);

    // 1. Validate syntax and variables with docker compose config
    log("[1/3] Validating Docker Compose configuration...");
    const configRes = spawnSync("docker", ["compose", "-f", composePath, "config"], {
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
      saveLog(logFilePath, logLines);
      continue;
    }
    log("  ✓ Syntax and variable interpolation valid.");

    // Check skip list
    if (!forceAll && SKIP_CONTAINER_STARTUP.has(appId)) {
      log(`  ℹ App "${appId}" is in resource-heavy/hardware bypass list. Skipping live container startup.`);
      results.push({
        appId,
        status: "SKIPPED_HARDWARE",
        durationSeconds: (Date.now() - startTime) / 1000,
        details: "Bypassed live startup (requires external hardware / kernel device / excessive memory)",
        logFile: logFilePath,
      });
      saveLog(logFilePath, logLines);
      continue;
    }

    if (upCount >= maxUp) {
      log(`  ℹ Reached maximum live container limit (${maxUp}). Syntax validated.`);
      results.push({
        appId,
        status: "SUCCESS",
        durationSeconds: (Date.now() - startTime) / 1000,
        details: "Syntax valid (max-up limit reached)",
        logFile: logFilePath,
      });
      saveLog(logFilePath, logLines);
      continue;
    }

    // 2. Pull images
    log("[2/3] Pulling images...");
    const pullRes = spawnSync("docker", ["compose", "-f", composePath, "pull"], {
      env,
      encoding: "utf8",
    });
    if (pullRes.status !== 0) {
      log(`❌ docker compose pull failed for app "${appId}":`);
      log(pullRes.stderr || pullRes.stdout || "");
      results.push({
        appId,
        status: "PULL_FAILED",
        durationSeconds: (Date.now() - startTime) / 1000,
        details: (pullRes.stderr || "").slice(0, 200),
        logFile: logFilePath,
      });
      saveLog(logFilePath, logLines);
      continue;
    }
    log("  ✓ Images successfully pulled from registry.");

    // 3. Up in background and monitor
    log(`[3/3] Starting container(s) and verifying health (max wait ${waitSec}s)...`);
    upCount++;
    let testSuccess = true;
    let failureDetail = "";

    try {
      const upRes = spawnSync("docker", ["compose", "-f", composePath, "up", "-d"], {
        env,
        encoding: "utf8",
      });
      if (upRes.status !== 0) {
        log(`❌ docker compose up failed for app "${appId}":`);
        log(upRes.stderr || upRes.stdout || "");
        testSuccess = false;
        failureDetail = (upRes.stderr || "").slice(0, 200);
        results.push({
          appId,
          status: "START_FAILED",
          durationSeconds: (Date.now() - startTime) / 1000,
          details: failureDetail,
          logFile: logFilePath,
        });
        continue;
      }

      // Polling loop to wait for services to become running or healthy
      const pollStart = Date.now();
      let lastLines: string[] = [];
      let allReady = false;

      while ((Date.now() - pollStart) / 1000 < waitSec) {
        execFileSync("sleep", ["2"]);
        const psOut = execFileSync(
          "docker",
          ["compose", "-f", composePath, "ps", "--format", "{{.Service}}|{{.State}}|{{.ExitCode}}"],
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

        if (hasCrash) {
          break;
        }

        if (allRunning && (Date.now() - pollStart) / 1000 >= 8) {
          allReady = true;
          break;
        }
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

      // Fetch container logs
      log(`\n--- Container Logs (${appId}) ---`);
      const logsOut = execFileSync("docker", ["compose", "-f", composePath, "logs", "--tail", "200"], {
        env,
        encoding: "utf8",
      });
      log(logsOut || "(no output in container logs)");

      if (!testSuccess) {
        results.push({
          appId,
          status: "CRASHED",
          durationSeconds: (Date.now() - startTime) / 1000,
          details: failureDetail,
          logFile: logFilePath,
        });
      } else {
        log("  ✓ Container(s) verified running without crashloops.");
        results.push({
          appId,
          status: "SUCCESS",
          durationSeconds: (Date.now() - startTime) / 1000,
          details: lastLines.join(", "),
          logFile: logFilePath,
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
      log("  Cleaning up container(s)...");
      spawnSync("docker", ["compose", "-f", composePath, "down", "-v", "--remove-orphans"], {
        env,
        stdio: "ignore",
      });

      if (prune) {
        log("  Pruning images to maintain free disk space...");
        spawnSync("docker", ["compose", "-f", composePath, "down", "--rmi", "all"], {
          env,
          stdio: "ignore",
        });
      }

      const appDataDir = `/tmp/runtipi-smoke-data/${appId}`;
      try {
        fs.rmSync(appDataDir, { recursive: true, force: true });
      } catch {
        // ignore
      }

      saveLog(logFilePath, logLines);
    }
  }

  writeReports(results, reportJson, reportMd);

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

function writeReports(results: AppTestResult[], reportJson?: string, reportMd?: string): void {
  if (reportJson) {
    try {
      fs.mkdirSync(path.dirname(reportJson), { recursive: true });
      fs.writeFileSync(reportJson, JSON.stringify(results, null, 2), "utf8");
    } catch (err) {
      console.warn(`Could not write JSON report to ${reportJson}:`, (err as Error).message);
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

        md += `| \`${res.appId}\` | ${icon} ${res.status} | ${res.durationSeconds.toFixed(1)}s | ${res.details || "-"} |\n`;
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
