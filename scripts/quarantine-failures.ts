import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateReadme } from "./sync-umbrel.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

interface FailureItem {
  appId: string;
  status: string;
  duration?: number;
  details?: string;
  logFile?: string;
}

export function quarantineFailures(
  failuresJsonPath: string,
  options?: { rootDir?: string; githubActions?: boolean },
): number {
  const rootDir = options?.rootDir ?? ROOT_DIR;
  const isGithubActions = options?.githubActions ?? process.env.GITHUB_ACTIONS === "true";

  if (!fs.existsSync(failuresJsonPath)) {
    console.log("No failures file found. Everything is healthy!");
    return 0;
  }

  let failures: FailureItem[] = [];
  try {
    failures = JSON.parse(fs.readFileSync(failuresJsonPath, "utf8"));
  } catch (err) {
    console.warn("Could not parse failures JSON:", (err as Error).message);
    return 0;
  }

  if (!Array.isArray(failures) || failures.length === 0) {
    console.log("Zero failed apps in failures file.");
    try {
      fs.rmSync(failuresJsonPath, { force: true });
    } catch {
      // ignore
    }
    return 0;
  }

  console.log(`\n🛡️ Isolating and quarantining ${failures.length} failed app(s)...`);

  const syncStatePath = path.join(rootDir, "state", "sync-state.json");
  let syncState: any = null;
  if (fs.existsSync(syncStatePath)) {
    try {
      syncState = JSON.parse(fs.readFileSync(syncStatePath, "utf8"));
    } catch {
      // ignore
    }
  }

  let quarantinedCount = 0;

  for (const item of failures) {
    const { appId, status, details, logFile } = item;
    if (!appId || !/^[a-z0-9][a-z0-9-]*$/i.test(appId)) {
      console.warn(`  ⚠️ Skipping invalid appId in failures file: ${String(appId)}`);
      continue;
    }
    const appDir = path.join(rootDir, "apps", appId);

    console.log(`  - Quarantining "${appId}" (Reason: ${status} - ${details || "No details"})`);

    // Check if app existed in HEAD git commit
    let existedInHead = false;
    try {
      execFileSync("git", ["cat-file", "-e", `HEAD:apps/${appId}/config.json`], { cwd: rootDir, stdio: "ignore" });
      existedInHead = true;
    } catch {
      existedInHead = false;
    }

    if (existedInHead) {
      try {
        execFileSync("git", ["checkout", "HEAD", "--", `apps/${appId}`], { cwd: rootDir, stdio: "inherit" });
        execFileSync("git", ["clean", "-fd", "--", `apps/${appId}`], { cwd: rootDir, stdio: "inherit" });
        quarantinedCount++;
        console.log(`    ✓ Reverted apps/${appId} to previous healthy version in git HEAD.`);
      } catch (err) {
        console.warn(`    ⚠️ Failed to git checkout apps/${appId}:`, (err as Error).message);
      }
    } else {
      try {
        fs.rmSync(appDir, { recursive: true, force: true });
        quarantinedCount++;
        console.log(`    ✓ Removed new unverified app folder apps/${appId}.`);
      } catch (err) {
        console.warn(`    ⚠️ Failed to delete apps/${appId}:`, (err as Error).message);
      }
    }

    // Revert state entry if needed
    if (syncState?.apps?.[appId]) {
      try {
        const headStateRaw = execFileSync("git", ["show", "HEAD:state/sync-state.json"], {
          cwd: rootDir,
          encoding: "utf8",
        });
        const headState = JSON.parse(headStateRaw);
        if (headState?.apps?.[appId]) {
          syncState.apps[appId] = headState.apps[appId];
        } else {
          delete syncState.apps[appId];
        }
      } catch {
        delete syncState.apps[appId];
      }
    }

    // Automated Issue creation/update via GitHub CLI
    if (isGithubActions) {
      try {
        let logContent = "(no logs captured)";
        if (logFile && fs.existsSync(logFile)) {
          const raw = fs.readFileSync(logFile, "utf8");
          const lines = raw.split("\n");
          logContent = lines.slice(Math.max(0, lines.length - 80)).join("\n");
        }

        const title = `🚨 [Auto-Quarantine] Falha no Smoke Test: ${appId}`;
        const body = `### Falha Detectada na Sincronização Automática

O aplicativo **\`${appId}\`** falhou nos testes de inicialização (*Smoke Test*) durante o sincronismo diário com o repositório upstream da Umbrel.

- **Status da Falha**: \`${status}\`
- **Motivo**: ${details || "Falha de container ou inicialização"}
- **Ação Automática**: O app foi revertido para a versão anterior estável e isolado para não bloquear os demais aplicativos saudáveis da loja.

#### Últimos Logs do Container:
\`\`\`
${logContent}
\`\`\`

*Este alerta foi gerado automaticamente pelo pipeline de sincronismo.*`;

        // Check if an issue with the same title is already open
        const existingOut = execFileSync(
          "gh",
          ["issue", "list", "--search", `"${title}" in:title state:open`, "--json", "number"],
          { cwd: rootDir, encoding: "utf8" },
        );
        const existingList = JSON.parse(existingOut || "[]");

        if (existingList.length > 0) {
          const issueNum = existingList[0].number;
          console.log(`    ℹ Issue #${issueNum} already open. Adding comment...`);
          execFileSync("gh", ["issue", "comment", String(issueNum), "--body", body], {
            cwd: rootDir,
            stdio: "inherit",
          });
        } else {
          console.log(`    ℹ Opening new GitHub Issue for ${appId}...`);
          try {
            execFileSync(
              "gh",
              [
                "label",
                "create",
                "auto-quarantine",
                "--description",
                "Auto-quarantined app from daily sync",
                "--color",
                "D93F0B",
                "--force",
              ],
              { cwd: rootDir, stdio: "ignore" },
            );
          } catch {
            // ignore label creation failures
          }

          try {
            execFileSync(
              "gh",
              ["issue", "create", "--title", title, "--body", body, "--label", "auto-quarantine,bug"],
              {
                cwd: rootDir,
                stdio: "inherit",
              },
            );
          } catch {
            execFileSync("gh", ["issue", "create", "--title", title, "--body", body], {
              cwd: rootDir,
              stdio: "inherit",
            });
          }
        }
      } catch (err) {
        console.warn(`    ⚠️ Failed to create/update GitHub Issue for ${appId}:`, (err as Error).message);
      }
    }
  }

  if (syncState) {
    fs.writeFileSync(syncStatePath, `${JSON.stringify(syncState, null, 2)}\n`, "utf8");
  }

  if (quarantinedCount > 0 && fs.existsSync(path.join(rootDir, "apps"))) {
    generateReadme({ rootDir });
    console.log("    ✓ Regenerated README.md to reflect quarantined apps.");
  }

  try {
    fs.rmSync(failuresJsonPath, { force: true });
  } catch {
    // ignore
  }

  console.log(`🛡️ Quarantine completed for ${quarantinedCount} app(s).\n`);
  return quarantinedCount;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const filePath = process.argv[2] || path.join(ROOT_DIR, "state", "failures.json");
  quarantineFailures(filePath);
}
