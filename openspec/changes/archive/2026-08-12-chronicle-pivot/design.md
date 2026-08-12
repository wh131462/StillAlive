## Context

`vibrant-design-refresh` 已建立设计系统，`interactive-prototypes` 已把 app / web 做成可交互多屏原型。但原型仍携带「社交 / 关心 / 公共故事」的产品心智——匹配码、关心绑定、死亡确认、Web 公共故事前台等。

本次 pivot 把产品重新锚定为「**本地优先的个人编年史**」（心智对齐 nian 笔记 app）。核心叙事：

- 每日打开 → 可打卡 → 可舒服写一条日记 / 说说 / 朋友圈体裁
- 按时间线回看，过期提醒穿插为「那天是 X 日子」
- 每个人物一页小传，@ 过 ta 的帖子自动聚合
- 专门入口看所有人物的时间交集（类 Git branch）
- 数据本地主存（IndexedDB / SQLite+FS），用户自建服务器（WebDAV / S3）做二级备份
- Web 端退回成桌面写作 / 阅读视图，不做公共舞台
- 「死亡确认」改名「提醒邮件」，可以只是系统提示

约束：

- 仅改 `docs/design/` 下设计稿；存储协议、同步策略仅在 spec 层约束，原型用 mock 展示
- 保留并继续扩展 vibrant 设计系统 token（0 改动），新组件只追加
- 不引入任何 npm / 构建 / 框架 / CDN 脚本；保持「打开 HTML 即预览」
- PRD 更新不在本次范围

## Goals / Non-Goals

**Goals:**

- 把 `app.html` / `web.html` 重整为编年史版本：App ≥ 9 屏 / Web ≥ 7 屏，全部围绕写 / 读 / 人物 / 交集展开
- 写入 4 个新 capability spec（chronicle-data-model / local-first-storage / timeline-views / reminder-email）+ 更新 design-system / interactive-prototype 两个 modified capability
- 在 `shared/style.css` 追加 post-composer / mention-chip / bio-card / timeline-row / reminder-badge / intersection-branch 组件类
- 在 `shared/app-prototype.js` / `shared/web-prototype.js` 新增 `renderIntersection(targetEl, mockData)` 工具
- 所有 UI 去除「死亡 / 诅咒 / 匹配码 / 关心 / 绑定 / 公共故事」等文案与相关字段

**Non-Goals:**

- 不实现真实的 IndexedDB / SQLite / WebDAV / S3 读写（spec 定义契约；原型用内存 mock）
- 不实现真实的邮件发送（展示模板预览与 UI 流程即可）
- 不同步更新 `docs/PRD.md`（留给后续 `prd-chronicle-sync` change）
- 不修改 `docs/design/index.html` 主体（仅在顶部注释追加指向本次 change）
- 不改 vibrant 设计系统的 token 数值
- 不做暗色模式、a11y 专项

## Decisions

### 决策 1：Post 是核心写入单元，打卡是轻量事实而非必经入口

**选择：** Post 独立为实体（一天 0-N 条），「我还在」打卡只是 `dayKey` 的布尔事实（或任何 Post 自动触发）；不强制打卡=一条帖。

**理由：** 朋友圈 / 说说 体裁允许一天多条小表达，日记体裁允许长文一条，两者都不该被「打卡=一条帖」限制。打卡作为生存心跳保留在主页 N 天计数，不再作为写入的唯一入口。

**替代方案：**
- A（已选）：Post 独立，打卡即 dayKey 存在证明
- B：打卡 = 第一条帖；后续帖都是「追加」。UI 简单但强迫第一条帖承担"今日打卡"语义，写作者心理负担。
- C：完全砍掉打卡概念，只有 Post。太激进，会丢失「还活着 N 天」这条产品主叙事。

### 决策 2：@ 提及是纯本地索引

**选择：** Post.mentions 是 personId 数组，仅用于本地查询与视图过滤；**不产生任何网络请求、不向他人推送、不同步到对方设备**。

**理由：** 本次产品明确"不社交"。@ 是给「我自己看人物时间线」的索引，不是社交动作。这与朋友圈 @ 语义完全不同，设计稿和文案要避免用户误以为对方会收到通知。

