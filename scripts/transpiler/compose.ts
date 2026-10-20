import { convertLegacyToYaml, parseComposeJson, type FormField } from "@runtipi/common/schemas";
import { createFormFieldFromContract, UMBREL_EXTERNAL_CONTRACT_VARS } from "./contracts.ts";

export interface TranspiledComposeResult {
  composeJson: Record<string, any>;
  composeYamlObj: Record<string, any>;
  formFields: FormField[];
  mainImageTag: string;
  serviceRenameMap: Record<string, string>;
  uid?: number;
  gid?: number;
}

const RUNTIPI_BUILTIN_ENV_VARS = new Set([
  "APP_DATA_DIR",
  "APP_DOMAIN",
  "APP_PROTOCOL",
  "APP_PORT",
  "LOCAL_DOMAIN",
  "INTERNAL_IP",
  "ROOT_FOLDER_HOST",
  "DNS_IP",
  "TZ",
  " TIPI_VERSION",
]);

function stripImageDigest(image: string): string {
  const withoutDigest = image.split("@sha256:")[0].trim();
  const lastSlash = withoutDigest.lastIndexOf("/");
  const afterSlash = lastSlash >= 0 ? withoutDigest.slice(lastSlash + 1) : withoutDigest;
  if (!afterSlash.includes(":")) {
    return `${withoutDigest}:latest`;
  }
  return withoutDigest;
}

export function extractImageVersionTag(image: string): string {
  const clean = stripImageDigest(image);
  const parts = clean.split(":");
  return parts[parts.length - 1] || "latest";
}

function isIgnoredSidecarService(serviceName: string, serviceConfig: Record<string, any>): boolean {
  if (serviceName === "app_proxy") return true;
  const image = String(serviceConfig?.image || "").toLowerCase();
  if (!image) return true;
  if (image.includes("getumbrel/tor") || (serviceName === "tor" && image.includes("tor"))) {
    return true;
  }
  if (image.includes("-widget-server") || image.includes("-widget:") || image.includes("media-app-configurator")) {
    return true;
  }
  return false;
}

function parseEnvToMap(envInput: any): Array<{ key: string; value: string | number | boolean }> {
  const result: Array<{ key: string; value: string | number | boolean }> = [];
  const seen = new Set<string>();

  if (Array.isArray(envInput)) {
    for (const item of envInput) {
      if (typeof item !== "string") continue;
      const eqIdx = item.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = item.slice(0, eqIdx).trim();
      const val = item.slice(eqIdx + 1).trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push({ key, value: val });
    }
  } else if (envInput && typeof envInput === "object") {
    for (const [k, v] of Object.entries(envInput)) {
      const key = k.trim();
      if (!key || v === undefined || v === null || seen.has(key)) continue;
      seen.add(key);
      if (typeof v === "number" || typeof v === "boolean") {
        result.push({ key, value: v });
      } else {
        result.push({ key, value: String(v) });
      }
    }
  }
  return result;
}

