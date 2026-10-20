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
  const seenVars = new Set<string>();

  if (!exportsContent.trim()) {
    return { formFields, staticExports };
  }

  const lines = exportsContent.split(/\r?\n/);
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

    // Ignore complex subshells that aren't simple variable interpolations
    if (unquoted.includes("$(") || unquoted.includes("`")) {
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

  function transformFileContent(content: string): string {
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
        fs.writeFileSync(fullDestPath, transformFileContent(raw), "utf8");
      } else {
        fs.copyFileSync(fullSrcPath, fullDestPath);
      }
    }
  }

  walkAndCopy(umbrelAppDir);
}
