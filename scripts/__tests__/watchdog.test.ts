import { describe, expect, it } from "vitest";
import {
  type FetchLike,
  type WatchdogOptions,
  type WorkflowJobSummary,
  type WorkflowRunSummary,
  evaluateSyncRetry,
  evaluateWorkflowRuns,
  formatWatchdogSummaryMarkdown,
  parseWatchdogCliArgs,
  runWatchdog,
} from "../watchdog-runs.ts";

const NOW = Date.parse("2026-11-20T23:00:00Z");

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function makeOptions(overrides: Partial<WatchdogOptions> = {}): WatchdogOptions {
  return {
    repository: "MurkBRA/uRuntipiAppStore",
    token: "test-token",
    currentRunId: 999_999,
    maxQueuedMinutes: 45,
    forceCancelAfterMinutes: 90,
    maxInProgressMinutes: 180,
    watchdogMaxMinutes: 25,
    retrySync: true,
    syncWorkflowPath: ".github/workflows/sync-umbrel.yml",
    syncBranch: "main",
    maxSyncRetriesPer12h: 2,
    dryRun: false,
    cancelVerifyDelayMs: 0,
    postCancelRetryDelayMs: 0,
    requestTimeoutMs: 5_000,
    apiBaseUrl: "https://api.github.com",
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Workflow Watchdog", () => {
  it("flags an orphaned queued run (8h without runner) for cancellation with force-cancel escalation", () => {
    const stuckRun: WorkflowRunSummary = {
      id: 44758498630,
      name: "Sync Umbrel App Store",
      path: ".github/workflows/sync-umbrel.yml",
      status: "queued",
      conclusion: null,
      event: "schedule",
      head_branch: "main",
      created_at: isoMinutesAgo(485),
    };
    const jobs = new Map<number, WorkflowJobSummary[]>([
      [
        stuckRun.id,
        [
          {
            id: 136364482349,
            name: "Prepare & Transpile Store",
            status: "queued",
            conclusion: null,
            runner_id: null,
            created_at: isoMinutesAgo(485),
          },
        ],
      ],
    ]);

    const results = evaluateWorkflowRuns([stuckRun], jobs, makeOptions(), NOW);
    expect(results).toHaveLength(1);
    expect(results[0].decision).toBe("CANCEL");
    expect(results[0].preferForceCancel).toBe(true);
    expect(results[0].reason).toContain("stuck-queued");
  });

  it("keeps a queued run that is legitimately waiting behind a healthy in_progress run of the same workflow", () => {
    const activeRun: WorkflowRunSummary = {
      id: 1001,
      name: "Sync Umbrel App Store",
      path: ".github/workflows/sync-umbrel.yml",
      status: "in_progress",
      conclusion: null,
      event: "schedule",
      head_branch: "main",
      created_at: isoMinutesAgo(60),
      run_started_at: isoMinutesAgo(58),
    };
    const queuedBehind: WorkflowRunSummary = {
      id: 1002,
      name: "Sync Umbrel App Store",
      path: ".github/workflows/sync-umbrel.yml",
      status: "queued",
      conclusion: null,
      event: "workflow_dispatch",
      head_branch: "main",
      created_at: isoMinutesAgo(55),
    };

    const jobs = new Map<number, WorkflowJobSummary[]>([
      [
        1001,
        [
          {
            id: 1,
            name: "Smoke Shard 1/6",
            status: "in_progress",
            conclusion: null,
            runner_id: 42,
            created_at: isoMinutesAgo(55),
          },
        ],
      ],
      [1002, []],
    ]);

    const results = evaluateWorkflowRuns([activeRun, queuedBehind], jobs, makeOptions(), NOW);
    expect(results.find((r) => r.run.id === 1001)?.decision).toBe("KEEP");
    expect(results.find((r) => r.run.id === 1002)?.decision).toBe("KEEP");
    expect(results.find((r) => r.run.id === 1002)?.reason).toBe("waiting-for-healthy-active-run");
  });

  it("detects an orphaned queued shard inside an in_progress run and excludes currentRunId", () => {
    const currentWatchdog: WorkflowRunSummary = {
      id: 999_999,
      name: "Watchdog Stuck Workflow Runs",
      path: ".github/workflows/watchdog-stuck-runs.yml",
      status: "in_progress",
      conclusion: null,
      event: "schedule",
      head_branch: "main",
      created_at: isoMinutesAgo(1),
    };
    const partialMatrixRun: WorkflowRunSummary = {
      id: 2001,
      name: "Sync Umbrel App Store",
      path: ".github/workflows/sync-umbrel.yml",
      status: "in_progress",
      conclusion: null,
      event: "schedule",
      head_branch: "main",
      created_at: isoMinutesAgo(70),
      run_started_at: isoMinutesAgo(70),
    };

    const jobs = new Map<number, WorkflowJobSummary[]>([
      [
        2001,
        [
          {
            id: 10,
            name: "Prepare & Transpile Store",
            status: "completed",
            conclusion: "success",
            runner_id: 7,
            created_at: isoMinutesAgo(70),
          },
          {
            id: 11,
            name: "Smoke Shard 2/6",
            status: "queued",
            conclusion: null,
            runner_id: null,
            created_at: isoMinutesAgo(65),
          },
        ],
      ],
    ]);

    const results = evaluateWorkflowRuns([currentWatchdog, partialMatrixRun], jobs, makeOptions(), NOW);
    expect(results).toHaveLength(1);
    expect(results[0].run.id).toBe(2001);
    expect(results[0].decision).toBe("CANCEL");
    expect(results[0].stuckJobName).toBe("Smoke Shard 2/6");
  });

  it("cancels zombie in_progress runs that exceed maxInProgressMinutes and stale watchdog runs", () => {
    const zombieRun: WorkflowRunSummary = {
      id: 3001,
      name: "Full Store Smoke Test & Container Logs",
      path: ".github/workflows/smoke-test-all.yml",
      status: "in_progress",
      conclusion: null,
      event: "workflow_dispatch",
      head_branch: "main",
      created_at: isoMinutesAgo(210),
      run_started_at: isoMinutesAgo(200),
    };
    const staleWatchdog: WorkflowRunSummary = {
      id: 3002,
      name: "Watchdog Stuck Workflow Runs",
      path: ".github/workflows/watchdog-stuck-runs.yml",
      status: "queued",
      conclusion: null,
      event: "schedule",
      head_branch: "main",
      created_at: isoMinutesAgo(30),
    };

    const results = evaluateWorkflowRuns([zombieRun, staleWatchdog], new Map(), makeOptions(), NOW);
    expect(results.find((r) => r.run.id === 3001)?.decision).toBe("CANCEL");
    expect(results.find((r) => r.run.id === 3001)?.preferForceCancel).toBe(true);
    expect(results.find((r) => r.run.id === 3002)?.decision).toBe("CANCEL");
  });

  it("evaluates sync auto-retry safely with circuit breaker after maxSyncRetriesPer12h", () => {
    const opts = makeOptions({ maxSyncRetriesPer12h: 2 });

    // First scheduled run cancelled -> should retry
    const firstRetry = evaluateSyncRetry(
      [
        {
          id: 5001,
          name: "Sync Umbrel App Store",
          path: ".github/workflows/sync-umbrel.yml",
          status: "queued",
          conclusion: null,
          event: "schedule",
          head_branch: "main",
          created_at: isoMinutesAgo(120),
        },
      ],
      new Set([5001]),
      opts,
      NOW,
    );
    expect(firstRetry.shouldRetry).toBe(true);
    expect(firstRetry.openAlertIssue).toBe(false);

    // Recent success exists -> skip retry
    const afterSuccess = evaluateSyncRetry(
      [
        {
          id: 5002,
          name: "Sync Umbrel App Store",
          path: ".github/workflows/sync-umbrel.yml",
          status: "completed",
          conclusion: "success",
          event: "schedule",
          head_branch: "main",
          created_at: isoMinutesAgo(180),
        },
      ],
      new Set([5003]),
      opts,
      NOW,
    );
    expect(afterSuccess.shouldRetry).toBe(false);
    expect(afterSuccess.openAlertIssue).toBe(false);

    // 2 workflow_dispatch retries already attempted in last 12h -> stop retrying & open alert issue
    const exhausted = evaluateSyncRetry(
      [
        {
          id: 5004,
          name: "Sync Umbrel App Store",
          path: ".github/workflows/sync-umbrel.yml",
          status: "completed",
          conclusion: "cancelled",
          event: "workflow_dispatch",
          head_branch: "main",
          created_at: isoMinutesAgo(180),
        },
        {
          id: 5005,
          name: "Sync Umbrel App Store",
          path: ".github/workflows/sync-umbrel.yml",
          status: "queued",
          conclusion: null,
          event: "workflow_dispatch",
          head_branch: "main",
          created_at: isoMinutesAgo(60),
        },
      ],
      new Set([5005]),
      opts,
      NOW,
    );
    expect(exhausted.shouldRetry).toBe(false);
    expect(exhausted.openAlertIssue).toBe(true);
  });

  it("escalates from cancel to force-cancel and dispatches fresh Sync Umbrel App Store end-to-end", async () => {
    const calls: string[] = [];
    const stuckRun: WorkflowRunSummary = {
      id: 44758498630,
      name: "Sync Umbrel App Store",
      path: ".github/workflows/sync-umbrel.yml",
      status: "queued",
      conclusion: null,
      event: "schedule",
      head_branch: "main",
      created_at: isoMinutesAgo(500),
      html_url: "https://github.com/MurkBRA/uRuntipiAppStore/actions/runs/44758498630",
    };

    const mockFetch: FetchLike = async (url, init) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url}`);

      if (method === "GET" && url.includes("/actions/runs?status=queued")) {
        return jsonResponse({ workflow_runs: [stuckRun] });
      }
      if (method === "GET" && url.includes("/actions/runs?status=")) {
        return jsonResponse({ workflow_runs: [] });
      }
      if (method === "GET" && url.includes(`/actions/runs/${stuckRun.id}/jobs`)) {
        return jsonResponse({
          jobs: [
            {
              id: 1,
              name: "Prepare & Transpile Store",
              status: "queued",
              conclusion: null,
              runner_id: null,
              created_at: isoMinutesAgo(500),
            },
          ],
        });
      }
      if (method === "POST" && url.endsWith(`/actions/runs/${stuckRun.id}/cancel`)) {
        return new Response(null, { status: 202 });
      }
      if (method === "GET" && url.endsWith(`/actions/runs/${stuckRun.id}`)) {
        // Still queued after graceful cancel -> must escalate to force-cancel
        return jsonResponse(stuckRun);
      }
      if (method === "POST" && url.endsWith(`/actions/runs/${stuckRun.id}/force-cancel`)) {
        return new Response(null, { status: 202 });
      }
      if (method === "GET" && url.includes("/actions/workflows/sync-umbrel.yml/runs")) {
        return jsonResponse({ workflow_runs: [stuckRun] });
      }
      if (method === "POST" && url.endsWith("/actions/workflows/sync-umbrel.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }
      return new Response("unexpected", { status: 500 });
    };

    const result = await runWatchdog(makeOptions(), { fetchImpl: mockFetch, nowMs: NOW });
    expect(result.inspectedCount).toBe(1);
    expect(result.actions[0].action).toBe("FORCE_CANCELLED");
    expect(result.retriedSync).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(calls.some((c) => c.startsWith("POST ") && c.endsWith("/force-cancel"))).toBe(true);
    expect(calls.some((c) => c.startsWith("POST ") && c.endsWith("/dispatches"))).toBe(true);

    const md = formatWatchdogSummaryMarkdown(result);
    expect(md).toContain("FORCE_CANCELLED");
    expect(md).toContain("Triggered ✅");
  });

  it("performs zero mutating requests in dryRun mode and parses CLI/env flags cleanly", async () => {
    const parsed = parseWatchdogCliArgs(["--repo=owner/repo", "--dry-run", "--max-queued-minutes=30"], {
      RETRY_SYNC: "false",
      GITHUB_RUN_ID: "777",
    });
    expect(parsed.repository).toBe("owner/repo");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.retrySync).toBe(false);
    expect(parsed.maxQueuedMinutes).toBe(30);
    expect(parsed.currentRunId).toBe(777);

    const postCalls: string[] = [];
    const mockFetch: FetchLike = async (url, init) => {
      if ((init?.method ?? "GET") !== "GET") {
        postCalls.push(`${init?.method} ${url}`);
      }
      if (url.includes("/actions/runs?status=queued")) {
        return jsonResponse({
          workflow_runs: [
            {
              id: 88,
              name: "Sync Umbrel App Store",
              path: ".github/workflows/sync-umbrel.yml",
              status: "queued",
              conclusion: null,
              event: "schedule",
              head_branch: "main",
              created_at: isoMinutesAgo(120),
            },
          ],
        });
      }
      if (url.includes("/actions/runs?status=")) {
        return jsonResponse({ workflow_runs: [] });
      }
      if (url.includes("/jobs")) {
        return jsonResponse({ jobs: [] });
      }
      return new Response("unexpected", { status: 500 });
    };

    const result = await runWatchdog(makeOptions({ dryRun: true }), { fetchImpl: mockFetch, nowMs: NOW });
    expect(result.actions[0].action).toBe("DRY_RUN_CANCEL");
    expect(result.retriedSync).toBe(false);
    expect(postCalls).toEqual([]);
  });
});
