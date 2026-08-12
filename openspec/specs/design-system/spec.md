# design-system Specification

## Purpose
TBD - created by archiving change vibrant-design-refresh. Update Purpose after archive.
## Requirements
### Requirement: 主色板使用鲜活现代调性

设计系统 SHALL 提供一组以「明亮纸白基底 + 深墨灰文字 + 高饱和点缀色」为核心的主色板，替代原压花标本的奶白纸 + 铁胆墨配色。色板 MUST 包含至少四个鲜活点缀色，覆盖「生命/自然」「温暖/陪伴」「珍贵/记忆」「宁静/呼吸」四种情绪语义。

#### Scenario: CSS 变量定义鲜活基础色

- **WHEN** 开发者读取 `docs/design/shared/style.css` 中的 `:root` 变量
- **THEN** 存在 `--bg`（明亮纸白，亮度 ≥ #FAFAF7）与 `--ink`（深墨灰，亮度 ≤ #2A2D34）作为基础前后景
- **AND** 不再以 `#F4ECDB` 类奶白纸 / `#1F1A14` 铁胆墨为默认 body 背景与文字色

#### Scenario: 鲜活辅色覆盖四种语义

- **WHEN** 开发者读取主色板变量
- **THEN** 至少存在以下四组语义点缀色：
  - 生命/自然：`--vital-green`（鲜嫩绿，HSL 饱和度 ≥ 50%）
  - 温暖/陪伴：`--warm-coral` 或 `--warm-amber`（暖橙/珊瑚，HSL 饱和度 ≥ 50%）
  - 珍贵/记忆：`--memory-gold` 或 `--memory-rose`（暖金/玫瑰，HSL 饱和度 ≥ 40%）
  - 宁静/呼吸：`--calm-blue`（晨光蓝，HSL 饱和度 ≥ 30%）

#### Scenario: 旧标本风变量被废弃

- **WHEN** 检查 `style.css`
- **THEN** 不再导出 `--paper`、`--paper-warm`、`--paper-edge`、`--ink-faint` 等旧变量作为页面默认值（可保留为 legacy 注释，但 body 不再使用）

### Requirement: 字体系统转向无衬线主导

设计系统 SHALL 以现代无衬线字体作为主标题与 UI 字体，弱化古籍衬线体的主导地位。衬线字体仅在「日记内容」「引文」等少量叙事场景保留。

#### Scenario: 主字体引入无衬线

- **WHEN** 浏览器加载 `style.css`
- **THEN** `--sans` 变量存在并指向 `Inter`、`Manrope` 或同类现代无衬线字体（中文 fallback 为 `PingFang SC` / `Noto Sans SC`）
- **AND** `body` 默认 `font-family` 使用 `--sans`

#### Scenario: 衬线字体仅用于叙事

- **WHEN** 检查页面 H1/H2/H3 与正文 UI 元素（按钮、表单标签、导航）
- **THEN** 这些元素 MUST 使用 `--sans`
- **AND** 仅 `.diary-text`、`.quote`、`<blockquote>` 一类叙事容器可使用 `--serif`

#### Scenario: 移除手写体主导

- **WHEN** 检查 `index.html`、`app.html`、`web.html`
- **THEN** `Caveat` 手写体不再用于装饰性 margin-note、副标题等显眼位置（可保留作为可选 accent，但默认页面装饰中移除）

### Requirement: 移除标本风装饰元素

设计系统 SHALL 不再渲染下列原有「古籍/标本」视觉装饰元素，使页面整体观感转为现代鲜活。

#### Scenario: tape 与印章装饰被移除

- **WHEN** 检查 `index.html`、`app.html`、`web.html` 的 DOM 与 CSS
- **THEN** 不存在 `.tape`、`.stamp`、`.plate::before`（胶带）类伪元素装饰

#### Scenario: 角花 SVG 与拉丁文装饰被移除或弱化

- **WHEN** 检查页面四角与封面区域
- **THEN** 装饰性的 `corner-svg` 角花植物线描、拉丁文 `latin-plate` 古籍铭牌不再作为默认元素出现（如保留少量"植物枝叶"图形，须以现代描边风格重绘）

#### Scenario: 纸张噪点滤镜被移除

- **WHEN** 检查 body 是否使用 `.paper-tex` 类
- **THEN** 该类要么从所有页面 body 移除，要么其 `::before` 噪点 SVG 被替换为透明背景（`opacity: 0`）

### Requirement: 引入现代视觉语汇

设计系统 SHALL 提供以圆角、柔光阴影、清晰对比、规则化留白为基础的现代组件样式。

#### Scenario: 圆角令牌

- **WHEN** 检查 `:root`
- **THEN** 存在 `--radius-sm`（4–6px）、`--radius-md`（10–14px）、`--radius-lg`（18–24px）三档圆角变量
- **AND** 卡片、按钮、表单元素的圆角通过这些变量统一管理

#### Scenario: 柔光阴影令牌

