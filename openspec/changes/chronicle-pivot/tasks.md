## 1. shared 资源扩展（design-system）

- [x] 1.1 在 `docs/design/shared/style.css` 追加 `/* === chronicle-pivot additions === */` 段，作为本次新增组件的清晰边界
- [x] 1.2 新增 `.post-composer`、`.post-composer__body`、`.post-composer__toolbar`、`.post-composer__meta` 类
- [x] 1.3 新增 `.mention-chip`（pill 形，`--vital-green-soft` 底，`#2F6F30` 字）
- [x] 1.4 新增 `.bio-card`（人物页结构化卡片：左大头像 + 右姓名/印象/标签/生日/主题色条）
- [x] 1.5 新增 `.timeline-row`（左 12px 主题色竖条 + 右 `.panel` 卡片）与 `.timeline-divider`（日期分隔 sticky）
- [x] 1.6 新增 `.reminder-badge`（菱形 + `--memory-gold`）用于「那天是 X 日子」条目
- [x] 1.7 新增 `.intersection-branch`（单行：头像 + 轴）与 `.intersection-dot.is-green/coral/gold/blue`（圆点主题色）
- [x] 1.8 新增 `.bio-longform`（Fraunces Italic 长文容器，与 index.html 日记样张一致）
- [x] 1.9 浏览器打开 `docs/design/index.html` 核对无回归

## 2. 共用原型 JS 扩展

- [x] 2.1 在 `docs/design/shared/app-prototype.js` 与 `web-prototype.js` 中新增 `renderIntersection(targetEl, mockData)` 工具
- [x] 2.2 mockData 结构：`{ persons: [{id,name,color,avatar}], posts: [{id,dayKey,mentions:[personId]}] }`；工具基于此绘制 SVG
- [x] 2.3 实现人物轴（每人一行）、时间刻度、圆点、多 @ 垂直连接线
- [x] 2.4 Try/catch 包裹；错误 console.warn 不抛出
- [x] 2.5 新增 `bindMentionChipInput(inputEl)` 占位（后续若 post-composer 需要）

## 3. app.html 删减旧屏 + 重命名

- [x] 3.1 删除 `<section data-screen="care-manage">` 整块 + 其内嵌的 `<div class="modal-scrim" id="bind-confirm">` 模态
- [x] 3.2 删除屏切换器中 `data-go="care-manage"` chip；App 端无「关心管理」入口
- [x] 3.3 将 `<section data-screen="death-confirm">` 的 id 改为 `<section data-screen="reminder-email">`；屏切换器 chip 同步改名并更新 `data-go="reminder-email"`
- [x] 3.4 删除 `reminder-email` 屏内所有「死亡 / 诅咒 / 已故」类措辞；标题改为「提醒邮件」；副标「温柔的牵挂，而不是诅咒」改为「长时间没有记录时，温柔提醒一下」
- [x] 3.5 profile 屏移除「我的匹配码」块（整个 vital-green-soft 面板 + pin-input）
- [x] 3.6 profile 屏移除「关心管理」list-row 入口
- [x] 3.7 profile 屏把「死亡确认」list-row 入口重命名为「提醒邮件」，data-go 改 `reminder-email`
- [x] 3.8 today 屏移除「关心动态」整段（section-title + list-rows 含 avatars 堆叠）
- [x] 3.9 people-list 屏移除「8 位 · 你重要的人」副标，改为「你记录过的人」
- [x] 3.10 全文 grep 确认 app.html 中不再出现 `care-manage / bind-confirm / death-confirm / 匹配码 / 关心` 等字样

## 4. app.html 新增屏

