import fs from "node:fs";
import path from "node:path";
import type { FormFieldInput } from "./contracts.ts";

export interface ParsedExportsResult {
  formFields: FormFieldInput[];
  staticExports: Record<string, string>;
}

export interface ShellStatement {
  text: string;
  conditionalDepth: number;
}

export interface CopyDataFilesOptions {
  resolvedStaticExports?: Record<string, string>;
  keepTor?: boolean;
  referencedTemplates?: Set<string>;
}

const IGNORED_PACKAGE_ROOT_FILES = new Set([
  "umbrel-app.yml",
  "docker-compose.yml",
  "exports.sh",
  ".gitkeep",
  ".gitattributes",
  ".gitignore",
]);

const TOR_ROOT_FILES = new Set(["torrc", "torrc.template"]);

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

type LexFrame =
  | { kind: "single" }
  | { kind: "double" }
  | { kind: "brace" }
  | { kind: "paren"; caseStates: Array<"header" | "pattern" | "body">; pendingWord: string; atCommandPos: boolean };

/**
 * Strips quoted strings, backslash escapes, and subshells/brace expansions so
 * top-level compound keywords (if/fi/case/esac/for/while/until/done/{/}) can be
 * detected reliably without matching literals inside variable values.
 */
function stripQuotesAndSubstitutions(seg: string): string {
  let out = "";
  const stack: Array<"single" | "double" | "paren" | "brace"> = [];

  for (let i = 0; i < seg.length; i++) {
    const ch = seg[i];
    const next = i + 1 < seg.length ? seg[i + 1] : "";
    const top = stack[stack.length - 1];

    if (top === "single") {
      if (ch === "'") {
        stack.pop();
        out += " ";
      }
      continue;
    }

    if (top === "double") {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "$" && next === "(") {
        stack.push("paren");
        i++;
        continue;
      }
      if (ch === "$" && next === "{") {
        stack.push("brace");
        i++;
        continue;
      }
      if (ch === '"') {
        stack.pop();
        out += " ";
      }
      continue;
    }

    if (top === "paren" || top === "brace") {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "'") {
        stack.push("single");
        continue;
      }
      if (ch === '"') {
        stack.push("double");
        continue;
      }
      if (ch === "$" && next === "(") {
        stack.push("paren");
        i++;
        continue;
      }
      if (ch === "(" && top === "paren") {
        stack.push("paren");
        continue;
      }
      if (ch === "$" && next === "{") {
        stack.push("brace");
        i++;
        continue;
      }
      if (ch === ")" && top === "paren") {
        stack.pop();
        if (stack.length === 0) out += " ";
        continue;
      }
      if (ch === "}" && top === "brace") {
        stack.pop();
        if (stack.length === 0) out += " ";
        continue;
      }
      continue;
    }

    // Top level
    if (ch === "\\") {
      out += " ";
      i++;
      continue;
    }
    if (ch === "'") {
      stack.push("single");
      continue;
    }
    if (ch === '"') {
      stack.push("double");
      continue;
    }
    if (ch === "$" && next === "(") {
      stack.push("paren");
      i++;
      continue;
    }
    if (ch === "$" && next === "{") {
      stack.push("brace");
      i++;
      continue;
    }
    if (ch === "(") {
      stack.push("paren");
      continue;
    }

    out += ch;
  }

  return out;
}

/**
 * Splits a POSIX/Bash exports script into statements while keeping multi-line subshells `$(...)`,
 * nested quotes inside `"$(...)"`, `case ... in ...) ... ;; esac`, and backslash continuations intact,
 * while tracking outer conditional/loop/group block depth.
 */