**落地：**
- 人物页底部自动聚合 = 对 Mention 索引的查询
- 交集视图的"交点" = 同 Post 中多 personId 的同时命中
- 设置页明示："@ 仅用于你自己的人物档案整理"

### 决策 3：小传是"卡片 + 长文 + 自动聚合"的人物页

**选择：** Person 页上半 = 结构化卡片（头像/名/印象/生日/标签/主题色）+ 中部 = 可选的长文 biography（Markdown，用 Fraunces Italic）+ 下部 = 自动聚合该 personId 被 @ 过的所有 Post。

**理由：** 避免用户把「维护小传」和「日常写帖」当成两件事。绝大多数日常感受通过 Post @ 人自然沉淀；小传只是对这人的"总括"补充，可为空。

**替代方案：**
- A（已选）：三段式合一（卡片 + 小传 + 自动聚合）
- B：小传独立页 + 时间线独立页。维护负担大、入口零散。
- C：只有时间线没有小传。缺少对这个人"总体印象"的容器。

### 决策 4：交集视图采用 Git branch 式横向人物轴

**选择：**
- 每个 Person 占一条水平行（轴首头像 + 名字 + 主题色轴线）
- 共享同一条横向时间坐标（左远右近），可按年/季/月三档切换密度
- Post 只 @ 一人 → 对应行的时刻画圆点
- Post @ 多人 → 各行圆点 + 之间画垂直细连接线（形成"交点"）
- 从未被 @ 的人保留空轴（头像 + "尚无共现"右侧提示）

**理由：** Git branch 比喻直观——人物是长期存在的"分支"，Post 是他们时不时的"合并节点"。用户对 Git 图熟悉度高，省解释。

**替代方案：**
- A（已选）：Git branch 横向轴
- B：Person × Person 共现矩阵（数字格子）。信息密度大但不直观，看不到时间演化
- C：力引导图（force graph）。漂亮但时间维度缺失，收益有限

### 决策 5：本地主存 + WebDAV/S3 单向备份

**选择：**
- Web 主存 IndexedDB（含 blob）
- App 主存 SQLite + 应用沙盒 FS
- 备份仅支持标准协议（WebDAV + S3 兼容含 MinIO/R2/B2），不做专有云 SDK
- 仅"单向上传快照"，不做跨设备合并同步；提供"从备份覆盖本地"的手动恢复入口（红色二次确认）
- 可选客户端加密（AES-256-GCM + PBKDF2-SHA256）

**理由：**
- 本地优先 → 用户有绝对数据所有权
- 标准协议 → 避免 vendor lock-in，用户可以自己搭 Nextcloud / MinIO
- 单向备份 → MVP 避免跨设备 CRDT 冲突合并的复杂度；90% 用户实际上只在一台主设备写

**替代方案：**
- A（已选）：单向备份 WebDAV/S3
- B：双向增量同步（带 CRDT）。技术负担极大，MVP 不做
- C：只导出 / 导入 zip，不接协议。用户自己扛备份节奏，不舒服

### 决策 6：Web 端完全退回成桌面版 App

**选择：** Web 不再是公共故事舞台；Web = 同一套本地数据的桌面大屏视图（双栏：左目录/时间线 + 中大写作区 + 右元信息）。`web-home` / `web-stories` / `web-story-detail` 整体移除。

**理由：** 产品既然不社交，公共故事没有读者；维护两套产品形态（公共 vs 私人）只会分散注意力。桌面的长文写作仍是价值点，保留它作为 App 的大屏延伸。

### 决策 7：「提醒邮件」替代「死亡确认」

**选择：**
- 屏 id `death-confirm` → `reminder-email`
- 入口标签 "死亡确认" → "提醒邮件"
- UI 文案全量去除"死亡 / 诅咒"字样
- 两种模式：「邮件模式」（发到紧急联系人邮箱）与「仅系统提示」（只在自己设备本地通知），互斥
- 默认模板温和："<nickname> 已经连续 <N> 天未在『还活着』中留下任何记录..."
- 触发阈值 `3 / 7 / 14 / 30 / 自定义`，默认 7