- [x] 4.1 新增 `<section data-screen="timeline">`：顶部 tab 切换（全部 / 仅帖 / 仅提醒），下方反向时序流。日期分隔 sticky。同日多帖垂直叠放。过期提醒以 `.reminder-badge` 条目呈现。mock 3 个月数据。
- [x] 4.2 timeline 屏底部保留 `.tab-bar`；tab-bar 新增 timeline 项（替代原来的打卡位置？由设计决定：改为 5 项 or 把 timeline 作为 today 的下级），实际落地保持 4 项 tab（主页 / 打卡 / 人物 / 我的），timeline 通过屏切换器 + today「查看完整时间线」入口到达
- [x] 4.3 新增 `<section data-screen="person-bio">`（替代现有 person-detail 的升级版）：上半 `.bio-card` 结构化卡片 + 中 `.bio-longform` 长文小传 + 下自动聚合时间线（list of timeline-row）
- [x] 4.4 person-bio 下半每条帖显示「@ 的其他人头像串」（避免孤立视感）
- [x] 4.5 新增 `<section data-screen="intersection">`：顶部三档时间密度 chip（年/季/月）+ 开关"隐藏孤立" + 下方调用 `renderIntersection(targetEl, mockData)` 绘制
- [x] 4.6 intersection 屏 mock 6 个人物 + 20 条帖（部分单 @ 部分多 @ 部分孤立人物）
- [x] 4.7 新增 `<section data-screen="post-composer">`：大标题「写点什么」+ Markdown textarea + 工具栏（@ / 图 / 提醒 / 保存）+ 底部「取消 / 保存」
- [x] 4.8 post-composer 的 @ 工具按钮点击后在文本中插入 `@<person>` 文本并以 `.mention-chip` 渲染（用简单替换模拟）
- [x] 4.9 today 屏的「今日打卡」卡片 CTA 改为双按钮：「✓ 我还在」（纯打卡，dayKey 即事实）+ 「写一条」（跳转 post-composer）
- [x] 4.10 today 屏新增「最近帖」段（3 条预览）+ 「查看完整时间线 →」按钮跳 timeline
- [x] 4.11 today 屏「今日提醒」段若有过期未处理提醒，显示「那天是 X 日子」的转化提示

## 5. web.html 删减旧屏 + 重命名

- [x] 5.1 删除 `<section data-screen="web-stories">` 整块 + 其左侧分类 nav
- [x] 5.2 删除 `<section data-screen="web-story-detail">` 整块
- [x] 5.3 删除 `<section data-screen="web-home">`（旧公共首页）或改为重定向到 `web-dashboard`
- [x] 5.4 屏切换器删除「首页 / 故事列表 / 故事详情」三 chip
- [x] 5.5 左 nav-rail 删除「公共」分组及其 3 个 nav-item
- [x] 5.6 `web-dashboard` 去「关心我的人」格子，替换为「最近人物」格子
- [x] 5.7 `web-settings` 去公共故事开关；新增「备份（WebDAV / S3）」分组 + 「提醒邮件」分组

## 6. web.html 新增屏

- [x] 6.1 新增 `<section data-screen="web-timeline">`：左 sticky 年月目录 + 中反向时序流（同 App 的 timeline 升级桌面版）+ 右元信息（当月统计 / 本月 @ 过的人）
- [x] 6.2 新增 `<section data-screen="web-bio-editor">`：左 bio-card 预览 + 中长文编辑器（textarea with Fraunces 样式预览）+ 右元信息（生日 / 标签 / 头像上传占位）
- [x] 6.3 新增 `<section data-screen="web-intersection">`：全宽 canvas/svg 区域，顶部密度 chip + 隐藏孤立 toggle + 调用 `renderIntersection(targetEl, mockData)`
- [x] 6.4 屏切换器 chip 同步新增三项；左 nav-rail 调整分组为「写作」「档案」「视图」「设置」

## 7. reminder-email 屏完整化（app + web）

- [x] 7.1 app.html 的 `reminder-email` 屏实现：两种模式 pick-group（邮件 / 仅系统提示）+ 触发天数 chip 5 选 1（3/7/14/30/自定义）+ 紧急联系人 input + 模板 textarea + 预览卡片 + 「发送测试邮件」按钮
- [x] 7.2 web.html 的 `web-settings` 新增「提醒邮件」分组；结构与 app 保持一致但用桌面布局
- [x] 7.3 grep 确认全仓无「死亡 / 诅咒 / 已故」：`grep -r -nE "死亡|诅咒|已故" docs/design/` 应返回空

## 8. 一致性与验收