- **WHEN** 检查 `:root`
- **THEN** 存在至少两档 `--shadow-soft`、`--shadow-lift` 阴影变量，使用低不透明度（≤ 0.15）的 RGBA 黑或主色阴影，禁用原 `3px 3px 0 var(--ink)` 的硬质偏移阴影作为默认

#### Scenario: 间距与节奏

- **WHEN** 检查间距变量
- **THEN** 存在以 4 或 8 的倍数为基础的间距 token（如 `--space-1` 到 `--space-8`）

### Requirement: 鲜活动态层

设计系统 SHALL 提供一组保留「生长 / 呼吸 / 漂浮」生命叙事但用现代手法实现的微动效，作为页面默认体验的一部分。

#### Scenario: 元素入场动画

- **WHEN** 用户首次进入 `index.html`、`app.html`、`web.html`
- **THEN** 主要内容块（标题、卡片、章节）以 `fade-up`、`bloom-in` 等方式渐入，单元素动画时长 400–800ms，整体延迟序列 ≤ 1.2s

#### Scenario: 卡片 hover 漂浮

- **WHEN** 用户鼠标悬停在卡片类组件上
- **THEN** 卡片以 `translateY(-4px ~ -8px)` 加柔光阴影提升，过渡时长 200–400ms
- **AND** 不再使用原 `rotate(0.4deg)` 倾斜效果作为默认 hover

#### Scenario: 植物/图标微动效

- **WHEN** 页面包含装饰性叶片、图标
- **THEN** 这些元素以 `float-leaf` 类轻微浮动（≤ 6px）或 SVG 描边生长动画呈现，循环周期 4–8s，无强烈旋转或抖动

### Requirement: 三个设计稿入口统一应用新系统

`docs/design/index.html`、`docs/design/app.html`、`docs/design/web.html` SHALL 全部使用新设计系统重构，且视觉语言保持一致。

#### Scenario: index.html 使用新封面风格

- **WHEN** 用户打开 `docs/design/index.html`
- **THEN** 页面 body 背景为 `--bg` 明亮纸白
- **AND** 主标题"还活着"使用 `--sans` 现代字体并以鲜活色（如 `--vital-green` 或 `--warm-coral`）做强调
- **AND** 不再出现 `Herbarium of Days`、`Cotidie florēs`、`Anno MMXXVI` 等古籍铭牌（可保留中文副标题与现代英文副标题）

#### Scenario: app.html 与 web.html 视觉一致

- **WHEN** 用户从 `index.html` 进入 `app.html` 或 `web.html`
- **THEN** 三个页面共享同一套色板、字体、圆角、阴影、动效
- **AND** `app.html`（移动端总览）与 `web.html`（Web 端总览）的容器、卡片、按钮组件类名与样式来自 `style.css` 共享层

#### Scenario: 保留产品叙事核心

- **WHEN** 用户阅读重构后的页面
- **THEN** 「人 = 花」「日记 = 标本」「活着 = 当下」三条叙事线索仍可被识别（可通过文案、图标、植物意象保留），但表达手段为现代视觉而非古籍标本装帧

### Requirement: 导航组件类扩展

设计系统 SHALL 在 `shared/style.css` 中新增导航相关组件类（底部 tab bar、顶部返回条、Web 端侧边导航、屏切换 chip 组），复用现有 token。

#### Scenario: 底部 tab bar 存在

- **WHEN** 检查 `shared/style.css`
- **THEN** 存在 `.tab-bar` 与 `.tab-bar .tab-item`（含激活态 `.tab-item.is-active`）类定义
- **AND** 激活态颜色使用 `--vital-green`（或其他主色 token），非激活态使用 `--ink-faint`

#### Scenario: 屏切换 chip 组

- **WHEN** 检查 `shared/style.css`
- **THEN** 存在 `.screen-switcher`（容器）与 `.screen-chip`（单项）类，激活态用 `.screen-chip.is-active`

### Requirement: 列表与行组件类

设计系统 SHALL 新增统一的列表行组件类，适用于人物列表、菜单列表、设置列表、关心列表等。

#### Scenario: list-row 基础结构

- **WHEN** 使用 `<li class="list-row">` 或 `<div class="list-row">`
- **THEN** 行内以 flex 水平排列：`.row-lead`（头像/图标）、`.row-body`（主副文本）、`.row-tail`（右侧尾巴，如箭头或徽标）
- **AND** 多行之间有 `1px` 分隔线（颜色为 `--line`）

### Requirement: 日历与热力图组件类

设计系统 SHALL 新增日历单元格与年度热力图相关组件类。

#### Scenario: 日历单元格状态

- **WHEN** 检查 `.calendar-cell` 及其修饰类
- **THEN** 存在以下状态：`.is-checked`（已打卡，用 `--vital-green-soft` 背景）、`.is-today`（今天，用 `--vital-green` 边框）、`.is-retro`（补签，虚线边）、`.is-empty`（非本月，`--ink-faint` 色）

