## ADDED Requirements

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

子屏列表（最低集）：
- Login（登录）
- Register（注册）
- Today（主页 / 巨字生存天数 / 打卡卡片 / 关心条 / 今日提醒）
- Check-in Calendar（月日历 + 统计行 + 近期记录）
- Check-in Entry（写记录 / 照片占位 / 文本框 / 心情九宫格）
- People List（人物列表 + 分组 chip + 生日卡）
- Person Detail（人物详情 / 基本信息网格 / 关系时间轴）
- Care Manage（关心管理 / 我的匹配码 / 待确认 / 已绑定列表）
- Milestone-7（7 天里程碑 / 巨字数字 / 引言）
- Profile（我的 / 头像 / 我的码 / 像素图 / 设置入口）
- Settings（偏好设置 / 提醒时间 / 外观切换）
- Death Confirm（死亡确认设置 / 触发天数选择 / 邮件预览）

#### Scenario: App 子屏数 ≥ 9

- **WHEN** 检查 `docs/design/app.html` 中 `[data-screen]` 节点（或等价屏容器）
- **THEN** 其数量 ≥ 9

#### Scenario: 每屏存在真实内容

- **WHEN** 切换到任一 App 子屏
- **THEN** 屏内显示真实可读的中文 UI 文本与组件（不是占位卡片 + 描述文案）

### Requirement: Web 原型至少包含 7 个可切换子屏

`docs/design/web.html` 内的 Web 原型 SHALL 至少包含以下子屏，每屏均可通过左侧导航或屏切换器到达，每屏均显示真实内容。

子屏列表（最低集）：
- Public · Home（首页 / 巨字 slogan / 近期故事）
- Public · Stories List（故事列表 / 时间轴）
- Public · Story Detail（长文阅读器 / 左目录 / 正文 Fraunces）
- Auth（登录注册合一）
- Dashboard（仪表盘 / 生存天数 / 年度热力图）
- Editor（长文编辑 / 大写作区）
- Settings（账号 / 备份 / 死亡确认配置）

#### Scenario: Web 子屏数 ≥ 7

- **WHEN** 检查 `docs/design/web.html` 中 `[data-screen]` 节点
- **THEN** 其数量 ≥ 7

#### Scenario: Web 公共与后台分流

- **WHEN** 切换到 Web 公共前台屏（Home / Stories / Story Detail）
- **THEN** 顶部地址栏显示公共域路径（如 `stillalive.app/...`）
- **WHEN** 切换到 Web 后台屏（Dashboard / Editor / Settings）
- **THEN** 顶部地址栏显示带 `/app` 前缀的路径

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
