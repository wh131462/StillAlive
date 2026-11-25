# 「仍在」AI 能力接入设计方案（V1）

| 项目 | 内容 |
|---|---|
| 文档状态 | P0 接入层与 P1–P3 场景已实现（编辑器写作、人物印象、账本解析、摘抄解读）；流式输出与本地价格表未实现 |
| 代码基线 | v1.1.21（2026-11-25 工作区，HEAD `5d71819`） |
| 范围 | 接入层（配置 / 检测 / 余额 / 用量）+ 四类融合场景 |
| 前置文档 | [PRD_V3.md](PRD_V3.md)、[V4_CHANGE_PLAN.md](V4_CHANGE_PLAN.md)、[V4 交互样本](design/v4.html) |
| 后续文档 | [AI_KNOWLEDGE_MEMORY_PLAN.md](AI_KNOWLEDGE_MEMORY_PLAN.md)：本地知识库、聚合与 Agent 记忆系统（V2） |

---

## 0. 一句话结论

把 AI 做成**可选、按次、用户显式触发的工具层**：设置里有一个默认关闭的总开关，关掉时零网络请求、零 AI 入口，与未接入 AI 完全一致；打开后也需要用户逐次点击才调用，生成结果一律先进预览、再由用户决定是否写入本地数据。不做自动总结、自动改写、情绪分析，也不引入服务端、代理或后台 agent 进程。

---

## 1. 决策与边界

### 1.1 已确认决策（2026-11-25）

| 决策点 | 结论 |
|---|---|
| “允许没有 agent” | 三件事同时成立：① 不配置 AI 也能完整使用；② 不依赖本地/后台 agent 进程或自建代理，纯客户端直连厂商；③ 首期只做**单次任务调用**，不做自主多步 agent（工具调用循环、自动执行） |
| 首期场景 | 编辑器写作辅助、人物印象（建议-采纳）、结构化解析（账本 / 摘抄）、记录问答页 |
| 总开关 | 设置内唯一总开关，默认关闭；关闭后入口全部隐藏、零请求，已保存配置与 Key 保留（详见 §1.4） |
| 密钥边界 | 仅本机 SecureStore，**不进备份**；换机或恢复备份后需重新填写 |
| 首期不接入 | 音乐元数据、密码本、图片视觉、语音转写、自动后台任务 |

### 1.2 必须先解决的产品口径冲突

现有文档四处明确拒绝 AI 参与叙事，本方案**有意修改其中两处已勾选的既定决策**，因此必须先得到产品确认，再进入实现：

| 现有文档 | 原文 | 本方案的处理 |
|---|---|---|
| [PRD_V3.md](PRD_V3.md) §3.2 | “AI 自动总结、心理分析或人物关系判断”属非目标 | 保持非目标：不做自动总结、不做情绪/关系判断；AI 只在用户主动调用时工作 |
| [PRD_V3.md](PRD_V3.md) §8.5 | “MVP 只实现两类确定性回忆，不使用 AI” | 保持：首页/日历回忆不加 AI，v1 不改任何回忆逻辑 |
| [V4_CHANGE_PLAN.md](V4_CHANGE_PLAN.md) D3 | “不自动改写，**不做 AI 抽取**” | **需改判**：人物印象从“本地启发式抽取”升级为“本地建议为默认、AI 建议为可选按钮”，不替换默认行为 |
| [V4_CHANGE_PLAN.md](V4_CHANGE_PLAN.md) §10 | “不包含 AI 情绪分析、人格判断、关系预测” | 保持：提示词与场景均不做这三类输出 |
| [V4 交互样本](design/v4.html) 02/03 段 | “没有 AI 总结，只做确定性的时间”“不自动改写任何叙述” | **文案需微调**为“没有 AI 自动总结”；“不自动改写”继续成立 |

本方案给出的边界（建议直接写进 PRD 与 V4 文案）：

1. AI **不产生**系统自动内容：首页、日历、人物页在没有用户点击时不会调用模型。
2. AI **不改写**既有数据：编辑器结果不自动保存；人物印象必须点“采纳”；账本解析只预填表单；问答页不落库。
3. AI **不判断**关系与情绪：人物印象只允许“描述我从记录里读到的样子”，并必须附来源记录日期。
4. 设置默认关闭（`ai.enabled = false`），关闭后所有入口隐藏，主流程与现在完全一致。
5. 无 AI 时，人物印象仍显示现有本地启发式建议——即“不做 AI 抽取”的默认行为原样保留，AI 只是额外可选项。

建议在 PRD 新增一节“AI 可选增强（默认关闭）”，并把 V4 D3 的“不做 AI 抽取”改为“默认不做 AI 抽取；可选择让 AI 再给一句建议”。

### 1.3 与现有约束的对应关系

| 现有约束 | 本方案的遵守方式 |
|---|---|
| 本地优先、无服务端（[README.md](../README.md)） | 无中转服务；请求从设备直连用户填写的厂商地址；默认只发送纯文本，不发送图片/语音/密码 |
| 数据可迁移 | 密钥不进备份；AI 配置与用量本就是设备级数据，明确标注“不随备份迁移” |
| App 启动不能被阻塞 | AI 不参与 `AppStateProvider` 初始化；不做启动探测；无定时任务 |
| 不新增一级导航 | 不新增 Tab；AI 设置与用量是二级页；问答页从“时间线”页进入 |
| 文案温和、明确 | 费用一律标注“估算”、错误文案不出现“失败/严重”以外的施压表达；余额不支持时如实说明而不是隐藏 |

### 1.4 总开关语义（本期必做）

开关是这套能力的第一道门：**关掉就等于没有这个功能**，而不是“关掉只隐藏按钮、后台还在跑”。

| 项目 | 约定 |
|---|---|
| 位置 | 设置 → AI 助手，页面第一行“启用 AI 功能”，唯一总开关 |
| 默认值 | 关闭（首次安装、恢复备份后均为关闭） |
| 存储 | 独立 `ai_settings` 表的 `enabled` 键，默认缺省即关闭；**不写 `settings` 表**，因此不进备份、不会被恢复备份覆盖 |
| 关闭时 · 入口 | 除“设置 → AI 助手”外所有 AI 入口全部隐藏：编辑器“AI 写作”、人物“让 AI 再给一句”、账本“一句话记账”、摘抄“帮我理解这段”、时间线问答页入口 |
| 关闭时 · 请求 | 不发起任何请求：不检测、不查余额、不拉模型列表、不执行任务；不注册任何监听或定时任务 |
| 关闭时 · 进行中 | 立即 `abort()` 当前请求，已生成的部分文本保留在预览层，用户可复制或丢弃 |
| 关闭时 · 数据 | 已保存的服务商配置与 SecureStore 密钥**保留**（便于随时重开），只清掉内存中的模型列表与余额缓存 |
| 关闭时 · 用量 | 历史用量保留，可在 `/ai-usage` 只读查看；不产生新记录 |
| 重新打开 | 不自动检测、不自动请求；显示上次检测结果并标注时间，需要时手动点“检测” |
| 彻底清除 | “删除服务商”删配置与 Key；删除全部数据清空配置、Key、用量与开关状态 |

