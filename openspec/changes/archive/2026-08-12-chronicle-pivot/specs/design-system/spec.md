## ADDED Requirements

### Requirement: 编年史场景组件类

设计系统 SHALL 在 `shared/style.css` 继续增量追加以下组件类，服务于 chronicle-pivot 场景。所有类必须只引用已有 token（var(--*)），不得硬编码颜色 / 字号 / 圆角 / 阴影。

#### Scenario: post-composer

- **WHEN** 检查 `.post-composer` 及 `.post-composer__body / .post-composer__toolbar / .post-composer__meta`
- **THEN** 撰写器有统一边距、圆角 `--radius-md`、轻阴影 `--shadow-soft`，工具栏 flex 横向排列「@ / 图 / 提醒 / 保存」

#### Scenario: mention-chip

- **WHEN** 在文本中渲染 `@<person>`
- **THEN** 使用 `.mention-chip`，底色 `--vital-green-soft`，文字色 `#2F6F30`，pill 圆角 `--radius-pill`

#### Scenario: bio-card

- **WHEN** 人物页顶部结构化卡片
- **THEN** 使用 `.bio-card` 布局：左头像（最少 80×80）+ 右姓名 + 印象 + 标签 + 生日 + 主题色条
- **AND** 主题色条以当前 Person 的 `themeColor` 映射为四色之一

#### Scenario: timeline-row

- **WHEN** 时间线单条帖或条目
- **THEN** 使用 `.timeline-row`，左侧 12px 主题色垂直细线 + 右侧卡片（`.panel` 风格）
- **AND** 日期分隔 `.timeline-divider` 横向贯穿，sticky 粘顶

#### Scenario: reminder-badge

- **WHEN** 时间线中「那天是 X 日子」条目
- **THEN** 使用 `.reminder-badge`，菱形点缀 + 黄金色 `--memory-gold`

#### Scenario: intersection-branch

- **WHEN** 交集视图中的每一条人物轴
- **THEN** 使用 `.intersection-branch` 类定义行高、头像尺寸、轴线 `1px solid var(--line)`
- **AND** 轴上圆点使用对应 Person 主题色，连接线 `1px solid var(--ink-faint)`

### Requirement: 组件类依然尊重令牌不可变

新增编年史组件类 MUST 复用既有设计令牌，不得重定义或硬编码对应的颜色、字号、圆角和阴影值。

#### Scenario: 禁止 token 重定义

- **WHEN** 本次新增组件类在 `shared/style.css`
- **THEN** 不出现新的 `:root { --... }` 块
- **AND** 不修改任何已有 token 数值

#### Scenario: 反例即失败

- **WHEN** code review 发现硬编码 `#5BB85C` / `20px` / `0 2px 8px rgba(...)`
- **THEN** 改回 `var(--vital-green)` / `var(--radius-lg)` / `var(--shadow-soft)` 后再合入
