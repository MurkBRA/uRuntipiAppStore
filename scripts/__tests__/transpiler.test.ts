import { describe, expect, it } from "vitest";
import { isDatabaseImage, transpileCompose } from "../transpiler/compose.ts";
import { createFormFieldFromContract } from "../transpiler/contracts.ts";
import { parseUmbrelExports } from "../transpiler/exports-hooks.ts";
import {
  buildRuntipiConfigAndDescription,
  mapUmbrelCategory,
  replaceUmbrelProse,
  sanitizeUmbrelDescriptionText,
} from "../transpiler/manifest.ts";
import { PortAllocator } from "../transpiler/ports.ts";

describe("Transpiler Unit Tests", () => {
  it("PortAllocator avoids reserved Runtipi ports and maintains deterministic allocation", () => {
    const allocator = new PortAllocator([
      { port: 8015, runtipi_id: "archivebox" },
      { port: 3000, runtipi_id: "other" },
    ]);

    const port1 = allocator.allocatePort("adventurelog", 8015);
    expect(port1).not.toBe(8015);
    expect(port1).toBeGreaterThanOrEqual(18100);

    // Non-colliding port is preserved
    const port2 = allocator.allocatePort("agent-zero", 8910);
    expect(port2).toBe(8910);

    // Calling again for adventurelog returns the same allocated port
    expect(allocator.allocatePort("adventurelog", 8015)).toBe(port1);
  });

  it("parseUmbrelExports converts derive_entropy to random form_fields without required=true", () => {
    const exportsSh = `
export APP_SECRET_KEY=$(derive_entropy "\${app_entropy_identifier}-SECRET" | head -c32)
export STATIC_PORT="8080"
export DATA_SUBDIR="\${EXPORTS_APP_DATA_DIR}/storage"
`;
    const res = parseUmbrelExports(exportsSh, "SampleApp");
    expect(res.formFields).toHaveLength(1);
    expect(res.formFields[0]).toEqual({
      type: "random",
      label: "SampleApp secret key",
      min: 32,
      encoding: "hex",
      env_variable: "APP_SECRET_KEY",
    });
    expect((res.formFields[0] as any).required).toBeUndefined();
    expect(res.staticExports.STATIC_PORT).toBe("8080");
    expect(res.staticExports.DATA_SUBDIR).toBe("${APP_DATA_DIR}/data/storage");
  });

  it("mapUmbrelCategory maps all 10 Umbrel categories to valid Runtipi APP_CATEGORIES", () => {
    expect(mapUmbrelCategory("bitcoin")).toEqual(["finance"]);
    expect(mapUmbrelCategory("developer")).toEqual(["development"]);
    expect(mapUmbrelCategory("networking", "VPN service")).toEqual(["network", "security"]);
    expect(mapUmbrelCategory("files", "Ebook reader")).toEqual(["books", "utilities", "data"]);
  });

  it("transpileCompose removes app_proxy, strips @sha256, renames main service to appId, and rewrites DNS", () => {
    const umbrelCompose = {
      version: "3.7",
      services: {
        app_proxy: {
          environment: {
            APP_HOST: "my-app_web_1",
            APP_PORT: 3000,
          },
        },
        web: {
          user: "1000:1000",
          image: "ghcr.io/org/my-app:1.2.3@sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
          environment: {
            DB_HOST: "my-app_db_1",
            BACKEND_HOST: "postgres",
            DATABASE_URL: "postgres://user:pass@db:5432/mydb",
            POSTGRES_USER: "postgres",
            DB_TYPE: "postgres",
            PUBLIC_URL: "http://${DEVICE_DOMAIN_NAME}:8123",
            SECRET: "${APP_PASSWORD}",
            BITCOIN_HOST: "${APP_BITCOIN_NODE_IP}",
            CUSTOM_SERVER_URL: "http://mycustombackend:8000",
          },
          volumes: ["${APP_DATA_DIR}/data/app:/data", "${APP_DATA_DIR}/config.yml:/app/config.yml:ro"],
          depends_on: {
            db: { condition: "service_healthy" },
          },
        },
        postgres: {
          container_name: "mycustombackend",
          image: "postgres:16.2@sha256:2222222222222222222222222222222222222222222222222222222222222222",
        },
        db: {
          image: "postgres:16.2@sha256:1111111111111111111111111111111111111111111111111111111111111111",
          environment: ["POSTGRES_PASSWORD=secret"],
          healthcheck: {
            test: ["CMD-SHELL", "pg_isready -U postgres"],
            interval: "5s",
            timeout: "5s",
            retries: 5,
          },
        },
      },
    };

    const res = transpileCompose({
      appId: "my-app",
      appName: "My App",
      manifestPort: 8123,
      allocatedPort: 8123,
      umbrelCompose,
      staticExports: {},
      initialFormFields: [],
      hasDependencies: true,
    });

    expect(res.mainImageTag).toBe("1.2.3");
    expect(res.uid).toBe(1000);
    expect(res.gid).toBe(1000);
    expect(res.composeYamlObj.services.app_proxy).toBeUndefined();
    expect(res.composeYamlObj.services["my-app"]).toBeDefined();
    expect(res.composeYamlObj.services["my-app"].image).toBe("ghcr.io/org/my-app:1.2.3");
    expect(res.composeYamlObj.services["my-app"].user).toBe("${APP_CONTAINER_USER:-1000:1000}");
    expect(res.composeYamlObj.services["my-app"]["x-runtipi"]).toEqual({
      internal_port: 3000,
      is_main: true,
      add_to_main_network: true,
    });
    expect(res.composeYamlObj.services["my-app"].environment).toContain("DB_HOST=my-app-db");
    expect(res.composeYamlObj.services["my-app"].environment).toContain("BACKEND_HOST=my-app-postgres");
    expect(res.composeYamlObj.services["my-app"].environment).toContain(
      "DATABASE_URL=postgres://user:pass@my-app-db:5432/mydb",
    );
    expect(res.composeYamlObj.services["my-app"].environment).toContain("POSTGRES_USER=postgres");
    expect(res.composeYamlObj.services["my-app"].environment).toContain("DB_TYPE=postgres");
    expect(res.composeYamlObj.services["my-app"].environment).toContain(
      "PUBLIC_URL=${APP_PROTOCOL:-http}://${APP_DOMAIN}",
    );
    expect(res.composeYamlObj.services["my-app"].environment).toContain(
      "CUSTOM_SERVER_URL=http://my-app-postgres:8000",
    );
    expect(res.composeYamlObj.services["my-app"].volumes).toContain(
      "${APP_DATA_DIR}/data/config.yml:/app/config.yml:ro",
    );
    expect(res.formFields.map((f) => f.env_variable)).toContain("APP_PASSWORD");
    expect(res.formFields.map((f) => f.env_variable)).toContain("APP_BITCOIN_NODE_IP");
    expect(res.formFields.map((f) => f.env_variable)).toContain("APP_CONTAINER_USER");
  });

  it("buildRuntipiConfigAndDescription generates valid Runtipi config.json", () => {
    const contractField = createFormFieldFromContract("APP_BITCOIN_NODE_IP")!;
    const { config, descriptionMd } = buildRuntipiConfigAndDescription({
      appId: "my-app",
      umbrelManifest: {
        id: "my-app",
        name: "My App",
        version: "1.2.3",
        tagline: "Awesome self-hosted tool",
        description:
          "First paragraph available at umbrel.local:8877/web/ and API docs at http://umbrel.local:8877/docs.\n\nSecond paragraph.",
        category: "developer",
        port: 8877,
        developer: 42,
        website: "https://example.com",
        repo: "",
        defaultUsername: "umbrel@umbrel.local",
        defaultPassword: "changeme",
      },
      allocatedPort: 18877,
      mainImageTag: "v1.2.3",
      formFields: [contractField],
      tipiVersion: 1,
      createdAt: 1700000000000,
      updatedAt: 1700000005000,
      uid: 1000,
      gid: 1000,
    });

    expect(config.id).toBe("my-app");
    expect(config.version).toBe("1.2.3");
    expect(config.author).toBe("42");
    expect(config.source).toBe("https://example.com");
    expect(config.categories).toEqual(["development"]);
    expect(config.description).toContain("<IP-DO-SERVIDOR>:18877/web/");
    expect(config.description).toContain("http://<IP-DO-SERVIDOR>:18877/docs");
    expect(descriptionMd).toContain("Default Credentials");
    expect(descriptionMd).toContain("admin@tipi.local");
  });

  it("resolves custom container_name in URLs and host environment variables", () => {
    const umbrelCompose = {
      version: "3.7",
      services: {
        web: {
          image: "ghcr.io/org/frontend:1.0.0",
          environment: {
            PUBLIC_SERVER_URL: "http://custombackendserver1:8000",
            BACKEND_API: "https://custombackendserver1:8000/api/v1",
            DB_HOST: "custom-postgres-db",
          },
          depends_on: ["server", "db"],
        },
        server: {
          image: "ghcr.io/org/backend:1.0.0",
          container_name: "custombackendserver1",
          environment: {
            PGHOST: "custom-postgres-db",
            DATABASE_URL: "postgres://user:pass@custom-postgres-db:5432/app",
          },
          depends_on: ["db"],
        },
        db: {
          image: "postgres:16",
          container_name: "custom-postgres-db",
        },
      },
    };

    const res = transpileCompose({
      appId: "my-travel-app",
      appName: "My Travel App",
      manifestPort: 8080,
      allocatedPort: 18080,
      umbrelCompose,
      staticExports: {},
      initialFormFields: [],
      hasDependencies: false,
    });

    const webEnv = res.composeYamlObj.services["my-travel-app"].environment;
    expect(webEnv).toContain("PUBLIC_SERVER_URL=http://my-travel-app-server:8000");
    expect(webEnv).toContain("BACKEND_API=https://my-travel-app-server:8000/api/v1");
    expect(webEnv).toContain("DB_HOST=my-travel-app-db");

    const serverEnv = res.composeYamlObj.services["my-travel-app-server"].environment;
    expect(serverEnv).toContain("PGHOST=my-travel-app-db");
    expect(serverEnv).toContain("DATABASE_URL=postgres://user:pass@my-travel-app-db:5432/app");

    // Make sure container_name is not present on services in compose output
    expect(res.composeYamlObj.services["my-travel-app-server"].container_name).toBeUndefined();
    expect(res.composeYamlObj.services["my-travel-app-db"].container_name).toBeUndefined();

    // Verify composeJson as well
    const webJson = res.composeJson.services.find((s: any) => s.name === "my-travel-app");
    expect(webJson.environment).toContainEqual({
      key: "PUBLIC_SERVER_URL",
      value: "http://my-travel-app-server:8000",
    });
    expect(webJson.environment).toContainEqual({
      key: "DB_HOST",
      value: "my-travel-app-db",
    });
  });

  it("isDatabaseImage correctly identifies database images and excludes application images", () => {
    expect(isDatabaseImage("postgres:18.3-alpine")).toBe(true);
    expect(isDatabaseImage("ghcr.io/baosystems/postgis:15-3.5")).toBe(true);
    expect(isDatabaseImage("mariadb:11.8.2")).toBe(true);
    expect(isDatabaseImage("mysql:8.0")).toBe(true);
    expect(isDatabaseImage("mongo:4.4.6-bionic")).toBe(true);
    expect(isDatabaseImage("redis:8.0.3-alpine")).toBe(true);
    expect(isDatabaseImage("valkey/valkey:9")).toBe(true);

    expect(isDatabaseImage("johly/airtrail:v3.13.0")).toBe(false);
    expect(isDatabaseImage("node:18-alpine")).toBe(false);
    expect(isDatabaseImage("nginx:latest")).toBe(false);
  });

  it("transpileCompose strips user from database containers while preserving it on app containers", () => {
    const umbrelCompose = {
      version: "3.7",
      services: {
        app_proxy: {
          environment: {
            APP_HOST: "my-app_web_1",
            APP_PORT: "3000",
          },
        },
        web: {
          image: "johly/airtrail:v3.13.0",
          user: "1000:1000",
        },
        db: {
          image: "postgres:18.3-alpine",
          user: "1000:1000",
        },
      },
    };

    const res = transpileCompose({
      appId: "airtrail",
      appName: "AirTrail",
      manifestPort: 3000,
      allocatedPort: 3256,
      umbrelCompose,
      staticExports: {},
      initialFormFields: [],
      hasDependencies: false,
    });

    // Web service keeps user parametrized as APP_CONTAINER_USER
    expect(res.composeYamlObj.services.airtrail.user).toBe("${APP_CONTAINER_USER:-1000:1000}");
    const webJson = res.composeJson.services.find((s: any) => s.name === "airtrail");
    expect(webJson.user).toBe("${APP_CONTAINER_USER:-1000:1000}");

    // Database service MUST NOT have user
    expect(res.composeYamlObj.services["airtrail-db"].user).toBeUndefined();
    const dbJson = res.composeJson.services.find((s: any) => s.name === "airtrail-db");
    expect(dbJson.user).toBeUndefined();

    // Form field for container user is present because web service uses it
    expect(res.formFields.some((f) => f.env_variable === "APP_CONTAINER_USER")).toBe(true);
  });

  it("replaceUmbrelProse and sanitizeUmbrelDescriptionText replace umbrelOS and Umbrel with Runtipi while preserving URLs and code blocks", () => {
    const raw = `
⚠️ Watch out for port conflicts between your custom Docker containers and your umbrelOS apps.
Arcane on Umbrel is designed for advanced users who want complete control over their containers.
Be mindful of port conflicts between your containers, Umbrel's system services, and other installed apps.
- **Username**: \`umbrel\`
- **Website**: https://docs.bffless.app/deployment/umbrel/
Access at umbrel.local:8080.
`;
    const sanitized = sanitizeUmbrelDescriptionText(raw, 8080, 18080);
    expect(sanitized).toContain("your custom Docker containers and your Runtipi apps.");
    expect(sanitized).toContain("Arcane on Runtipi is designed for advanced users");
    expect(sanitized).toContain("between your containers, Runtipi's system services");
    expect(sanitized).toContain("- **Username**: `umbrel`");
    expect(sanitized).toContain("https://docs.bffless.app/deployment/umbrel/");
    expect(sanitized).toContain("Access at <IP-DO-SERVIDOR>:18080");
    expect(sanitized).not.toMatch(/\bumbrelOS\b/i);
    expect(sanitized).not.toMatch(/\bUmbrel\b/);
  });

  it("buildRuntipiConfigAndDescription respects explicit defaultPassword even when APP_PASSWORD exists", () => {
    const umbrelManifest = {
      id: "arcane",
      name: "Arcane",
      version: "2.17.0",
      description: "An easy and modern Docker management platform",
      defaultUsername: "arcane",
      defaultPassword: "arcane-admin",
    };

    const formFieldsWithPassword: any[] = [
      {
        type: "random",
        label: "Arcane password",
        min: 32,
        env_variable: "APP_PASSWORD",
      },
    ];

    const res = buildRuntipiConfigAndDescription({
      umbrelManifest,
      manifestPort: 3552,
      allocatedPort: 3552,
      formFields: formFieldsWithPassword,
    });

    expect(res.descriptionMd).toContain("- **Username**: `arcane`");
    expect(res.descriptionMd).toContain("- **Password**: `arcane-admin`");
    expect(res.descriptionMd).not.toContain("Generated automatically via the `APP_PASSWORD` field");
  });

  it("transpileCompose maps ENCRYPTION_KEY, SECRET_KEY and JWT_SECRET to dedicated random fields without creating APP_PASSWORD", () => {
    const umbrelCompose = {
      version: "3.7",
      services: {
        app: {
          image: "ghcr.io/sample/app:latest",
          environment: {
            ENCRYPTION_KEY: "${APP_PASSWORD}",
            SECRET_KEY: "${APP_PASSWORD}",
            JWT_SECRET_KEY: "${APP_PASSWORD}",
          },
        },
      },
    };

    const res = transpileCompose({
      appId: "sample",
      appName: "SampleApp",
      manifestPort: 8080,
      allocatedPort: 8080,
      umbrelCompose,
      staticExports: {},
      initialFormFields: [],
      hasDependencies: false,
    });

    expect(res.formFields.some((f) => f.env_variable === "APP_PASSWORD")).toBe(false);
    expect(res.formFields.some((f) => f.env_variable === "APP_ENCRYPTION_KEY" && f.label === "SampleApp encryption key")).toBe(true);
    expect(res.formFields.some((f) => f.env_variable === "APP_SECRET_KEY" && f.label === "SampleApp secret key")).toBe(true);
    expect(res.formFields.some((f) => f.env_variable === "APP_JWT_SECRET" && f.label === "SampleApp JWT secret")).toBe(true);

    const appSvc = res.composeJson.services.find((s: any) => s.name === "sample");
    const encEntry = appSvc.environment.find((e: any) => e.key === "ENCRYPTION_KEY");
    const secEntry = appSvc.environment.find((e: any) => e.key === "SECRET_KEY");
    const jwtEntry = appSvc.environment.find((e: any) => e.key === "JWT_SECRET_KEY");

    expect(encEntry.value).toBe("${APP_ENCRYPTION_KEY:-${APP_PASSWORD}}");
    expect(secEntry.value).toBe("${APP_SECRET_KEY:-${APP_PASSWORD}}");
    expect(jwtEntry.value).toBe("${APP_JWT_SECRET:-${APP_PASSWORD}}");
  });

  it("transpileCompose preserves upstream service names configured in PRESERVED_UPSTREAM_SERVICE_NAMES", () => {
    const umbrelCompose = {
      version: "3.7",
      services: {
        app_proxy: {
          environment: {
            APP_HOST: "bffless_nginx_1",
            APP_PORT: 5537,
          },
        },
        nginx: {
          image: "ghcr.io/bffless/ce-nginx:umbrel",
          depends_on: ["backend", "frontend"],
        },
        backend: {
          image: "ghcr.io/bffless/ce-backend:umbrel",
          environment: {
            BACKEND_HOST: "backend",
          },
        },
        frontend: {
          image: "ghcr.io/bffless/ce-frontend:umbrel",
          depends_on: ["backend"],
        },
      },
    };

    const res = transpileCompose({
      appId: "bffless",
      appName: "BFFless",
      manifestPort: 5537,
      allocatedPort: 5537,
      umbrelCompose,
      staticExports: {},
      initialFormFields: [],
      hasDependencies: false,
    });

    expect(res.composeYamlObj.services.backend).toBeDefined();
    expect(res.composeYamlObj.services.frontend).toBeDefined();
    expect(res.composeYamlObj.services["bffless-backend"]).toBeUndefined();
    expect(res.composeYamlObj.services.bffless.depends_on).toContain("backend");
    expect(res.composeYamlObj.services.bffless.depends_on).toContain("frontend");
  });
});