要点：关闭后主流程（打卡、写记录、人物、账本、阅读、密码本、备份）与未接入 AI 时完全一致；开关本身随时可从设置页打开，不需要重装或清数据。

---

## 2. 现状勘察结论（决定方案形态的事实）

| 事实 | 位置 | 对方案的影响 |
|---|---|---|
| 结构化数据全部在 SQLite（当前 `user_version = 40`），媒体文件在文件系统；`AppState` 全量加载到内存 | [sqlite-schema.ts](../apps/mobile/src/infrastructure/database/sqlite-schema.ts)、[app-state.tsx](../apps/mobile/src/application/state/app-state.tsx) | 问答页可直接在内存里做候选检索，v1 不需要引入向量库或 FTS |
| 备份是白名单式快照 `BackupSnapshot`（定义在 `database-models.ts`，导出实现 `exportBackupSnapshot` 在 `sqlite-repository.ts`），`settings` 表全量导出；`repository-contract.ts` 不含备份方法 | [database-models.ts](../apps/mobile/src/infrastructure/database/database-models.ts)、[sqlite-repository.ts](../apps/mobile/src/infrastructure/database/sqlite-repository.ts) | 独立的 AI 表天然不进备份；AI 配置不要塞进 `settings` 表 |
| 已有 `expo-secure-store`，密码本与邀请链接私钥都走它 | [password-vault-storage.ts](../apps/mobile/src/features/vault/password-vault-storage.ts)、[profile-collection-key-storage.ts](../apps/mobile/src/features/profile-collection/profile-collection-key-storage.ts) | 密钥直接复用 SecureStore，不新增依赖 |
| 已有 `expo/fetch`（支持流式） | `apps/mobile/node_modules/expo/fetch.js` | 流式输出不需要新增依赖，也不需要 WebView 中转 |
| 全仓只有更新检查一处直接 `fetch`；另有 `expo-file-system` 下载（APK、EPUB 书源） | [android-update.ts](../apps/mobile/src/features/system/android-update.ts)、[epub-file-system.ts](../apps/mobile/src/features/bookshelf/epub-file-system.ts) | AI 会是第二个 HTTP 直连出口，必须集中封装超时、取消、重定向策略、错误映射与日志脱敏 |
| Android 生产构建已声明 INTERNET 权限、未开启 cleartext（debug 构建 `usesCleartextTraffic="true"`）；`app.json` 未配置 ATS 例外（生成的 `Info.plist` 仅放开本地网络明文） | `apps/mobile/android/app/src/main/AndroidManifest.xml`、`apps/mobile/android/app/src/debug/AndroidManifest.xml`、[app.json](../apps/mobile/app.json) | 只允许 `https://` 的自定义地址；不支持 http 自建网关，除非未来改构建配置 |
| 人物页已有“本地启发式建议印象 + 采纳”交互（建议卡只在印象为空且未忽略时出现，“换一句”轮换本地候选） | [person-detail-screen.tsx](../apps/mobile/src/features/people/person-detail-screen.tsx) | AI 只作为新增的次要入口，不替换本地默认建议 |
| 编辑器命令通过枚举下发到 WebView；命令执行前会 `restoreSelection`，现有插入只有 `insertHtml`（在保存选区插入），没有整篇替换/追加命令；粘贴走 `document.execCommand('insertHTML')` | [rich-text-editor.types.ts](../apps/mobile/src/features/journal/rich-text-editor.types.ts)、[rich-text-editor.dom.tsx](../apps/mobile/src/features/journal/rich-text-editor.dom.tsx) | 需新增 `insertMarkdown` / `replaceBodyMarkdown` / `appendMarkdown` 三种命令语义，但不需要重构编辑器 |
| `feedback.prompt` 会把提交值写进持久日志 | [feedback.ts](../apps/mobile/src/shared/feedback.ts) | **禁止**用 `feedback.prompt` 输入 API Key |
| 仓库目前没有移动端单测（`test` 脚本为占位） | [package.json](../apps/mobile/package.json) | 验收以 `typecheck`、双端 `build`、真机清单为主 |

---

## 3. 总体架构

### 3.1 分层

```text
┌──────────────────────────── UI 层（features） ────────────────────────────┐
│ features/ai（设置 / 服务商编辑 / 用量 / 问答）                            │
│ features/journal · people · ledger · bookshelf（各场景的入口与预览）      │
└───────────────▲──────────────────────────────────────────▲────────────────┘
                │ useAi()（application 层契约）             │ 直接复用现有 useAppState()
┌───────────────┴──────────────────────────────────────────┴────────────────┐
│ application/ai：AiProvider + useAi()                                      │
│   · 读取配置/密钥（按需，不常驻）· 任务目录与提示词 · 组装请求 · 记账      │
└───────────────▲──────────────────────────────────────────▲────────────────┘
                │                                          │
┌───────────────┴──────────── infrastructure/ai ───────────┴────────────────┐
│ ai-provider.ts  适配器契约 + 能力位                                       │
│ ai-http.ts      超时/取消/SSE 解析/错误归一化/脱敏                        │
│ ai-key-store.ts SecureStore 读写（每服务商一条）                          │
│ ai-price-table.ts 价格表 + 费用估算（版本化数据，不在业务代码里写死）     │
│ providers/{openai-compatible,anthropic,deepseek}.ts                       │
└───────────────▲───────────────────────────────────────────────────────────┘
                │ repository 方法
┌───────────────┴──────────── infrastructure/database ──────────────────────┐
│ 迁移 v41：ai_provider_profiles、ai_usage_records                          │
│ sqlite-repository 增加 AI 配置与用量读写（不进 BackupSnapshot）           │
└───────────────────────────────────────────────────────────────────────────┘
```

要点：

- **配置无全局常驻缓存**：配置和密钥在每次任务执行、每次设置页进入时读取，避免“删除全部数据 / 恢复备份”后内存里残留旧密钥或旧服务商。这是相比把 AI 塞进 `AppState` 更安全、改动更小的做法。
- **不做全局 `enabled` 的副作用**：入口显隐由设置页读取的配置决定；关闭后不注册任何监听、不发起任何请求。

### 3.2 新增与改动文件清单