export function transpileCompose(params: {
  appId: string;
  appName: string;
  manifestPort: number;
  allocatedPort: number;
  umbrelCompose: Record<string, any>;
  staticExports: Record<string, string>;
  initialFormFields: FormField[];
  hasDependencies: boolean;
}): TranspiledComposeResult {
  const {
    appId,
    appName,
    manifestPort,
    allocatedPort,
    umbrelCompose,
    staticExports,
    initialFormFields,
    hasDependencies,
  } = params;

  const rawServices: Record<string, any> = umbrelCompose?.services || {};
  const formFields: FormField[] = [...initialFormFields];
  const formFieldVars = new Set(formFields.map((f) => f.env_variable));

  function ensureFormField(field: FormField): void {
    if (formFieldVars.has(field.env_variable)) return;
    // Never mark random fields as required (Runtipi test rule)
    if (field.type === "random") {
      const { required: _, ...rest } = field as any;
      formFields.push(rest);
    } else {
      formFields.push(field);
    }
    formFieldVars.add(field.env_variable);
  }

  // 1. Inspect app_proxy to identify main service and internalPort
  const proxyEnvEntries = parseEnvToMap(rawServices.app_proxy?.environment);
  const proxyEnv = new Map(proxyEnvEntries.map((e) => [e.key, String(e.value)]));

  const rawAppHostOrig = proxyEnv.get("APP_HOST") || "";
  // Interpolate static exports if APP_HOST uses a variable
  const rawAppHost = rawAppHostOrig.replace(/\$\{?([A-Za-z0-9_]+)\}?/g, (_, v) => staticExports[v] ?? "");

  let rawAppPort = proxyEnv.get("APP_PORT") || "";
  rawAppPort = rawAppPort.replace(/\$\{?([A-Za-z0-9_]+)\}?/g, (_, v) => staticExports[v] ?? "");

  let internalPort = Number.parseInt(rawAppPort, 10);
  if (!Number.isInteger(internalPort) || internalPort <= 0 || internalPort > 65535) {
    internalPort = manifestPort || allocatedPort || 8080;
  }

  // 2. Filter active services
  const keptServiceKeys = Object.keys(rawServices).filter(
    (key) => rawServices[key] && typeof rawServices[key] === "object" && !isIgnoredSidecarService(key, rawServices[key]),
  );

  if (keptServiceKeys.length === 0) {
    throw new Error(`App ${appId} has no valid runtime services after filtering.`);
  }

  // Determine which kept service is the main web service
  let mainOrigKey = "";
  if (rawAppHost) {
    const prefix = `${appId}_`;
    const suffix = "_1";
    if (rawAppHost.startsWith(prefix) && rawAppHost.endsWith(suffix)) {
      const candidate = rawAppHost.slice(prefix.length, -suffix.length);
      if (keptServiceKeys.includes(candidate)) {
        mainOrigKey = candidate;
      }
    }
    if (!mainOrigKey && keptServiceKeys.includes(rawAppHost)) {
      mainOrigKey = rawAppHost;
    }
    // Check if rawAppHostOrig or rawAppHost matches a service's networks.default.ipv4_address
    if (!mainOrigKey) {
      const cleanHostVar = rawAppHostOrig.replace(/^\$\{?|\}?$/g, "");
      for (const k of keptServiceKeys) {
        const svcIp = rawServices[k]?.networks?.default?.ipv4_address;
        if (typeof svcIp === "string") {
          const cleanSvcIpVar = svcIp.replace(/^\$\{?|\}?$/g, "");
          const resolvedSvcIp = staticExports[cleanSvcIpVar] ?? cleanSvcIpVar;
          if (cleanSvcIpVar === cleanHostVar || resolvedSvcIp === rawAppHost) {
            mainOrigKey = k;
            break;
          }
        }
      }
    }
  }

  if (!mainOrigKey) {
    const preferredNames = [appId, "web", "app", "server", "frontend", "ui"];
    for (const p of preferredNames) {
      if (keptServiceKeys.includes(p)) {
        mainOrigKey = p;
        break;
      }
    }
  }
  if (!mainOrigKey) {
    mainOrigKey = keptServiceKeys[0];
  }

  // 3. Build service rename map: mainOrigKey -> appId
  const serviceRenameMap: Record<string, string> = {};
  for (const key of keptServiceKeys) {
    if (key === mainOrigKey) {
      serviceRenameMap[key] = appId;
    } else if (key === appId) {
      serviceRenameMap[key] = `${appId}-${key}-sidecar`;
    } else {
      serviceRenameMap[key] = `${appId}-${key}`;
    }
  }

  // Map legacy Umbrel per-service ipv4_address variables ($APP_*_IP) to their Docker DNS service names
  const resolvedStaticExports: Record<string, string> = { ...staticExports };
  for (const key of keptServiceKeys) {
    const svcIp = rawServices[key]?.networks?.default?.ipv4_address;
    if (typeof svcIp === "string" && svcIp.startsWith("$")) {
      const ipVarName = svcIp.replace(/^\$\{?|\}?$/g, "");
      if (ipVarName) {
        resolvedStaticExports[ipVarName] = serviceRenameMap[key];
      }
    }
  }

  // Helper to transform strings (DNS names, Umbrel vars, static exports)
  let usesExternalContract = hasDependencies;

  function transformString(input: string): string {
    let out = input;

    // 1. Replace staticExports variables first
    out = out.replace(/\$\{([A-Za-z0-9_]+)\}|\$([A-Za-z0-9_]+)/g, (full, brk, plain, offset, str) => {
      // Do not touch escaped $$VAR
      if (offset > 0 && str[offset - 1] === "$") return full;
      const varName = brk || plain;
      if (resolvedStaticExports[varName] !== undefined) {
        return resolvedStaticExports[varName];
      }
      return full;
    });

    // 2. Replace Umbrel container DNS names: <appId>_<origService>_1 -> renamed service
    for (const [origKey, finalKey] of Object.entries(serviceRenameMap)) {
      const umbrelContainerName = `${appId}_${origKey}_1`;
      out = out.replaceAll(umbrelContainerName, finalKey);
    }
    // Also catch any removed tor service references
    out = out.replaceAll(`${appId}_tor_1`, "127.0.0.1");
    out = out.replaceAll(`${appId}_tor_server_1`, "127.0.0.1");

    // 3. Replace Umbrel URL patterns
    out = out.replace(
      /https?:\/\/\$\{?DEVICE_DOMAIN_NAME(?::-[^}]*)?\}?:\$\{?(?:APP_PROXY_PORT|[A-Za-z0-9_]+)\}?/g,
      "${APP_PROTOCOL:-http}://${APP_DOMAIN}",
    );
    out = out.replace(
      new RegExp(`https?://\\$\\{?DEVICE_DOMAIN_NAME(?::-[^}]*)?\\}?:${manifestPort}\\b`, "g"),
      "${APP_PROTOCOL:-http}://${APP_DOMAIN}",
    );

    // 4. Replace Umbrel platform paths & variables (handling both ${VAR}, ${VAR:-default}, and $VAR)
    out = out
      .replace(/(?:\$\{UMBREL_ROOT(?::-[^}]*)?\}|\$UMBREL_ROOT)\/data\/storage\/downloads/g, "${APP_DATA_DIR}/data/downloads")
      .replace(/\$\{UMBREL_ROOT(?::-[^}]*)?\}|\$UMBREL_ROOT\b/g, "${APP_DATA_DIR}/data")
      .replace(/\$\{EXPORTS_APP_DATA_DIR(?::-[^}]*)?\}|\$EXPORTS_APP_DATA_DIR\b/g, "${APP_DATA_DIR}/data")
      .replace(/\$\{EXPORTS_APP_DIR(?::-[^}]*)?\}|\$EXPORTS_APP_DIR\b/g, "${APP_DATA_DIR}/data")
      .replace(/\$\{EXPORTS_DATA_ROOT(?::-[^}]*)?\}|\$EXPORTS_DATA_ROOT\b/g, "${APP_DATA_DIR}/data")
      .replace(/\$\{EXPORTS_TOR_DATA_DIR(?::-[^}]*)?\}|\$EXPORTS_TOR_DATA_DIR\b/g, "${APP_DATA_DIR}/data/tor")
      .replace(/\$\{TOR_DATA_DIR(?::-[^}]*)?\}|\$TOR_DATA_DIR\b/g, "${APP_DATA_DIR}/data/tor")
      .replace(/\$\{DEVICE_DOMAIN_NAME(?::-[^}]*)?\}|\$DEVICE_DOMAIN_NAME\b/g, "${APP_DOMAIN}")
      .replace(/\$\{DEVICE_HOSTNAME(?::-[^}]*)?\}|\$DEVICE_HOSTNAME\b/g, "${LOCAL_DOMAIN}")
      .replace(/\$\{APP_HIDDEN_SERVICE(?::-[^}]*)?\}|\$APP_HIDDEN_SERVICE\b/g, "${APP_DOMAIN}")
      .replace(/\$\{APP_PROXY_PORT(?::-[^}]*)?\}|\$APP_PROXY_PORT\b/g, String(allocatedPort))
      .replace(/\$\{NETWORK_IP(?::-[^}]*)?\}|\$NETWORK_IP\b/g, "${INTERNAL_IP}");

    // 5. Inspect any remaining ${VAR} or $VAR references
    out = out.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-[^}]*)?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (full, brk, plain, offset, str) => {
      if (offset > 0 && str[offset - 1] === "$") return full;
      const varName = brk || plain;
      if (!varName || RUNTIPI_BUILTIN_ENV_VARS.has(varName)) return full;

      if (varName === "APP_PASSWORD") {
        ensureFormField({
          type: "random",
          label: `${appName} password`,
          min: 32,
          env_variable: "APP_PASSWORD",
        });
        return "${APP_PASSWORD}";
      }

      if (varName === "APP_SEED") {
        ensureFormField({
          type: "random",
          label: `${appName} seed`,
          min: 64,
          encoding: "hex",
          env_variable: "APP_SEED",
        });
        return "${APP_SEED}";
      }

      const contractField = createFormFieldFromContract(varName);
      if (contractField) {
        if (
          varName.startsWith("APP_BITCOIN_") ||
          varName.startsWith("APP_LIGHTNING_") ||
          varName.startsWith("APP_CORE_LIGHTNING_") ||
          varName.startsWith("APP_ELECTRS_") ||
          varName.startsWith("APP_FULCRUM_") ||
          varName.startsWith("APP_MEMPOOL_") ||
          varName.startsWith("APP_NEXTCLOUD_")
        ) {
          usesExternalContract = true;
        }
        ensureFormField(contractField);
        return `\${${varName}}`;
      }

      if (!formFieldVars.has(varName)) {
        // Check if it looks like a secret/key/password/token
        if (/(PASSWORD|SECRET|KEY|TOKEN|SALT|HASH)/i.test(varName)) {
          ensureFormField({
            type: "random",
            label: `${appName} ${varName.toLowerCase().replace(/_/g, " ")}`,
            min: 32,
            env_variable: varName,
          });
        } else {
          ensureFormField({
            type: "text",
            label: `${appName} ${varName.toLowerCase().replace(/_/g, " ")}`,
            required: false,
            default: "default",
            env_variable: varName,
          });
        }
      }
      return `\${${varName}}`;
    });

    return out;
  }

  let detectedUid: number | undefined;
  let detectedGid: number | undefined;
  let mainImageTag = "latest";

  // Pre-scan which kept services have valid healthchecks
  const servicesWithHealthcheck = new Set<string>();
  for (const origKey of keptServiceKeys) {
    const hc = rawServices[origKey]?.healthcheck;
    if (hc && typeof hc === "object" && !hc.disable && hc.test) {
      servicesWithHealthcheck.add(serviceRenameMap[origKey]);
    }
  }

  const transpiledServices: Array<Record<string, any>> = [];
  const usedHostPortsInApp = new Set<number>([allocatedPort]);

  for (const origKey of keptServiceKeys) {
    const raw = rawServices[origKey];
    const finalName = serviceRenameMap[origKey];
    const isMain = origKey === mainOrigKey;

    const cleanImage = transformString(stripImageDigest(String(raw.image)));
    if (isMain) {
      mainImageTag = extractImageVersionTag(cleanImage);
    }

    const svc: Record<string, any> = {
      name: finalName,
      image: cleanImage,
    };

    if (isMain) {
      svc.isMain = true;
      svc.internalPort = internalPort;
    }

    if (usesExternalContract) {
      svc.addToMainNetwork = true;
    }

    if (typeof raw.network_mode === "string" && raw.network_mode === "host" && !isMain) {
      svc.networkMode = "host";
    }

    if (raw.user !== undefined) {
      const userStr = String(raw.user).trim();
      svc.user = userStr;
      if (userStr === "1000:1000") {
        detectedUid = 1000;
        detectedGid = 1000;
      }
    }

    if (typeof raw.hostname === "string" && raw.hostname.trim()) {
      svc.hostname = transformString(raw.hostname.trim());
    }

    if (typeof raw.working_dir === "string" && raw.working_dir.trim()) {
      svc.workingDir = transformString(raw.working_dir.trim());
    }

    if (typeof raw.shm_size === "string" && raw.shm_size.trim()) {
      svc.shmSize = raw.shm_size.trim();
    }

    if (typeof raw.privileged === "boolean") {
      svc.privileged = raw.privileged;
    }

    if (typeof raw.tty === "boolean") {
      svc.tty = raw.tty;
    }

    if (typeof raw.stdin_open === "boolean") {
      svc.stdinOpen = raw.stdin_open;
    }

    if (typeof raw.read_only === "boolean") {
      svc.readOnly = raw.read_only;
    }

    if (typeof raw.stop_signal === "string" && raw.stop_signal.trim()) {
      svc.stopSignal = raw.stop_signal.trim();
    }

    if (typeof raw.stop_grace_period === "string" && raw.stop_grace_period.trim()) {
      svc.stopGracePeriod = raw.stop_grace_period.trim();
    }

    if (typeof raw.pid === "string" && raw.pid.trim()) {
      svc.pid = raw.pid.trim();
    }

    // Command & Entrypoint
    if (typeof raw.command === "string" && raw.command.trim()) {
      svc.command = transformString(raw.command.trim());
    } else if (Array.isArray(raw.command) && raw.command.length > 0) {
      svc.command = raw.command.map((c: any) => transformString(String(c)));
    }

    if (typeof raw.entrypoint === "string" && raw.entrypoint.trim()) {
      svc.entrypoint = transformString(raw.entrypoint.trim());
    } else if (Array.isArray(raw.entrypoint) && raw.entrypoint.length > 0) {
      svc.entrypoint = raw.entrypoint.map((e: any) => transformString(String(e)));
    }

    // Environment (including merging any env_file if present in Umbrel package)
    const envEntries = parseEnvToMap(raw.environment);
    const transformedEnv: Array<{ key: string; value: string | number | boolean }> = [];
    for (const entry of envEntries) {
      if (typeof entry.value === "number" || typeof entry.value === "boolean") {
        transformedEnv.push(entry);
      } else {
        const val = transformString(entry.value).trim();
        // Schema rule: string env value must have minLength: 1
        if (val.length > 0) {
          transformedEnv.push({ key: entry.key, value: val });
        }
      }
    }
    if (transformedEnv.length > 0) {
      svc.environment = transformedEnv;
    }

    // Volumes
    if (Array.isArray(raw.volumes) && raw.volumes.length > 0) {
      const parsedVolumes: Array<Record<string, any>> = [];
      for (const vol of raw.volumes) {
        if (typeof vol !== "string") continue;
        const transformedVol = transformString(vol);
        const parts = transformedVol.split(":");
        if (parts.length < 2) continue;

        let hostPath = parts[0].trim();
        const containerPath = parts[1].trim();
        const modeRaw = parts.slice(2).join(":").trim();

        if (!hostPath || !containerPath) continue;

        // Normalize ${APP_DATA_DIR}/<subpath> -> ${APP_DATA_DIR}/data/<subpath>
        if (
          hostPath.startsWith("${APP_DATA_DIR}/") &&
          !hostPath.startsWith("${APP_DATA_DIR}/data/") &&
          hostPath !== "${APP_DATA_DIR}/data"
        ) {
          const rest = hostPath.slice("${APP_DATA_DIR}/".length);
          hostPath = `\${APP_DATA_DIR}/data/${rest}`;
        } else if (hostPath === "${APP_DATA_DIR}") {
          hostPath = "${APP_DATA_DIR}/data";
        }

        const volObj: Record<string, any> = {
          hostPath,
          containerPath,
        };

        if (modeRaw) {
          const flags = modeRaw.split(",").map((f) => f.trim());
          if (flags.includes("ro")) volObj.readOnly = true;
          if (flags.includes("z")) volObj.shared = true;
          else if (flags.includes("Z")) volObj.private = true;
          const prop = flags.find((f) =>
            ["rprivate", "private", "rshared", "shared", "rslave", "slave"].includes(f),
          );
          if (prop) {
            volObj.bind = { propagation: prop };
          }
        }

        parsedVolumes.push(volObj);
      }
      if (parsedVolumes.length > 0) {
        svc.volumes = parsedVolumes;
      }
    }

    // Extra Ports (addPorts)
    if (Array.isArray(raw.ports) && raw.ports.length > 0) {
      const addPorts: Array<Record<string, any>> = [];
      for (const p of raw.ports) {
        const pStr = transformString(String(p)).trim();
        let proto = "tcp";
        let cleanPort = pStr;
        if (cleanPort.endsWith("/udp")) {
          proto = "udp";
          cleanPort = cleanPort.slice(0, -4);
        } else if (cleanPort.endsWith("/tcp")) {
          proto = "tcp";
          cleanPort = cleanPort.slice(0, -4);
        }

        const segments = cleanPort.split(":");
        if (segments.length < 2) continue;
        const cPortStr = segments[segments.length - 1];
        const hPortStr = segments[segments.length - 2];

        const hostPort = Number.parseInt(hPortStr, 10);
        const containerPort = Number.parseInt(cPortStr, 10);

        if (
          !Number.isInteger(hostPort) ||
          !Number.isInteger(containerPort) ||
          hostPort <= 0 ||
          hostPort > 65535 ||
          containerPort <= 0 ||
          containerPort > 65535
        ) {
          continue;
        }

        // Skip if this is already the main web port
        if (isMain && (hostPort === manifestPort || hostPort === allocatedPort || containerPort === internalPort)) {
          continue;
        }
        if (usedHostPortsInApp.has(hostPort) && proto === "tcp") {
          continue;
        }
        usedHostPortsInApp.add(hostPort);

        addPorts.push({
          hostPort,
          containerPort,
          ...(proto === "udp" ? { udp: true, tcp: false } : { tcp: true }),
        });
      }
      if (addPorts.length > 0) {
        svc.addPorts = addPorts;
      }
    }

    // HealthCheck
    if (raw.healthcheck && typeof raw.healthcheck === "object" && !raw.healthcheck.disable && raw.healthcheck.test) {
      let testStr = "";
      if (typeof raw.healthcheck.test === "string") {
        testStr = transformString(raw.healthcheck.test.trim());
      } else if (Array.isArray(raw.healthcheck.test)) {
        const arr = raw.healthcheck.test.map((x: any) => String(x));
        if (arr[0] === "CMD-SHELL" || arr[0] === "CMD") {
          testStr = transformString(arr.slice(1).join(" ").trim());
        } else if (arr[0] === "NONE") {
          testStr = "";
        } else {
          testStr = transformString(arr.join(" ").trim());
        }
      }

      if (testStr) {
        const hcObj: Record<string, any> = { test: testStr };
        if (typeof raw.healthcheck.interval === "string") hcObj.interval = raw.healthcheck.interval;
        if (typeof raw.healthcheck.timeout === "string") hcObj.timeout = raw.healthcheck.timeout;
        if (typeof raw.healthcheck.retries === "number") hcObj.retries = raw.healthcheck.retries;
        if (typeof raw.healthcheck.start_period === "string") hcObj.startPeriod = raw.healthcheck.start_period;
        if (typeof raw.healthcheck.start_interval === "string") hcObj.startInterval = raw.healthcheck.start_interval;
        svc.healthCheck = hcObj;
      }
    }

    // DependsOn
    if (Array.isArray(raw.depends_on)) {
      const mappedDeps = raw.depends_on
        .map((d: any) => serviceRenameMap[String(d)])
        .filter((d: string | undefined): d is string => Boolean(d) && d !== finalName);
      if (mappedDeps.length > 0) {
        svc.dependsOn = Array.from(new Set(mappedDeps));
      }
    } else if (raw.depends_on && typeof raw.depends_on === "object") {
      const depMap: Record<string, { condition: "service_healthy" | "service_started" | "service_completed_successfully" }> = {};
      for (const [depOrig, depCfg] of Object.entries(raw.depends_on)) {
        const mappedDep = serviceRenameMap[depOrig];
        if (!mappedDep || mappedDep === finalName) continue;
        let cond: "service_healthy" | "service_started" | "service_completed_successfully" = "service_started";
        const rawCond = (depCfg as any)?.condition;
        if (
          rawCond === "service_healthy" ||
          rawCond === "service_started" ||
          rawCond === "service_completed_successfully"
        ) {
          cond = rawCond;
        }
        if (cond === "service_healthy" && !servicesWithHealthcheck.has(mappedDep)) {
          cond = "service_started";
        }
        depMap[mappedDep] = { condition: cond };
      }
      if (Object.keys(depMap).length > 0) {
        svc.dependsOn = depMap;
      }
    }

    // Capabilities, security_opt, devices, extra_hosts, dns
    if (Array.isArray(raw.cap_add) && raw.cap_add.length > 0) {
      svc.capAdd = raw.cap_add.map((c: any) => String(c));
    }
    if (Array.isArray(raw.cap_drop) && raw.cap_drop.length > 0) {
      svc.capDrop = raw.cap_drop.map((c: any) => String(c));
    }
    if (Array.isArray(raw.security_opt) && raw.security_opt.length > 0) {
      svc.securityOpt = raw.security_opt.map((s: any) => String(s));
    }
    if (Array.isArray(raw.devices) && raw.devices.length > 0) {
      svc.devices = raw.devices.map((d: any) => transformString(String(d)));
    }
    if (Array.isArray(raw.extra_hosts) && raw.extra_hosts.length > 0) {
      svc.extraHosts = raw.extra_hosts.map((h: any) => transformString(String(h)));
    }
    if (typeof raw.dns === "string" && raw.dns.trim()) {
      svc.dns = raw.dns.trim();
    } else if (Array.isArray(raw.dns) && raw.dns.length > 0) {
      svc.dns = raw.dns.map((d: any) => String(d));
    }

    // Sysctls (must be numeric values in Runtipi schema)
    if (raw.sysctls && typeof raw.sysctls === "object" && !Array.isArray(raw.sysctls)) {
      const sysctlsObj: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw.sysctls)) {
        const num = Number(v);
        if (Number.isFinite(num)) {
          sysctlsObj[k] = num;
        }
      }
      if (Object.keys(sysctlsObj).length > 0) {
        svc.sysctls = sysctlsObj;
      }
    } else if (Array.isArray(raw.sysctls)) {
      const sysctlsObj: Record<string, number> = {};
      for (const item of raw.sysctls) {
        const [k, v] = String(item).split("=");
        const num = Number(v);
        if (k && Number.isFinite(num)) {
          sysctlsObj[k.trim()] = num;
        }
      }
      if (Object.keys(sysctlsObj).length > 0) {
        svc.sysctls = sysctlsObj;
      }
    }

    transpiledServices.push(svc);
  }

  // Ensure main service is first in services list
  transpiledServices.sort((a, b) => (a.isMain ? -1 : b.isMain ? 1 : 0));

  // If usesExternalContract became true during string scanning, mark main service addToMainNetwork: true
  if (usesExternalContract && transpiledServices[0]) {
    transpiledServices[0].addToMainNetwork = true;
  }

  const composeJson = {
    schemaVersion: 2,
    services: transpiledServices,
  };

  // Validate with @runtipi/common parseComposeJson and convert to YAML
  parseComposeJson(composeJson);
  const composeYamlObj = convertLegacyToYaml(composeJson) as Record<string, any>;
  composeYamlObj["x-runtipi"] = {
    ...(composeYamlObj["x-runtipi"] || {}),
    schema_version: 2,
  };

  return {
    composeJson,
    composeYamlObj,
    formFields,
    mainImageTag,
    serviceRenameMap,
    uid: detectedUid,
    gid: detectedGid,
  };
}
