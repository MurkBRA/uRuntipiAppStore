import fs from "node:fs";
import path from "node:path";
import type { FormField } from "@runtipi/common/schemas";

export interface ParsedExportsResult {
  formFields: FormField[];
  staticExports: Record<string, string>;
}

const IGNORED_PACKAGE_ROOT_FILES = new Set([
  "umbrel-app.yml",
  "docker-compose.yml",
  "exports.sh",
  ".gitkeep",
  ".gitattributes",
  ".gitignore",
  "torrc",
  "torrc.template",
]);

function humanizeVarName(envVar: string, appName: string): string {
  const appPrefix = appName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const cleaned = envVar
    .replace(new RegExp(`^APP_${appPrefix}_`), "")
    .replace(/^APP_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
  if (!cleaned) return `${appName} secret`;
  return `${appName} ${cleaned}`;
}

export function parseUmbrelExports(exportsContent: string, appName: string): ParsedExportsResult {
  const formFields: FormField[] = [];
  const staticExports: Record<string, string> = {};
  const localAssignments: Record<string, string> = {};
  const seenVars = new Set<string>();

  if (!exportsContent.trim()) {
    return { formFields, staticExports };
  }

  const lines = exportsContent.split(/\r?\n/);

  // First pass: collect local shell variable assignments (e.g. BLOCK_EXPLORER_URL="https://mempool.space")
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const assignMatch = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!assignMatch) continue;

    const [, k, rawV] = assignMatch;
    let v = rawV.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    // Do not overwrite base value with self-referencing mutations like BLOCK_EXPLORER_URL="${BLOCK_EXPLORER_URL}/..."
    if (localAssignments[k] && (v.includes(`\${${k}}`) || v.includes(`$${k}`))) {
      continue;
    }
    localAssignments[k] = v;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, varName, rawValue] = match;
    if (seenVars.has(varName)) continue;

    const value = rawValue.trim();

    // Check if value uses derive_entropy, openssl rand, urandom, or APP_SEED/APP_PASSWORD
    if (
      value.includes("derive_entropy") ||
      value.includes("openssl rand") ||
      value.includes("/dev/urandom") ||
      value.includes("APP_SEED") ||
      value.includes("APP_PASSWORD")
    ) {
      let length = 32;
      const headMatch = value.match(/head\s+-c\s*(\d+)/);
      if (headMatch) {
        const parsedLen = Number.parseInt(headMatch[1], 10);
        if (parsedLen >= 8 && parsedLen <= 128) {
          length = parsedLen;
        }
      }
      seenVars.add(varName);
      formFields.push({
        type: "random",
        label: humanizeVarName(varName, appName),
        min: length,
        ...(value.includes("hex") || value.includes("derive_entropy") ? { encoding: "hex" as const } : {}),
        env_variable: varName,
      });
      continue;
    }

    // Check if it is a simple static assignment (strip quotes)
    let unquoted = value;
    if ((unquoted.startsWith('"') && unquoted.endsWith('"')) || (unquoted.startsWith("'") && unquoted.endsWith("'"))) {
      unquoted = unquoted.slice(1, -1);
    }

    // Resolve any references to earlier localAssignments
    unquoted = unquoted.replace(/\$\{([A-Za-z0-9_]+)\}|\$([A-Za-z0-9_]+)/g, (full, brk, plain) => {
      const ref = brk || plain;
      if (localAssignments[ref] !== undefined && !localAssignments[ref].includes("$(")) {
        return localAssignments[ref];
      }
      return full;
    });

    // Special Umbrel network and URL patterns
    if (varName.endsWith("_LOCAL_URLS") || varName === "APP_WGER_LOCAL_URLS") {
      seenVars.add(varName);
      staticExports[varName] = "http://${INTERNAL_IP}:${APP_PORT}";
      continue;
    }
    if (varName.endsWith("_LOCAL_IPS")) {
      seenVars.add(varName);
      staticExports[varName] = "${INTERNAL_IP}";
      continue;
    }

    // Handle complex subshells that aren't simple variable interpolations
    if (unquoted.includes("$(") || unquoted.includes("`")) {
      // If the command is detecting an IP address or network host, do NOT generate a random hex string!
      if (
        /hostname\s+-I|ip\s+(?:route|addr)|ifconfig/i.test(unquoted) ||
        varName.includes("MACHINE_IP") ||
        varName.includes("LOCAL_IP")
      ) {
        seenVars.add(varName);
        staticExports[varName] = "host.docker.internal";
        continue;
      }

      // Directory or file path variables (e.g. ELEMENTS_DATA_DIR)
      if (/(?:DIR|PATH|FOLDER)$/i.test(varName)) {
        seenVars.add(varName);
        const defaultPath = varName === "ELEMENTS_DATA_DIR" ? "/data/elements" : "/data";
        formFields.push({
          type: "text",
          label: humanizeVarName(varName, appName),
          required: false,
          default: defaultPath,
          env_variable: varName,
        });
        continue;
      }

      // URLs, hostnames, domains, services (e.g. APP_TAILSCALE_URL)
      if (/(?:URL|URI|SERVICE|HOST|HOSTNAME|DOMAIN)$/i.test(varName)) {
        seenVars.add(varName);
        formFields.push({
          type: "text",
          label: humanizeVarName(varName, appName),
          required: false,
          default: "",
          env_variable: varName,
        });
        continue;
      }

      // Port numbers
      if (/(?:PORT)$/i.test(varName)) {
        seenVars.add(varName);
        formFields.push({
          type: "text",
          label: humanizeVarName(varName, appName),
          required: false,
          default: "8080",
          env_variable: varName,
        });
        continue;
      }

      // Users or emails
      if (/(?:USER|USERNAME|EMAIL)$/i.test(varName)) {
        seenVars.add(varName);
        formFields.push({
          type: "text",
          label: humanizeVarName(varName, appName),
          required: false,
          default: "admin",
          env_variable: varName,
        });
        continue;
      }

      seenVars.add(varName);
      formFields.push({
        type: "random",
        label: humanizeVarName(varName, appName),
        min: 32,
        env_variable: varName,
      });
      continue;
    }

    // Normalize Umbrel export-time paths (including default fallbacks like ${EXPORTS_APP_DATA_DIR:-...})
    const normalizedVal = unquoted
      .replace(/\$\{EXPORTS_APP_DATA_DIR(?::-[^}]*)?\}|\$EXPORTS_APP_DATA_DIR\b/g, "${APP_DATA_DIR}/data")
      .replace(/\$\{EXPORTS_APP_DIR(?::-[^}]*)?\}|\$EXPORTS_APP_DIR\b/g, "${APP_DATA_DIR}/data")
      .replace(/\$\{EXPORTS_DATA_ROOT(?::-[^}]*)?\}|\$EXPORTS_DATA_ROOT\b/g, "${APP_DATA_DIR}/data")
      .replace(/\$\{EXPORTS_TOR_DATA_DIR(?::-[^}]*)?\}|\$EXPORTS_TOR_DATA_DIR\b/g, "${APP_DATA_DIR}/data/tor");

    seenVars.add(varName);
    staticExports[varName] = normalizedVal;
  }

  return { formFields, staticExports };
}