- [x] 8.1 `docs/design/index.html` 顶部注释追加：`<!-- Chronicle pivot → 本地优先个人编年史 · 见 openspec/changes/chronicle-pivot/ -->`
- [x] 8.2 浏览器实测 `index.html` 无回归
- [x] 8.3 浏览器实测 `app.html`：所有新屏可切换到达；post-composer @ 交互可模拟；intersection 视图绘制无控制台错误
- [x] 8.4 浏览器实测 `web.html`：左 nav-rail 重整后结构清晰；timeline / bio-editor / intersection 三新屏可达；address bar 同步更新
- [x] 8.5 grep token 守恒：`grep -E "^\s*--(bg|ink|vital|warm|memory|calm|radius|shadow|space)" docs/design/shared/style.css` 数值未变
- [x] 8.6 grep 旧概念全清：`grep -rnE "care-manage|bind-confirm|death-confirm|匹配码|Herbarium|公共故事" docs/design/*.html` 应返回空
- [x] 8.7 屏数量核对：App ≥ 9（目标 12+）、Web ≥ 7（目标 8+）
- [x] 8.8 DevTools 移动视口（393×852）：app.html 所有屏无溢出
- [x] 8.9 键盘可达：Tab 焦点 / ESC 关模态 / 屏切换 chip focus 可见
## 9. PRD 同步（docs/PRD.md）

- [x] 9.1 改写 §1.1 产品定位：去「社交纽带 / 匹配码 / 关心」；新定位为「本地优先的个人编年史工具」
- [x] 9.2 改写 §1.3 核心价值观：删「社交纽带」行；新增「本地优先 · 数据自主」「长久可回看」
- [x] 9.3 改写 §1.4 核心叙事：保留「你已经活了 N 天」巨字；新增「每一天可以打卡 + 写」+「回看历史与人物」两条次叙事
- [x] 9.4 改写 §1.5 多端形态：明确 Web 端定位为「桌面写作/阅读视图」而非公共故事舞台
- [x] 9.5 改写 §2.1 导航结构：保留 4 Tab（主页 / 打卡 / 人物 / 我的），但「打卡」tab 内核变为「时间线」为主、日历为辅
- [x] 9.6 改写 §2.2 模块关系图：去「关心」子模块节点，新增「时间线 / 人物小传 / 交集 / 备份」
- [x] 9.7 新增 §3.2.5 快速写入（Post Composer 入口 · 独立于打卡）
- [x] 9.8 改写 §3.2.6「关心动态」→「最近记录」（列举最近 3 条 Post 与本月 @ 过的人）
- [x] 9.9 §3.3 打卡模块 → 重命名为「记录模块」；内容升级为：时间线（反向时序 + 日期分隔 + 过期提醒穿插）+ 打卡日历（保留）+ 近期记录（保留 + 链接到 Post 详情）
- [x] 9.10 §3.3 新增：Post 数据模型说明 + @ 提及说明（纯本地、不推送）
- [x] 9.11 §3.4 人物模块 → 升级为「人物小传 + 自动聚合时间线」；去「关心互绑」描述
- [x] 9.12 §3.4 新增：人物页三段式（卡片 / 长文小传 / 自动聚合）+ 交集视图（Git branch 样式）
- [x] 9.13 **删除整个 §3.5 关心模块**（匹配码 / 绑定 / 解绑 / 关心动态）
- [x] 9.14 §3.6 我的模块：删「关心管理 §3.6.2」；「死亡确认设置 §3.6.4」重命名为「提醒邮件 §3.6.4」
- [x] 9.15 §3.6 新增「备份与数据 §3.6.x」章节：WebDAV / S3 配置 + 单向备份语义 + 可选加密
- [x] 9.16 §3.6 新增「时间线与交集入口 §3.6.x」（或合入 §3.3 / §3.4）
- [x] 9.17 改写 §4 业务规则：删「关心绑定规则 §4.2」；新增「@ 提及规则」「备份规则」「Post 多帖规则」
- [x] 9.18 §4.4 文案规则：新增「禁用词清单」（死亡 / 诅咒 / 已故 / 匹配码 / 关心绑定 等）
- [x] 9.19 §5.1 整体架构：去「社交相关 API」描述；新增「本地优先 + 备份到用户自建服务器」的层次图
- [x] 9.20 §5.4 数据模型：删 `Match / CareBinding / DeathConfirmConfig`；新增 `Post / Reminder / Mention / BackupMeta / ReminderEmailConfig`；`Person` 表新增 `biography / aliases / themeColor` 字段
- [x] 9.21 §5.5 部署架构：明示「后端仅服务用户账号 + 可选云端备份中转；核心数据留在本地」
- [x] 9.22 全文 grep：`匹配码 / 关心绑定 / 关心动态 / 死亡确认 / 诅咒 / 公共故事` 清除；`Herbarium / Specimen` 等旧风格词清除
- [x] 9.23 在 PRD 开头加一行指向本次 change 的脚注：`> 本次重构：chronicle-pivot（openspec/changes/chronicle-pivot/）`
