import type { FormField } from "@runtipi/common/schemas";

export interface ContractVariableSpec {
  type: "text" | "password" | "number" | "random";
  label: string;
  default?: string | number | boolean;
  hint?: string;
  min?: number;
  max?: number;
  encoding?: "hex" | "base64";
}

/**
 * Dictionary of external Umbrel contract/platform variables that may be referenced
 * by apps in docker-compose.yml or templates without being defined in the app's own exports.sh.
 * Each entry becomes a form_field in config.json (or is resolved directly).
 */
export const UMBREL_EXTERNAL_CONTRACT_VARS: Record<string, ContractVariableSpec> = {
  // Bitcoin Core / Node contract
  APP_BITCOIN_NETWORK: {
    type: "text",
    label: "Bitcoin Network",
    default: "mainnet",
    hint: "Network mode for Bitcoin node (mainnet, testnet, signet, regtest)",
  },
  APP_BITCOIN_NETWORK_ELECTRS: {
    type: "text",
    label: "Bitcoin Network (Electrs format)",
    default: "bitcoin",
    hint: "Electrs network identifier (bitcoin, testnet, signet, regtest)",
  },
  APP_BITCOIN_NODE_IP: {
    type: "text",
    label: "Bitcoin Node Host / IP",
    default: "bitcoind",
    hint: "Hostname or IP of your Bitcoin RPC node on the Runtipi network",
  },
  APP_BITCOIN_RPC_PORT: {
    type: "number",
    label: "Bitcoin RPC Port",
    default: 8332,
  },
  APP_BITCOIN_P2P_PORT: {
    type: "number",
    label: "Bitcoin P2P Port",
    default: 8333,
  },
  APP_BITCOIN_RPC_USER: {
    type: "text",
    label: "Bitcoin RPC Username",
    default: "umbrel",
  },
  APP_BITCOIN_RPC_PASS: {
    type: "password",
    label: "Bitcoin RPC Password",
    default: "moneyprintergobrrr",
  },
  APP_BITCOIN_RPC_AUTH: {
    type: "text",
    label: "Bitcoin RPC Auth Line (rpcauth)",
    default: "umbrel:ab803582c122e9ab25dece2fb5aa83f5$b1fd6770a6dc64ca33ce25f45f64cb2cfda0be03e0698fc8e858388205fb1dd8",
  },
  APP_BITCOIN_ZMQ_RAWBLOCK_PORT: {
    type: "number",
    label: "Bitcoin ZMQ Rawblock Port",
    default: 28332,
  },
  APP_BITCOIN_ZMQ_RAWTX_PORT: {
    type: "number",
    label: "Bitcoin ZMQ Rawtx Port",
    default: 28333,
  },
  APP_BITCOIN_ZMQ_HASHBLOCK_PORT: {
    type: "number",
    label: "Bitcoin ZMQ Hashblock Port",
    default: 28334,
  },
  APP_BITCOIN_ZMQ_SEQUENCE_PORT: {
    type: "number",
    label: "Bitcoin ZMQ Sequence Port",
    default: 28335,
  },
  APP_BITCOIN_DATA_DIR: {
    type: "text",
    label: "Bitcoin Data Directory Path",
    default: "/data/bitcoin",
  },

  // Lightning (LND) contract
  APP_LIGHTNING_NODE_IP: {
    type: "text",
    label: "Lightning (LND) Node Host / IP",
    default: "lightning",
  },
  APP_LIGHTNING_NODE_GRPC_PORT: {
    type: "number",
    label: "Lightning (LND) gRPC Port",
    default: 10009,
  },
  APP_LIGHTNING_NODE_REST_PORT: {
    type: "number",
    label: "Lightning (LND) REST Port",
    default: 8080,
  },
  APP_LIGHTNING_NODE_DATA_DIR: {
    type: "text",
    label: "Lightning (LND) Data Directory",
    default: "/data/lnd",
  },
  LND_IP: {
    type: "text",
    label: "LND Host / IP",
    default: "lightning",
  },
  LND_REST_PORT: {
    type: "number",
    label: "LND REST Port",
    default: 8080,
  },

  // Core Lightning contract
  APP_CORE_LIGHTNING_DAEMON_IP: {
    type: "text",
    label: "Core Lightning Daemon Host / IP",
    default: "core-lightning",
  },
  CORE_LIGHTNING_REST_PORT: {
    type: "number",
    label: "Core Lightning REST Port",
    default: 3010,
  },
  APP_CORE_LIGHTNING_DATA_DIR: {
    type: "text",
    label: "Core Lightning Data Directory",
    default: "/data/core-lightning",
  },

  // Electrs / Fulcrum / Elements / Mempool contracts
  APP_ELECTRS_NODE_IP: {
    type: "text",
    label: "Electrs Server Host / IP",
    default: "electrs",
  },
  APP_ELECTRS_NODE_PORT: {
    type: "number",
    label: "Electrs Server Port",
    default: 50001,
  },
  APP_FULCRUM_NODE_IP: {
    type: "text",
    label: "Fulcrum Server Host / IP",
    default: "fulcrum",
  },
  APP_ELEMENTS_NODE_RPC_PORT: {
    type: "number",
    label: "Elements Core RPC Port",
    default: 7041,
  },
  APP_MEMPOOL_IP: {
    type: "text",
    label: "Mempool Host / IP",
    default: "mempool",
  },
  APP_MEMPOOL_PORT: {
    type: "number",
    label: "Mempool HTTP Port",
    default: 3006,
  },
  APP_MEMPOOL_HIDDEN_SERVICE: {
    type: "text",
    label: "Mempool Hostname / Onion Address",
    default: "mempool.local",
  },
  APP_NEXTCLOUD_PORT: {
    type: "number",
    label: "Nextcloud Port",
    default: 8080,
  },

  // Optional Tor Proxy variables (for users with an external Tor SOCKS proxy)
  TOR_PROXY_IP: {
    type: "text",
    label: "Tor SOCKS Proxy Host / IP (Optional)",
    default: "127.0.0.1",
  },
  TOR_PROXY_PORT: {
    type: "number",
    label: "Tor SOCKS Proxy Port (Optional)",
    default: 9050,
  },
  TOR_PASSWORD: {
    type: "random",
    label: "Tor Control Password",
    min: 32,
  },

  // App-specific external variables found during full-repo audit
  POSTGRES_DB: {
    type: "text",
    label: "PostgreSQL Database Name",
    default: "appdb",
  },
  POSTGRES_USER: {
    type: "text",
    label: "PostgreSQL Username",
    default: "tipi",
  },
  VAPID_PUBLIC_KEY: {
    type: "text",
    label: "VAPID Public Key (Optional)",
    default: "none",
  },
  VAPID_PRIVATE_KEY: {
    type: "text",
    label: "VAPID Private Key (Optional)",
    default: "none",
  },
  SENTRY_DSN: {
    type: "text",
    label: "Sentry DSN (Optional)",
    default: "https://examplePublicKey@o0.ingest.sentry.io/0",
  },
  GATEWAY_IP: {
    type: "text",
    label: "Home Gateway IP",
    default: "192.168.1.1",
  },
  BITCOIN_INITIALIZE_WITH_CLEARNET_OVER_TOR: {
    type: "text",
    label: "Initialize Bitcoin with Clearnet over Tor",
    default: "true",
  },
  LNDG_CSRF_TRUSTED_ORIGINS: {
    type: "text",
    label: "LNDg CSRF Trusted Origins",
    default: "http://localhost",
  },
  MONETR_ALLOW_SIGN_UP: {
    type: "text",
    label: "Allow User Sign Up",
    default: "true",
  },
  MONETR_PROOF_OF_WORK_ENABLED: {
    type: "text",
    label: "Enable Proof of Work on Sign Up",
    default: "false",
  },
  MONETR_STORAGE_ENABLED: {
    type: "text",
    label: "Enable File Storage",
    default: "true",
  },
  MONETR_STORAGE_PROVIDER: {
    type: "text",
    label: "Storage Provider",
    default: "filesystem",
  },
  STORAGE_MAX: {
    type: "text",
    label: "Maximum Storage Size",
    default: "10G",
  },
  POZNOTE_DEBUG: {
    type: "text",
    label: "Enable Debug Mode",
    default: "false",
  },
  PGDATA: {
    type: "text",
    label: "PostgreSQL Data Subdirectory",
    default: "/var/lib/postgresql/data/pgdata",
  },
  OTBR_REST_PORT: {
    type: "number",
    label: "OpenThread Border Router REST Port",
    default: 8081,
  },
  DEVICE: {
    type: "text",
    label: "Serial Radio Device Path",
    default: "/dev/ttyACM0",
  },
  BACKBONE_IF: {
    type: "text",
    label: "Backbone Network Interface",
    default: "eth0",
  },
};

export function createFormFieldFromContract(envVar: string): FormField | null {
  const spec = UMBREL_EXTERNAL_CONTRACT_VARS[envVar];
  if (!spec) return null;

  if (spec.type === "random") {
    return {
      type: "random",
      label: spec.label,
      min: spec.min ?? 32,
      ...(spec.encoding ? { encoding: spec.encoding } : {}),
      env_variable: envVar,
    };
  }

  return {
    type: spec.type,
    label: spec.label,
    required: false,
    ...(spec.default !== undefined ? { default: spec.default } : {}),
    ...(spec.hint ? { hint: spec.hint } : {}),
    env_variable: envVar,
  };
}