#### Scenario: 热力图等级

- **WHEN** 检查 `.heatmap-cell`
- **THEN** 存在 `.l0 / .l1 / .l2 / .l3 / .l4` 5 档等级类
- **AND** 等级颜色为 `--vital-green` 在不同透明度下的梯度

### Requirement: 表单控件扩展

设计系统 SHALL 新增 toggle 开关、pin 码输入、心情选择器等表单控件类，仍遵循 vibrant 风格（`--radius-*`、`--shadow-soft`、主色 token）。

#### Scenario: toggle 开关

- **WHEN** 使用 `<div class="toggle"></div>`
- **THEN** 渲染为胶囊形开关，点击后通过 `.is-on` 切换视觉
- **AND** 激活色使用 `--vital-green`

#### Scenario: 心情选择器

- **WHEN** 在 Check-in Entry 使用 `.mood-chip` 构建心情九宫格
- **THEN** 激活态 `.mood-chip.is-active` 使用对应情绪点缀色（如开心=warm-coral-soft，平静=calm-blue-soft）

### Requirement: 模态与浮层

设计系统 SHALL 新增模态浮层组件类（遮罩 + 居中卡片）。

#### Scenario: 模态组成

- **WHEN** 使用 `.modal-scrim` + `.modal-card`
- **THEN** 遮罩覆盖 `设备外框` 区域且半透明黑色（`rgba(31,35,40,0.35)` 级别）
- **AND** 模态卡使用 `--surface` 背景 + `--radius-lg` + `--shadow-lift`

### Requirement: 向后兼容

设计系统 SHALL 保持 `vibrant-design-refresh` 已建立的公共 API（token 与组件类）向后兼容，不修改其数值或语义。

#### Scenario: 令牌未被修改

- **WHEN** 比较 `shared/style.css` 中的 `:root` 变量
- **THEN** `--bg / --ink / --vital-green / --warm-coral / --memory-gold / --calm-blue / --radius-sm / --radius-md / --radius-lg / --radius-pill / --shadow-soft / --shadow-lift / --space-1..10` 的数值与 `vibrant-design-refresh` 完成时相同

#### Scenario: 既有组件类未被破坏

- **WHEN** `index.html` 使用 `.btn-primary / .panel / .specimen-tag / .diary-text` 等
- **THEN** 视觉与交互行为与 `vibrant-design-refresh` 完成时相同

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

### Requirement: Apple HIG 风格的新组件

设计系统 SHALL 追加以下组件类，遵循 Apple Human Interface Guidelines 的精神（少装饰、强对比、留白、术语隐藏）。所有类只引用现有 token。

#### Scenario: checkin-card 三态

- **WHEN** 检查 `.checkin-card` 及其修饰类 `.is-pending / .is-done / .is-collapsed`
- **THEN** 三态共享同一根节点，通过 class 切换实现
- **AND** `.is-done` 状态下卡片高度变化时使用 `cubic-bezier(0.34, 1.56, 0.64, 1)` 弹簧曲线，时长 380ms

#### Scenario: sheet 上拉浮层

- **WHEN** 检查 `.sheet` 与 `.sheet-scrim`
- **THEN** sheet 从屏底滑入，圆角 `--radius-lg`（仅顶部），含拖拽指示条 `.sheet-handle`（36×4px 圆角灰）
- **AND** scrim 不透明度 30%；点击 scrim 触发 sheet 关闭

#### Scenario: graph-canvas

- **WHEN** 检查 `.graph-canvas`
- **THEN** 容器为 relative + overflow:hidden 的全屏区域
- **AND** 内置 `.graph-node`（圆形）/`.graph-edge`（svg line）/ `.graph-edge-label`（中点文字）类

#### Scenario: kv-row 自定义字段

- **WHEN** 检查 `.kv-row`
- **THEN** 横向 flex：左 `kv-key`（mono 11px 大写字距）+ 右 `kv-value`（sans 14px）
- **AND** 用于人物详情自定义字段、事件 timeHint 等紧凑信息呈现

#### Scenario: segmented-control

- **WHEN** 检查 `.segmented`（人物 tab 顶部「关系图 / 列表」切换）
- **THEN** 胶囊形容器内含 2-3 个等宽段，激活段填充 `--surface` + 阴影 + 主色字
- **AND** 非激活段透明背景 + `--ink-faint` 字

### Requirement: 屏切换器降级

`docs/design/app.html` 与 `docs/design/web.html` 的屏切换器 SHALL 去掉编号 chip 风格，改为顶部水平标签条（pill 简洁版，无数字）。

#### Scenario: 视觉简化

- **WHEN** 渲染屏切换器
- **THEN** chip 不再显示 `01-14` 编号；仅显示标签名（如「主页 / 时间线 / 人物 / 我的 / 写一条 / 关系图」）
- **AND** 切换器位于设备外框上方水平排列；超过宽度时横向滚动而非换行
- **AND** 激活态用细底线 + 主色字，不用整段填充

