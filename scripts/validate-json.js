import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const ajv = new Ajv2020({ allErrors: true, strict: false });

async function fetchSchema(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch schema ${url}: ${response.statusText}`);
  }
  return response.json();
}

async function validateJson() {
  const composeSchema = await fetchSchema("https://schemas.runtipi.io/dynamic-compose.json");
  const appInfoSchema = await fetchSchema("https://schemas.runtipi.io/app-info.json");

  const validateCompose = ajv.compile(composeSchema);
  const validateAppInfo = ajv.compile(appInfoSchema);

  const appsDir = path.join(ROOT_DIR, "apps");
  if (!fs.existsSync(appsDir)) {
    console.log("No apps directory found.");
    return;
  }

  const appEntries = fs.readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("__"));

  let hasErrors = false;
  let validatedComposeCount = 0;
  let validatedConfigCount = 0;

  for (const entry of appEntries) {
    const appDir = path.join(appsDir, entry.name);
    const composeJsonPath = path.join(appDir, "docker-compose.json");
    const configJsonPath = path.join(appDir, "config.json");

    if (fs.existsSync(composeJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(composeJsonPath, "utf8"));
        const { $schema: _, ...dataToValidate } = data;
        const valid = validateCompose(dataToValidate);
        if (!valid) {
          console.error(`Validation failed for apps/${entry.name}/docker-compose.json:`);
          console.error(validateCompose.errors);
          hasErrors = true;
        } else {
          validatedComposeCount++;
        }
      } catch (err) {
        console.error(`Error parsing apps/${entry.name}/docker-compose.json:`, err.message);
        hasErrors = true;
      }
    }

    if (fs.existsSync(configJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(configJsonPath, "utf8"));
        const { $schema: _, ...dataToValidate } = data;
        const valid = validateAppInfo(dataToValidate);
        if (!valid) {
          console.error(`Validation failed for apps/${entry.name}/config.json:`);
          console.error(validateAppInfo.errors);
          hasErrors = true;
        } else {
          validatedConfigCount++;
        }
      } catch (err) {
        console.error(`Error parsing apps/${entry.name}/config.json:`, err.message);
        hasErrors = true;
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log(`All JSON files are valid! (${validatedConfigCount} config.json, ${validatedComposeCount} docker-compose.json)`);
  }
}

validateJson().catch((error) => {
  console.error("Validation script error:", error);
  process.exit(1);
});
