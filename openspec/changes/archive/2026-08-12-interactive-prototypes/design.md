## Context

`vibrant-design-refresh` 已建立 vibrant 设计系统并把三个入口页（index/app/web）从「压花标本」风格切换到现代鲜活风格。但 `app.html` 与 `web.html` 当前只是以「占位卡片 + 描述文案」展示规划页面，无法点击进入子屏，也无法演示真实交互流程，对评审、用户走查与前端实现的参考价值有限。

约束：

- 仅修改 `docs/design/` 下的设计稿；不得引入任何 npm 包、构建工具、前端框架或外部 CDN（保持「打开 HTML 即预览」的零构建假设）。
- 必须复用并仅向前扩展 `shared/style.css` 的现有 token 与组件 API；不得破坏 `index.html` 的视觉。
- 设计质感参考 `frontend-design` skill 的指南（间距节奏、对比、留白、过渡动效），但 token 来源仍是已落地的 vibrant 系统。
- 现有真实子页面 HTML（auth / checkin / person / story / profile）已被删除，不在本次范围；本次原型为静态演示，状态仅存于前端 DOM。
- 移动端原型按 393×852 设备外框；Web 端按 1280×800 macOS 风格设备外框。

## Goals / Non-Goals

**Goals:**

- 把 `app.html` 升级为可直接交互的多屏 App 原型，至少 ≥ 9 个真实子屏，可通过屏切换器、tab bar、返回按钮在子屏间流转。
- 把 `web.html` 升级为可直接交互的多屏 Web 原型，至少 ≥ 7 个真实子屏，公共前台与后台路由分流，左侧站点导航 / 顶部 chrome 真实可切。
- 实现最小集合的微交互：心情选择互斥、tag 切换、toggle on/off、模态开关、补签日选中、年度热力图 JS 渲染。
- 在 `shared/style.css` 增量新增导航 / 列表 / 日历 / 热力图 / toggle / 模态等组件类，保持 token 与现有组件 API 100% 向后兼容。
- 抽出极简原生 JS：`shared/app-prototype.js` 与 `shared/web-prototype.js`，承担屏切换 / tab 切换 / 模态 / 热力图渲染，不依赖任何外部库。

**Non-Goals:**

- 不实现真实前端工程（React Native / React SPA），仅产出可在浏览器直接打开的静态 HTML/CSS/JS 原型。
- 不引入构建工具、不用任何前端框架或 jQuery、不引入外部 CDN 脚本（Google Fonts CSS 引用除外，已是 vibrant 系统的一部分）。
- 不重写 `docs/design/index.html` 或重新调整 vibrant 设计系统的 token。
- 不实现真实状态持久化（无 localStorage 写入、无后端调用）；状态仅存于 DOM。
- 不做完整 a11y 审查；只保证最低限度的键盘可达（Tab 焦点、ESC 关闭模态）。
- 不做暗色模式。
- 不重设信息架构 / 不增减产品范围（人物 / 关心 / 打卡 / 里程碑 / 死亡确认仍是核心模块）。

## Decisions

### 决策 1：屏栈采用「兄弟节点 + display 切换」而非 SPA 路由

**选择：** 设备外框内每个子屏是独立的 `<section data-screen="screen-id">` 兄弟节点；未激活的屏 `display: none`，激活的屏显示。屏切换器与 tab bar 通过 JS 修改 `data-active-screen` 属性触发显示。

**为什么不引入 hashchange / History API 路由？**
设计稿是纯静态预览，URL 路由会让 `file://` 打开时刷新跳屏丢失上下文，且增加调试复杂度。`display` 切换零依赖、调试简单，足够覆盖原型评审需求。

**替代方案：**

- 方案 A（已选）：DOM 兄弟节点 + display 切换。简单稳定。
- 方案 B：iframe 嵌套若干子页面 HTML 文件。需要拆出 12+ 子文件，违反「单文件原型」直观感。
- 方案 C：用 `<dialog>` 元素替代屏切换。语义不符（屏不是模态）。

### 决策 2：屏切换器位于设备外框左侧（App）/ 顶部 + 左侧（Web）

**App 端：** 设备外框右侧（或下方 fallback）放置一组垂直 `.screen-chip` 列表，含所有子屏。点击 chip 即跳屏。同时屏内 tab bar / 返回按钮独立工作（点击 tab bar 同步更新激活的 chip）。

**Web 端：** 设备外框「内」部用左侧侧边导航（`.nav-rail`）模拟 SPA 路由（公共前台 / 后台），设备外框「外」部仍提供完整屏切换器作为评审快捷入口（含登录、详情等不在主导航内的子屏）。地址栏文本随屏切换。

**为什么把 chip 放在设备外框外？**
评审者需要能 1 点直达任一屏，不必每次走 Login → Today。设备外框内的导航服务于真实使用模拟，外部 chip 服务于评审跳转，两者互不冲突。

### 决策 3：交互逻辑全部抽到独立 JS 文件

**选择：** 新增 `docs/design/shared/app-prototype.js` 与 `docs/design/shared/web-prototype.js`。每个文件 < 200 行，导出三类 helper：

```js
// 屏切换：data-go="screen-id" 触发
// tab 互斥：data-tab-group + data-active-tab
// 模态开关：data-modal-open / data-modal-close
```

事件委托绑定到 document，避免 N 个屏各自绑事件。

