# @hxflow/shared

跨包共享的 TypeScript 类型定义，是整个 hxflow 平台的单一类型事实源。

## 使用

```ts
import type { RunSpec, RunResult, RunEvent, RunManifest } from "@hxflow/shared/types"
```

## 包含的类型

| 类型 | 说明 |
|------|------|
| `RunId` | Run ID 格式：`r-YYYY-MM-DDTHHMMSS-<hash>` |
| `RunStatus` | Run 状态枚举 |
| `ExitCode` | 容器退出码常量 |
| `HxPhase` | hxflow 阶段：doc / plan / run / review / mr |
| `RunSpec` | CLI → backend 的容器规格 |
| `RunEvent` | backend.follow() 与 trace.jsonl 共用的事件流 |
| `TraceEntry` | trace.jsonl 单行结构 |
| `RunResult` | /output/result.json 结构 |
| `RunManifest` | ~/.hx/runs/\<id\>/manifest.json 结构 |
| `RunSummary` | UI 列表视图用的精简结构 |

## 消费方

- `@hxflow/agent` — entrypoint 写 RunResult / TraceEntry
- `@hxflow/cli` — 构造 RunSpec，读取 RunResult / RunManifest
- `@hxflow/ui` — 渲染 RunSummary / RunEvent
- `@hxflow/workflow` — re-export（保持 `@hxflow/workflow/contracts` 历史路径兼容）

## 本地开发

各包通过 `"@hxflow/shared": "file:../shared"` 直接引用，无需 `bun link`。