export function splitShellStatements(content: string): ShellStatement[] {
  const statements: ShellStatement[] = [];
  const blockStack: string[] = [];
  const stack: LexFrame[] = [];
  const rootCaseStates: Array<"header" | "pattern" | "body"> = [];

  let rootPendingWord = "";
  let rootAtCommandPos = true;
  let extglobDepth = 0;

  let current = "";
  let inComment = false;
  let currentConditionalDepth = 0;

  function activeCaseStateHost(): {
    caseStates: Array<"header" | "pattern" | "body">;
    pendingWord: string;
    atCommandPos: boolean;
  } | null {
    for (let k = stack.length - 1; k >= 0; k--) {
      const f = stack[k];
      if (f.kind === "paren") return f;
      if (f.kind === "brace") return null;
    }
    return null;
  }

  function flushLexWord(isCommandBoundary = false): void {
    const parenHost = activeCaseStateHost();
    const word = parenHost ? parenHost.pendingWord : stack.length === 0 ? rootPendingWord : "";
    const atCmd = parenHost ? parenHost.atCommandPos : stack.length === 0 ? rootAtCommandPos : false;
    const cs = parenHost ? parenHost.caseStates : rootCaseStates;

    if (word) {
      const topCase = cs[cs.length - 1];
      if (atCmd && word === "case") {
        cs.push("header");
      } else if (word === "in" && topCase === "header") {
        cs[cs.length - 1] = "pattern";
      } else if (atCmd && word === "esac" && cs.length > 0) {
        cs.pop();
      }
    }

    let nextCmdPos = isCommandBoundary;
    if (word && !isCommandBoundary) {
      nextCmdPos = ["then", "do", "else", "elif", "!"].includes(word);
    }

    if (parenHost) {
      parenHost.pendingWord = "";
      parenHost.atCommandPos = nextCmdPos;
    } else if (stack.length === 0) {
      rootPendingWord = "";
      rootAtCommandPos = nextCmdPos;
    }
  }

  function updateBlockStackForSegment(rawSeg: string): number {
    const stripped = stripQuotesAndSubstitutions(rawSeg).trim();
    if (!stripped) return blockStack.length;

    const tokens = stripped.match(/&&|\|\||[;|&{}()]|[^\s;|&{}()]+/g) || [];
    let depthForStmt = blockStack.length;
    let atCmdPos = true;

    for (const token of tokens) {
      if (token === ";" || token === "&" || token === "|" || token === "&&" || token === "||") {
        atCmdPos = true;
        continue;
      }

      if (token === "}") {
        depthForStmt = Math.max(depthForStmt, blockStack.length, 1);
        if (blockStack.length > 0) blockStack.pop();
        atCmdPos = false;
        continue;
      }

      if (token === "{" && atCmdPos) {
        blockStack.push("{");
        depthForStmt = Math.max(depthForStmt, blockStack.length);
        atCmdPos = true;
        continue;
      }

      if (atCmdPos) {
        if (token === "if" || token === "for" || token === "while" || token === "until" || token === "case") {
          blockStack.push(token);
          depthForStmt = Math.max(depthForStmt, blockStack.length);
          atCmdPos = false;
        } else if (token === "then" || token === "do" || token === "else" || token === "elif" || token === "!") {
          atCmdPos = true;
        } else if (token === "fi" || token === "done" || token === "esac") {
          depthForStmt = Math.max(depthForStmt, blockStack.length, 1);
          if (blockStack.length > 0) blockStack.pop();
          atCmdPos = false;
        } else {
          atCmdPos = false;
        }
      }
    }

    return depthForStmt;
  }

  function flushStatement(): void {
    flushLexWord(true);
    const trimmed = current.trim();
    current = "";
    if (!trimmed) return;
    const depth = updateBlockStackForSegment(trimmed);
    const effectiveDepth = Math.max(currentConditionalDepth, depth);
    statements.push({ text: trimmed, conditionalDepth: effectiveDepth });
    currentConditionalDepth = blockStack.length;
  }

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = i + 1 < content.length ? content[i + 1] : "";
    const top = stack[stack.length - 1];

    if (inComment) {
      if (ch === "\n") {
        inComment = false;
        if (stack.length === 0) {
          flushStatement();
        } else {
          current += ch;
          flushLexWord(true);
        }
      }
      continue;
    }

    if (top?.kind === "single") {
      current += ch;
      if (ch === "'") {
        stack.pop();
      }
      continue;
    }

    if (top?.kind === "double") {
      if (ch === "\\") {
        if (next === "\n") {
          i++;
          continue;
        }
        if (next === "\r" && content[i + 2] === "\n") {
          i += 2;
          continue;
        }
        current += ch;
        if (i + 1 < content.length) {
          current += content[++i];
        }
        continue;
      }
      if (ch === "$" && next === "(") {
        stack.push({ kind: "paren", caseStates: [], pendingWord: "", atCommandPos: true });
        current += "$(";
        i++;
        continue;
      }
      if (ch === "$" && next === "{") {
        stack.push({ kind: "brace" });
        current += "${";
        i++;
        continue;
      }
      if (ch === '"') {
        stack.pop();
      }
      current += ch;
      continue;
    }

    // Outside quotes (top-level, inside $(...), inside (...), or inside ${...})
    if (ch === "\\") {
      if (next === "\n") {
        i++;
        continue;
      }
      if (next === "\r" && content[i + 2] === "\n") {
        i += 2;
        continue;
      }
      current += ch;
      if (i + 1 < content.length) {
        current += content[++i];
      }
      continue;
    }

    if (ch === "#" && top?.kind !== "brace") {
      const prev = i > 0 ? content[i - 1] : "\n";
      if (/\s|;|\(|&|\|/.test(prev)) {
        flushLexWord(false);
        inComment = true;
        continue;
      }
    }

    if (ch === "'") {
      flushLexWord(false);
      stack.push({ kind: "single" });
      current += ch;
      continue;
    }

    if (ch === '"') {
      flushLexWord(false);
      stack.push({ kind: "double" });
      current += ch;
      continue;
    }

    if (ch === "$" && next === "(") {
      flushLexWord(false);
      stack.push({ kind: "paren", caseStates: [], pendingWord: "", atCommandPos: true });
      current += "$(";
      i++;
      continue;
    }

    if (ch === "$" && next === "{") {
      flushLexWord(false);
      stack.push({ kind: "brace" });
      current += "${";
      i++;
      continue;
    }

    if (ch === "(" && top?.kind !== "brace") {
      const parenHost = activeCaseStateHost();
      const cs = parenHost ? parenHost.caseStates : rootCaseStates;
      const inPattern = cs[cs.length - 1] === "pattern";
      const prev = i > 0 ? content[i - 1] : "";
      if (inPattern && (extglobDepth > 0 || /[@*+?!]/.test(prev))) {
        extglobDepth++;
      } else if (inPattern && /\s/.test(prev || " ")) {
        // Optional leading '(' in POSIX case pattern `(foo|bar)` — matching ')' ends pattern
        extglobDepth = 0;
      } else {
        flushLexWord(false);
        stack.push({ kind: "paren", caseStates: [], pendingWord: "", atCommandPos: true });
      }
      current += ch;
      continue;
    }

    if (ch === ")" && top?.kind !== "brace") {
      const parenHost = activeCaseStateHost();
      const cs = parenHost ? parenHost.caseStates : rootCaseStates;
      if (cs[cs.length - 1] === "pattern" && (parenHost ? top?.kind === "paren" && parenHost === top : true)) {
        if (extglobDepth > 0) {
          extglobDepth--;
        } else {
          cs[cs.length - 1] = "body";
          if (parenHost) {
            parenHost.pendingWord = "";
            parenHost.atCommandPos = true;
          } else {
            rootPendingWord = "";
            rootAtCommandPos = true;
          }
        }
        current += ch;
        continue;
      }
      if (top?.kind === "paren") {
        stack.pop();
        current += ch;
        continue;
      }
    }

    if (ch === "}" && top?.kind === "brace") {
      stack.pop();
      current += ch;
      continue;
    }

    // Track case pattern/body transitions and statement boundaries
    if (top?.kind !== "brace") {
      const parenHost = activeCaseStateHost();
      const cs = parenHost ? parenHost.caseStates : rootCaseStates;

      if (ch === ";" && next === ";" && cs[cs.length - 1] === "body") {
        flushLexWord(true);
        cs[cs.length - 1] = "pattern";
        current += ";;";
        i++;
        continue;
      }

      if (/[A-Za-z0-9_{}!]/.test(ch)) {
        if (parenHost) {
          parenHost.pendingWord += ch;
        } else if (stack.length === 0) {
          rootPendingWord += ch;
        }
      } else if (ch === ";" || ch === "&" || ch === "|" || ch === "\n" || ch === "\r") {
        flushLexWord(true);
      } else if (/\s/.test(ch)) {
        flushLexWord(false);
      } else {
        if (parenHost) {
          parenHost.pendingWord = "";
          parenHost.atCommandPos = false;
        } else if (stack.length === 0) {
          rootPendingWord = "";
          rootAtCommandPos = false;
        }
      }
    }

    if (stack.length === 0 && (ch === "\n" || ch === "\r" || ch === ";")) {
      if (ch === "\r" && next === "\n") i++;
      flushStatement();
      continue;
    }

    current += ch;
  }

  flushStatement();
  return statements;
}