**为什么不写在每个 HTML 内联 `<script>` 里？**
两个原型有大量共用交互（屏切换、tab 切换、模态、toggle、热力图渲染），抽到 shared 避免重复。同时 HTML 文件保持「结构 + 样式」清晰、JS 文件单独阅读 / 调试。

**替代方案：**

- 方案 A（已选）：shared/app-prototype.js + shared/web-prototype.js。
- 方案 B：所有 JS 放在每个 HTML 内联 `<script>`。重复 + 难维护。
- 方案 C：单一 shared/prototype.js 同时驱动两个 HTML。耦合两端逻辑，不利于演化。

### 决策 4：组件类只增不删，向后兼容

**选择：** `vibrant-design-refresh` 已暴露的所有 token 与组件类（`.btn / .btn-primary / .btn-ghost / .panel / .specimen-tag / .field / .diary-text` 等）保持原样、不修改数值。本次只在 `shared/style.css` 末尾追加新组件类（`.tab-bar / .tab-item / .nav-rail / .list-row / .calendar-cell / .heatmap-cell / .toggle / .modal-scrim / .modal-card / .screen-switcher / .screen-chip / .pin-input / .mood-chip` 等）。

**为什么？**
`index.html` 是设计语言展示页，已在审查通过的状态；任何修改都可能引入回归。新增不影响旧功能。

### 决策 5：复用 `frontend-design` skill 提升设计质感

**选择：** 在 Phase 1 草拟 App / Web 原型 wireframe 后，调用 `frontend-design` skill 对一两个关键屏（Today、Person Detail、Web Story Detail）做视觉精修：间距节奏、字重对比、过渡动效。skill 输出的代码片段经评估后再合入，且只能修改组件级样式 / 微交互，不能改 token。

**为什么？**
该 skill 擅长在已有 token 系统下产出「production-grade」的高质感界面，与本次目标契合。但需限制其只在组件层操作，避免 token 被覆盖。

### 决策 6：状态仅在 DOM，不持久化

**选择：** 心情选择、tag 激活、toggle 状态都只反映在 DOM（`.is-active / .is-on` 类）。刷新页面回到默认。不写 localStorage。

**为什么？**
原型用于演示，刷新即重置反而便于评审者反复进入「初始流程」。

## Risks / Trade-offs

- **风险：单 HTML 文件膨胀，难以维护** → 单页内承载 ≥ 9（App）/ ≥ 7（Web）个子屏，DOM 节点会很多。
  - **缓解**：每屏内 markup 控制在 100 行以内；重复结构（如列表行、tab bar）封装为组件类，DOM 复用 class 而非内联 style；超过 1500 行的 HTML 触发拆 partial 评估。

- **风险：屏切换 chip 数量多，挤占布局** → 移动端原型设备外框右侧空间有限。
  - **缓解**：chip 列表使用 `flex-wrap` 在窄屏下换行；chip 文字简短（中文 2–4 字）；悬浮显示完整说明（title 属性）。

- **风险：JS 错误导致整个原型不可用** → 极简原生 JS 没有错误边界。
  - **缓解**：每个事件 handler 加 try/catch；console.warn 而非 throw；屏切换至少保证 fallback：缺失 `data-screen` 时显示第一屏。

- **风险：设计系统 token 被新组件偷偷修改** → 新增大量组件类时容易写出硬编码颜色。
  - **缓解**：code review 时强制要求 `shared/style.css` 新增类只能引用 `var(--*)`；本次提交后用 grep 验证。

- **权衡：原型 ≠ 真实前端代码** → 后续真实前端开发时仍需迁移。
  - **接受**：这是「设计稿」层面的可交互演示；真实前端在另一个 change 接力实现。

- **权衡：`frontend-design` skill 输出可能引入超出 token 的样式** → 合规风险。
  - **缓解**：skill 调用时显式约束「仅基于 vibrant token 工作」；输出后人工 review 颜色 / 字体 / 圆角是否仍来自 var(--*)。

## Migration Plan

1. **Phase 1 设计系统扩展（shared/style.css）**：先在 `shared/style.css` 末尾新增本次涉及的全部组件类，独立 commit。完成后用 `index.html` 验证回归（应当无变化）。
2. **Phase 2 App 原型（app.html）**：逐屏实现，先按低保真完成屏栈与切换器，再调用 `frontend-design` 优化关键屏视觉。
3. **Phase 3 Web 原型（web.html）**：复用 Phase 2 模式，先骨架后视觉。
4. **Phase 4 共用 JS 抽取（shared/app-prototype.js + shared/web-prototype.js）**：把 Phase 2/3 中的内联 JS 抽到独立文件，HTML 仅 `<script src="shared/app-prototype.js" defer>`。
5. **Phase 5 验收**：浏览器实测三屏（index / app / web）；检查所有 chip / tab / 模态可达；`index.html` 无回归；DevTools 控制台无错误。
6. **回滚**：本次所有改动通过 git 分批提交；如出现严重回归，单 commit revert 即可。

## Open Questions

- 屏切换 chip 是否需要分组（如 App 端按「认证 / 主流程 / 关心 / 设置」分组）？默认采用单层平铺，若超过 12 个再分组。
- Web 端「公共前台」与「后台」是否需要不同主色锚（公共=warm-coral，后台=vital-green）？默认沿用 `vibrant-design-refresh` 的双锚策略，若评审反馈混乱再统一。
- `frontend-design` skill 调用粒度：一次精修一屏 vs. 一次精修整个原型？默认每屏单独调用，便于 code review 与回滚。
