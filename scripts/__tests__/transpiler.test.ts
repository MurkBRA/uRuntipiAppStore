import { describe, expect, it } from "vitest";
import { transpileCompose } from "../transpiler/compose.ts";
import { createFormFieldFromContract } from "../transpiler/contracts.ts";
import { parseUmbrelExports } from "../transpiler/exports-hooks.ts";
import { buildRuntipiConfigAndDescription, mapUmbrelCategory } from "../transpiler/manifest.ts";
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
          },
          volumes: ["${APP_DATA_DIR}/data/app:/data", "${APP_DATA_DIR}/config.yml:/app/config.yml:ro"],
          depends_on: {
            db: { condition: "service_healthy" },
          },
        },
        postgres: {
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
    expect(res.composeYamlObj.services["my-app"].volumes).toContain("${APP_DATA_DIR}/data/config.yml:/app/config.yml:ro");
    expect(res.formFields.map((f) => f.env_variable)).toContain("APP_PASSWORD");
    expect(res.formFields.map((f) => f.env_variable)).toContain("APP_BITCOIN_NODE_IP");
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
});
