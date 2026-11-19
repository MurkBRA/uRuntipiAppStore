import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SCHEMA_ENDPOINTS = {
  appInfo: "https://schemas.runtipi.io/app-info.json",
  dynamicCompose: "https://schemas.runtipi.io/dynamic-compose.json",
};

/**
 * Downloads a remote JSON Schema with exponential-ish linear retry backoff.
 */
async function loadRemoteJsonSchema(url, maxAttempts = 3, timeoutMs = 15_000) {
  let lastFailure;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} (${res.statusText})`);
      }
      return await res.json();
    } catch (err) {
      lastFailure = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  throw new Error(`Unable to download schema ${url} after ${maxAttempts} attempt(s): ${lastFailure?.message}`);
}

/**
 * Lists all active app directory names under apps/ (excluding internal __tests__ / dot directories).
 */
function discoverAppDirectories(appsRoot) {
  if (!fs.existsSync(appsRoot)) return [];
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("__") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Parses and validates a single JSON artifact against a compiled AJV validator.
 */
function verifyAppJsonArtifact(filePath, validator, relativeLabel) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, message: `Missing required file: ${relativeLabel}` };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return { ok: false, message: `Invalid JSON in ${relativeLabel}: ${err.message}` };
  }

  // Strip local IDE $schema pointer before AJV validation against remote schema
  const payload = { ...parsed };
  Reflect.deleteProperty(payload, "$schema");

  if (!validator(payload)) {
    return {
      ok: false,
      message: `Schema mismatch in ${relativeLabel}`,
      errors: validator.errors,
    };
  }

  return { ok: true };
}

async function runStoreSchemaValidation() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const [appInfoSchema, composeSchema] = await Promise.all([
    loadRemoteJsonSchema(SCHEMA_ENDPOINTS.appInfo),
    loadRemoteJsonSchema(SCHEMA_ENDPOINTS.dynamicCompose),
  ]);

  const checkAppInfo = ajv.compile(appInfoSchema);
  const checkCompose = ajv.compile(composeSchema);

  const appsRoot = path.join(REPO_ROOT, "apps");
  const appIds = discoverAppDirectories(appsRoot);
  if (appIds.length === 0) {
    console.log("No app directories detected under apps/.");
    return;
  }

  let validConfigs = 0;
  let validComposes = 0;
  let failureCount = 0;

  for (const appId of appIds) {
    const appDir = path.join(appsRoot, appId);

    const configOutcome = verifyAppJsonArtifact(
      path.join(appDir, "config.json"),
      checkAppInfo,
      `apps/${appId}/config.json`,
    );
    if (configOutcome.ok) {
      validConfigs++;
    } else {
      failureCount++;
      console.error(configOutcome.message);
      if (configOutcome.errors) console.error(configOutcome.errors);
    }

    const composeOutcome = verifyAppJsonArtifact(
      path.join(appDir, "docker-compose.json"),
      checkCompose,
      `apps/${appId}/docker-compose.json`,
    );
    if (composeOutcome.ok) {
      validComposes++;
    } else {
      failureCount++;
      console.error(composeOutcome.message);
      if (composeOutcome.errors) console.error(composeOutcome.errors);
    }
  }

  if (failureCount > 0) {
    console.error(`Schema validation failed with ${failureCount} error(s).`);
    process.exit(1);
  }

  console.log(`JSON schema validation passed (${validConfigs} config.json, ${validComposes} docker-compose.json).`);
}

runStoreSchemaValidation().catch((err) => {
  console.error("Schema validation runner failed:", err);
  process.exit(1);
});
