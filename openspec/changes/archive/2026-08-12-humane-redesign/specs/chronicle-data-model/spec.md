## ADDED Requirements

### Requirement: Person 实体扩展

`Person` 表 SHALL 新增以下字段以承载 humane-redesign 的需求。

```ts
type Person = {
  // ...原有字段保留
  customFields: { key: string; value: string }[];   // 自定义键值对
  relations: {
    targetId: string | 'self';                       // 关联到的另一人物 id 或 'self'
    type: string;                                    // 关系类型字符串（预设或自定义）
  }[];
  layoutHint?: { x: number; y: number };             // 关系图中用户拖动后的位置
};
```

#### Scenario: 字段向后兼容

- **WHEN** 老版本 Person 数据无 `customFields` / `relations` / `layoutHint`
- **THEN** 应用以空数组 / undefined 处理，不报错
- **AND** 用户首次进入新版本时不强制迁移；用户首次编辑某 Person 时这些字段才被写入

### Requirement: Event 实体新增

系统 SHALL 引入与 Post 并列的 `Event` 实体：

```ts
type Event = {
  id: string;
  title: string;
  description: string;
  participants: ('self' | string)[];    // 'self' 表示「我」也是参与者
  timeHint: string;                     // 自由字符串："高三那年" / "2018-06" 等
  sortKey: number;                      // 用户拖拽排序权重，默认 = createdAt 毫秒数
  linkedPostId: string | null;          // 若来源于某 Post，则关联
  createdAt: string;
  updatedAt: string;
};
```

#### Scenario: 仅属于人物的事件

- **WHEN** 创建一条 Event，`participants = ['mom']`（不含 self）
- **THEN** 该 Event 出现在 mom 的事件流中
- **AND** **不出现**在主页的历史合流（因为「我」不是参与者）

#### Scenario: 同时属于人物与我的事件

- **WHEN** 创建一条 Event，`participants = ['self', 'mom']`
- **THEN** 该 Event 出现在 mom 的事件流中
- **AND** **同时出现**在主页的历史合流

### Requirement: Mention 索引补强

系统 MUST 将 Mention 保持为本地索引，并仅在用户确认后由提及内容创建关联 Event。

#### Scenario: @ 提及生成 Event 提示

- **WHEN** 用户保存一条 Post，其 `mentions` 非空
- **THEN** 系统弹出一次性轻量 toast「要把这条同时记为 mom 的经历吗？」
- **AND** 用户点「记一条」→ 自动创建对应 Event，`linkedPostId` 指向该 Post，`participants = ['self', ...mentions]`
- **AND** 用户点关闭 → toast 消失，不再询问

#### Scenario: @ 不向他人推送（合约延续）

- **WHEN** 任意操作产生 Mention 或 Event
- **THEN** 系统不发送任何网络请求
- **AND** 第一次使用 @ 时显示一次性 toast 解释，之后不再出现专业提示

## MODIFIED Requirements

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
- `linkedEventId`: string | null（**新增**：若该 Post 被用户选择"同时记为某人经历"，关联到生成的 Event）
- `updatedAt`: ISO-8601 datetime

#### Scenario: 一天零帖不阻塞

- **WHEN** 用户某天只打卡不写任何帖
- **THEN** 当日无 Post 记录
- **AND** 打卡事实（`dayKey` 命中）仍在主页 "N 天" 计数内

#### Scenario: 一天多帖

- **WHEN** 用户同一 `dayKey` 连续创建多条 Post
- **THEN** 各 Post 共享 `dayKey`，按 `createdAt` 正序排列在时间线

#### Scenario: Post 关联 Event

- **WHEN** Post 的 `linkedEventId` 非空
- **THEN** Post 详情底部显示「也记在了 X 的经历里 →」可点击跳到该 Event
- **AND** Event 详情显示「来自打卡：YYYY-MM-DD →」可跳回 Post
