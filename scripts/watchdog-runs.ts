import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface WorkflowRunSummary {
  id: number;
  name: string;
  path: string;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string | null;
  created_at: string;
  updated_at?: string;
  run_started_at?: string | null;
  html_url?: string;
}

export interface WorkflowJobSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  runner_id?: number | null;
  runner_name?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface WatchdogOptions {
  repository: string;
  token: string;
  currentRunId: number | null;
  maxQueuedMinutes: number;
  forceCancelAfterMinutes: number;
  maxInProgressMinutes: number;
  watchdogMaxMinutes: number;
  retrySync: boolean;
  syncWorkflowPath: string;
  syncBranch: string;
  maxSyncRetriesPer12h: number;
  dryRun: boolean;
  cancelVerifyDelayMs: number;
  postCancelRetryDelayMs: number;
  requestTimeoutMs: number;
  apiBaseUrl: string;
}

export type RunDecisionKind = "KEEP" | "CANCEL";

export interface RunEvaluation {
  run: WorkflowRunSummary;
  decision: RunDecisionKind;
  reason: string;
  ageMinutes: number;
  preferForceCancel: boolean;
  stuckJobName?: string;
}

export interface SyncRetryDecision {
  shouldRetry: boolean;
  reason: string;
  openAlertIssue: boolean;
  recentDispatchCount: number;
}

export interface WatchdogActionRecord {
  runId: number;
  workflowName: string;
  workflowPath: string;
  status: string;
  ageMinutes: number;
  action: "KEEP" | "DRY_RUN_CANCEL" | "CANCELLED" | "FORCE_CANCELLED" | "CANCEL_FAILED";
  reason: string;
  htmlUrl?: string;
}

export interface WatchdogResult {
  inspectedCount: number;
  actions: WatchdogActionRecord[];
  retriedSync: boolean;
  retryReason: string;
  alertIssueOpened: boolean;
  warnings: string[];
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ACTIVE_RUN_STATUSES = ["queued", "in_progress", "waiting", "pending", "requested"] as const;
const QUEUED_LIKE_STATUSES = new Set(["queued", "waiting", "pending", "requested"]);
const WATCHDOG_WORKFLOW_SUFFIX = "watchdog-stuck-runs.yml";
const ALERT_ISSUE_TITLE = "[Watchdog] Sync Umbrel App Store travado repetidamente na fila do GitHub Actions";

export function minutesSince(isoTimestamp: string | null | undefined, nowMs: number): number {
  if (!isoTimestamp) return 0;
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, (nowMs - parsed) / 60_000);
}

function workflowBranchKey(run: WorkflowRunSummary): string {
  return `${run.path || run.name}::${run.head_branch ?? ""}`;
}

function findStuckQueuedJob(
  run: WorkflowRunSummary,
  jobs: WorkflowJobSummary[],
  limitQueuedMinutes: number,
  nowMs: number,
): { job: WorkflowJobSummary; queuedMinutes: number } | null {
  for (const job of jobs) {
    if (job.status !== "queued") continue;
    if (job.runner_id !== null && job.runner_id !== undefined) continue;
    const queuedSince = job.created_at || job.started_at || run.created_at;
    const queuedMinutes = minutesSince(queuedSince, nowMs);
    if (queuedMinutes >= limitQueuedMinutes) {
      return { job, queuedMinutes };
    }
  }
  return null;
}