| 类型 | 文件 | 职责 |
|---|---|---|
| 新增 | `apps/mobile/src/infrastructure/ai/ai-provider.ts` | `AiProviderKind`、适配器接口、`AiProbeResult`、`AiBalance`、`AiUsage`、`AiResult` |
| 新增 | `apps/mobile/src/infrastructure/ai/ai-http.ts` | `requestJson` / `streamSse`，统一 `AbortSignal`、超时、`https` 校验、错误归类、密钥脱敏 |
| 新增 | `apps/mobile/src/infrastructure/ai/providers/openai-compatible.ts` | `/models`、`/chat/completions`、流式 `include_usage` 容错 |
| 新增 | `apps/mobile/src/infrastructure/ai/providers/anthropic.ts` | `/v1/models`、`/v1/messages`、SSE 用量累计 |
| 新增 | `apps/mobile/src/infrastructure/ai/providers/deepseek.ts` | 复用 OpenAI 兼容实现 + `/user/balance` |
| 新增 | `apps/mobile/src/infrastructure/ai/ai-key-store.ts` | SecureStore 键规范、读写删、`keyHint` 生成 |
| 新增 | `apps/mobile/src/infrastructure/ai/ai-price-table.ts` | 价格规则表 + `estimateCost()`（未知模型返回 `null`） |
| 新增 | `apps/mobile/src/infrastructure/ai/ai-usage-summary.ts` | 纯函数：按日/服务商/模型/任务聚合 |
| 新增 | `apps/mobile/src/application/ai/ai-provider.tsx` | `AiProvider` + `useAi()`：`runTask`、`probe`、`getBalance`、配置 CRUD、用量查询 |
| 新增 | `apps/mobile/src/application/ai/ai-tasks.ts` | 任务目录：`taskId`、提示词模板、上下文裁剪、`maxOutputTokens` |
| 新增 | `apps/mobile/src/features/ai/ai-settings-screen.tsx` | 设置主页（开关、服务商列表、余额、用量入口、隐私说明） |
| 新增 | `apps/mobile/src/features/ai/ai-provider-editor-sheet.tsx` | 添加/编辑服务商（类型、Base URL、模型、Key、检测） |
| 新增 | `apps/mobile/src/features/ai/ai-usage-screen.tsx` | 用量统计与费用估算 |
| 新增 | `apps/mobile/src/features/ai/ai-chat-screen.tsx` | 记录问答页 |
| 新增 | `apps/mobile/src/features/ai/ai-chat-retrieval.ts` | 纯函数：候选记录评分、上下文打包、token 预算 |
| 新增 | `apps/mobile/app/ai-settings.tsx`、`app/ai-usage.tsx`、`app/ai-chat.tsx` | 路由入口，只导出对应 feature 屏幕 |
| 改动 | `sqlite-schema.ts` | v41 迁移（两张表 + 索引） |
| 改动 | `repository-contract.ts`、`sqlite-repository.ts` | 服务商配置 CRUD、用量写入/聚合、`deleteAllData` 增删 AI 表 |
| 改动 | `app-state.tsx` | `deleteAllLocalData` 追加删除 SecureStore 中的 AI 密钥 |
| 改动 | `app/_layout.tsx` | 在 `AppStateProvider` 内挂 `<AiProvider>`（仅提供上下文，不发起请求） |
| 改动 | `features/settings/settings-screen.tsx` | 新增 “AI 助手” 入口（未启用时显示“未启用”） |
| 改动 | `features/journal/editor-screen.tsx`、`rich-text-editor.dom.tsx`、`rich-text-editor.types.ts` | AI 写作入口 + 预览面板 + `insertMarkdown` / `replaceBodyMarkdown` / `appendMarkdown` 命令 |
| 改动 | `features/people/person-detail-screen.tsx` | 保留本地默认建议，新增“让 AI 再给一句”可选入口 |
| 改动 | `features/ledger/ledger-screen.tsx` | “一句话记账”入口与表单预填 |
| 改动 | `features/bookshelf/excerpts-screen.tsx`（及阅读器选区菜单） | “帮我理解这段” → 写入摘抄备注 |
| 改动 | `features/system/privacy-policy-screen.tsx` | 新增 AI 第三方传输条款 |
| 改动 | `features/backup/backup-screen.tsx`（设置里的“数据管理”即该页） | 增加“AI 配置与密钥不进备份”说明 |
| 改动 | `docs/PRD_V3.md`、`docs/design/v4.html`（文案） | 见 §1.2，需产品确认后修改 |

### 3.3 分层理由（对照 [AGENTS.md](../AGENTS.md)）

- 网络与平台能力属于 `infrastructure/`，因此适配器、密钥、价格表放 `infrastructure/ai/`，不放进 `shared/`。
- 多个 feature 都要调用 AI，编排放 `application/ai/`（跨 feature 组合），符合“跨 feature 工作流在 application 协调”。
- 只有 AI 设置/用量/问答是“AI 自己的界面”，其余场景的入口和预览留在各自 feature，避免 `features/ai` 反向依赖业务 feature。
- 类型不建 workspace package：只有移动端消费，放 `infrastructure/ai/` 契约文件即可。

---

## 4. 数据与密钥

### 4.1 迁移 v41

```sql
CREATE TABLE IF NOT EXISTS ai_provider_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('openai-compatible','anthropic','deepseek')),
  base_url TEXT NOT NULL,
  model_id TEXT NOT NULL,
  key_hint TEXT,                     -- 只存末 4 位用于回显
  supports_stream INTEGER NOT NULL DEFAULT 1,
  supports_balance INTEGER NOT NULL DEFAULT 0,
  last_probe_at TEXT,
  last_probe_status TEXT,            -- ok | auth_failed | network_failed | model_missing | unknown
  last_probe_latency_ms INTEGER,
  last_probe_message TEXT,
  models_json TEXT,                  -- 最近一次 /models 结果缓存（不含密钥）
  is_default INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_profiles_default_idx
  ON ai_provider_profiles(is_default) WHERE is_default = 1;

CREATE TABLE IF NOT EXISTS ai_usage_records (
  id TEXT PRIMARY KEY NOT NULL,
  provider_id TEXT NOT NULL,         -- 不设外键：删除服务商后用量历史保留
  provider_kind TEXT NOT NULL,
  model_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success','failed','cancelled')),
  error_code TEXT,
  input_tokens INTEGER,
  cached_input_tokens INTEGER,
  output_tokens INTEGER,
  duration_ms INTEGER NOT NULL,
  estimated_cost_micros INTEGER,     -- 整数微单位，避免浮点误差；未知价格时为 NULL
  currency TEXT,                     -- CNY | USD
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_usage_records_created_idx ON ai_usage_records(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_records_provider_idx ON ai_usage_records(provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_settings (
  key TEXT PRIMARY KEY NOT NULL,     -- 目前只有 'enabled'
  value TEXT NOT NULL                -- 'true' | 'false'；缺省视为 false
);
```

迁移约束：

- 只做 `CREATE TABLE / CREATE INDEX`，不改既有表，不需要 `PRAGMA foreign_keys = OFF` 重建。
- `user_version 41`，与现有 `addColumnIfMissing` / `tableExists` 风格保持一致。
- 不在 `AppPreferences` 里加字段：AI 配置属于设备级配置，不是“我的偏好”，避免污染 `settings` 表和备份。
- 总开关放 `ai_settings` 而不是 `settings`：否则导出/恢复备份会把“是否启用 AI”当作用户偏好一起搬运。

### 4.2 密钥

