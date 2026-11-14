import type { FormFieldInput } from "./contracts.ts";

export interface AppOverride {
  /** Optional modifications to form fields */
  modifyFormFields?: (fields: FormFieldInput[]) => FormFieldInput[];
  /** Optional service modifications during transpilation */
  modifyService?: (serviceName: string, service: Record<string, any>, origKey: string) => void;
  /** Optional compose-level modifications */
  postProcessCompose?: (compose: Record<string, any>) => void;
  /** Static environment defaults for variables */
  staticEnvOverrides?: Record<string, string>;
}

export const APP_OVERRIDES: Record<string, AppOverride> = {
  wanderer: {
    modifyService: (serviceName, service) => {
      // wanderer-db uses flomp/wanderer-db which lacks curl (/curl: not found)
      if (serviceName === "wanderer-db") {
        Reflect.deleteProperty(service, "healthCheck");
      }
      // wanderer web depends on wanderer-db
      if (serviceName === "wanderer" && service.dependsOn?.["wanderer-db"]) {
        service.dependsOn["wanderer-db"] = { condition: "service_started" };
      }
    },
  },
  peerswap: {
    modifyFormFields: (fields) => {
      return fields.map((f) => {
        if (f.env_variable === "ELEMENTS_DATA_DIR") {
          return {
            type: "text",
            label: f.label || "Peerswap elements data dir",
            required: false,
            default: "/data/elements",
            env_variable: "ELEMENTS_DATA_DIR",
          };
        }
        return f;
      });
    },
  },
  adventurelog: {
    modifyService: (serviceName, service, origKey) => {
      if (origKey === "db" || serviceName === "adventurelog-db") {
        service.healthCheck = {
          test: "pg_isready -U adventure -d database",
          interval: "5s",
          timeout: "5s",
          retries: 10,
          startPeriod: "10s",
        };
      }
    },
  },
  gitlab: {
    modifyService: (serviceName, service) => {
      if (serviceName === "gitlab") {
        service.hostname = "gitlab";
      }
    },
  },
  wger: {
    modifyService: (serviceName, service) => {
      if (serviceName === "wger-celery_beat" && Array.isArray(service.volumes)) {
        for (const vol of service.volumes) {
          if (
            typeof vol.containerPath === "string" &&
            (vol.containerPath.includes("${APP_DATA_DIR}") || vol.containerPath === "/beat/")
          ) {
            vol.containerPath = "/beat";
          }
        }
      }
      if (serviceName === "wger-celery_worker" || serviceName === "wger-celery_beat") {
        service.environment = [
          ...(service.environment || []),
          { key: "DJANGO_DB_HOST", value: "wger-db" },
          { key: "DJANGO_DB_PORT", value: "5432" },
          { key: "DJANGO_DB_DATABASE", value: "wger" },
          { key: "DJANGO_DB_USER", value: "wger" },
          { key: "DJANGO_DB_PASSWORD", value: "wger" },
          { key: "CELERY_BROKER", value: "redis://wger-cache:6379/2" },
          { key: "CELERY_BACKEND", value: "redis://wger-cache:6379/2" },
          { key: "DJANGO_CACHE_LOCATION", value: "redis://wger-cache:6379/1" },
        ];
        Reflect.deleteProperty(service, "healthCheck");
      }
      if (serviceName === "wger-celery_beat" && service.dependsOn?.["wger-celery_worker"]) {
        service.dependsOn["wger-celery_worker"] = { condition: "service_started" };
      }
    },
    modifyFormFields: (fields) => {
      // Remove any spurious ips_with_port text field
      return fields.filter((f) => f.env_variable !== "ips_with_port");
    },
  },
  "blockstream-blind-oracle": {
    modifyFormFields: (fields) => {
      return fields.map((f) => {
        if (f.env_variable === "APP_TAILSCALE_URL") {
          return {
            type: "text",
            label: f.label || "Blockstream Blind Oracle tailscale url",
            required: false,
            default: "",
            env_variable: "APP_TAILSCALE_URL",
          };
        }
        return f;
      });
    },
  },
  "bitcoin-knots": {
    modifyFormFields: (fields) => {
      return fields.map((f) => {
        if (f.env_variable === "APP_BITCOIN_KNOTS_RPC_USER") {
          return {
            type: "text",
            label: f.label || "Bitcoin Knots RPC user",
            required: false,
            default: "umbrel",
            env_variable: "APP_BITCOIN_KNOTS_RPC_USER",
          };
        }
        if (f.env_variable === "APP_BITCOIN_KNOTS_RPC_PASS") {
          return {
            type: "random",
            label: f.label || "Bitcoin Knots RPC password",
            min: 32,
            env_variable: "APP_BITCOIN_KNOTS_RPC_PASS",
          };
        }
        return f;
      });
    },
  },
  frigate: {
    modifyService: (serviceName, service) => {
      if (serviceName === "frigate") {
        service.shmSize = "256mb";
      }
    },
  },
  hermitstash: {
    modifyService: (serviceName, service) => {
      if (serviceName === "hermitstash" && Array.isArray(service.environment)) {
        for (const entry of service.environment) {
          if (entry.key === "TRUST_PROXY" && entry.value === "10.21.0.0/16") {
            entry.value = "172.16.0.0/12";
          }
        }
      }
    },
  },
  albyhub: {
    modifyFormFields: (fields) => {
      return fields.map((f) => {
        if (f.env_variable === "APP_ALBYHUB_LND_ADDRESS") {
          return {
            ...f,
            type: "text",
            required: false,
            default: "lightning:10009",
            hint: "gRPC host:port when using an LND backend (e.g. lightning:10009)",
          };
        }
        if (f.env_variable === "APP_ALBYHUB_LND_CERT_FILE") {
          return {
            ...f,
            type: "text",
            required: false,
            default: "/lnd/tls.cert",
          };
        }
        if (f.env_variable === "APP_ALBYHUB_LND_MACAROON_FILE") {
          return {
            ...f,
            type: "text",
            required: false,
            default: "/lnd/data/chain/bitcoin/mainnet/admin.macaroon",
          };
        }
        return f;
      });
    },
  },
  lightning: {
    staticEnvOverrides: {
      APP_LIGHTNING_COMMAND:
        "--configfile=/data/.lnd/umbrel-lnd.conf --listen=0.0.0.0:9735 --rpclisten=0.0.0.0:10009 --restlisten=0.0.0.0:8080 --bitcoin.active --bitcoin.${APP_BITCOIN_NETWORK} --bitcoin.node=bitcoind --bitcoind.rpchost=${APP_BITCOIN_NODE_IP}:${APP_BITCOIN_RPC_PORT} --bitcoind.rpcuser=${APP_BITCOIN_RPC_USER} --bitcoind.rpcpass=${APP_BITCOIN_RPC_PASS} --bitcoind.zmqpubrawblock=tcp://${APP_BITCOIN_NODE_IP}:${APP_BITCOIN_ZMQ_RAWBLOCK_PORT} --bitcoind.zmqpubrawtx=tcp://${APP_BITCOIN_NODE_IP}:${APP_BITCOIN_ZMQ_RAWTX_PORT}",
    },
    modifyFormFields: (fields) => fields.filter((f) => f.env_variable !== "APP_LIGHTNING_COMMAND"),
  },
  lndg: {
    modifyFormFields: (fields) => {
      return fields.map((f) => {
        if (f.env_variable === "APP_LNDG_CSRF_TRUSTED_ORIGINS") {
          return {
            type: "text",
            label: f.label || "LNDg CSRF trusted origins",
            hint: "Optional comma-and-quote separated trusted origins override (leave empty for Runtipi defaults).",
            required: false,
            default: "",
            env_variable: "APP_LNDG_CSRF_TRUSTED_ORIGINS",
          };
        }
        return f;
      });
    },
    modifyService: (serviceName, service) => {
      if (serviceName === "lndg" && Array.isArray(service.environment)) {
        const entry = service.environment.find((e: any) => e.key === "LNDG_CSRF_TRUSTED_ORIGINS");
        if (entry) {
          entry.value =
            "${APP_LNDG_CSRF_TRUSTED_ORIGINS:-https://${APP_DOMAIN}','http://${APP_DOMAIN}','http://${LOCAL_DOMAIN}:${APP_PORT}','https://${LOCAL_DOMAIN}:${APP_PORT}','http://${INTERNAL_IP}:${APP_PORT}}";
        }
      }
    },
  },
};