**理由：** 原"死亡确认"命名过重，对用户心理压力大，和产品温柔叙事冲突。

## Risks / Trade-offs

- **风险：删除 care-manage 后，已绑定关心关系用户的设计稿缺失迁移路径** → 原型无真实用户，纯设计稿场景可直接删除；真实前端实现时要做一次数据迁移（清关系表）。
  - **缓解**：本次只改设计稿；真前端 change 补迁移脚本。

- **风险：交集视图在孤立人物多、时间跨度大时信息密度低** → 视觉上大量空轴看起来冷清。
  - **缓解**：提供"隐藏孤立人物"开关 + "按最后 @ 时间排序" 。

- **风险：@ 误导用户以为对方会收到通知** → 即使文案写清，第一印象仍可能误解。
  - **缓解**：首次使用 @ 时弹出一次性说明"@ 仅整理你自己的档案，对方不会收到通知"；设置页显眼说明。

- **权衡：砍掉公共故事 → 对外传播路径减少** → 用户只能通过口碑或独立渠道推广。
  - **接受**：产品定位是"给自己写"。传播不是本次目标。

- **权衡：单向备份不处理跨设备冲突** → 两台设备写入会各自成孤岛。
  - **接受**：MVP 明示；高级选项提供"覆盖恢复"；双向同步留给后续 change。

- **权衡：不提供 Dropbox/iCloud SDK** → 部分用户嫌 WebDAV/S3 配置繁琐。
  - **缓解**：提供几家常见 WebDAV（如坚果云）的配置模板；提供 MinIO / R2 / B2 的"新手指引"链接。

## Migration Plan

1. **spec + design + tasks 先行**（本次 proposal）。
2. **Phase A shared 资源**：`shared/style.css` 追加新组件类；`shared/app-prototype.js` / `web-prototype.js` 新增 `renderIntersection`。验证 `index.html` 无回归。
3. **Phase B 删减旧屏**：app.html 删 care-manage + bind-modal；web.html 删 web-stories + web-story-detail；重命名 death-confirm → reminder-email（屏 id + 文案）。prototype JS 屏切换器配置同步更新。
4. **Phase C 裁剪字段**：people-list 去匹配码 + 关心条；profile 去"我的匹配码" + "关心管理"入口；web-dashboard 去"关心我的人"格子。
5. **Phase D 新增屏**：App 端新增 timeline / person-bio / intersection / post-composer；Web 端新增 web-timeline / web-bio-editor / web-intersection，替换 web-home 的故事栅格为 dashboard 内容。
6. **Phase E 新组件 + 内容填充**：小传区用 Fraunces Italic、人物页三段式；交集视图调用 `renderIntersection` 用 mock 数据绘制。
7. **Phase F reminder-email 改造**：屏内容按 spec 重写（两种模式 + 预览 + 触发天数 + 紧急联系人）。
8. **Phase G 验收**：grep 确保「死亡 / 诅咒 / 匹配码 / 绑定 / 公共故事」全部清除；Chrome DevTools 实测所有新屏；index.html 无回归；token 守恒。

**回滚**：本次所有改动通过 git 分批提交；如需回滚至 `interactive-prototypes` 状态，revert 本次相关 commit 即可。

## Open Questions

- 交集视图的「时间坐标」是物理均匀（每年等距）还是对数拉伸（近年更宽）？MVP 倾向物理均匀，实现简单；若长期用户数据跨越 5 年以上，再加对数选项。
- Post 是否需要 `visibility` 字段（只在备份时加密 / 对自己也加锁）？MVP 不做，保持字段最少；后续可加 `locked: boolean`。
- 小传 biography 是否支持版本历史？MVP 不做；当前只保存最新文本 + `updatedAt`。
- reminder-email 的实际发送由谁执行？Web 端在线时可由浏览器端 SMTP fetch（用户提供 SMTP 配置）；App 端可在客户端执行。服务器转发邮件不在本次范围（与本地优先心智冲突）。
