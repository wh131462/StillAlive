## ADDED Requirements

### Requirement: 个人总时间线（Timeline）

系统 SHALL 提供一个反向时序的「时间线」视图，作为除主页外的主要回看入口。

时间线内容来源：
1. 用户自己的所有 Post（按 `createdAt` 倒序）
2. 已过期但未被 Post 转化的 Reminder（以「那天是 X 日子」条目呈现，位置按 `targetDate`）
3. 打卡事实��「我还在」空打卡：若该 `dayKey` 无任何 Post，也显示一枚小徽章）

#### Scenario: 日期分隔

- **WHEN** 时间线滚动跨越日期
- **THEN** 以「YYYY MM DD 周 X」+ 当日生存天数编号（Day 127）作为分隔条
- **AND** 分隔条粘性（sticky）停留在视口顶端直到下一分隔条推上去

#### Scenario: 过期提醒穿插

- **WHEN** 时间线遇到某日有过期 Reminder 且当日无对应 Post
- **THEN** 该日分隔下显示「那天是 X 日子」条目（rhombus 样式徽章 + 文案）
- **AND** 点击该条目进入「补写一条" + 预填标题」Post 撰写页

#### Scenario: 空打卡显示

- **WHEN** 某日分隔下该日有空打卡但无 Post
- **THEN** 显示一枚「✓ 我还在」迷你徽章（灰 + 对勾），不占完整卡片空间

### Requirement: 人物页（Person Bio Page）

系统 SHALL 为每个 Person 提供独立页面，上半结构化卡片，下半自动聚合该人相关 Post。

#### Scenario: 卡片区

- **WHEN** 进入某人物页
- **THEN** 顶部显示：大头像 + 姓名 + 印象 + 标签 + 生日（如有）+ 主题色条
- **AND** 卡片区右上角有「编辑」入口切换为表单模式

#### Scenario: 长文小传区

- **WHEN** 该 Person 的 `biography` 非空
- **THEN** 卡片下方展示小传长文（Markdown 渲染，Fraunces Italic 字体，与 index 日记样张一致）
- **AND** 段落上限不截断，整段完整展示

#### Scenario: 聚合时间线

- **WHEN** 小传下方
- **THEN** 自动展示所有 `mentions` 包含该 `personId` 的 Post，按 `createdAt` 倒序
- **AND** 每条 Post 显示日期 + 摘要 + 当时一并 @ 的其他人的头像串（避免 ta 的时间线显得孤立）

#### Scenario: 无聚合时的空态

- **WHEN** 该 Person 尚未被任何 Post @ 过
- **THEN** 聚合区显示空态「还没有和 ta 相关的记录 写一条试试 &rarr;」，点击进入新帖编辑器并预填 `@<name>`

### Requirement: 交集视图（Intersection View）

系统 SHALL 提供一个专门的「交集」入口，以类 Git branch 的可视化呈现所有人物在时间轴上的共现关系。

#### Scenario: 每人一行横向轴

- **WHEN** 进入交集视图
- **THEN** 每个 Person 占据一条独立的水平时间轴（"行"），行首是 ta 的头像 + 名字
- **AND** 所有行共享同一条横向时间坐标（左 = 久远，右 = 最近）

#### Scenario: 单 @ 点

- **WHEN** 某 Post 仅 @ 了一个 Person
- **THEN** 在 ta 的那条轴上该时刻位置画一个圆点（主题色）

#### Scenario: 多 @ 交点

- **WHEN** 某 Post 同时 @ 了两人及以上
- **THEN** 在相应各行的同一时刻位置分别画圆点
- **AND** 在这些圆点之间画出垂直连接线（浅色细线），视觉上形成一次"交点"

#### Scenario: 孤立人物

- **WHEN** 某 Person 从未被 @
- **THEN** ta 的那行依然保留，但为空轴（仅轴线 + 头像），不隐藏
- **AND** 行右侧显示柔和灰字「尚无共现」

#### Scenario: 时间缩放

- **WHEN** 用户在交集视图使用横向滚动或缩放控件
- **THEN** 时间轴可按 `年 / 季 / 月` 三档切换密度
- **AND** 标尺刻度相应更新

#### Scenario: 点击圆点跳转

- **WHEN** 用户点击任一圆点
- **THEN** 弹出浮层显示该 Post 摘要 + 「打开原帖」按钮
- **AND** 不破坏当前交集视图状态（浮层可关闭返回）

### Requirement: Post 撰写器（Post Composer）

系统 SHALL 在 App 端与 Web 端均提供 Post 撰写入口，两者共享字段与体验原则。

#### Scenario: 共通字段

- **WHEN** 用户打开撰写器
- **THEN** 始终包含：文本区（Markdown / 富文本）+ 添加图片 + @ 人物 + 关联 Reminder（可选）+ 保存
- **AND** 保存后默认回到来源视图（时间线 / 今日）

#### Scenario: Web 端大写作区

- **WHEN** 在 Web 端
- **THEN** 撰写器占据主内容区 60% 以上宽度，支持双栏（左文本 + 右预览）可选
- **AND** 自动保存每 20 秒或失焦时触发，用 mono 小字显示「已保存于 HH:MM」

#### Scenario: App 端轻量撰写器

- **WHEN** 在 App 端
- **THEN** 撰写器占满屏，顶部返回 + 右上「保存」；图片上传入口在文本区下方
- **AND** @ 弹出候选采用底部 sheet
