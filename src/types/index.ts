/**
 * @hxflow/workflow contract types — single source of truth shared across:
 *   @hxflow/agent  (writes RunEvent / RunResult to /output)
 *   @hxflow/cli    (constructs RunSpec, reads RunResult, follows RunEvent stream)
 *   @hxflow/console     (renders RunSummary / RunEvent in browser)
 *   @hxflow/sdk    (programmatic API consuming the same types)
 *
 * Phase 0 draft. Refine in Phase 2/3 as concrete needs emerge.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Run identity & status
// ─────────────────────────────────────────────────────────────────────────────

/** RunId format: `r-YYYY-MM-DDTHHMMSS-<6-char-hash>` */
export type RunId = string;

export type RunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "budget_exceeded"
  | "timeout"
  | "system_error";

/** Container exit codes (see Plan §容器契约). */
export const ExitCode = {
  Success: 0,
  BusinessFailure: 1,
  BudgetExceeded: 2,
  Timeout: 3,
  Cancelled: 4,
  SystemError: 10,
  // 137 (OOM) handled implicitly via runtime
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

// ─────────────────────────────────────────────────────────────────────────────
// hxflow phases
// ─────────────────────────────────────────────────────────────────────────────

export type HxPhase =
  | "init"
  | "doc"
  | "plan"
  | "run"
  | "review"
  | "mr"
  | "go"
  | "status"
  | "reset";

// ─────────────────────────────────────────────────────────────────────────────
// RunSpec — CLI 构造、传给 backend 的容器规格
// ─────────────────────────────────────────────────────────────────────────────

export interface RunSpec {
  runId: RunId;
  /** Container image, e.g. `ghcr.io/hxflow/agent:v1` */
  image: string;
  /** Environment variables passed into container. */
  env: Record<string, string>;
  /** Mount points (host paths). */
  mounts: {
    /** Source dir mounted at /workspace. */
    workspace: string;
    /** Source dir mounted at /output. */
    output: string;
  };
  /** Auth strategy. */
  auth:
    | { mode: "host-pi"; authJsonPath: string }
    | { mode: "env-only" };
  /** Resource limits. */
  limits: {
    cpus?: number;
    memoryMB?: number;
    /** Wall-clock seconds (agent-internal). Container layer adds 30s buffer. */
    timeoutSec: number;
    pids?: number;
  };
  /** Network mode. Maps to docker --network or k8s NetworkPolicy. */
  network: "bridge" | "none" | "host";
  /** Optional human-readable label. */
  name?: string;
  /** Run detached (CLI returns immediately after start). */
  detach: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// RunEvent — backend.follow() 与 trace.jsonl 共用的事件流
// ─────────────────────────────────────────────────────────────────────────────

export type RunEvent =
  | { type: "stdout"; ts: string; data: string }
  | { type: "stderr"; ts: string; data: string }
  | { type: "trace"; ts: string; data: TraceEntry }
  | { type: "phase"; ts: string; data: PhaseEntry }
  | { type: "result"; ts: string; data: RunResult };

/** Single line of /output/trace.jsonl. Wraps pi SDK events plus hx-internal markers. */
export type TraceEntry =
  | {
      kind: "pi";
      /** Raw pi SDK event type (agent_start, message_update, tool_call, etc.) */
      piType: string;
      payload: unknown;
    }
  | {
      kind: "hx";
      /** hx-internal markers: phase boundary, budget snapshot, etc. */
      hxType: "phase_enter" | "phase_exit" | "budget" | "info" | "warn" | "error";
      payload: unknown;
    };

export interface PhaseEntry {
  phase: HxPhase;
  /** "enter" or "exit" */
  transition: "enter" | "exit";
  /** Phase elapsed ms (only on exit). */
  durationMs?: number;
  /** Phase outcome (only on exit). */
  outcome?: "ok" | "fail" | "skip";
}

// ─────────────────────────────────────────────────────────────────────────────
// RunResult — /output/result.json
// ─────────────────────────────────────────────────────────────────────────────

export interface RunResult {
  runId: RunId;
  status: RunStatus;
  exitCode: ExitCodeValue | number;
  startedAt: string;
  endedAt: string;
  /** Total wall-clock seconds. */
  durationSec: number;
  /** Per-phase timing. */
  phases: Array<{
    phase: HxPhase;
    startedAt: string;
    endedAt?: string;
    durationMs: number;
    outcome: "ok" | "fail" | "skip";
  }>;
  /** Token usage (sum across all LLM calls). */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalTokens: number;
    /** Estimated USD cost (provider-specific pricing applied agent-side). */
    costUsd: number;
  };
  /** MR / PR URL if `mr` phase succeeded. */
  mrUrl?: string;
  /** First-line error summary if status != succeeded. */
  errorSummary?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RunManifest — ~/.hx/runs/<id>/manifest.json (CLI 写)
// ─────────────────────────────────────────────────────────────────────────────

export interface RunManifest {
  runId: RunId;
  /** Snapshot of the original CLI invocation. */
  invocation: {
    command: string[];
    cwd: string;
    user: string;
    hostname: string;
  };
  /** Resolved RunSpec passed to backend. Auth fields redacted. */
  spec: Omit<RunSpec, "env"> & {
    env: Record<string, string | "<redacted>">;
  };
  /** Profile applied (name + resolved values). */
  profile: {
    name: string;
    source: string;
  };
  /** Backend that ran it. */
  backend: "docker" | "podman" | "k8s";
  /** Native handle (container id / job name) — for cancel/cleanup. */
  nativeHandle: unknown;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RunSummary — UI list view 用
// ─────────────────────────────────────────────────────────────────────────────

export interface RunSummary {
  runId: RunId;
  name?: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  costUsd?: number;
  /** Truncated requirement preview for list display. */
  requirementPreview: string;
  mrUrl?: string;
}
