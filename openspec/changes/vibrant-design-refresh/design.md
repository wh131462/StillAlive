## Context

`docs/design/` 目录下的现有设计稿（`index.html`、`app.html`、`web.html` 与共享 `shared/style.css`）采用「Herbarium of Days · 压花标本」视觉风格：奶白纸基底（`#F4ECDB`）、铁胆墨深褐（`#1F1A14`）、低饱和苔绿/赭石/陶土点缀，Fraunces Italic 显眼标题，纸张噪点滤镜、tape 胶带、圆形钢印、四角古籍花纹 SVG、拉丁文铭牌等密集装饰。

该风格成功传达「珍藏、凝视、纪念」氛围，但产品「还活着」的叙事核心是「当下、活力、生长、陪伴」。当前视觉与"活着"的鲜活感存在错位。本次改版需要在保留产品叙事母题（人=花、日记=标本、活着=每一天）的同时，整体替换视觉语言为「明亮、清晰、生长感」的现代风格。

约束：

- 仅修改 `docs/design/` 下的设计稿（HTML/CSS）；不涉及真实前端工程、不涉及后端、不修改 PRD 中的产品功能。
- 设计稿是纯静态预览，无构建工具，所有样式通过 `<link>` + `<style>` 直出；字体通过 Google Fonts CDN 加载。
- 必须保持三个入口页（index/app/web）跨页一致。
- 现存其它已删除的设计稿（认证、打卡、人物、故事等子页）目前不在工作树中，不在本次范围。

## Goals / Non-Goals

**Goals:**

- 建立一套「鲜活现代」CSS 设计系统：色板、字体、圆角、阴影、间距、动效、组件类。
- 重写 `docs/design/shared/style.css`，对外暴露一致的 CSS 变量与组件类。
- 重构 `docs/design/index.html`、`app.html`、`web.html` 以应用新系统。
- 保留产品叙事核心（活着 / 人 / 花 / 日记），但用现代手法重新诠释（如：用极简描边的植物 SVG 替代古籍线描）。
- 设计稿可在浏览器直接打开预览，无需构建步骤。

**Non-Goals:**

- 不实现真实前端工程（React/Vue/SPA），仅产出静态 HTML/CSS 设计稿。
- 不修改 `docs/PRD.md` 中的产品功能定义；如有"风格描述"段落需更新，由后续单独 change 处理。
- 不重新设计被删除的子页面（auth/checkin/person/story/profile）；本次仅做三个入口页 + 共享 CSS。
- 不引入 JS 框架；动效用 CSS animation 与必要的极简原生 JS。
- 不做暗色模式（dark mode）；本次仅交付亮色主题。
- 不做无障碍（a11y）专项审查；保持基本语义化 HTML 即可。

## Decisions

### 决策 1：用「明亮纸白 + 深墨灰 + 鲜活四色」替换「奶白 + 铁胆墨 + 标本三色」

**选择：**

```css
--bg:           #FAFAF7;  /* 明亮纸白（保留一点暖意，不刺眼） */
--surface:      #FFFFFF;  /* 卡片/面板 */
--ink:          #1F2328;  /* 深墨灰文字 */
--ink-soft:     #4A5058;  /* 次级文字 */
--ink-faint:    #8A9099;  /* 辅助/占位 */

--vital-green:  #5BB85C;  /* 生命/自然——主品牌色 */
--warm-coral:   #FF7F66;  /* 温暖/陪伴 */
--memory-gold:  #F2B544;  /* 珍贵/记忆 */
--calm-blue:    #6FA8DC;  /* 宁静/呼吸 */
```

**为什么不直接用 Material Design 或 iOS 系统色？**
系统色过于"工具感"，缺乏品牌叙事。本组色出自「植物 / 阳光 / 暮色 / 晨雾」语义，仍贴合植物叙事母题，但饱和度提升 2–3 个档位、明度抬升，整体观感从「干燥标本」转为「鲜活枝叶」。

**为什么保留一抹奶色基底（#FAFAF7 而非纯白）？**
完全纯白会让"日记"叙事显得冰冷；保留 2–3% 暖色偏移延续"纸张感"叙事，但远比 `#F4ECDB` 通透。

**替代方案：**

- 方案 A（已选）：明亮纸白 + 鲜活四色。中庸但稳，传达「鲜活但不喧嚣」。
- 方案 B：纯白 + 高饱和品牌色（一抹荧光绿）。更强烈现代，但破坏"日记/陪伴"叙事温度。
- 方案 C：渐变色（绿→蓝）做主背景。视觉冲击强，但分散注意力，且与"日记"功能不匹配。

### 决策 2：主字体切换到 Inter / Manrope，衬线仅留给叙事

**选择：**

```css
--sans:       'Manrope', 'Inter', -apple-system, 'PingFang SC', 'Noto Sans SC', system-ui, sans-serif;
--serif:      'Fraunces', 'Noto Serif SC', Georgia, serif; /* 仅日记/引文 */
--mono:       'JetBrains Mono', 'SF Mono', monospace;     /* 元数据/代码 */
```

`body` 默认 `--sans`，所有 H1/H2/H3、按钮、表单、导航统一无衬线。日记内容（`.diary-text`）、引文（`<blockquote>`、`.quote`）保留 `--serif` 以维系"手写/收藏"叙事。

