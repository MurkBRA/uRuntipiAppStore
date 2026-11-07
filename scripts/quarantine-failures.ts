import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export function quarantineFailures(failuresJsonPath: string): number {
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
    return 0;
  }

  console.log(`\n🛡️ Isolating and quarantining ${failures.length} failed app(s)...`);

  const syncStatePath = path.join(ROOT_DIR, "state", "sync-state.json");
  let syncState: any = null;
  if (fs.existsSync(syncStatePath)) {
    try {
      syncState = JSON.parse(fs.readFileSync(syncStatePath, "utf8"));
    } catch {
      // ignore
    }
  }

  for (const item of failures) {
    const { appId, status, details, logFile } = item;
    const appDir = path.join(ROOT_DIR, "apps", appId);

    console.log(`  - Quarantining "${appId}" (Reason: ${status} - ${details || "No details"})`);

    // Check if app existed in HEAD git commit
    let existedInHead = false;
    try {
      execFileSync("git", ["cat-file", "-e", `HEAD:apps/${appId}/config.json`], { stdio: "ignore" });
      existedInHead = true;
    } catch {
      existedInHead = false;
    }

    if (existedInHead) {
      try {
        execFileSync("git", ["checkout", "HEAD", "--", `apps/${appId}`], { stdio: "inherit" });
        console.log(`    ✓ Reverted apps/${appId} to previous healthy version in git HEAD.`);
      } catch (err) {
        console.warn(`    ⚠️ Failed to git checkout apps/${appId}:`, (err as Error).message);
      }
    } else {
      try {
        fs.rmSync(appDir, { recursive: true, force: true });
        console.log(`    ✓ Removed new unverified app folder apps/${appId}.`);
      } catch (err) {
        console.warn(`    ⚠️ Failed to delete apps/${appId}:`, (err as Error).message);
      }
    }

    // Revert state entry if needed
    if (syncState?.apps?.[appId]) {
      try {
        const headStateRaw = execFileSync("git", ["show", "HEAD:state/sync-state.json"], { encoding: "utf8" });
        const headState = JSON.parse(headStateRaw);
        if (headState?.apps?.[appId]) {
          syncState.apps[appId] = headState.apps[appId];
        } else {
          delete syncState.apps[appId];
        }
      } catch {
        // ignore
      }
    }

    // Automated Issue creation/update via GitHub CLI
    if (process.env.GITHUB_ACTIONS === "true") {
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
          { encoding: "utf8" },
        );
        const existingList = JSON.parse(existingOut || "[]");

        if (existingList.length > 0) {
          const issueNum = existingList[0].number;
          console.log(`    ℹ Issue #${issueNum} already open. Adding comment...`);
          execFileSync("gh", ["issue", "comment", String(issueNum), "--body", body], { stdio: "inherit" });
        } else {
          console.log(`    ℹ Opening new GitHub Issue for ${appId}...`);
          execFileSync("gh", ["issue", "create", "--title", title, "--body", body, "--label", "auto-quarantine,bug"], {
            stdio: "inherit",
          });
        }
      } catch (err) {
        console.warn(`    ⚠️ Failed to create/update GitHub Issue for ${appId}:`, (err as Error).message);
      }
    }
  }

  if (syncState) {
    fs.writeFileSync(syncStatePath, `${JSON.stringify(syncState, null, 2)}\n`, "utf8");
  }

  try {
    fs.rmSync(failuresJsonPath, { force: true });
  } catch {
    // ignore
  }

  console.log(`🛡️ Quarantine completed for ${failures.length} app(s).\n`);
  return failures.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const filePath = process.argv[2] || path.join(ROOT_DIR, "state", "failures.json");
  quarantineFailures(filePath);
}
