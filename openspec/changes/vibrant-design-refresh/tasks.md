## 1. 设计系统基础（shared/style.css 重写）

- [x] 1.1 在 `docs/design/shared/style.css` 顶部更新 `@import url(...)` 字体引用：移除 Caveat、EB Garamond 主导地位；保留 Fraunces（用于日记/引文，仅 1–2 weight + italic）；新增 Manrope 与 Inter（变量字体）；保留 JetBrains Mono、Noto Serif SC、Noto Sans SC
- [x] 1.2 重写 `:root` CSS 变量：替换为 `--bg`、`--surface`、`--ink`、`--ink-soft`、`--ink-faint` 基础色；新增 `--vital-green`、`--warm-coral`、`--memory-gold`、`--calm-blue` 四组鲜活点缀色（按 design.md 决策 1）
- [x] 1.3 在 `:root` 添加字体变量：`--sans`（Manrope/Inter+中文）、`--serif`（Fraunces+Noto Serif SC）、`--mono`（JetBrains Mono），并将 `body` 默认 `font-family` 改为 `--sans`
- [x] 1.4 在 `:root` 添加现代视觉令牌：`--radius-sm/md/lg/pill`、`--shadow-soft`、`--shadow-lift`、`--space-1..10`（按 design.md 决策 4）
- [x] 1.5 移除 `.paper-tex` 类的纸张噪点滤镜（删除 `::before` 内 SVG 噪点 dataURL，或将类整体废弃）
- [x] 1.6 移除/重写 `.wash-warm`、`.wash-sage`、`.wash-ochre` 三个水彩晕染类，改为低饱和柔光 radial-gradient（点缀色：vital-green / warm-coral / calm-blue）
- [x] 1.7 重写按钮组件：`.btn`、`.btn-primary`（实心，鲜活主色）、`.btn-ghost`（透明描边）；删除 `.btn-pressed` 的 `3px 3px 0` 硬质阴影，替换为 `--shadow-soft` + hover `--shadow-lift`
- [x] 1.8 重写卡片/面板：`.panel` 改为白底（`--surface`） + `--radius-md` 圆角 + `--shadow-soft`；删除 `.panel-corner` 的四角古籍 L 形线条伪元素
- [x] 1.9 重写 `.field` 表单：去除底部下划线为唯一边界的样式，改为带 `--radius-sm` 圆角的浅色填充输入框，focus 时主色描边
- [x] 1.10 重写 `.specimen-tag`：现代 pill 标签（`--radius-pill`、纯色背景或浅色填充 + 主色文字）
- [x] 1.11 删除 `.dropcap`（衬线古籍首字下沉）、`.marg-note`（手写体倾斜批注）作为通用类；如保留也仅作为 `.diary-text` 内的可选样式
- [x] 1.12 重写动效 keyframes：保留 `fade-up`、`draw-line`、`float-leaf`、`ink-bloom`（重命名/调参）；删除任何依赖纸张噪点或墨晕的特殊动效
- [x] 1.13 删除/废弃旧变量 `--paper`、`--paper-warm`、`--paper-edge`、`--paper-shadow`、`--sage`、`--terracotta`、`--ochre`、`--rose`、`--indigo` 在 body / 通用类中的引用（旧名可在文件尾部以注释保留为 legacy 对照）
- [x] 1.14 浏览器打开 `docs/design/index.html` 快速核对 CSS 变量与基础类生效（此时页面尚未重写，预期视觉混乱，目标仅是确认 CSS 无解析错误）

## 2. 重构 docs/design/index.html（封面/导航）

- [x] 2.1 删除头部 `<header class="running">` 中的"Vol. IV — A Personal Herbarium / Hangzhou · Anno MMXXVI"古籍铭牌
- [x] 2.2 删除四角装饰 SVG（`.corner-svg.tl`、`.corner-svg.br`）及其相关 CSS
- [x] 2.3 删除 `.latin-plate` 拉丁文铭牌区（`Cotidie florēs · Specimen vitae`）
- [x] 2.4 删除 `.margin-note`（"读这本书,就像翻一页自己的春天"手写体批注）
- [x] 2.5 删除每张 `.plate` 上的 `.stamp`（`Specimen Mobile Edition` 圆形钢印）与 `::before` tape 胶带伪元素
- [x] 2.6 重写 hero 区域：`<h1>还活<em>着</em></h1>` 字体改为 `--sans`，`em` 强调色改为 `--vital-green`；副标题保留中文「记录每一天的活着」与一行简短英文 `Still Alive · One Day at a Time`，字体使用 `--sans`
- [x] 2.7 重写"Index of Plates"区段：标题改名为「两端预览 · App / Web」（中文优先），删除 `Catalogus Specierum`、`Pigmentum & Litterae` 类拉丁标题
- [x] 2.8 重写两张大卡（指向 `app.html` / `web.html`）：使用 `.panel` 白底卡片 + `--radius-lg` 圆角 + `--shadow-soft`；卡片顶部用色块而非"罗马数字 i / ii"作视觉锚（保留小字编号）；hover 改为 `translateY(-4px)` + `--shadow-lift`
- [x] 2.9 重写"Catalogus Specierum"为「核心模块 · Core Modules」六宫格：现代极简描边图标替代古籍线描叶片 SVG；卡片改用浅色填充 + 主色细边或彩色顶部 accent
- [x] 2.10 重写"Pigmentum & Litterae"色板与字体样张：色板改为现代色卡（圆角色块 + hex），字体样张展示 Manrope（标题）/ Manrope（正文）/ Fraunces（日记示例）/ JetBrains Mono（元数据）
- [x] 2.11 重写 `.colophon` 页脚：删除 `❦ · ❦`、`Composed and bound in Hangzhou` 古籍尾跋；改为简洁版权 + 版本号 + 日期（中文优先）
- [x] 2.12 删除 `.folio` 右下角 "Plate · 序 · Folium" 古籍页码
- [x] 2.13 在浏览器打开 `docs/design/index.html` 实际核对：背景明亮纸白、文字深墨灰、主标题鲜活色强调、无 tape/钢印/角花/拉丁文
- [x] 2.14 截图或目视确认动效：标题 fade-up、卡片 hover 上浮且无倾斜、植物图标轻微浮动

