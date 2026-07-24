## Why

`chronicle-pivot` 把产品锚定到"本地优先编年史"心智，但实现层面有三处不够人本：

1. **交互流程偏技术**：屏切换器 14 个编号 chip、Markdown 工具栏外露、@ 候选列表平铺、备份配置直接暴露 WebDAV/S3/AES-256-GCM 等术语，整体像开发者工具。
2. **主页心流是并列展示而非顺序流**：「✓ 我还在」和「写一条」两个 CTA 并排，用户不知道关系；进入即可写帖，没有"先确认存在，再考虑写"的节奏。
3. **人物模块是列表 + 详情**：缺少"我和我身边人之间的关系"这一核心叙事的可视化；人物详情字段固定，没有让用户自由表达；事件经历无法模糊时间记忆（"高三那年"无法存）。

本次重构按 Apple Human Interface 原则（少决策、强默认、术语隐藏、动作顺序流）重新组织三个层面：主页心流（打卡先于写入的状态机）、人物图谱（以"我"为中心的关系图替代列表为主入口）、备份语言（JSON / 数据库文件导出导入为主，云同步为可选辅路径）。

## What Changes

- **BREAKING** 主页改为分阶段顺序流：未打卡 → 仅显示打卡卡片（"✓ 打卡"按钮）；已打卡未写 → 卡片变形为"打卡完成 · 想写点什么吗？"+ 温柔次级 CTA；已打卡已写 → 卡片折叠为"今天已记下 N 条"小条。**未打卡状态下 Post Composer 入口完全不可见。**
- **BREAKING** 人物 tab 默认视图从「列表」改为「以我为中心的关系图」：中心节点固定是"我"；其他人物按关系连边到我；人物之间也可互连（爸爸 ↔ 妈妈）；点头像进详情。列表作为副视图保留（顶部切换）。
- **BREAKING** 人物详情结构化字段升级：固定字段（性别 / 生日 / MBTI / 星座 / 属性）+ **自定义键值对**（用户自由添加，如"外号: 小笨蛋"）。
- **BREAKING** 人物小传重构为「事件流」：每条事件由 (`title`, `description`, `participants[]`, `timeHint`, `sortKey`) 组成；`timeHint` 是自由字符串（"高三那年" / "2018-06" / "2018 暑假"皆可），`sortKey` 由用户拖拽产生（不依赖真实日期）。
- **BREAKING** 事件归属：默认事件归属"参与者列表中的人物"；若 `participants` 包含「我」则也出现在我的时间线；若不含「我」（如"妈妈年轻时去过西藏"），则**仅在该人物的小传中可见**。
- **BREAKING** 关系类型用户可完全自定义；同时预置常见类型（爸爸 / 妈妈 / 儿子 / 女儿 / 兄弟 / 姐妹 / 朋友 / 同学 / 老师 / 同事 / 伴侣）作为选择起点。
- **BREAKING** 备份语言去技术化：导出/导入 JSON 与数据库文件作为「主推」；坚果云 / Nextcloud 等远程同步降级为「也可以同步到云端」次级入口，UI 不暴露 WebDAV/S3/AES-256-GCM 等术语，统一用「服务器地址 / 账号 / 密码 / 加密保存」的人话。
- **BREAKING** 屏切换器砍掉编号 chip 风格的开发者工具感：原型预览页改为顶部小型切换器（标签风），不再展示 01-14 数字编号。
- 微交互向 Apple 风靠拢：写入时光面板上拉（sheet）而非全屏跳页；打卡变形动效采用弹簧曲线；模态用居中卡 + 浮层而非 scrim 全覆盖。
- @ 提及在 UI 上隐含：输入 `@` 时自动浮出极简候选，**不展示"@ 不向他人推送"字眼**——这是隐含合约，第一次使用 @ 时一次性 toast 解释，之后不再出现。

## Capabilities

### New Capabilities

- `home-flow`: 主页打卡 → 写入 → 历史浏览的分阶段状态机，含三态卡片变形与历史合流。
- `person-graph`: 以「我」为固定中心的人物关系图，节点 / 边 / 关系类型 / 缩放与拖动交互、与列表视图的双向切换。
- `person-detail-v2`: 升级版人物详情：固定属性 + 自定义键值对 + 事件流（模糊时间 + 拖拽排序）+ 归属规则。

### Modified Capabilities

- `design-system`: 追加 Apple 风格组件类（checkin-card 三态 / sheet / graph-canvas / kv-row 等），token 保持 0 改动。
- `interactive-prototype`: 屏切换器视觉降级；新增 timeline-feed 合流屏、person-graph 屏、person-detail-v2 屏；裁剪原 today 屏的并列双 CTA。
- `chronicle-data-model`: Person 表新增 `customFields` / `relations[]`；新增 `Event` 表（与 Post 并列）；Mention 保留但 UI 不再暴露专业名词。
- `local-first-storage`: 备份 UI 文案与流程改造；功能契约不变但「测试连接」按钮文案 / 协议选项命名全部本地化。

## Impact

- **设计稿**：`docs/design/app.html` 与 `docs/design/web.html` 需要大改 today / people-list / person-bio 三屏；新增 person-graph 屏；重构屏切换器视觉。
- **共享 CSS / JS**：`shared/style.css` 追加 humane 组件；`shared/app-prototype.js` 新增 `renderPersonGraph(target, data)` 工具，绘制 SVG 关系图。
- **PRD**：`docs/PRD.md` 同步更新 §3.2（主页心流状态机）、§3.4（人物图 + 事件流 + 自定义字段）、§3.6.5（备份去技术化）、§4（@ 隐含合约 / 关系自由度 / 事件归属规则）。
- **不影响**：vibrant 设计系统 token 数值；本地优先存储的底层契约；服务器侧账号鉴权。
- **零新依赖**：关系图全部用原生 SVG / 简单的力布局静态版本（mock）；不引入 d3 / cytoscape / vis.js。
