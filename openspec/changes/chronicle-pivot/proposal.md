## Why

产品早期方向从「轻社交陪伴」回归到「本地优先的个人编年史」——心智对齐 nian 这类笔记 app：数据只属于你，服务器只是你自己搭的二级备份。现有 `interactive-prototypes` 里的关心/匹配码/绑定弹窗/公共故事前台都属于「社交/平台」路径，与新心智不符；同时「死亡确认」命名过于重量，需要柔化为「提醒邮件」。

核心目标：让用户每天打开时可以舒服地打一次卡 + 写一条日记/说说；按时间线回看历史，穿插过期提醒（"那天是 X 日子"）；围绕每个人物写小传，@ 过 ta 的帖子自动聚合到 ta 的时间线；在一张专门的「交集视图」上看到所有人物的时间轴，在同时被 @ 的时刻之间画出连接线（类 Git branch）。

## What Changes

- **BREAKING** 砍掉关心模块：care-manage 屏、bind-modal 弹窗、people-list 里的关心条 / 匹配码相关字段、profile 里的「我的匹配码」展示与「关心管理」入口。
- **BREAKING** 砍掉 Web 公共故事前台：`web-home`（未登录时的公共入口版）、`web-stories`、`web-story-detail`。Web 端 `web-auth` 保留为私人登录入口。
- **BREAKING** 重命名 `death-confirm` → `reminder-email`：移除"死亡""诅咒"字样；保留触发条件（连续 N 天无活动）+ 预设邮件，新增"仅系统提示不发邮件"模式。
- **BREAKING** 主页（Today）重构：保留「已活 N 天」巨字叙事；「今日打卡」卡片转为「打卡 + 快速写入」组合；新增「最近帖」流、「今日提醒」段。
- 新增实体（设计稿层以 mock 呈现；数据契约由 spec 固化）：Post（当日帖，可 @ 人 + 可带图 + 可多条/天）/ Reminder（带目标日期的事件，到期显示当日提醒、过期沉淀为"那天是 X 日子"）/ Person（卡片 + 小传长文 + 自动聚合时间线）/ Mention（本地索引，@ 仅在自己的人物页可见）。
- 新增视图：Timeline（个人总时间线，反向时序，自己的帖 + 过期提醒分隔穿插）/ Person Bio（人物页，固定卡片 + 长文小传 + 自动聚合"@过 ta"的帖）/ Intersection（独立入口，类 Git branch：每人一条横向轴，同帖 @ 多人处画连接线，孤立者保持孤立）。
- Web 端重定位为「桌面写作/阅读视图」：同一套本地数据，双栏（左目录/时间线 + 中大写作区 + 右元信息），不再是公共故事舞台。
- 新增本地优先存储架构（契约层）：IndexedDB（Web 主存）+ SQLite + 文件系统（App 主存）+ WebDAV / S3 作为用户自建服务器的二级备份协议。
- 保留并延续 vibrant 设计系统 token，只在 `shared/style.css` 继续增量追加新组件类。

## Capabilities

### New Capabilities

- `chronicle-data-model`: 本地数据模型（Post / Reminder / Person / Mention）的实体字段、关系、唯一性与索引约束。
- `local-first-storage`: 本地主存（IndexedDB / SQLite + FS）+ WebDAV / S3 备份的协议契约、同步语义（单向上传 / 冲突策略 / 时间戳）。
- `timeline-views`: 个人时间线、人物页、交集图三个视图的呈现、数据源、交互契约。
- `reminder-email`: 替代 death-confirm 的邮件/系统提示契约（触发条件、文案模板、两种通知模式）。

### Modified Capabilities

- `design-system`: 向现有 vibrant 系统追加新组件类（mention-chip、post-composer、bio-card、timeline-row、intersection-branch、reminder-badge 等），token 保持 0 改动。
- `interactive-prototype`: 屏列表更新——移除 care-manage / bind-modal / web-stories / web-story-detail；重命名 death-confirm → reminder-email；新增 timeline / person-bio / intersection / post-composer 等屏。

## Impact

- **设计稿文件**：`docs/design/app.html` 删除 care-manage + bind-modal 屏，重命名 death-confirm 屏，裁剪 people-list 的匹配码/关心字段，新增 timeline / person-bio / intersection / post-composer 四屏；`docs/design/web.html` 删除 web-stories / web-story-detail 屏，web-home 重构为桌面仪表盘（已登录态）、web-auth 标记为私人入口，新增 timeline / bio-editor / intersection 屏。
- **共享 CSS / JS**：`shared/style.css` 增量新增组件；`shared/app-prototype.js` / `web-prototype.js` 新增 `renderIntersection(target, data)` 工具绘制 Git branch 风 SVG。
- **存储层**：仅在 spec 固化契约；原型不实现真实 IndexedDB / SQLite / WebDAV 调用，用内存 mock 数据模拟「读 / 写 / 备份」入口的 UI。
- **PRD**：`docs/PRD.md` 中涉及「关心/匹配/死亡确认/公共故事」的段落需同步刷新——本次 change 仅改设计稿；PRD 重写留给下个 change（暂定 `prd-chronicle-sync`）。
- **零新依赖**：不引入 npm / 构建 / 框架；所有存储/同步在真实前端实现时才接入，原型保持「打开 HTML 即预览」。
- **不影响**：`docs/design/index.html`（仅在导语注释补一行指向本次 change）；vibrant 设计系统的 token 数值。