| 项目 | 约定 |
|---|---|
| 存储 | `SecureStore.setItemAsync('stillalive.ai.key.<providerId>', key, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY })` |
| 读取 | 仅在执行任务、检测、查余额时读取，用完不写日志、不放进 React state 之外的持久结构 |
| 回显 | 只显示 `key_hint`（末 4 位，如 `…ab12`）；输入框使用 `secureTextEntry` |
| 删除 | 删除服务商时立即删密钥；`deleteAllLocalData` 删除所有前缀键 |
| 入口限制 | 禁止使用 `feedback.prompt` 收 Key（它会记录提交值到持久日志），改用独立底部表单 |
| 日志 | 适配器错误只保留厂商状态码与归一化 `error_code`，**不记录**请求头、请求体、响应体 |

### 4.3 备份 / 恢复 / 删除语义

| 操作 | 总开关 | AI 配置 | 密钥 | 用量记录 |
|---|---|---|---|---|
| 导出备份 | 不包含 | 不包含 | 不包含 | 不包含 |
| 恢复备份 | 保持现状（不被覆盖） | 保持现状 | 保持现状 | 保持现状 |
| 删除全部数据 | 重置为关闭 | 清空 | 清空 | 清空 |
| 删除单个服务商 | 不变 | 删该行 | 删该键 | 保留（历史对账） |

UI 文案：

- 数据管理页（`/backup` → `backup-screen.tsx`，同时承载导入、导出与删除全部数据）加一行说明：“AI 服务商配置、API Key 与用量记录保存在本机，不随备份导出。”
- 删除全部数据确认框追加：“同时会删除已保存的 AI API Key。”

### 4.4 明确不落盘的内容

- 提示词全文与模型原始回复（避免隐私文本进入持久日志或数据库）。
- 聊天历史：问答页关闭即清空，v1 不提供会话恢复。
- 密钥明文进任何日志、备份、分享文件、错误提示。

---

## 5. Provider 适配层

### 5.1 契约（`infrastructure/ai/ai-provider.ts`）

```ts
export type AiProviderKind = 'openai-compatible' | 'anthropic' | 'deepseek';

export type AiTaskId =
  | 'editor.polish' | 'editor.continue' | 'editor.title' | 'editor.organize'
  | 'person.impression'
  | 'ledger.parse'
  | 'excerpt.explain'
  | 'chat.answer';

export interface AiProviderConfig {
  id: string;
  label: string;
  kind: AiProviderKind;
  baseUrl: string;
  modelId: string;
  keyHint: string;
  supportsStream: boolean;
  supportsBalance: boolean;
  enabled: boolean;
  isDefault: boolean;
}

export interface AiMessage { role: 'system' | 'user' | 'assistant'; content: string; }

export interface AiUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}

export interface AiResult {
  text: string;
  usage: AiUsage;
  latencyMs: number;
  finishReason: string | null;
}

export interface AiBalance {
  available: boolean;
  currency: 'CNY' | 'USD';
  total: string;
  granted: string;
  toppedUp: string;
}

export interface AiProbeResult {
  status: 'ok' | 'auth_failed' | 'network_failed' | 'model_missing' | 'unsupported' | 'unknown';
  latencyMs: number | null;
  modelCount: number | null;
  message: string;
  balance: AiBalance | null;
}

export interface AiAdapter {
  listModels(config: AiProviderConfig, key: string, signal?: AbortSignal): Promise<{ id: string; label: string }[]>;
  chat(input: {
    config: AiProviderConfig; key: string; messages: AiMessage[];
    maxOutputTokens?: number; temperature?: number; json?: boolean;
    signal?: AbortSignal; onDelta?: (text: string) => void;
  }): Promise<AiResult>;
  probe(config: AiProviderConfig, key: string, signal?: AbortSignal): Promise<AiProbeResult>;
  getBalance?(config: AiProviderConfig, key: string, signal?: AbortSignal): Promise<AiBalance | null>;
}
```

### 5.2 能力矩阵

| 能力 | DeepSeek | OpenAI 兼容 | Anthropic | 说明 |
|---|---|---|---|---|
| 对话 | ✅ | ✅ | ✅ | 三家都能满足全部首期场景 |
| 流式 | ✅ | ✅（部分网关不支持，降级为非流式） | ✅ | 失败自动降级，不阻塞结果 |
| 模型列表 | ✅ `GET /models` | ✅ `GET /models` | ✅ `GET /v1/models` | 用于检测与模型选择器 |
| 余额查询 | ✅ `GET /user/balance` | ⚠️ 首期不做（标准 Key 无公开余额接口，需实现时核对） | ⚠️ 首期不做（组织级用量/费用需 Admin Key） | 能力位隔离，UI 如实显示“该服务商不提供余额查询” |
| 用量上报 | ✅ 响应 `usage` | ✅ `usage`（流式需 `include_usage`） | ✅ `usage`（流式在 `message_start` / `message_delta`） | 统一归一化；缺失时只记请求与耗时 |
| JSON 输出 | ✅ `response_format` | ✅ `response_format`（网关支持度不一） | ⚠️ 无同名参数 | 统一用“提示词约束 + 本地严格校验”，不依赖 JSON 模式 |

### 5.3 多服务商策略

- 可保存多个服务商配置，但同一时刻只有一个默认服务商承担 AI 任务；`enabled = 0` 的服务商只保留配置、不参与调度。
- v1 不做“按任务切服务商”的路由（避免费用与行为不可预期）；v2 若需要，在任务目录里增加 `providerId` 覆盖即可，不影响数据模型。

### 5.4 适配器实现要点

**OpenAI 兼容（`openai-compatible`）**

- 默认 Base URL：`https://api.openai.com/v1`；用户可改为任意 `https://` 网关（OneAPI、LiteLLM、自建）。
- `GET {base}/models` 检测；`POST {base}/chat/completions` 生成。
- 认证：`Authorization: Bearer <key>`。
- 流式：请求体加 `stream: true` 与 `stream_options: { include_usage: true }`；**容错**：网关不返回 usage 时 `usage` 为空但仍视为成功。
- `finish_reason`、`choices[0].message.content` 归一化；空内容按失败处理。

**DeepSeek（`deepseek`）**

- 默认 Base URL：`https://api.deepseek.com`（OpenAI 格式）；适配器内部统一拼接 `/chat/completions` 与 `/models`。
- 验证过的接口（本次查阅官方文档）：
  - `GET /user/balance` → `{ is_available: boolean, balance_infos: [{ currency: 'CNY' | 'USD', total_balance, granted_balance, topped_up_balance }] }`
  - `GET /models` → 带 `context_window`、`max_output_tokens` 等元数据
- 说明：DeepSeek 当前默认开启思考模式，输出 token 会明显高于纯文本生成；费用展示必须标注“估算”。
- 可选扩展：DeepSeek 也提供 Anthropic 格式端点（`/anthropic`），v1 不启用，避免同一服务商出现两条路径。

**Anthropic（`anthropic`）**

