## ADDED Requirements

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