export function parseUmbrelExports(exportsContent: string, appName: string): ParsedExportsResult {
  const formFields: FormFieldInput[] = [];
  const staticExports: Record<string, string> = {};
  const localAssignments: Record<string, string> = {};
  const seenVars = new Set<string>();

  if (!exportsContent.trim()) {
    return { formFields, staticExports };
  }

  const statements = splitShellStatements(exportsContent);

  // First pass: collect top-level unconditional shell variable assignments (skip conditional blocks)
  for (const stmt of statements) {
    if (stmt.conditionalDepth > 0) continue;
    const line = stmt.text.trim();
    if (!line || line.startsWith("#")) continue;

    const assignMatch = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s);
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

  for (const stmt of statements) {
    if (stmt.conditionalDepth > 0) continue;
    const line = stmt.text.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s);
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

      // URLs, origins, hostnames, domains, services, IPs, commands, args (e.g. APP_TAILSCALE_URL, APP_LNDG_CSRF_TRUSTED_ORIGINS, APP_LIGHTNING_COMMAND)
      if (
        /(?:URL|URI|URLS|URIS|ORIGINS|SERVICE|SERVICES|HOST|HOSTS|HOSTNAME|HOSTNAMES|DOMAIN|DOMAINS|IPS|COMMAND|CMD|ARGS|FLAGS|OPTIONS)$/i.test(
          varName,
        )
      ) {
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
      if (/(?:PORT|PORTS)$/i.test(varName)) {
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
      if (/(?:USER|USERNAME|EMAIL|EMAILS)$/i.test(varName)) {
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
  options?: CopyDataFilesOptions,
): void {
  const destDataRoot = path.join(destAppDir, "data");
  const staticMap = options?.resolvedStaticExports || {};
  const keepTor = Boolean(options?.keepTor);
  const referencedTemplates = options?.referencedTemplates;

  function transformFileContent(
    content: string,
    opts: { isHtml?: boolean; isTemplate?: boolean; targetRelInData: string },
  ): string {
    let out = content;
    // Rewrite Umbrel container DNS names <appId>_<service>_1 -> renamed service
    for (const [origService, newService] of Object.entries(serviceRenameMap)) {
      const umbrelDns = `${appId}_${origService}_1`;
      out = out.replaceAll(umbrelDns, newService);
    }

    // Interpolate resolved static export variables inside .template files while leaving nginx/PHP variables intact
    if (opts.isTemplate) {
      out = out.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (full, b, _, p) => {
        const varName = b || p;
        if (varName && Object.prototype.hasOwnProperty.call(staticMap, varName)) {
          return staticMap[varName];
        }
        return full;
      });
    }

    out = out
      .replace(/\$\{?APP_HIDDEN_SERVICE\}?/g, "localhost")
      .replace(/\$\{?DEVICE_DOMAIN_NAME\}?/g, "localhost")
      .replace(/\$\{?DEVICE_HOSTNAME\}?/g, "localhost");

    if (opts.isHtml) {
      out = out.replace(/(?<!@)\bumbrel\.local\b/gi, "<IP-DO-SERVIDOR>");
    }

    // Tor SocksPolicy does not accept DNS hostnames; use private Docker bridge CIDRs instead
    const targetBase = path.posix.basename(opts.targetRelInData);
    if (keepTor && (targetBase === "torrc" || targetBase === "torrc.template")) {
      out = out.replace(/^[ \t]*SocksPolicy\s+accept\s+([^\s#]+).*$/gim, (line, target) => {
        if (target === "*" || /^\d+\.\d+\.\d+\.\d+(?:\/\d+)?$/.test(target)) {
          return line;
        }
        return [
          "SocksPolicy accept 10.0.0.0/8",
          "SocksPolicy accept 172.16.0.0/12",
          "SocksPolicy accept 192.168.0.0/16",
        ].join("\n");
      });
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
    if (appId === "frigate") {
      out = out.replace(
        /name_of_your_camera:\s*(?:#[^\n]*)?\n\s*ffmpeg:/,
        "name_of_your_camera: # <------ Name the camera\n    enabled: False # <---- Set to True once you configure a valid RTSP camera stream\n    ffmpeg:",
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
      if (!relDir && !keepTor && TOR_ROOT_FILES.has(entry.name)) continue;
      if (entry.name === ".gitkeep") continue;

      const fullSrcPath = path.join(currentSrcDir, entry.name);

      if (entry.isDirectory()) {
        walkAndCopy(fullSrcPath, relPath);
        continue;
      }

      // Determine target path inside apps/<appId>/data/
      let targetRelInData = normRel.startsWith("data/") ? normRel.slice("data/".length) : normRel;
      const isTemplate = targetRelInData.endsWith(".template");
      if (isTemplate && !referencedTemplates?.has(entry.name)) {
        targetRelInData = targetRelInData.slice(0, -".template".length);
      }

      const fullDestPath = path.join(destDataRoot, targetRelInData);
      fs.mkdirSync(path.dirname(fullDestPath), { recursive: true });

      const stat = fs.statSync(fullSrcPath);
      const isTextFile =
        isTemplate ||
        /\.(conf|yml|yaml|json|sh|env|ini|toml|xml|py|js|php|html|css|sql|txt|Caddyfile)$/i.test(fullDestPath) ||
        path.posix.basename(targetRelInData) === "torrc";

      if (isTextFile && stat.size < 512 * 1024) {
        const raw = fs.readFileSync(fullSrcPath, "utf8");
        fs.writeFileSync(
          fullDestPath,
          transformFileContent(raw, {
            isHtml: /\.html?$/i.test(fullDestPath),
            isTemplate,
            targetRelInData,
          }),
          "utf8",
        );
      } else {
        fs.copyFileSync(fullSrcPath, fullDestPath);
      }

      // Preserve executable bit from upstream scripts/binaries
      if ((stat.mode & 0o111) !== 0) {
        fs.chmodSync(fullDestPath, 0o755);
      }
    }
  }

  walkAndCopy(umbrelAppDir);
}