- 默认 Base URL：`https://api.anthropic.com`；`POST /v1/messages`，必须带 `anthropic-version: 2023-06-01`、`x-api-key`、`content-type`。
- `system` 必须是请求顶层字段，不能作为 `messages` 中的 system 角色；`max_tokens` 必填。
- 流式：解析 `message_start` 的 `usage.input_tokens` 与后续 `message_delta` 的 `output_tokens`；**取最终累计值，不跨事件累加**，避免重复计数。
- 模型列表：`GET /v1/models`（同一套鉴权头）。

**自定义 OpenAI 兼容网关**

- 只承诺 OpenAI 标准路径与字段；网关私有余额接口不做猜测，UI 显示“该服务商不提供余额查询”。
- 非 `https` 地址在保存时直接拒绝，文案说明原因（当前构建未开启 HTTP 明文访问）。

### 5.5 错误归一化

| HTTP / 情况 | `error_code` | 用户文案（示例） | 处理 |
|---|---|---|---|
| 401 / 403 | `auth_failed` | “API Key 未通过验证，请检查服务商与 Key” | 不重试 |
| 402 / 余额不足类响应 | `insufficient_balance` | “该服务商余额不足，请充值后重试” | 不重试 |
| 404 | `model_missing` | “找不到该模型，请重新选择模型” | 不重试 |
| 429 | `rate_limited` | “请求过于频繁，请稍后再试” | 只重试 1 次，带短退避 |
| 5xx | `provider_error` | “服务商暂时不可用，稍后再试” | 只重试 1 次 |
| 超时 / `AbortError` | `timeout` / `cancelled` | “请求超时” / 用户主动取消不报错 | 不重试 |
| 网络不可达 | `network_failed` | “网络不可用，AI 功能暂不可用” | 不重试 |

原则：错误信息**不回显响应体原文**（可能包含被发送的记录片段），只给状态码与归一化说明；详细归因写持久日志时也只写 `provider_id / kind / error_code / status`。

### 5.6 检测（“支持检测”的落地定义）

三级检测，默认只跑免费的前两级：

1. **配置预检（本地，0 成本）**：地址必须是 `https`、Key 非空、模型非空；按 Key 前缀预填类型（`sk-ant-` → Anthropic，`sk-` → OpenAI 兼容，其余默认 DeepSeek）但允许用户改。
2. **连通性检测（0 成本）**：`GET /models`，记录 `last_probe_status`、`last_probe_latency_ms`、模型数量，并刷新 `models_json` 缓存。
3. **可用性检测（可能计费，默认关闭）**：发送 1 次极短请求（`max_tokens` 很小）。UI 明确写“会产生极少量费用”，由用户勾选后再执行。

结果展示：`已连接 · 延迟 820ms · 12 个模型` / `Key 未通过验证` / `网络不可达` / `该地址不支持模型列表`。检测结果落库，设置页显示最近一次结果与时间，不自动重检。

### 5.7 余额查询

- 供应商能力位 `supportsBalance` 决定入口显隐。
- DeepSeek：读取 `/user/balance`，展示总额度、赠送额度、充值额度、是否可用；一次页面进入只查一次，避免频繁请求。
- OpenAI / Anthropic：标准 Key 首期不提供余额口径，界面显示“该服务商不提供余额查询”+ 厂商控制台入口（`Linking.openURL`）。**不估算余额**，不伪造数字。
- 自定义网关：同上，不猜测其私有接口。
- 余额缓存：只在内存与 `last_probe_*` 同级展示，不写库、不进备份（余额是瞬时状态）。

### 5.8 用量统计与费用估算

- **记账点**：每次任务结束（成功/失败/取消）写一条 `ai_usage_records`；写入失败不影响任务结果（`catch` 后仅写日志）。
- **统计口径**：今日 / 最近 7 天 / 最近 30 天 / 全部；维度＝服务商、模型、任务、状态。
- **费用估算**：`estimated_cost_micros = tokens × 单价 / 1e6`；规则来自 `ai-price-table.ts`：
  - 数据版本字段 `version` + 生效说明；未知模型返回 `null`，UI 只显示 token，不显示金额。
  - DeepSeek 存在峰谷价与缓存命中价：v1 使用**非缓存、高峰价**作为保守上界，UI 标注“按高峰价估算，实际以厂商账单为准”；缓存命中 token 若上报则单独记录，暂不参与估算。
  - 币种随价格表；余额币种与估算币种不同时并列展示，不做汇率换算。
- **不做的**：本地余额推算、跨设备的用量合并、自动对账。官方用量/费用接口（Anthropic Admin API、OpenAI 组织级用量）列为 v2 可选项，需要管理员密钥，首期不做。

### 5.9 流式、取消、并发

- 统一用 `expo/fetch` 读取 `ReadableStream`，按 `data:` 行解析 SSE；`[DONE]` 结束。
- 每个任务持有一个 `AbortController`；页面卸载或用户点“停止”时 `abort()`；取消不写错误提示，但记一条 `cancelled` 用量。
- 全局并发上限 1（同一时刻只允许一个 AI 请求），避免误触导致多份计费；UI 上按钮进入加载态。
- 超时：短任务 45s，问答 90s；`maxOutputTokens` 按任务类型设上限（见附录 B）。
- 流式失败或网关不支持流式时自动降级为非流式一次性返回，用户无感。

### 5.10 网络策略

- 仅允许 `https://`；保存配置与执行请求前各校验一次（防止历史配置被写坏）。
- AI 请求显式使用 `redirect: 'manual'`（`expo/fetch` 支持），遇到 3xx 直接按失败处理，避免把 Key 发到意外域名。注意：现有更新检查未设置该保护，不能直接复用其请求封装。
- 不使用系统代理之外的特殊配置；不引入 WebView 中转（避免 Key 暴露在 DOM 环境）。
- 请求头只带必要字段：`Authorization` / `x-api-key`、`content-type`、`accept`、`anthropic-version`；不带 UA 之外的指纹信息。

---

## 6. 场景融合

### 6.0 融合总览

| 现有模块 | AI 融合方式 | 触发 | 版本 | 风险 |
|---|---|---|---|---|
| 写一条 / 编辑器 | 润色、续写、起标题、整理 | 用户点按钮 | P1 | 中：文本质量与费用 |
| 人物详情 | 本地默认建议不变，AI 建议为可选入口（建议-采纳） | 用户点“让 AI 再给一句” | P2 | 中：隐私模式需确认 |
| 账本 | 一句话记账解析 → 预填表单 | 用户点“一句话记账” | P2 | 低：本地校验兜底 |
| 书架 / 摘抄 | 摘抄解读 → 预填备注 | 用户点“帮我理解这段” | P3 | 低 |
| 时间线 | 记录问答页（仅本机检索） | 用户的问题 | P3 | 高：上下文成本、隐私 |
| 设置 / 数据管理 | 服务商配置、检测、余额、用量、隐私披露 | 用户进入设置 | P0 | 低 |
| 密码本 / 音乐 / 相册 | 不融合 | — | — | 刻意排除 |

### 6.1 统一交互协议（所有场景共用）

