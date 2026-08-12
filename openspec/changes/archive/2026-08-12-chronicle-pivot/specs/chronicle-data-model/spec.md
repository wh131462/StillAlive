## ADDED Requirements

### Requirement: Post 实体

系统 SHALL 以 `Post` 为核心写入单元，一天可存在 0 到多条 Post。

字段：
- `id`: string, UUID v4
- `createdAt`: ISO-8601 datetime with timezone
- `dayKey`: string, `YYYY-MM-DD`（基于用户本地时区）
- `body`: string, Markdown 文本
- `photos`: array of `{ path: string, width: int, height: int }`, 本地路径
- `mentions`: array of `personId`
- `reminderId`: string | null（若该 Post 由一条过期提醒生成，关联回该 reminder）
- `updatedAt`: ISO-8601 datetime

#### Scenario: 一天零帖不阻塞

- **WHEN** 用户某天只打卡不写任何帖
- **THEN** 当日无 Post 记录
- **AND** 打卡事实（`dayKey` 命中）仍在主页 "N 天" 计数内

#### Scenario: 一天多帖

- **WHEN** 用户同一 `dayKey` 连续创建多条 Post
- **THEN** 各 Post 共享 `dayKey`，按 `createdAt` 正序排列在时间线

### Requirement: Reminder 实体

系统 SHALL 提供独立于 Post 的 `Reminder` 实体，用于事件日期提醒。

字段：
- `id`: string
- `title`: string（如「妈妈的生日」「认识楠楠两周年」）
- `targetDate`: `YYYY-MM-DD`
- `recurrence`: `'once' | 'yearly' | 'monthly'`
- `relatedPersonIds`: array of `personId`
- `note`: string | null（附加说明）
- `createdAt`: ISO-8601

#### Scenario: 到期当天显示为今日提醒

- **WHEN** 当前本地日期等于 `targetDate`（或按 recurrence 命中）
- **THEN** 主页「今日提醒」段显示该 Reminder
- **AND** 时间线当日分隔条旁显示提醒 badge

#### Scenario: 过期沉淀为历史备忘

- **WHEN** 当前本地日期晚于 `targetDate` 且该提醒没有对应的 Post 记录
- **THEN** 时间线在 `targetDate` 当日的位置显示为「那天是 X 日子」条目
- **AND** 该条目可被 1 点变成一条真正的 Post（带 `reminderId` 关联）

### Requirement: Person 实体

系统 SHALL 为每个人物存一份本地档案，含结构化卡片 + 可选长文小传。

字段：
- `id`: string
- `name`: string
- `aliases`: array of string（@ 自动补全备选）
- `avatar`: `{ path: string } | null`
- `birthday`: `MM-DD | YYYY-MM-DD | null`
- `impression`: string（短印象，1-2 句）
- `biography`: string（长文 Markdown，可选）
- `tags`: array of string（家人 / 朋友 / 同事 等，纯本地分类）
- `themeColor`: `'green' | 'coral' | 'gold' | 'blue' | null`
- `createdAt`, `updatedAt`

#### Scenario: 小传自动聚合

- **WHEN** 用户打开某 Person 页
- **THEN** 页面顶部显示卡片字段（avatar / name / impression / birthday / tags）
- **AND** 中部显示 `biography`（如存在）
- **AND** 下部自动聚合所有 `mentions` 包含该 `personId` 的 Post，按 `createdAt` 倒序

#### Scenario: 小传可为空

- **WHEN** 用户未写 biography
- **THEN** 中部不出现 biography 区域，直接展示聚合时间线

### Requirement: Mention 索引

系统 SHALL 维护 Post 到 Person 的多对多关联，仅用于本地查询与视图过滤，不向任何外部推送。

#### Scenario: 输入 @ 触发人物联想

- **WHEN** 用户在 Post 编辑器输入 `@`
- **THEN** 弹出候选列表，优先展示最近被 @ 的人 + 姓名 / 别名匹配
- **AND** 选中后将 `personId` 写入该 Post 的 `mentions` 数组

#### Scenario: @ 不向他人推送

- **WHEN** Post 的 `mentions` 包含某 `personId`
- **THEN** 该 Post **仅** 在本设备的「人物页聚合时间线」与「交集视图」中可见
- **AND** 不产生任何网络请求、不发送通知、不写入他人设备

### Requirement: 索引与唯一性约束

- Post / Person / Reminder 的 `id` SHALL 在本地数据库内唯一。
- Post SHALL 建立 `(dayKey)` 与 `(mentions[])` 的索引以支持时间线与人物页的快速查询。
- Reminder SHALL 建立 `(targetDate, recurrence)` 的索引。
- Person SHALL 建立 `(name)` 与 `(aliases[])` 的索引以支持 @ 补全。

#### Scenario: 时间线范围查询

- **WHEN** 加载时间线某月份视图
- **THEN** 通过 `(dayKey between ...)` 单次查询拿到当月所有 Post
- **AND** 合并同月的过期 Reminder 得到最终时间线
