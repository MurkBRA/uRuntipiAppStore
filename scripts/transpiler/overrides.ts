import type { FormField } from "@runtipi/common/schemas";

export interface AppOverride {
  /** Optional modifications to form fields */
  modifyFormFields?: (fields: FormField[]) => FormField[];
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
      if (serviceName === "wanderer-db" && service.healthCheck) {
        service.healthCheck = undefined;
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
};