export function evaluateWorkflowRuns(
  activeRuns: WorkflowRunSummary[],
  jobsByRunId: Map<number, WorkflowJobSummary[]>,
  options: Pick<
    WatchdogOptions,
    "currentRunId" | "maxQueuedMinutes" | "forceCancelAfterMinutes" | "maxInProgressMinutes" | "watchdogMaxMinutes"
  >,
  nowMs: number = Date.now(),
): RunEvaluation[] {
  const candidates = activeRuns.filter((run) => run.id !== options.currentRunId && run.status !== "completed");
  const healthyInProgressKeys = new Set<string>();

  for (const run of candidates) {
    if (run.status !== "in_progress") continue;
    const isWatchdog = (run.path || "").endsWith(WATCHDOG_WORKFLOW_SUFFIX);
    const limitQueued = isWatchdog
      ? Math.min(options.maxQueuedMinutes, options.watchdogMaxMinutes)
      : options.maxQueuedMinutes;
    const limitInProgress = isWatchdog ? options.watchdogMaxMinutes : options.maxInProgressMinutes;

    const jobs = jobsByRunId.get(run.id) ?? [];
    const activeAgeMinutes = minutesSince(run.run_started_at || run.created_at, nowMs);
    if (activeAgeMinutes >= limitInProgress) continue;

    const stuckJob = findStuckQueuedJob(run, jobs, limitQueued, nowMs);
    if (stuckJob) continue;

    const hasStartedJob =
      jobs.length === 0 || jobs.some((job) => job.status === "in_progress" || job.status === "completed");
    if (hasStartedJob) {
      healthyInProgressKeys.add(workflowBranchKey(run));
    }
  }

  const evaluations: RunEvaluation[] = [];

  for (const run of candidates) {
    const isWatchdog = (run.path || "").endsWith(WATCHDOG_WORKFLOW_SUFFIX);
    const limitQueued = isWatchdog
      ? Math.min(options.maxQueuedMinutes, options.watchdogMaxMinutes)
      : options.maxQueuedMinutes;
    const limitInProgress = isWatchdog ? options.watchdogMaxMinutes : options.maxInProgressMinutes;

    const jobs = jobsByRunId.get(run.id) ?? [];
    const createdAgeMinutes = minutesSince(run.created_at, nowMs);

    if (QUEUED_LIKE_STATUSES.has(run.status)) {
      if (healthyInProgressKeys.has(workflowBranchKey(run))) {
        evaluations.push({
          run,
          decision: "KEEP",
          reason: "waiting-for-healthy-active-run",
          ageMinutes: createdAgeMinutes,
          preferForceCancel: false,
        });
        continue;
      }

      if (createdAgeMinutes >= limitQueued) {
        evaluations.push({
          run,
          decision: "CANCEL",
          reason: `stuck-queued (${Math.round(createdAgeMinutes)}m >= ${limitQueued}m without runner)`,
          ageMinutes: createdAgeMinutes,
          preferForceCancel: createdAgeMinutes >= options.forceCancelAfterMinutes,
        });
      } else {
        evaluations.push({
          run,
          decision: "KEEP",
          reason: `within-queue-threshold (${Math.round(createdAgeMinutes)}m < ${limitQueued}m)`,
          ageMinutes: createdAgeMinutes,
          preferForceCancel: false,
        });
      }
      continue;
    }

    if (run.status === "in_progress") {
      const stuckJob = findStuckQueuedJob(run, jobs, limitQueued, nowMs);
      if (stuckJob) {
        evaluations.push({
          run,
          decision: "CANCEL",
          reason: `stuck-queued-job "${stuckJob.job.name}" (${Math.round(stuckJob.queuedMinutes)}m >= ${limitQueued}m without runner)`,
          ageMinutes: stuckJob.queuedMinutes,
          preferForceCancel: stuckJob.queuedMinutes >= options.forceCancelAfterMinutes,
          stuckJobName: stuckJob.job.name,
        });
        continue;
      }

      const activeAgeMinutes = minutesSince(run.run_started_at || run.created_at, nowMs);
      if (activeAgeMinutes >= limitInProgress) {
        evaluations.push({
          run,
          decision: "CANCEL",
          reason: `exceeded-max-in-progress (${Math.round(activeAgeMinutes)}m >= ${limitInProgress}m)`,
          ageMinutes: activeAgeMinutes,
          preferForceCancel: true,
        });
      } else {
        evaluations.push({
          run,
          decision: "KEEP",
          reason: `healthy-in-progress (${Math.round(activeAgeMinutes)}m < ${limitInProgress}m)`,
          ageMinutes: activeAgeMinutes,
          preferForceCancel: false,
        });
      }
      continue;
    }

    evaluations.push({
      run,
      decision: "KEEP",
      reason: `unhandled-status:${run.status}`,
      ageMinutes: createdAgeMinutes,
      preferForceCancel: false,
    });
  }

  return evaluations;
}

