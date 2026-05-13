/**
 * @hxflow/shared contract types — single source of truth shared across:
 *   @hxflow/agent    (writes trace.jsonl + result.json envelope to /output)
 *   @hxflow/cli      (constructs RunSpec, tails trace.jsonl, reads envelope)
 *   @hxflow/console  (renders trace stream + envelope in browser)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Run identity & status
// ─────────────────────────────────────────────────────────────────────────────

/** RunId format: UUID v7 (time-ordered, e.g. `019dfb29-d486-7328-ba31-136eb3623871`). */
export type RunId = string;

export type RunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timeout"
  | "system_error";

/** Container exit codes. */
export const ExitCode = {
  Success: 0,
  BusinessFailure: 1,
  Timeout: 3,
  Cancelled: 4,
  SystemError: 10,
  // 137 (OOM) handled implicitly via runtime
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

// ─────────────────────────────────────────────────────────────────────────────
// hxflow phases (used by hxflow skill, not by agent)
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
  /** Environment variables passed into container (resolved from environment config). */
  env: Record<string, string>;
  /** Mount points (host paths). */
  mounts: {
    /** Source dir mounted at /workspace. */
    workspace: string;
    /** Source dir mounted at /output. */
    output: string;
    /** Optional secrets dir mounted at /run/secrets:ro. */
    secrets?: string;
    /** Optional pi auth.json file mounted at /root/.pi/agent/auth.json:rw. */
    authJson?: string;
  };
  /** Auth strategy — always env-only; credentials injected via env vars by CLI. */
  auth: { mode: "env-only" };
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
// TraceEntry — /output/trace.jsonl 单行
// ─────────────────────────────────────────────────────────────────────────────

/** Single line of /output/trace.jsonl. Wraps pi SDK events plus hx-internal markers. */
export type TraceEntry =
  | {
      ts: string;
      kind: "pi";
      /** Raw pi SDK event type (agent_start, message_update, tool_execution_start, etc.) */
      piType: string;
      payload: unknown;
    }
  | {
      ts: string;
      kind: "hx";
      hxType: "info" | "warn" | "error" | "skill_overridden";
      payload: unknown;
    };

// ─────────────────────────────────────────────────────────────────────────────
// AgentResponse — /output/result.json 统一信封
// ─────────────────────────────────────────────────────────────────────────────

/** Unified envelope written to /output/result.json. */
export interface AgentResponse<TData = AgentResultData> {
  /** 0 = success; non-zero = ExitCode; null = LLM has not finalized yet (scaffold state). */
  err: number | null;
  /** One-line human-readable message; null in scaffold state. */
  msg: string | null;
  data: TData;
}

export interface SkillAssembly {
  /** Names of system skills loaded from agent image. */
  system: string[];
  /** Names of project-local skills discovered under /workspace. */
  project: string[];
  /** Names of project skills dropped because a system skill with the same name exists. */
  overridden: string[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
}

export interface Artifact {
  /** Open string: pr / mr / branch / commit / file / ... */
  type: string;
  url: string;
  label?: string;
}

/** Default shape of AgentResponse.data — agent fills system fields, LLM fills business fields. */
export interface AgentResultData {
  /** ─── Agent-owned (filled at scaffold time / shutdown) ─── */
  runId: RunId;
  createdAt: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  environment: { name: string; image: string };
  model: string | null;
  provider: string | null;
  scope: string;
  source: string;
  executionLocation: string;
  skills: SkillAssembly;
  usage: TokenUsage;

  /** ─── LLM-owned (filled by hxflow skill at run end) ─── */
  status: RunStatus | null;
  summary: string | null;
  artifacts: Artifact[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RunEvent — backend.follow() 输出，CLI/UI 消费
// ─────────────────────────────────────────────────────────────────────────────

/** Single-source: backend tails trace.jsonl only; result fires once after envelope is finalized. */
export type RunEvent =
  | { type: "trace"; ts: string; data: TraceEntry }
  | { type: "result"; ts: string; data: AgentResponse };

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
  /** Resolved RunSpec passed to backend. Sensitive env values redacted. */
  spec: Omit<RunSpec, "env"> & {
    env: Record<string, string | "<redacted>">;
  };
  /** Environment applied. */
  environment: {
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
  /** Truncated requirement preview for list display. */
  requirementPreview: string;
  /** First MR/PR artifact url, if any. */
  mrUrl?: string;
}
