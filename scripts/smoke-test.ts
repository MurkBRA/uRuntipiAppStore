import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// Apps that require excessive RAM (>4GB), long compilations, blockchain sync, or specific hardware/kernel devices.
// For these apps, we validate syntax (config -q) and pull images, but bypass container startup.
const SKIP_CONTAINER_STARTUP = new Set([
  "gitlab", // Needs 6GB+ RAM and 15m Chef bootstrap
  "bitcoin",
  "bitcoind",
  "electrs",
  "lightning",
  "core-lightning",
  "lnd", // Blockchain sync
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
  let maxUp = 5;

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
    } else if (arg === "--changed") {
      changed = true;
    } else if (arg.startsWith("--max-up=")) {
      maxUp = Number.parseInt(arg.slice("--max-up=".length), 10) || 5;
    }
  }

  return { baseRef, appArg, changed, maxUp };
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

  // Also check uncommitted/unstaged changes in apps/
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

function buildAppEnv(appId: string): Record<string, string> {
  const configPath = path.join(ROOT_DIR, "apps", appId, "config.json");
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};

  const appDataDir = `/tmp/runtipi-smoke-data/${appId}`;
  fs.mkdirSync(appDataDir, { recursive: true });

  const env: Record<string, string> = {
    ...process.env,
    APP_DATA_DIR: appDataDir,
    APP_DOMAIN: "localhost",
    APP_PROTOCOL: "http",
    LOCAL_DOMAIN: "tipi.local",
    INTERNAL_IP: "127.0.0.1",
    APP_PORT: String(config.port || 8080),
    APP_PASSWORD: "smoketestpassword123456789012345",
  };

  // Populate any custom form fields declared in config.json
  if (Array.isArray(config.form_fields)) {
    for (const field of config.form_fields) {
      if (!field?.env_variable) continue;
      const key = field.env_variable;
      if (field.default !== undefined && field.default !== null) {
        env[key] = String(field.default);
      } else if (field.type === "random") {
        env[key] = "smoketestrandomsecret1234567890";
      } else if (field.type === "number") {
        env[key] = "1000";
      } else if (field.type === "boolean") {
        env[key] = "true";
      } else {
        env[key] = "test-value";
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
      const dirToCreate = relPath.includes(".") && !relPath.endsWith("/") ? path.dirname(fullPath) : fullPath;
      try {
        fs.mkdirSync(dirToCreate, { recursive: true });
        if (relPath.includes(".") && !relPath.endsWith("/")) {
          if (!fs.existsSync(fullPath)) {
            fs.writeFileSync(fullPath, "");
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return env;
}

export function runSmokeTests(): void {
  const { baseRef, appArg, changed, maxUp } = parseCliArgs(process.argv);

  let targetApps: string[] = [];
  if (appArg) {
    targetApps = appArg
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
  } else if (baseRef || changed) {
    targetApps = getChangedApps(baseRef || "origin/main");
  }

  if (targetApps.length === 0) {
    console.log("No changed apps detected for Docker Smoke Test. All clear!");
    return;
  }

  console.log(`Found ${targetApps.length} app(s) to validate: ${targetApps.join(", ")}`);

  if (!isDockerAvailable()) {
    console.warn("⚠️ Docker / Docker Compose is not available in this environment.");
    console.warn("Skipping container live-execution smoke test (syntax validated in unit test suite).");
    return;
  }

  let failedCount = 0;
  let upCount = 0;

  for (const appId of targetApps) {
    const composePath = path.join(ROOT_DIR, "apps", appId, "docker-compose.yml");
    if (!fs.existsSync(composePath)) {
      console.warn(`Skipping "${appId}": docker-compose.yml not found.`);
      continue;
    }

    console.log("\n======================================================");
    console.log(`🧪 Smoke Testing: ${appId}`);
    console.log("======================================================");

    const env = buildAppEnv(appId);

    // 1. Validate syntax and variables with `docker compose config -q`
    console.log("[1/3] Validating Docker Compose configuration...");
    const configRes = spawnSync("docker", ["compose", "-f", composePath, "config", "-q"], {
      env,
      stdio: "inherit",
    });
    if (configRes.status !== 0) {
      console.error(`❌ docker compose config failed for app "${appId}"`);
      failedCount++;
      continue;
    }
    console.log("  ✓ Syntax and variable interpolation valid.");

    // Check if we should pull and up
    if (SKIP_CONTAINER_STARTUP.has(appId)) {
      console.log(`  ℹ App "${appId}" is in resource-heavy/hardware bypass list. Skipping live container startup.`);
      continue;
    }

    if (upCount >= maxUp) {
      console.log(`  ℹ Reached maximum live container limit (${maxUp}). Syntax validated.`);
      continue;
    }

    // 2. Pull images
    console.log("[2/3] Pulling images...");
    const pullRes = spawnSync("docker", ["compose", "-f", composePath, "pull", "--quiet"], {
      env,
      stdio: "inherit",
    });
    if (pullRes.status !== 0) {
      console.error(`❌ docker compose pull failed for app "${appId}"`);
      failedCount++;
      continue;
    }
    console.log("  ✓ Images successfully pulled from registry.");

    // 3. Up in background and check status
    console.log("[3/3] Starting container(s) and verifying health...");
    upCount++;
    try {
      const upRes = spawnSync("docker", ["compose", "-f", composePath, "up", "-d"], {
        env,
        stdio: "inherit",
      });
      if (upRes.status !== 0) {
        console.error(`❌ docker compose up failed for app "${appId}"`);
        failedCount++;
        continue;
      }

      // Wait 12 seconds for container to initialize
      execFileSync("sleep", ["12"]);

      const psOut = execFileSync(
        "docker",
        ["compose", "-f", composePath, "ps", "--format", "{{.Service}}|{{.State}}|{{.ExitCode}}"],
        { env, encoding: "utf8" },
      );

      const lines = psOut.trim().split("\n").filter(Boolean);
      let serviceFailed = false;
      for (const line of lines) {
        const [svcName, state, exitCode] = line.split("|");
        console.log(`    - Service "${svcName}": status=${state}, exit=${exitCode}`);
        if (state === "restarting" || (state === "exited" && exitCode !== "0")) {
          serviceFailed = true;
          console.error(`\n❌ Service "${svcName}" crashed! Recent logs:`);
          spawnSync("docker", ["compose", "-f", composePath, "logs", "--tail", "50", svcName], {
            env,
            stdio: "inherit",
          });
        }
      }

      if (serviceFailed) {
        failedCount++;
        continue;
      }

      console.log("  ✓ Container(s) verified running without crashloops.");
    } finally {
      console.log("  Cleaning up container(s)...");
      spawnSync("docker", ["compose", "-f", composePath, "down", "-v", "--remove-orphans"], {
        env,
        stdio: "ignore",
      });
      const appDataDir = `/tmp/runtipi-smoke-data/${appId}`;
      try {
        fs.rmSync(appDataDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  if (failedCount > 0) {
    console.error(`\n❌ Smoke tests failed for ${failedCount} app(s).`);
    process.exit(1);
  }

  console.log("\n🎉 All tested apps passed Docker Compose validation & smoke testing!");
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runSmokeTests();
}
