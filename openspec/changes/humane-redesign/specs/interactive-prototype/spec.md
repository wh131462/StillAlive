## ADDED Requirements

### Requirement: 屏列表更新（App 端）

`docs/design/app.html` SHALL 按 humane-redesign 重整屏列表。

新增：
- `home-flow`：主页三态卡片 + 历史合流（合并替代旧 today 屏）
- `person-graph`：人物关系图（人物 tab 默认视图）
- `person-detail-v2`：升级版人物详情（三段式 + 自定义字段 + 事件流）
- `event-composer`：事件编辑 sheet
- `relation-picker`：关系类型选择 sheet

移除：
- `today` 屏的并列「我还在 / 写一条」双 CTA（替换为状态机 home-flow）
- `person-detail`（被 `person-detail-v2` 替代）

保留：
- `login` / `register` / `checkin-cal` / `people-list`（作为人物 tab 副视图）/ `timeline` / `intersection` / `milestone` / `profile` / `settings` / `reminder-email`

#### Scenario: 人物 tab 默认进图

- **WHEN** 检查 `docs/design/app.html` 的人物 tab 入口
- **THEN** 初始 active 屏为 `person-graph`，不是 `people-list`
- **AND** 顶部分段控件 `.segmented` 让用户切换到列表视图

#### Scenario: 屏切换器无编号 chip

- **WHEN** 检查屏切换器
- **THEN** chip 不出现 `01-14` 数字
- **AND** chip 视觉为简洁标签（参考设计系统 `segmented-control` 或简化 `screen-chip`）

### Requirement: 屏列表更新（Web 端）

`docs/design/web.html` SHALL 同步更新。

调整：
- `web-dashboard` 顶部新增「今日打卡」卡片（与 App home-flow 状态机一致）
- `web-bio-editor` 升级为 `person-detail-v2` 桌面版（左卡片 + 中事件流 + 右自定义字段）
- 新增 `web-person-graph`：以「我」为中心的关系图，画布占满主区
- 移除 nav-rail 中的「故事」「公共」旧入口（chronicle-pivot 已移除，本次确认无残留）

#### Scenario: 桌面端图谱视图

- **WHEN** 用户在 web nav-rail 点击「关系图」
- **THEN** 主区域渲染 `web-person-graph` 屏
- **AND** 图谱画布大于移动端版本，节点直径 64px，可见关系标签字体大一档

### Requirement: 原型交互契约延续

#### Scenario: 数据属性契约

- **WHEN** 新增屏使用 `data-go` / `data-pick-group` / `data-modal-open` / `data-modal-close`
- **THEN** 由 `shared/app-prototype.js` / `shared/web-prototype.js` 统一处理
- **AND** 不在屏内联新的 `<script>` 块

#### Scenario: 新增 renderPersonGraph

- **WHEN** 渲染 `person-graph` 屏
- **THEN** `shared/app-prototype.js` 暴露 `renderPersonGraph(targetEl, dataMock)`
- **AND** 不依赖任何第三方图形库（d3 / cytoscape / vis 一律禁止）

## MODIFIED Requirements

### Requirement: App 原型至少包含 9 个可切换子屏

`docs/design/app.html` 内的 App 原型 SHALL 至少包含以下子屏，每屏均可通过屏切换器单独到达，且每屏至少有一个真实可视的内容区域（非占位卡片）。

子屏列表（最低集 — humane-redesign 后）：
- Login（登录）
- Register（注册）
- **Home Flow（主页三态卡片 + 历史合流）**
- Timeline（个人时间线，反向时序）
- Checkin Calendar（月日历，作为时间线日历视图）
- People List（人物列表，作为人物 tab 副视图）
- **Person Graph（人物关系图，以"我"为中心；人物 tab 默认视图）**
- **Person Detail v2（升级版人物详情：三段式 + 自定义字段 + 事件流）**
- Intersection（交集视图）
- Milestone（里程碑）
- Profile（我的）
- Settings（偏好设置）
- Reminder Email（提醒邮件）

#### Scenario: App 子屏数 ≥ 9

- **WHEN** 检查 `docs/design/app.html` 中 `[data-screen]` 节点
- **THEN** 其数量 ≥ 9

#### Scenario: 每屏存在真实内容

- **WHEN** 切换到任一 App 子屏
- **THEN** 屏内显示真实可读的中文 UI 文本与组件（不是占位卡片 + 描述文案）

### Requirement: Web 原型至少包含 7 个可切换子屏

`docs/design/web.html` 内的 Web 原型 SHALL 至少包含以下子屏。

子屏列表（最低集 — humane-redesign 后）：
- Web Dashboard（桌面仪表盘 / 含今日打卡卡片）
- Web Timeline
- Web Editor（写作 sheet 桌面版）
- **Web Person Graph（桌面版关系图，画布占满主区）**
- **Web Person Detail v2（桌面版人物详情）**
- Web Intersection
- Web Auth（私人登录）
- Web Settings（含备份语言重构）

#### Scenario: Web 子屏数 ≥ 7

- **WHEN** 检查 `docs/design/web.html` 中 `[data-screen]` 节点
- **THEN** 其数量 ≥ 7