/**
 * Copies seed data files and renders top-level/nested .template files into apps/<appId>/data/
 * so that Runtipi automatically provisions them into ${APP_DATA_DIR}/data/ on app install.
 */
export function copyAndPrepareAppDataFiles(
  umbrelAppDir: string,
  destAppDir: string,
  appId: string,
  serviceRenameMap: Record<string, string>,
): void {
  const destDataRoot = path.join(destAppDir, "data");

  function transformFileContent(content: string, isHtml = false): string {
    let out = content;
    // Rewrite Umbrel container DNS names <appId>_<service>_1 -> renamed service
    for (const [origService, newService] of Object.entries(serviceRenameMap)) {
      const umbrelDns = `${appId}_${origService}_1`;
      out = out.replaceAll(umbrelDns, newService);
    }
    out = out
      .replace(/\$\{?APP_HIDDEN_SERVICE\}?/g, "localhost")
      .replace(/\$\{?DEVICE_DOMAIN_NAME\}?/g, "localhost")
      .replace(/\$\{?DEVICE_HOSTNAME\}?/g, "localhost");
    if (isHtml) {
      out = out.replace(/(?<!@)\bumbrel\.local\b/gi, "<IP-DO-SERVIDOR>");
    }
    if (appId === "pocketbase") {
      out = out
        .replace(
          'record.set("email", "umbrel@umbrel.local")',
          'record.set("email", $os.getenv("PB_ADMIN_EMAIL") || "admin@tipi.local")',
        )
        .replace(
          'record.set("password", "umbrel-pocketbase")',
          'record.set("password", $os.getenv("APP_PASSWORD") || "tipi-pocketbase")',
        )
        .replace(
          'findAuthRecordByEmail("_superusers", "umbrel@umbrel.local")',
          'findAuthRecordByEmail("_superusers", $os.getenv("PB_ADMIN_EMAIL") || "admin@tipi.local")',
        );
    }
    return out;
  }

  function walkAndCopy(currentSrcDir: string, relDir = ""): void {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
      const normRel = relPath.replace(/\\/g, "/");

      // Skip hooks dir and root metadata files
      if (normRel === "hooks" || normRel.startsWith("hooks/")) continue;
      if (!relDir && IGNORED_PACKAGE_ROOT_FILES.has(entry.name)) continue;
      if (entry.name === ".gitkeep") continue;

      const fullSrcPath = path.join(currentSrcDir, entry.name);

      if (entry.isDirectory()) {
        walkAndCopy(fullSrcPath, relPath);
        continue;
      }

      // Determine target path inside apps/<appId>/data/
      let targetRelInData = normRel.startsWith("data/") ? normRel.slice("data/".length) : normRel;
      const isTemplate = targetRelInData.endsWith(".template");
      if (isTemplate) {
        targetRelInData = targetRelInData.slice(0, -".template".length);
      }

      const fullDestPath = path.join(destDataRoot, targetRelInData);
      fs.mkdirSync(path.dirname(fullDestPath), { recursive: true });

      const stat = fs.statSync(fullSrcPath);
      const isTextFile =
        isTemplate ||
        /\.(conf|yml|yaml|json|sh|env|ini|toml|xml|py|js|php|html|css|sql|txt|Caddyfile)$/i.test(fullDestPath);

      if (isTextFile && stat.size < 512 * 1024) {
        const raw = fs.readFileSync(fullSrcPath, "utf8");
        fs.writeFileSync(fullDestPath, transformFileContent(raw, /\.html?$/i.test(fullDestPath)), "utf8");
      } else {
        fs.copyFileSync(fullSrcPath, fullDestPath);
      }
    }
  }

  walkAndCopy(umbrelAppDir);
}