## 3. 重构 docs/design/app.html（移动端总览）

- [x] 3.1 通读现有 `app.html`，标记其使用的旧标本风局部样式（`<style>` 内）与 DOM 装饰
- [x] 3.2 替换 body 背景与文字色：使用 `--bg` 与 `--ink`，移除任何 `paper-tex` 类
- [x] 3.3 删除页面内的 tape、钢印、纸张噪点、四角植物 SVG、拉丁文铭牌、`Caveat` 手写体批注（如存在）
- [x] 3.4 替换字体：所有标题、UI 文字使用 `--sans`；仅日记示例区使用 `--serif`
- [x] 3.5 重写"移动端预览"卡片样式：使用 `.panel` 共享类 + `--radius-md/lg` 圆角 + `--shadow-soft`
- [x] 3.6 子页缩略图区（如存在）改为「占位卡片 + 文字描述 + 主色 accent」，不补绘子页 UI
- [x] 3.7 替换或简化页面内联 `<style>`：能用 `shared/style.css` 共享类的统一替换；page-specific 仅保留布局尺寸（如 393×852 设备外框）
- [x] 3.8 浏览器打开 `docs/design/app.html` 核对：与 `index.html` 视觉一致、设备外框美观、无残留古籍装饰

## 4. 重构 docs/design/web.html（Web 端总览）

- [x] 4.1 通读现有 `web.html`，标记其旧标本风局部样式与 DOM 装饰
- [x] 4.2 替换 body 背景、文字色与字体（对齐 `index.html` 与 `app.html`）
- [x] 4.3 删除 tape、钢印、纸张噪点、四角 SVG、拉丁文铭牌、手写体批注（如存在）
- [x] 4.4 重写"Web 端预览"卡片：与 `app.html` 共享 `.panel` 类，仅设备外框尺寸不同（1280×800）
- [x] 4.5 子页占位卡片对齐 `app.html` 的处理方式
- [x] 4.6 替换或简化页面内联 `<style>`，最大化复用共享 CSS
- [x] 4.7 浏览器打开 `docs/design/web.html` 核对：与另两页视觉一致

## 5. 一致性与收尾验收

- [x] 5.1 三页交叉对比：在浏览器同时打开 `index.html` / `app.html` / `web.html`，确认主标题字体、主色、卡片样式、阴影、圆角完全一致
- [x] 5.2 全局搜索 `Herbarium`、`Cotidie`、`Specimen`、`Plate`、`Folio`、`Anno MMXXVI`、`Caveat`、`paper-tex`、`tape`、`stamp`、`corner-svg`、`latin-plate` 在三个 HTML 中的残留并清理
- [x] 5.3 全局搜索旧 CSS 变量 `--paper`、`--paper-warm`、`--paper-edge`、`--terracotta`、`--ochre`、`--rose` 在三个 HTML 内联 `<style>` 中的引用，替换为新变量或删除
- [x] 5.4 检查 hover 行为：所有卡片 hover 是 `translateY(-4px) + shadow-lift`，无 `rotate(0.4deg)` 倾斜残留
- [x] 5.5 检查动效时序：首屏 fade-up 序列总时长 ≤ 1.2s，无明显卡顿
- [x] 5.6 检查字体加载：浏览器 DevTools Network 面板确认 Manrope 已加载；Fraunces 仅加载用于日记示例的 1–2 weight；Caveat、EB Garamond 不再被请求
- [x] 5.7 移动端视口检查：DevTools 切换为 iPhone 14 Pro（393×852），三页布局不溢出、动效正常
- [x] 5.8 在 `docs/design/index.html` 顶部为后续设计师/开发添加一段 1–2 行简短说明注释（HTML 注释），点明「设计系统：vibrant-design-refresh / 鲜活现代风 / 见 openspec/changes/vibrant-design-refresh/」