export function evaluateSyncRetry(
  recentSyncRuns: WorkflowRunSummary[],
  cancelledRunIds: Set<number>,
  options: Pick<WatchdogOptions, "retrySync" | "maxSyncRetriesPer12h">,
  nowMs: number = Date.now(),
): SyncRetryDecision {
  if (!options.retrySync) {
    return { shouldRetry: false, reason: "retry-disabled", openAlertIssue: false, recentDispatchCount: 0 };
  }

  const twelveHoursMs = 12 * 60 * 60 * 1000;
  const recentWindowRuns = recentSyncRuns.filter((run) => {
    const created = Date.parse(run.created_at);
    return !Number.isNaN(created) && nowMs - created <= twelveHoursMs;
  });

  const stillActive = recentWindowRuns.find((run) => !cancelledRunIds.has(run.id) && run.status !== "completed");
  if (stillActive) {
    return {
      shouldRetry: false,
      reason: `another-sync-active (#${stillActive.id}, status=${stillActive.status})`,
      openAlertIssue: false,
      recentDispatchCount: 0,
    };
  }

  const recentSuccess = recentWindowRuns.find((run) => run.status === "completed" && run.conclusion === "success");
  if (recentSuccess) {
    return {
      shouldRetry: false,
      reason: `recent-sync-succeeded (#${recentSuccess.id})`,
      openAlertIssue: false,
      recentDispatchCount: 0,
    };
  }

  const recentDispatchCount = recentWindowRuns.filter((run) => run.event === "workflow_dispatch").length;
  if (recentDispatchCount >= options.maxSyncRetriesPer12h) {
    return {
      shouldRetry: false,
      reason: `retry-budget-exhausted (${recentDispatchCount}/${options.maxSyncRetriesPer12h} dispatches in last 12h)`,
      openAlertIssue: true,
      recentDispatchCount,
    };
  }

  return {
    shouldRetry: true,
    reason: `recovering-stuck-sync (dispatches in last 12h: ${recentDispatchCount}/${options.maxSyncRetriesPer12h})`,
    openAlertIssue: false,
    recentDispatchCount,
  };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function githubRequest(
  fetchImpl: FetchLike,
  options: Pick<WatchdogOptions, "apiBaseUrl" | "token" | "requestTimeoutMs">,
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<Response> {
  const url = `${options.apiBaseUrl.replace(/\/+$/, "")}${endpoint}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "uRuntipiAppStore-watchdog",
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetchImpl(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(options.requestTimeoutMs),
  });
}

async function listActiveWorkflowRuns(fetchImpl: FetchLike, options: WatchdogOptions): Promise<WorkflowRunSummary[]> {
  const byId = new Map<number, WorkflowRunSummary>();
  for (const status of ACTIVE_RUN_STATUSES) {
    const res = await githubRequest(
      fetchImpl,
      options,
      "GET",
      `/repos/${options.repository}/actions/runs?status=${status}&per_page=50`,
    );
    if (!res.ok) {
      throw new Error(`Failed to list ${status} workflow runs (HTTP ${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { workflow_runs?: WorkflowRunSummary[] };
    for (const run of data.workflow_runs ?? []) {
      byId.set(run.id, run);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

async function listRunJobs(
  fetchImpl: FetchLike,
  options: WatchdogOptions,
  runId: number,
): Promise<WorkflowJobSummary[]> {
  const res = await githubRequest(
    fetchImpl,
    options,
    "GET",
    `/repos/${options.repository}/actions/runs/${runId}/jobs?per_page=100`,
  );
  if (!res.ok) {
    throw new Error(`Failed to list jobs for run #${runId} (HTTP ${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { jobs?: WorkflowJobSummary[] };
  return data.jobs ?? [];
}

async function cancelOrForceCancelRun(
  fetchImpl: FetchLike,
  options: WatchdogOptions,
  evaluation: RunEvaluation,
): Promise<{ action: "DRY_RUN_CANCEL" | "CANCELLED" | "FORCE_CANCELLED" | "CANCEL_FAILED"; warning?: string }> {
  if (options.dryRun) {
    return { action: "DRY_RUN_CANCEL" };
  }

  const runId = evaluation.run.id;
  const cancelRes = await githubRequest(
    fetchImpl,
    options,
    "POST",
    `/repos/${options.repository}/actions/runs/${runId}/cancel`,
  );

  let needsForceCancel = evaluation.preferForceCancel || (!cancelRes.ok && cancelRes.status !== 202);

  if (cancelRes.ok) {
    await sleep(options.cancelVerifyDelayMs);
    const checkRes = await githubRequest(
      fetchImpl,
      options,
      "GET",
      `/repos/${options.repository}/actions/runs/${runId}`,
    );
    if (checkRes.ok) {
      const updated = (await checkRes.json()) as WorkflowRunSummary;
      if (updated.status === "completed") {
        return { action: "CANCELLED" };
      }
      needsForceCancel = true;
    }
  }

  if (needsForceCancel) {
    const forceRes = await githubRequest(
      fetchImpl,
      options,
      "POST",
      `/repos/${options.repository}/actions/runs/${runId}/force-cancel`,
    );
    if (forceRes.ok) {
      return { action: "FORCE_CANCELLED" };
    }
    const forceBody = await forceRes.text();
    if (cancelRes.ok) {
      return {
        action: "CANCELLED",
        warning: `Run #${runId}: graceful cancel accepted (HTTP ${cancelRes.status}), force-cancel returned HTTP ${forceRes.status}: ${forceBody}`,
      };
    }
    return {
      action: "CANCEL_FAILED",
      warning: `Run #${runId}: cancel failed (HTTP ${cancelRes.status}) and force-cancel failed (HTTP ${forceRes.status}): ${forceBody}`,
    };
  }

  return { action: "CANCELLED" };
}

async function upsertWatchdogAlertIssue(
  fetchImpl: FetchLike,
  options: WatchdogOptions,
  body: string,
): Promise<boolean> {
  if (options.dryRun) return false;

  const listRes = await githubRequest(
    fetchImpl,
    options,
    "GET",
    `/repos/${options.repository}/issues?state=open&per_page=50`,
  );
  if (!listRes.ok) return false;

  const issues = (await listRes.json()) as Array<{ number: number; title: string; pull_request?: unknown }>;
  const existing = issues.find((item) => !item.pull_request && item.title === ALERT_ISSUE_TITLE);

  if (existing) {
    const commentRes = await githubRequest(
      fetchImpl,
      options,
      "POST",
      `/repos/${options.repository}/issues/${existing.number}/comments`,
      { body },
    );
    return commentRes.ok;
  }

  const createRes = await githubRequest(fetchImpl, options, "POST", `/repos/${options.repository}/issues`, {
    title: ALERT_ISSUE_TITLE,
    body,
  });
  return createRes.ok;
}

export function formatWatchdogSummaryMarkdown(result: WatchdogResult): string {
  const lines = [
    "## 🛡️ Workflow Watchdog Report",
    "",
    `- **Active Runs Inspected**: ${result.inspectedCount}`,
    `- **Sync Auto-Retry**: ${result.retriedSync ? "Triggered ✅" : `Skipped (${result.retryReason})`}`,
    "",
  ];

  if (result.actions.length === 0) {
    lines.push("No stuck or active workflow runs required intervention.");
  } else {
    lines.push(
      "| Run | Workflow | Status | Age | Action | Reason |",
      "| :---: | :--- | :---: | :---: | :---: | :--- |",
    );
    for (const item of result.actions) {
      const runRef = item.htmlUrl ? `[#${item.runId}](${item.htmlUrl})` : `#${item.runId}`;
      lines.push(
        `| ${runRef} | ${item.workflowName} | \`${item.status}\` | ${Math.round(item.ageMinutes)}m | \`${item.action}\` | ${item.reason} |`,
      );
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "### ⚠️ Warnings", "");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export async function runWatchdog(
  options: WatchdogOptions,
  deps: { fetchImpl?: FetchLike; nowMs?: number } = {},
): Promise<WatchdogResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const nowMs = deps.nowMs ?? Date.now();
  const warnings: string[] = [];

  const activeRuns = await listActiveWorkflowRuns(fetchImpl, options);
  const jobsByRunId = new Map<number, WorkflowJobSummary[]>();

  for (const run of activeRuns) {
    if (run.id === options.currentRunId) continue;
    try {
      jobsByRunId.set(run.id, await listRunJobs(fetchImpl, options, run.id));
    } catch (err) {
      warnings.push(`Could not inspect jobs for run #${run.id}: ${(err as Error).message}`);
      jobsByRunId.set(run.id, []);
    }
  }

  const evaluations = evaluateWorkflowRuns(activeRuns, jobsByRunId, options, nowMs);
  const actions: WatchdogActionRecord[] = [];
  const cancelledRunIds = new Set<number>();
  let cancelledSyncRun = false;

  for (const ev of evaluations) {
    if (ev.decision === "KEEP") {
      actions.push({
        runId: ev.run.id,
        workflowName: ev.run.name,
        workflowPath: ev.run.path,
        status: ev.run.status,
        ageMinutes: ev.ageMinutes,
        action: "KEEP",
        reason: ev.reason,
        htmlUrl: ev.run.html_url,
      });
      continue;
    }

    const cancelOutcome = await cancelOrForceCancelRun(fetchImpl, options, ev);
    if (cancelOutcome.warning) {
      warnings.push(cancelOutcome.warning);
    }

    actions.push({
      runId: ev.run.id,
      workflowName: ev.run.name,
      workflowPath: ev.run.path,
      status: ev.run.status,
      ageMinutes: ev.ageMinutes,
      action: cancelOutcome.action,
      reason: ev.reason,
      htmlUrl: ev.run.html_url,
    });

    if (cancelOutcome.action === "CANCELLED" || cancelOutcome.action === "FORCE_CANCELLED") {
      cancelledRunIds.add(ev.run.id);
      if (ev.run.path === options.syncWorkflowPath) {
        cancelledSyncRun = true;
      }
    }
  }

  let retriedSync = false;
  let retryReason = "no-stuck-sync-cancelled";
  let alertIssueOpened = false;

  if (cancelledSyncRun) {
    const workflowFile = path.posix.basename(options.syncWorkflowPath);
    const recentRes = await githubRequest(
      fetchImpl,
      options,
      "GET",
      `/repos/${options.repository}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=${encodeURIComponent(options.syncBranch)}&per_page=15`,
    );

    if (!recentRes.ok) {
      retryReason = `failed-to-query-recent-sync-runs (HTTP ${recentRes.status})`;
      warnings.push(retryReason);
    } else {
      const recentData = (await recentRes.json()) as { workflow_runs?: WorkflowRunSummary[] };
      const retryDecision = evaluateSyncRetry(recentData.workflow_runs ?? [], cancelledRunIds, options, nowMs);
      retryReason = retryDecision.reason;

      if (retryDecision.shouldRetry && !options.dryRun) {
        await sleep(options.postCancelRetryDelayMs);
        const dispatchRes = await githubRequest(
          fetchImpl,
          options,
          "POST",
          `/repos/${options.repository}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
          { ref: options.syncBranch },
        );
        if (dispatchRes.ok) {
          retriedSync = true;
        } else {
          const dispatchErr = await dispatchRes.text();
          retryReason = `dispatch-failed (HTTP ${dispatchRes.status})`;
          warnings.push(`Failed to re-dispatch ${workflowFile} (HTTP ${dispatchRes.status}): ${dispatchErr}`);
        }
      } else if (retryDecision.openAlertIssue) {
        const issueBody = [
          `O Watchdog cancelou execuções travadas do workflow \`${workflowFile}\`, mas o limite de retentativas automáticas (${options.maxSyncRetriesPer12h} em 12h) foi atingido.`,
          "",
          "### O que verificar",
          "1. Status de incidentes do GitHub Actions em https://www.githubstatus.com/",
          "2. **Settings -> Billing & plans / Actions** na conta GitHub (limites de concorrência ou restrições da conta)",
          `3. Histórico recente: https://github.com/${options.repository}/actions/workflows/${workflowFile}`,
        ].join("\n");
        try {
          alertIssueOpened = await upsertWatchdogAlertIssue(fetchImpl, options, issueBody);
        } catch (err) {
          warnings.push(`Could not open watchdog alert issue: ${(err as Error).message}`);
        }
      }
    }
  }

  return {
    inspectedCount: evaluations.length,
    actions,
    retriedSync,
    retryReason,
    alertIssueOpened,
    warnings,
  };
}

export function parseWatchdogCliArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): WatchdogOptions {
  const getArg = (prefix: string): string | undefined => {
    const match = argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
  };

  const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const currentRunRaw = getArg("--current-run-id=") ?? env.GITHUB_RUN_ID;
  const currentRunParsed = currentRunRaw ? Number.parseInt(currentRunRaw, 10) : Number.NaN;

  return {
    repository: getArg("--repo=") ?? env.GITHUB_REPOSITORY ?? "",
    token: env.GITHUB_TOKEN ?? env.GH_TOKEN ?? "",
    currentRunId: Number.isFinite(currentRunParsed) ? currentRunParsed : null,
    maxQueuedMinutes: parsePositiveInt(getArg("--max-queued-minutes=") ?? env.MAX_QUEUED_MINUTES, 45),
    forceCancelAfterMinutes: parsePositiveInt(
      getArg("--force-cancel-after-minutes=") ?? env.FORCE_CANCEL_AFTER_MINUTES,
      90,
    ),
    maxInProgressMinutes: parsePositiveInt(getArg("--max-in-progress-minutes=") ?? env.MAX_IN_PROGRESS_MINUTES, 180),
    watchdogMaxMinutes: parsePositiveInt(getArg("--watchdog-max-minutes=") ?? env.WATCHDOG_MAX_MINUTES, 25),
    retrySync: !argv.includes("--no-retry-sync") && env.RETRY_SYNC !== "false",
    syncWorkflowPath: getArg("--sync-workflow=") ?? ".github/workflows/sync-umbrel.yml",
    syncBranch: getArg("--sync-branch=") ?? "main",
    maxSyncRetriesPer12h: parsePositiveInt(getArg("--max-sync-retries=") ?? env.MAX_SYNC_RETRIES, 2),
    dryRun: argv.includes("--dry-run") || env.DRY_RUN === "true",
    cancelVerifyDelayMs: 4_000,
    postCancelRetryDelayMs: 3_000,
    requestTimeoutMs: 15_000,
    apiBaseUrl: env.GITHUB_API_URL ?? "https://api.github.com",
  };
}

async function main(): Promise<void> {
  const options = parseWatchdogCliArgs(process.argv.slice(2), process.env);
  if (!options.repository) {
    throw new Error("Missing repository (set GITHUB_REPOSITORY or pass --repo=owner/repo).");
  }
  if (!options.dryRun && !options.token) {
    throw new Error("Missing GITHUB_TOKEN / GH_TOKEN for mutating watchdog actions.");
  }

  console.log(
    `🛡️ Running Workflow Watchdog on ${options.repository} (maxQueued=${options.maxQueuedMinutes}m, maxInProgress=${options.maxInProgressMinutes}m, retrySync=${options.retrySync}, dryRun=${options.dryRun})...`,
  );

  const result = await runWatchdog(options);
  const summary = formatWatchdogSummaryMarkdown(result);
  console.log(summary);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, "utf8");
  }

  const failedCancellations = result.actions.filter((item) => item.action === "CANCEL_FAILED");
  if (failedCancellations.length > 0) {
    process.exitCode = 1;
  }
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntryPoint) {
  main().catch((err) => {
    console.error("Watchdog execution failed:", err);
    process.exit(1);
  });
}