```text
用户显式点击入口 → 组装最小上下文 → 请求（可取消、显示“正在生成…”）
→ 预览层展示结果（标明模型、耗时、估算费用）
→ 用户选择：替换 / 追加 / 采纳 / 保存为摘抄 / 丢弃
```

四条硬规则：

1. **不自动触发**：没有点击就没有请求。
2. **不直接写库**：落库动作由用户确认后调用既有 `AppState` 方法完成。
3. **可撤销**：编辑器走新增的 Markdown 插入/替换命令，正文变更仍由用户控制；人物印象采纳后与现有编辑路径一致。
4. **隐私前置**：首次使用某场景时显示一次“将把 X 发送到 Y”，二次确认后本设备记住。

### 6.2 编辑器写作辅助（P1）

| 项目 | 内容 |
|---|---|
| 入口 | 编辑器底部“更多”面板新增一组“AI 写作”，包含：润色这段、继续写、起 3 个标题、整理成一条记录 |
| 无配置时 | 入口置灰 + 提示“在设置中启用 AI 后可用了”，点击跳转 `/ai-settings` |
| 上下文 | 当前草稿 `bodyMarkdown`（按 token 预算截断，优先保留开头与结尾）、记录日期、已关联人物名字（只发名字） |
| 输出 | 底部预览面板（复用 `DraggableBottomSheet`）：结果全文 + “替换正文 / 追加到末尾 / 复制 / 丢弃” |
| 写入方式 | 命令只携带 Markdown；在 `rich-text-editor.dom.tsx` 内调用 `renderRichTextMarkdown()`（marked + DOMPurify，仅在 DOM 环境可用）转成已消毒 HTML，再 `execCommand('insertHTML')`。RN 侧不得直接调用该函数 |
| 命令扩展 | 现有命令执行前会 `restoreSelection`，只有“在保存选区插入”。需在类型与 DOM handler 两侧同步新增：`insertMarkdown`（光标处插入）、`replaceBodyMarkdown`（整篇替换）、`appendMarkdown`（追加末尾并把光标放到结尾），分别对应预览面板的三个动作 |
| 约束 | 不自动保存草稿之外的内容；AI 文本不做“已保存”状态；不发送图片/语音 |
| 选区说明 | 当前编辑器未把选区文本回传 RN；v1 以“整篇草稿”为输入。若需要“只润色选中段”，再加一个 `getSelection` 桥接（列为 v2） |

### 6.3 人物印象（P2）

| 项目 | 内容 |
|---|---|
| 现状 | `person-detail-screen.tsx` 用 `buildImpressionSuggestions(posts)` 从记录里抽一句，用户点“采纳为印象”；“换一句”只轮换本地候选 |
| 改造（默认不变） | 默认仍显示现有本地建议，满足 V4 D3“不做 AI 抽取”的原状；在建议卡片下方加一个次要入口“让 AI 再给一句”，只有点击才调用模型 |
| AI 输出 | 1–3 条候选，每条附来源记录日期；沿用现有“grow”卡片与“采纳”按钮 |
| 回退 | 未启用 AI / 请求失败时保持本地建议可用，**功能不退化**；错误只在卡片内一行提示 |
| 上下文 | 人物 `name / nickname / relationToMe` + 最多 20 条关联记录的文本片段（每条约 200 字截断），只此而已 |
| 隐私 | `person.privacyMode === 'private'` 时默认不发送，需用户在该次确认“允许发送这位人物的记录片段” |
| 约束 | 不判断关系、不做情绪分析；不自动写入；不替换本地默认建议 |
| 写入 | 复用现有 `updatePerson(..., impression)` 路径；“采纳”提示保持“已写入印象，只改了这一句” |

### 6.4 结构化解析（P2 / P3）

**账本（P2）**

- 入口：账本页顶部“一句话记账”；输入如“昨天午饭 32，打车 18”。
- 输出契约：`{ type: 'expense' | 'income', amount: number, category: string, dayKey?: 'YYYY-MM-DD', note?: string }`。
- 本地校验：类型 / 金额 / 日期 / 分类白名单（复用 `CATEGORIES`；它当前是 `ledger-screen.tsx` 的模块私有常量，需先导出或下沉为领域常量）→ 不合法就展示“没看懂，换个说法”并保留原文。
- 落地：预填现有新增账单表单，用户确认后调用 `createLedgerTransaction`；**不批量直接入库**。
- 成本控制：`maxOutputTokens` ≤ 300；只传用户这句话，不传历史账本。

**摘抄（P3）**

- 入口：摘抄列表/阅读器选区菜单新增“帮我理解这段”。
- 输入：摘抄文本 + `bookTitle` / `chapterTitle`；输出 ≤ 200 字解读。
- 落地：预填 `bookExcerpt.note` 编辑框，用户确认后 `updateBookExcerpt`；不自动写评论、不自动生成新记录。

### 6.5 记录问答页（P3）

| 项目 | 内容 |
|---|---|
| 路由 | `app/ai-chat.tsx` → `/ai-chat`；入口在时间线页顶部与设置页，不加 Tab |
| 页面结构 | 顶部标题与范围选择 → 消息流（仅本次会话，内存）→ 输入框 + “停止” → 底部披露“仅基于本机记录” |
| 范围选择 | 全部 / 某个人 / 最近一年 / 当前这本书的摘抄；默认“全部” |
| 检索（v1，不引入向量库） | 纯函数 `selectChatContext()`：<br>1. 过滤范围与隐私（`person.privacyMode === 'private'` 的记录默认排除）<br>2. 关键词打分：对查询做 2-gram 切分，命中标题/正文/人物名加权；近期记录轻微加权<br>3. 按分数排序后在 token 预算内截断（默认 8000 输入 token），每条附日期与人物名<br>4. 若候选为空，直接回复“你的记录里没有相关内容”，不请求模型 |
| 追问 | 保留最近 2 轮问答作为上下文；超出预算时只保留最近一轮 |
| 引用 | 回答允许模型引用 `[记录日期]`；页面把回答里出现的日期做成可点跳转 `/post/[id]`（仅当日期能唯一定位） |
| 落库 | 不保存对话；提供“保存这段回答为记录”显式按钮（复用编辑器保存路径） |
| 披露 | 首次进入弹一次说明：会把命中的记录片段发送到所选服务商；页脚常驻“本页不联网检索，只用你的本机记录” |
| 成本 | 每次提问前显示“本次约 N 条记录，预估 X tokens”；可取消 |

### 6.6 本版明确不做

- 首页/日历自动 AI 总结、人格化文案、情绪与关系判断。
- 在后台或启动时调用模型；任何自动重试队列。
- 密码本、密码字段、私钥、联系人等敏感数据进入任何提示词（代码层：上下文构造只接收白名单字段）。
- 图片/语音/PDF 内容上传（视觉与转写留到 v2，若做需单独隐私评审）。
- 音乐元数据补齐（收益低、可离线用文件名）。

---

## 7. UI 与文案

### 7.1 设置入口

`features/settings/settings-screen.tsx` 新增分组（放在 `CONTENT` 之后、`NOTIFICATIONS` 之前）：

