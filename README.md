# @hxflow/shared

hxflow 平台的跨包共享 TypeScript 类型，是整个平台的单一类型事实源。

## 使用

```ts
import type {
  RunSpec, RunResult, RunEvent, RunManifest, RunSummary,
  TraceEntry, HxPhase, RunStatus, ExitCode,
} from "@hxflow/shared/types"
```

## 类型一览

### Run 标识与状态

| 类型 | 说明 |
|------|------|
| `RunId` | Run ID，格式：`r-YYYY-MM-DDTHHMMSS-<6位hash>` |
| `RunStatus` | `pending` / `running` / `succeeded` / `failed` / `cancelled` / `budget_exceeded` / `timeout` / `system_error` |
| `ExitCode` | 容器退出码常量（0 成功 / 1 业务失败 / 2 预算超限 / 3 超时 / 4 取消 / 10+ 系统错误）|
| `HxPhase` | hxflow 阶段：`init` / `doc` / `plan` / `run` / `review` / `mr` |

### 核心结构

| 类型 | 写入方 | 说明 |
|------|--------|------|
| `RunSpec` | `@hxflow/cli` | CLI 传给 backend 的容器规格（镜像、env、挂载、limits）|
| `RunEvent` | `@hxflow/agent` | `backend.follow()` 与 `trace.jsonl` 共用的事件流 |
| `TraceEntry` | `@hxflow/agent` | `trace.jsonl` 单行结构（pi SDK 事件 或 hx 内部标记）|
| `RunResult` | `@hxflow/agent` | `/output/result.json` 结构（状态、耗时、token 用量）|
| `RunManifest` | `@hxflow/cli` | `~/.hx/runs/<id>/manifest.json`（调用参数快照）|
| `RunSummary` | `@hxflow/console` | 列表视图精简结构 |

## 消费方

| 包 | 用途 |
|----|------|
| `@hxflow/agent` | 写 `RunResult` / `TraceEntry` 到 `/output/` |
| `@hxflow/cli` | 构造 `RunSpec`，读 `RunResult` / `RunManifest` |
| `@hxflow/console` | 渲染 `RunSummary` / `RunEvent` |
| `@hxflow/workflow` | re-export（向后兼容 `@hxflow/workflow/contracts` 路径）|

## 本地开发

各包通过 `"@hxflow/shared": "file:../shared"` 直接引用，无需 `bun link`，改动实时生效。

```bash
# 发版前先发 shared
cd shared
bun publish
```