**为什么选 Manrope？**
Manrope 字形带轻微人文柔和度（不像 Inter 那样几何刚硬），与"温柔陪伴"的产品调性更契合，又是 100% 现代无衬线。Inter 作 fallback。

**移除：** Caveat 手写、EB Garamond 古籍体。

### 决策 3：删除 tape / 钢印 / 角花 / 纸张噪点

**理由：** 这些是「古籍标本」最强的视觉锚点，只要存在，整体气质就会被拉回"古籍"。哪怕调亮色板，只要四角有花、卡片上有印章，仍是标本志。所以必须整体清除。

**保留的"植物意象"如何延续？**

- 用极简描边 SVG（`stroke-width: 1.5`，圆角 lineCap）画出现代化植物图形，仅 1–2 处点睛，不做四角装饰。
- 用 CSS `radial-gradient` 做柔和色光斑（替代水彩晕染）。
- 用 `@keyframes draw-line` 让叶片描边「生长」入场。

### 决策 4：现代视觉令牌——圆角、柔光阴影、间距

**选择：**

```css
--radius-sm:   6px;
--radius-md:   12px;
--radius-lg:   20px;
--radius-pill: 999px;

--shadow-soft: 0 2px 8px rgba(31, 35, 40, 0.06);
--shadow-lift: 0 8px 24px rgba(31, 35, 40, 0.10);

--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  24px;
--space-6:  32px;
--space-8:  56px;
--space-10: 80px;
```

放弃原 `3px 3px 0 var(--ink)` 的硬质投影按钮（btn-pressed），改为圆角 + 柔光阴影 + hover 微抬升。

### 决策 5：动效——保留"生长 / 呼吸 / 漂浮"叙事，但更克制

- **入场**：内容块 `fade-up`（400–800ms，cubic-bezier(0.16, 1, 0.3, 1)），延迟序列 0.05–0.6s。
- **植物描边**：保留 `draw-line` SVG 生长动画，仅在首屏与 hero 区域使用。
- **卡片 hover**：`translateY(-4px)` + `--shadow-lift`，禁用倾斜旋转。
- **图标/叶片漂浮**：`float-leaf` 周期 6s，幅度 ≤ 6px。
- **禁用**：纸张抖动、墨晕扩散、印章随机旋转（这些在原稿存在）。

### 决策 6：三个入口页结构保持，仅替换视觉

- `index.html` 仍是封面/导航，但去除"Herbarium of Days · 标本志"古籍铭牌；保留中文「还活着」主标题与中文/英文副标题（如 `Still Alive · 活着的每一天`）。
- `app.html`、`web.html` 保持其作为"移动端预览总览 / Web 端预览总览"的角色，仅替换样式。如这两个文件本身较长且包含大量原标本风装饰，本次仅做"风格替换"层级的修改，不重设信息架构。
- 三页共享 `shared/style.css`，page-specific 样式留在各 `<style>` 中。

## Risks / Trade-offs

- **风险：风格断层** → 与 PRD（`docs/PRD.md`）中可能存在的"标本志"风格描述形成不一致。
  - **缓解**：本 change 仅交付设计稿；PRD 文案同步在 tasks 中明确为"out-of-scope"，由后续 change 处理。

- **风险：保留 Fraunces 仅供日记可能造成字体加载冗余** → 影响首屏加载。
  - **缓解**：减少 Fraunces 字重档（仅保留 1–2 个 weight），并设置 `font-display: swap`。

- **风险：色板饱和度过高 → 产品叙事偏向工具感** → 失去"陪伴/温柔"调性。
  - **缓解**：四个鲜活色仅作为"点缀色"，主体仍是大量留白 + 深墨灰文字；卡片背景仍用近白色，不出现大色块铺底。

- **权衡：移除 tape/钢印 → 部分用户可能怀念原标本风** → 视觉辨识度下降。
  - **接受**：风格转向是用户明确诉求。原"压花标本"母题以"现代植物极简描边 + 柔光绿点缀"延续，仍可识别为"植物 / 生命"产品。

- **权衡：仅交付设计稿 vs. 同步落到真实前端代码** → 当真实前端开发时仍需重新对照设计稿迁移。
  - **接受**：当前 `docs/design/` 即为真实开发的视觉源参考；后续前端 change 接力。

## Migration Plan

1. **新建系统**：先重写 `docs/design/shared/style.css`，导出新变量与组件类。旧变量名（`--paper`、`--ink-faint` 等）可在文件顶部以注释保留映射，不向外暴露。
2. **逐页替换**：按 `index.html` → `app.html` → `web.html` 顺序替换，每页修改后用浏览器实际打开核对。
3. **回滚策略**：所有改动通过 git 提交分批管理（参考 `smart-commit` 流程）；如需回滚，单 commit revert 即可。
4. **验收**：浏览器逐页打开 `docs/design/index.html`、`app.html`、`web.html`，确认不出现旧装饰、配色统一、动效流畅。

## Open Questions

- 是否将主品牌色定为 `--vital-green`（更"生命"叙事）还是 `--warm-coral`（更"陪伴"叙事）？默认采用 `--vital-green` 作主色；如实施时观感不佳可在 tasks 阶段切换。
- `app.html` 与 `web.html` 这两个总览页是否需要展示「子页缩略图」？现存的子页 HTML 已被删除，本次默认按"占位卡片 + 文字描述"处理，不补绘子页 UI。