- 标题：“AI 助手”
- 未配置：`未启用 · 配置后可辅助写作与整理`，右侧状态点灰色。
- 已配置且开关打开：`已启用 · DeepSeek · deepseek-flash`，右侧状态点绿色；检测异常时为金色。
- 已配置但开关关闭：`已关闭 · 配置保存在本机`，右侧状态点灰色。
- 点击进入 `/ai-settings`。

### 7.2 页面结构

**`/ai-settings`**

1. 顶部说明卡：本机处理边界、Key 只存本机、费用由服务商计费。
2. 总开关“启用 AI 功能”（默认关，页面首行）：
   - 开：显示服务商列表与添加按钮。
   - 关：列表折叠为一行摘要（“已保存 N 个服务商 · 全部停用”），隐藏“添加服务商”和检测入口；服务商配置与 Key 保留。
   - 副文案：“关闭后所有 AI 入口隐藏，不会发出任何请求；已保存的配置与 Key 仍留在本机。”
3. 服务商列表：默认服务商标记、检测状态与时间、余额（仅能力支持的）、操作：编辑 / 检测 / 设为默认 / 删除。
4. “添加服务商”按钮 → 底部表单：
   - 类型：DeepSeek / OpenAI / Anthropic / 自定义（OpenAI 兼容）
   - 名称、Base URL（预填默认值）、模型（可手填或用检测后的列表选择）
   - API Key（`secureTextEntry`，不显示明文，保存后只显示末 4 位）
   - “保存并检测”
5. 入口：“用量统计” → `/ai-usage`；“隐私说明” → 现有隐私协议页。
6. 删除服务商：确认框写明“会同时删除本机保存的 API Key”。

**`/ai-usage`**

- 时间范围分段：今日 / 7 天 / 30 天 / 全部。
- 总览卡：请求数、成功/失败、输入/输出 token、估算费用（“估算”角标）。
- 分组列表：按服务商 → 模型 → 任务；显示 token 与估算费用。
- 空态：`还没有 AI 用量`；口径说明：“费用按本地价格表估算，以厂商账单为准；余额请以服务商为准。”
- v1 不做导出。

**`/ai-chat`**

- 见 §6.4；气泡区分“你的问题 / 回答”，回答底部附“复制 / 保存为记录 / 引用来源”。

### 7.3 状态与文案矩阵

| 状态 | 设置页 | 场景入口 |
|---|---|---|
| 未启用 | “未启用” | 置灰 + “在设置中启用 AI” |
| 已启用、未检测 | “已启用 · 尚未检测” | 可用 |
| 检测失败（鉴权） | “Key 未通过验证” | 点击后提示核对 Key，跳设置 |
| 余额不足 | “余额不足” | 提示充值，不重试 |
| 网络不可用 | “当前离线，AI 暂不可用” | 提示稍后再试，主流程不受影响 |
| 请求中 | — | 按钮加载态 + 可取消 |

### 7.4 视觉与交互规范

- 颜色、圆角、间距、字体全部走 `@still-alive/tokens`；三套主题（moss / sand / midnight）必须逐一检查。
- 触摸区 ≥ 44pt（与 A12 项一致）；底部表单复用 `DraggableBottomSheet`；成功/失败反馈走 `shared/feedback.ts`（成功用 `notice`，错误用 `alert`）。
- 加载态允许 120–240ms 的透明度过渡，不加庆祝动画，符合“只做必要的动效”。
- 不新增图标依赖：使用 `expo-symbols` 的 Material Symbols 名称。

---

## 8. 隐私与安全

1. **最小化传输**：默认只发送用户当前操作的文本与必要元信息；人物隐私模式、密码本、私钥绝不进入上下文。
2. **显式确认**：首次进入每个 AI 场景时展示一次传输说明；问答页常驻披露。
3. **不落盘**：提示词、回复、对话历史不写数据库/日志/备份。
4. **日志脱敏**：`infrastructure/ai` 不得把 Key、`Authorization`、请求体交给 `writePersistentLog` / `writePersistentError`；`feedback.alert` 的消息不得包含 Key 或响应体原文；`feedback.prompt` 禁止用于密钥输入。
5. **密钥生命周期**：删除服务商、删除全部数据、关闭 AI 时不残留；SecureStore 使用 `WHEN_UNLOCKED_THIS_DEVICE_ONLY`。
6. **入口隔离**：密码本相关页面不引用 `useAi()`；代码评审把这条作为 checklist。
7. **披露更新**：隐私协议新增“AI 功能”条款——启用后相关文本会发送至你选择的第三方服务商，传输内容、目的、不包含的字段、关闭方式、不提供账号与中转服务。
8. **备份说明**：备份页/数据管理页明确“AI 配置、Key、用量不进备份”。
9. **设备级风险说明**：Key 保存在本机；Root/越狱或系统备份可能暴露 SecureStore 内容，属于设备安全边界，应用在设置页用一句话说明。

---

## 9. 失败与降级

| 场景 | 行为 |
|---|---|
| 未配置 / 总开关关闭 | 除设置页外所有 AI 入口隐藏，其余功能零差异、零请求；进行中的请求被取消 |
| 配置错误 | 检测结果与场景内错误提示指向设置页，一行文案说明原因 |
| 网络失败 / 超时 | 提示后返回原页面，输入内容保留（编辑器正文、问答输入、账本原文） |
| 取消 | 无错误提示；用量记 `cancelled` |
| 流式中断 | 保留已生成的文本，提供“重试” |
| 记账解析失败 | 展示原文 + “没看懂，换个说法”，不写入 |
| 用量写入失败 | 只写日志，不阻断生成结果 |
| AI 相关代码异常 | 全部在 feature/application 边界 `try/catch`，不允许影响 `AppStateProvider` 初始化或首页渲染 |

---

## 10. 实施计划与验收

### 10.1 阶段与工作量（人日，含约 20% 缓冲）

| 阶段 | 内容 | 预估 |
|---|---|---:|
| P0 | 迁移 v41、契约、HTTP/SSE、三个适配器、密钥、总开关、检测、余额（DeepSeek）、设置页、用量骨架、错误映射 | 5.8 |
| P1 | 编辑器 AI 入口 + 预览面板 + 3 个 Markdown 命令 + 4 个写作任务 | 2.0 |
| P2 | 人物印象（本地默认 + AI 可选入口）+ 一句话记账解析 | 3.0 |
| P3 | 摘抄解读 + 记录问答页（检索、引用、预算） | 4.0 |
| P4 | 隐私协议与各页披露、删除/备份语义、双端真机回归 | 2.0 |
| 合计 | | **16.8** |

依赖顺序：P0 →（P1、P2 可并行）→ P3 → P4。P0 完成即可发一版“只有配置与用量”的可用状态，符合“先接入层、后场景”的节奏。

### 10.2 验收清单

工程：

