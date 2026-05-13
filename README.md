# @hxflow/shared

hxflow 平台的跨包共享 TypeScript 类型，是整个平台的单一类型事实源。

## 使用

```ts
import type {
  RunSpec, RunEvent, RunManifest, RunSummary,
  TraceEntry, HxPhase, RunStatus, ExitCode,
  AgentResponse, AgentResultData, TokenUsage, Artifact, SkillAssembly,
} from "@hxflow/shared/types"
import { uuidv7 } from "@hxflow/shared/uuid"
```

## 类型一览

### Run 标识与状态

| 类型 | 说明 |
|------|------|
| `RunId` | UUID v7（时间有序，DB 化时可按 id 排时间） |
| `RunStatus` | `pending` / `running` / `succeeded` / `failed` / `cancelled` / `timeout` / `system_error` |
| `ExitCode` | 容器退出码常量（0 成功 / 1 业务失败 / 3 超时 / 4 取消 / 10+ 系统错） |
| `HxPhase` | hxflow 阶段：`init` / `doc` / `plan` / `run` / `review` / `mr` 等 |

### 容器契约

| 类型 | 写入方 | 说明 |
|------|--------|------|
| `RunSpec` | `@hxflow/cli` | CLI 传给 backend 的容器规格（image / env / 挂载 / limits） |
| `RunManifest` | `@hxflow/cli` | `~/.hx/runs/<id>/manifest.json`（调用参数快照） |

### 事件流

| 类型 | 说明 |
|------|------|
| `TraceEntry` | `/output/trace.jsonl` 单行；`{ts, kind:"pi"\|"hx", piType?\|hxType?, payload}` |
| `RunEvent` | `backend.follow()` 输出；只有 `trace` 与 `result` 两种 variant（**单一订阅源**，stdout/stderr 不再走 RunEvent） |

### 结果信封

agent 唯一契约产物 `/output/result.json` 的形状：

| 类型 | 说明 |
|------|------|
| `AgentResponse<TData>` | `{ err: number\|null, msg: string\|null, data: TData }` |
| `AgentResultData` | 默认 `data` 形状，含 agent 元数据 + LLM 业务字段 |
| `TokenUsage` | 4 类 token + total |
| `Artifact` | `{ type, url, label? }`；type 开放：`pr` / `mr` / `branch` / `commit` / `file` 等 |
| `SkillAssembly` | `{ system: string[], project: string[], overridden: string[] }` |

字段切分：

| 字段 | 写入方 |
|------|--------|
| `err` / `msg` | LLM（hxflow skill 末端 Edit）；agent 在 LLM 漏写时兜底 |
| `data.runId/createdAt/startedAt/endedAt/durationSec` | agent |
| `data.environment/model/provider/scope/source/executionLocation` | agent |
| `data.skills` / `data.usage` | agent |
| `data.status` / `summary` / `artifacts` | LLM |

### UI

| 类型 | 说明 |
|------|------|
| `RunSummary` | UI list view 用 |

## 工具

### `uuidv7()`

`@hxflow/shared/uuid` 导出 `uuidv7()`，生成时间有序的 UUID v7 字符串。CLI 用它构造 runId，agent 在 env 缺省时也用它兜底。

## 消费方

| 包 | 用途 |
|----|------|
| `@hxflow/agent` | 写 `AgentResponse` / `TraceEntry` 到 `/output/` |
| `@hxflow/cli` | 构造 `RunSpec`，读 `AgentResponse` / `RunManifest`；tail `trace.jsonl` |
| `@hxflow/console` | 渲染 `RunSummary` / `TraceEntry` / `AgentResponse` |

## 本地开发

各包通过 `"@hxflow/shared": "workspace:*"` 引用，workspace 根的 bun workspaces 负责 link，改动实时生效。
