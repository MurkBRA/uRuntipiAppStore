import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { quarantineFailures } from "../quarantine-failures.ts";
import { applySharding, buildAppEnv, getChangedApps, parseCliArgs } from "../smoke-test.ts";
import { generateReadme } from "../sync-umbrel.ts";

describe("Automation Scripts Unit & Regression Tests", () => {
  it("parseCliArgs parses flags including --help, --prune, --changed, and --shard", () => {
    const cli = parseCliArgs([
      "node",
      "smoke-test.ts",
      "--changed",
      "--base=origin/main",
      "--prune",
      "--shard=2/10",
      "--wait=15",
      "--max-up=5",
      "--help",
    ]);

    expect(cli.changed).toBe(true);
    expect(cli.baseRef).toBe("origin/main");
    expect(cli.prune).toBe(true);
    expect(cli.shard).toBe("2/10");
    expect(cli.waitSec).toBe(15);
    expect(cli.maxUp).toBe(5);
    expect(cli.help).toBe(true);
  });

  it("applySharding distributes apps across all requested shards without duplicates or drops", () => {
    const apps = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
    const sharded = [
      ...applySharding(apps, "1/3"),
      ...applySharding(apps, "2/3"),
      ...applySharding(apps, "3/3"),
    ].sort();
    expect(sharded).toEqual([...apps].sort());
  });

  it("buildAppEnv pre-creates host directories/files for both ${APP_DATA_DIR} and $APP_DATA_DIR", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uruntipi-smoke-env-"));
    const tmpDataBase = path.join(tmpRoot, "smoke-data");
    try {
      const appDir = path.join(tmpRoot, "apps", "sample-app");
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, "config.json"),
        JSON.stringify({ id: "sample-app", port: 8123, form_fields: [] }),
        "utf8",
      );
      fs.writeFileSync(
        path.join(appDir, "docker-compose.yml"),
        [
          "services:",
          "  sample-app:",
          "    image: alpine:latest",
          "    volumes:",
          "      - ${APP_DATA_DIR}/data/db:/db",
          "      - $APP_DATA_DIR/data/config.yml:/etc/app/config.yml",
        ].join("\n"),
        "utf8",
      );

      const env = buildAppEnv("sample-app", { rootDir: tmpRoot, dataBaseDir: tmpDataBase });
      expect(env.APP_PORT).toBe("8123");
      expect(fs.existsSync(path.join(env.APP_DATA_DIR, "data", "db"))).toBe(true);
      expect(fs.statSync(path.join(env.APP_DATA_DIR, "data", "db")).isDirectory()).toBe(true);
      expect(fs.existsSync(path.join(env.APP_DATA_DIR, "data", "config.yml"))).toBe(true);
      expect(fs.statSync(path.join(env.APP_DATA_DIR, "data", "config.yml")).isFile()).toBe(true);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("quarantineFailures reverts modified tracked apps, cleans new extra files, deletes unverified new apps, updates README.md, and restores sync-state.json", () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "uruntipi-quarantine-"));
    try {
      const git = (args: string[]) => execFileSync("git", args, { cwd: tmpRepo, encoding: "utf8" });

      git(["init"]);
      git(["config", "core.autocrlf", "false"]);
      git(["config", "user.email", "test@example.com"]);
      git(["config", "user.name", "Test"]);

      // Seed initial committed state with 1 healthy app "good-app"
      const goodAppDir = path.join(tmpRepo, "apps", "good-app");
      fs.mkdirSync(goodAppDir, { recursive: true });
      fs.writeFileSync(
        path.join(goodAppDir, "config.json"),
        JSON.stringify({ id: "good-app", name: "Good App", version: "1.0.0", port: 8001, categories: ["utilities"] }),
        "utf8",
      );
      fs.writeFileSync(path.join(goodAppDir, "docker-compose.yml"), "services:\n  good-app:\n    image: alpine:1\n");

      const stateDir = path.join(tmpRepo, "state");
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(
        path.join(stateDir, "sync-state.json"),
        JSON.stringify({
          last_synced_at: "2026-01-01T00:00:00.000Z",
          apps: {
            "good-app": {
              tipi_version: 1,
              version: "1.0.0",
              port: 8001,
              created_at: 1000,
              updated_at: 2000,
              upstream_hash: "h1",
            },
          },
        }),
        "utf8",
      );
      generateReadme({ rootDir: tmpRepo, skippedBlacklistCount: 10 });

      git(["add", "."]);
      git(["commit", "-m", "initial"]);

      // Simulate broken sync:
      // 1) modifies good-app + leaves an extra untracked file inside apps/good-app/data/bad.conf
      fs.writeFileSync(
        path.join(goodAppDir, "config.json"),
        JSON.stringify({ id: "good-app", name: "Good App", version: "2.0.0", port: 8001, categories: ["utilities"] }),
        "utf8",
      );
      fs.mkdirSync(path.join(goodAppDir, "data"), { recursive: true });
      fs.writeFileSync(path.join(goodAppDir, "data", "bad.conf"), "broken", "utf8");

      // 2) adds a broken brand-new app "bad-new-app"
      const badNewDir = path.join(tmpRepo, "apps", "bad-new-app");
      fs.mkdirSync(badNewDir, { recursive: true });
      fs.writeFileSync(
        path.join(badNewDir, "config.json"),
        JSON.stringify({ id: "bad-new-app", name: "Bad New App", version: "1.0.0", port: 8002, categories: ["ai"] }),
        "utf8",
      );
      fs.writeFileSync(
        path.join(badNewDir, "docker-compose.yml"),
        "services:\n  bad-new-app:\n    image: alpine:bad\n",
      );

      // Confirm getChangedApps sees BOTH modified & untracked apps (-uall)
      expect(getChangedApps(undefined, tmpRepo)).toEqual(["bad-new-app", "good-app"]);

      // Update sync-state.json & README.md as sync would before smoke tests
      fs.writeFileSync(
        path.join(stateDir, "sync-state.json"),
        JSON.stringify({
          last_synced_at: "2026-01-02T00:00:00.000Z",
          apps: {
            "good-app": {
              tipi_version: 2,
              version: "2.0.0",
              port: 8001,
              created_at: 1000,
              updated_at: 3000,
              upstream_hash: "h2",
            },
            "bad-new-app": {
              tipi_version: 1,
              version: "1.0.0",
              port: 8002,
              created_at: 3000,
              updated_at: 3000,
              upstream_hash: "h3",
            },
          },
        }),
        "utf8",
      );
      generateReadme({ rootDir: tmpRepo, skippedBlacklistCount: 10 });

      const failuresPath = path.join(stateDir, "failures.json");
      fs.writeFileSync(
        failuresPath,
        JSON.stringify([
          { appId: "good-app", status: "CRASHED", details: "Container exited" },
          { appId: "bad-new-app", status: "PULL_FAILED", details: "Not found" },
        ]),
        "utf8",
      );

      const count = quarantineFailures(failuresPath, { rootDir: tmpRepo, githubActions: false });
      expect(count).toBe(2);

      // Verifications
      expect(fs.existsSync(failuresPath)).toBe(false);
      expect(fs.existsSync(badNewDir)).toBe(false);
      expect(fs.existsSync(path.join(goodAppDir, "data", "bad.conf"))).toBe(false);

      const revertedGoodConfig = JSON.parse(fs.readFileSync(path.join(goodAppDir, "config.json"), "utf8"));
      expect(revertedGoodConfig.version).toBe("1.0.0");

      const restoredState = JSON.parse(fs.readFileSync(path.join(stateDir, "sync-state.json"), "utf8"));
      expect(Object.keys(restoredState.apps)).toEqual(["good-app"]);
      expect(restoredState.apps["good-app"].version).toBe("1.0.0");

      const readme = fs.readFileSync(path.join(tmpRepo, "README.md"), "utf8");
      expect(readme).toContain("Ported Active Apps**: **1**");
      expect(readme).toContain("Blacklisted Duplicates / Disabled Apps**: **10**");
      expect(readme).toContain("`good-app`");
      expect(readme).not.toContain("`bad-new-app`");
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });
});
