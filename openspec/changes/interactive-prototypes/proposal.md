## Why

当前 `docs/design/app.html` 与 `docs/design/web.html` 仅以「占位卡片 + 描述文案」展示信息架构，无法点击进入子屏、看不到真实界面，对设计评审、用户走查、前端实现的参考价值都很有限。需要把它们升级为可直接交互的多屏原型，所有计划页（登录、主页、打卡日历、写记录、人物列表、人物详情、关心管理、里程碑、设置等）都以可点击 / 可切换 tab / 可滚动的方式呈现，复用 `frontend-design` skill 的设计风格保证质感不掉档。

## What Changes

- **BREAKING** 删除 `docs/design/app.html` 现有的「主流程 / 关心与里程碑」占位卡片九宫格；`docs/design/web.html` 现有的「公共前台 / 个人后台」占位卡片九宫格。
- 在 `docs/design/app.html` 内放置一个 393×852 的设备外框，内部以「屏栈」方式呈现完整 App 子屏序列；新增屏切换器（chip 列表，点击切换屏幕）+ 屏幕内导航（tab bar、返回按钮、按钮跳转）的真实交互。
- 在 `docs/design/web.html` 内放置一个 1280×800 的 macOS 设备外框，内部以「路由切换」方式呈现完整 Web 子屏序列（公共前台路由 + 后台路由），左侧站点导航 / 顶部 chrome 真实可切。
- 新增可见的全部子屏：App 端 ≥ 9 屏（Login / Register / Today / Check-in Calendar / Check-in Entry / People List / Person Detail / Care Manage / Milestone-7 / Profile / Death Confirm / Settings），Web 端 ≥ 7 屏（Home / Stories List / Story Detail / Auth / Dashboard / Editor / Settings）。
- 引入极简原生 JS（无框架、无构建）实现：屏切换、tab bar 切换、返回/前进、心情选择、表单焦点态、补签日选中、年度热力图渲染等基础交互。
- 复用并扩展 `docs/design/shared/style.css` 的 vibrant 设计系统（已上线）；任何新增组件类（如 `.list-row`、`.calendar-cell`、`.toggle`、`.nav-rail`）写入 shared，page-specific 仅保留布局尺寸。
- 通过 `frontend-design` skill 在视觉层面提升质感（间距节奏、对比、留白、过渡动效），但不引入构建依赖、不改变设计系统骨架（颜色、字体、圆角令牌仍来自 shared/style.css）。
- 不影响：`docs/design/index.html`（仍作为入口与设计语言展示页）；`shared/style.css` 的核心 token；后端、PRD。

## Capabilities

### New Capabilities

- `interactive-prototype`: 静态原型在浏览器内的可交互能力规范——屏栈结构、屏切换 / tab 切换 / 路由切换的交互契约、键盘可达性最低要求、state 仅存于前端 DOM 的约束。

### Modified Capabilities

- `design-system`: 在 vibrant 风格基础上扩展共享组件类（导航、列表、日历、热力图、toggle、模态等），现有 token 与组件契约保持向后兼容；不影响已落地的 `index.html`。

## Impact

- **设计稿文件**：`docs/design/app.html`、`docs/design/web.html` 整体重写；`docs/design/shared/style.css` 增量新增组件类（不删除已有令牌）；`docs/design/index.html` 保持不变。
- **新增资源**：可在 `docs/design/shared/` 下新增 `app-prototype.js`、`web-prototype.js` 这类极简原生脚本，只服务于原型交互。
- **不引入新依赖**：禁止 npm / 构建工具 / 框架；交互仅用浏览器原生 API（`addEventListener`、`classList`、`querySelector`），与现有「打开 HTML 即预览」的零构建假设一致。
- **可访问性**：基本键盘可达（Tab、Enter、ESC 关闭模态），不做完整 a11y 审查。
- **不影响**：`docs/PRD.md`、后端、数据模型；本次仅设计稿层。
