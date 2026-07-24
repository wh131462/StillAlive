## Why

当前设计稿（`docs/design/`）采用「压花标本 / 编辑式植物志」风格：奶白纸基底、铁胆墨深褐、赭石苔绿低饱和点缀、Fraunces Italic + EB Garamond 衬线为主、tape/印章/角花等纸质装饰，整体安静、内敛、偏古籍感。

产品名为「还活着」(Still Alive)，核心叙事是「记录每一天的活着」「人是花朵」「日记如标本」。当前风格成功传达「珍藏与凝视」，但弱于传达「活着」本身的活力、节律、生长感。用户希望整体改造为更鲜活、现代的视觉表达，使设计语言与「活着」的当下感、生命力同频。

## What Changes

- **BREAKING** 替换主色板：弱化奶白纸 + 铁胆墨基调，转向明亮纸白 (`#FAFAF7`) + 深墨灰文字 + 鲜活辅色（活力绿、阳光黄、珊瑚粉、晨光蓝）。
- **BREAKING** 调整字体系统：标题字体从 `Fraunces` 切换到现代几何/人文无衬线（如 `Inter` 或 `Manrope`）；正文保留少量衬线供"日记/引文"使用；移除 `Caveat` 手写、`EB Garamond` 古籍体的主导地位。
- **BREAKING** 移除/简化标本风装饰元素：去除 tape 胶带贴片、圆形钢印、四角古籍花纹 SVG、纸张噪点滤镜、水彩墨晕背景。
- 引入现代视觉语汇：8–16px 圆角、柔光阴影、大色块卡片、清晰对比、留白节奏。
- 新增鲜活动态层：植物生长描边动画、卡片 hover 漂浮、滚动渐入、点缀图标微动效（保留"生命感"叙事但用现代手法）。
- 重构 `docs/design/shared/style.css`，建立新的 CSS 变量与组件类（按钮、卡片、表单、标签）。
- 更新三个设计稿入口：`index.html`（封面/导航）、`app.html`（移动端预览总览）、`web.html`（Web 端预览总览），统一应用新风格。
- 保留产品的核心叙事（人 = 花、日记 = 标本、活着 = 当下），但用现代视觉重新诠释——不是抹除"植物"母题，而是让植物「鲜活生长」。

## Capabilities

### New Capabilities
- `design-system`: 视觉设计系统规范，包含色板、字体、间距、圆角、阴影、组件样式、动效准则，作为后续所有页面（认证、打卡、人物、故事、个人中心等）共享设计源。

### Modified Capabilities
<!-- 当前 openspec/specs/ 为空，无现有 capability 需要修改 -->

## Impact

- **设计稿文件**：`docs/design/index.html`、`docs/design/app.html`、`docs/design/web.html`、`docs/design/shared/style.css` 整体重写。
- **未来开发**：当本设计稿被实现为真实前端代码时（Web SPA / React Native），需以新设计系统为准；现有 PRD（`docs/PRD.md`）中的"风格描述"段落可能需同步刷新。
- **依赖**：替换 Google Fonts 引用（移除 Fraunces / EB Garamond / Caveat 主导，引入 Inter / Manrope 等无衬线字体；可保留 Fraunces 作日记体强调）。
- **品牌资产**：原"Herbarium of Days / 标本志"的英文副标题与拉丁文装饰文案需重新评估是否保留。
- **不影响**：后端逻辑、数据模型、PRD 的产品功能定义；本次仅为视觉层。