- [ ] `pnpm typecheck`、`pnpm test`、`pnpm build`、`git diff --check` 全绿。
- [ ] 新增文件符合目录规则：路由文件仅导出屏幕；无 `src/components` 等旧目录；`shared/` 未反向依赖 feature。
- [ ] 迁移 40 → 41 在已有数据上可执行；重复启动幂等。

功能：

- [ ] 未配置 AI 时：启动无网络请求、首页/编辑/人物/账本行为与 v1.1.21 一致。
- [ ] 总开关关闭时：五个场景入口全部消失；抓包确认无任何 AI 请求（含检测/余额/模型列表）；进行中的请求被取消；重新打开后配置与 Key 仍在、需手动检测。
- [ ] 添加 DeepSeek Key → 检测成功 → 余额显示总额/赠送/充值。
- [ ] 添加 Anthropic / OpenAI 兼容 Key → 检测成功 → 余额显示“不支持查询”。
- [ ] 错误 Key、404 模型、断网、超时、取消、429 各自有对应文案。
- [ ] 编辑器四个写作任务可用；替换/追加/丢弃行为正确；AI 文本不自动保存。
- [ ] 人物印象：默认建议与现在一致；AI 建议仅在点击后出现、可采纳；关闭 AI 后行为不变；隐私模式默认不发送。
- [ ] 一句话记账：解析正确日期与分类；非法输入不写入；表单预填后可改。
- [ ] 问答页：范围过滤、空结果不请求模型、引用跳转、保存为记录。
- [ ] 用量页：四种范围与分组正确；未知模型不显示金额；重启后数据仍在。
- [ ] 导出备份不含 AI 表与密钥；恢复备份不影响现有 AI 配置；删除全部数据后 Key 与配置均清空。
- [ ] 三套主题、4096×? 无布局溢出；触控 ≥ 44pt；读屏可区分按钮。

安全：

- [ ] 全仓搜索：AI 模块无 `feedback.prompt`、无 `console.log(key)`、无持久日志记录请求体。
- [ ] 错误提示与日志中不出现 Key 前缀/后缀之外的任何 Key 片段。
- [ ] 密码本页面无 `useAi` 引用。

---

## 11. 风险与待决策

| 风险 / 待决策 | 影响 | 建议 |
|---|---|---|
| PRD/V4 文案与新能力冲突 | 产品口径自相矛盾 | 上线前置改 PRD §3.2 与 V4 02/03 段，见 §1.2 |
| 价格与模型频繁变化（如 DeepSeek 2026 已改为峰谷价、`deepseek-flash`） | 估算偏差、模型名失效 | 价格表带版本；模型从 `/models` 拉取；未知模型不显示金额 |
| 费用估算口径（峰谷/缓存/思考 token） | 用户对“花费”的预期 | 统一标注“估算，以账单为准”；DeepSeek 用高峰价保守上界 |
| 第三方网关 SSE/字段差异 | 部分网关不可用 | 流式失败降级非流式；错误归一化；提示“该地址可能不兼容” |
| 问答页上下文成本与隐私 | 单次请求可能较大 | 默认 8000 输入 token 上限；范围选择；请求前显示条数与预估 |
| 是否保存对话历史 | 隐私 vs 便利 | v1 不保存；v2 若做需单独评审（可保存为“记录”由用户显式操作） |
| 是否支持 http 自建地址 | 局域网/自建网关需求 | v1 仅 https；若必须支持，需要改 Android cleartext 与 iOS ATS，单独立项 |
| OpenAI/Anthropic 余额口径 | 需求中的“余额查询”无法三家对齐 | 能力位如实降级；v2 可评估 Admin Key 的组织级用量/费用接口 |
| 自主 agent（多步工具调用） | 用户明确“允许没有” | v1 不做；类型上预留 `AiTaskId` 与工具能力位，不实现循环 |

---

## 附录 A：Provider 端点汇总（标注本次查证状态）

| 服务商 | 用途 | 端点 | 状态 |
|---|---|---|---|
| DeepSeek | 余额 | `GET /user/balance` | 已查证：[官方文档](https://api-docs.deepseek.com/api/get-user-balance/)；字段 `is_available`、`balance_infos[].currency/total_balance/granted_balance/topped_up_balance` |
| DeepSeek | 模型列表 | `GET /models` | 已查证：[官方文档](https://api-docs.deepseek.com/api/list-models/) |
| DeepSeek | 价格 | — | 已查证：[官方定价](https://api-docs.deepseek.com/quick_start/pricing/)（按 1M token、峰谷价、缓存命中价；2026 年模型为 `deepseek-flash`、`deepseek-v4-pro`） |
| DeepSeek | 对话 | `POST /chat/completions`（OpenAI 格式） | 官方文档同页；实现时按真实响应核对 `usage` 字段 |
| OpenAI 兼容 | 模型列表 | `GET /v1/models` | 标准 OpenAI 路径；本次官方文档被 Cloudflare 拦截未能直接打开，实现时以真实响应验证 |
| OpenAI 兼容 | 对话 | `POST /v1/chat/completions` | 同上；流式 `stream_options.include_usage` 需真实响应验证 |
| Anthropic | 模型列表 | `GET /v1/models` + `x-api-key` + `anthropic-version` | 已查证：[官方文档](https://platform.claude.com/docs/en/api/models-list) |
| Anthropic | 对话 | `POST /v1/messages` | 公开文档；流式 `message_start` 的 `usage.input_tokens`、`message_delta` 的 `output_tokens` 已在公开资料交叉确认，实现时以真实 SSE 验证 |
| Anthropic | 组织级用量/费用 | Admin API（`/v1/organizations/usage_report/*`、`cost_report`） | 仅组织管理员密钥可用，v2 可选，实现前需核对官方文档 |

## 附录 B：任务目录、上下文与预算

| `taskId` | 触发点 | 输入（token 预算） | 输出上限 | 落点 |
|---|---|---|---:|---|
| `editor.polish` | 编辑器更多面板 | 当前草稿 ≤ 1500 | 800 | 预览 → 替换/追加正文 |
| `editor.continue` | 同上 | 草稿末尾 ≤ 1200 | 500 | 追加 |
| `editor.title` | 同上 | 草稿摘要 ≤ 800 | 120 | 预览 → 复制/插入 |
| `editor.organize` | 同上 | 草稿 ≤ 1500 | 800 | 替换 |
| `person.impression` | 人物页“让 AI 再给一句” | 人物资料 + ≤ 20 条记录 ≤ 2500 | 300 | 建议卡 → 采纳为印象 |
| `ledger.parse` | 账本“一句话记账” | 用户输入 ≤ 200 | 300（JSON） | 预填表单 |
| `excerpt.explain` | 摘抄“帮我理解这段” | 摘抄 ≤ 800 | 300 | 预填备注 |
| `chat.answer` | 问答页 | 命中记录 ≤ 8000 | 1200 | 仅本次会话 |

提示词统一在 `application/ai/ai-tasks.ts` 中以常量模板维护，禁止在 feature 内散写；所有模板要求：不虚构未提供的事实、不评价人物关系、不输出心理判断、不引用未给出的记录。
