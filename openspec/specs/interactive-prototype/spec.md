# interactive-prototype Specification

## Purpose
TBD - created by archiving change interactive-prototypes. Update Purpose after archive.
## Requirements
### Requirement: 设备外框承载真实子屏序列

`docs/design/app.html` 与 `docs/design/web.html` SHALL 在页面内放置一个固定尺寸的设备外框（App: 393×852；Web: 1280×800），所有子屏作为「屏栈（screen stack）」内的兄弟节点存在，同一时间仅显示一个屏。

#### Scenario: App 端单屏显示

- **WHEN** 用户在浏览器中打开 `docs/design/app.html`
- **THEN** 页面内可见一个 393×852 的设备外框
- **AND** 设备外框内部的屏栈中，初始可见屏为 Today（主页）
- **AND** 其他子屏（Login、Register、Check-in Calendar 等）均存在于 DOM 中但 `display: none` 或等价隐藏

#### Scenario: Web 端单屏显示

- **WHEN** 用户在浏览器中打开 `docs/design/web.html`
- **THEN** 页面内可见一个 1280×800 的浏览器窗口风格设备外框（含三色按钮 + 地址栏）
- **AND** 设备外框内部的屏栈中，初始可见屏为公共前台 Home
- **AND** 其他子屏均存在于 DOM 中但隐藏

### Requirement: 屏切换器允许直接跳转任一子屏

每个原型页 SHALL 在设备外框旁（或上方）提供一组屏切换 chip，用户点击 chip 即可立即切换设备外框内显示的子屏，无需依赖屏内导航逐级到达。

#### Scenario: chip 切换

- **WHEN** 用户点击屏切换器中标签为「打卡日历」的 chip
- **THEN** 设备外框立刻显示 Check-in Calendar 子屏
- **AND** 其他子屏被隐藏
- **AND** 当前 chip 显示选中态（视觉强调）

#### Scenario: chip 命中所有子屏

- **WHEN** 检查屏切换器
- **THEN** chip 数量与可切换子屏数量一致（App ≥ 9，Web ≥ 7）

### Requirement: 屏内导航交互为原生 JS 实现

设备外框内的导航交互（底部 tab bar 切换、页面内返回按钮、表单按钮跳转、tab 切换）SHALL 由极简原生 JavaScript 处理，不依赖任何前端框架或构建工具。

#### Scenario: tab bar 切换屏

- **WHEN** 用户在 Today 屏点击底部 tab bar 中的「打卡」icon
- **THEN** 设备外框切换到 Check-in Calendar 屏
- **AND** 底部 tab bar 中「打卡」项显示为激活态
- **AND** Today 项变为非激活态

#### Scenario: 返回按钮回到上一屏

- **WHEN** 用户在 Person Detail 屏点击左上角返回按钮
- **THEN** 设备外框回到 People List 屏

#### Scenario: 表单按钮跳转

- **WHEN** 用户在 Login 屏点击「登录」按钮
- **THEN** 设备外框切换到 Today 屏

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

### Requirement: 微交互最小集合

原型 SHALL 提供以下基础微交互，使评审者能感受真实使用流而非纯静态预览。

最小集合：
- 心情选择：点击 mood-chip 切换激活态（同组互斥）
- 标签切换：分组 chip（如「全部 / 家人 / 朋友 / 同事」）切换激活态
- toggle 开关：设置项里的 toggle 可点击切换 on/off
- 模态：「绑定确认」弹窗可被「同意 / 拒绝 / 关闭」按钮关闭
- 触发天数 chip：设置中天数选择互斥激活
- 年度像素图：dashboard 与 profile 中的热力图由 JS 渲染，等级用 vibrant 设计系统的绿色梯度

#### Scenario: 心情互斥

- **WHEN** 用户在 Check-in Entry 屏点击「平静」mood-chip
- **THEN** 「平静」激活，其它 mood 取消激活

#### Scenario: 模态可关闭

- **WHEN** 「绑定确认」弹窗显示并点击「拒绝」
- **THEN** 弹窗隐藏，回到 Care Manage 屏正常状态

### Requirement: 共享设计系统组件类不删除已有令牌

`docs/design/shared/style.css` SHALL 在 `vibrant-design-refresh` 已建立的 token 与组件基础上**只新增**，不删除、不修改 `--bg/--ink/--vital-green/--warm-coral/--memory-gold/--calm-blue/--radius-*/--shadow-*/--space-*/.btn/.btn-primary/.btn-ghost/.panel/.specimen-tag/.field` 等已对外暴露的 API。

#### Scenario: 不破坏 index.html

- **WHEN** 在浏览器打开 `docs/design/index.html`（不修改本次未涉及）
- **THEN** 页面视觉与本次改造前一致，无样式回归

#### Scenario: 新增组件类位于 shared

- **WHEN** 检查新增的导航 / 列表行 / 日历单元格 / 热力图等组件类
- **THEN** 它们定义在 `docs/design/shared/style.css`（不在 `app.html` / `web.html` 内联样式中）

### Requirement: 零构建零依赖

原型 SHALL 在浏览器中通过 `file://` 直接打开即可工作，不需要任何 npm 包、构建工具、CDN 框架（Vue / React / jQuery 等）。

#### Scenario: 直接打开预览

- **WHEN** 用户用任意现代浏览器（Chrome 100+ / Safari 16+ / Firefox 100+）以 `file://` 协议打开 `docs/design/app.html` 或 `docs/design/web.html`
- **THEN** 屏切换、tab 切换、模态、心情选择等核心交互全部可用
- **AND** 浏览器控制台无脚本错误

#### Scenario: 仅原生依赖

- **WHEN** 检查 `<script>` 标签
- **THEN** 仅引用 `shared/app-prototype.js` / `shared/web-prototype.js`（或同等本地路径），无外部 CDN

### Requirement: 基础键盘可达性

原型 SHALL 提供基础的键盘可达性，但不强制完��� a11y 审查。

#### Scenario: Tab 焦点可见

- **WHEN** 用户用 Tab 键在屏切换 chip 间移动焦点
- **THEN** 当前焦点 chip 显示可见的 focus 样式

#### Scenario: ESC 关闭模态

- **WHEN** 「绑定确认」弹窗显示并按下 ESC
- **THEN** 弹窗关闭

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

新增原型屏 MUST 由共享脚本统一处理交互，并保持零第三方图形依赖。

#### Scenario: 数据属性契约

- **WHEN** 新增屏使用 `data-go` / `data-pick-group` / `data-modal-open` / `data-modal-close`
- **THEN** 由 `shared/app-prototype.js` / `shared/web-prototype.js` 统一处理
- **AND** 不在屏内联新的 `<script>` 块

#### Scenario: 新增 renderPersonGraph

- **WHEN** 渲染 `person-graph` 屏
- **THEN** `shared/app-prototype.js` 暴露 `renderPersonGraph(targetEl, dataMock)`
- **AND** 不依赖任何第三方图形库（d3 / cytoscape / vis 一律禁止）

