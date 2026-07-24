## 1. shared/style.css 追加（design-system）

- [x] 1.1 在 `docs/design/shared/style.css` 末尾追加 `/* === humane-redesign additions === */` 注释段
- [x] 1.2 新增 `.checkin-card` 三态：`.is-pending`（大卡片 + 主 CTA 「✓ 打卡」）/ `.is-done`（变形为打卡完成 + 次级写入 CTA）/ `.is-collapsed`（折叠为小条）
- [x] 1.3 新增弹簧曲线变量 `--ease-spring-soft: cubic-bezier(0.34, 1.56, 0.64, 1)`；checkin-card 高度 / 透明度 / 圆角变化用该曲线，380ms
- [x] 1.4 新增 `.sheet`（顶部圆角、从底部上滑容器）+ `.sheet-scrim`（30% 不透明度黑色覆盖）+ `.sheet-handle`（36×4px 圆角拖拽指示条）
- [x] 1.5 新增 `.segmented`（胶囊形分段控件）+ `.segmented-item` + `.segmented-item.is-active`（白底主色字 + 阴影）
- [x] 1.6 新增 `.graph-canvas`（关系图容器，relative + overflow:hidden）
- [x] 1.7 新增 `.graph-node`（圆形节点：48px / 56px / 64px 三档；内含头像 + 下方名字）+ `.graph-node.is-self`（中心 fixed 样式）
- [x] 1.8 新增 `.graph-edge`（SVG line 样式：1.5px / `--ink-faint`）+ `.graph-edge-label`（中点 mono 小字标签）
- [x] 1.9 新增 `.kv-row`（横向 flex：左 mono 11px 键 + 右 sans 14px 值，紧凑两列）
- [x] 1.10 新增 `.event-row`（事件流单条：标题 + 折叠描述 + 时间提示 + 参与者头像串）
- [x] 1.11 新增 `.event-time-hint`（mono 11px 灰色，自由文本展示）
- [x] 1.12 屏切换器去编号化：原 `.screen-chip` 编号样式废弃，新增 `.screen-tabs`（顶部水平标签条，激活态用底线 + 主色字）
- [x] 1.13 浏览器打开 `docs/design/index.html` 核对：原视觉 100% 不变（无回归）

## 2. 共用原型 JS 扩展

- [x] 2.1 `docs/design/shared/app-prototype.js` 与 `web-prototype.js` 新增 `renderPersonGraph(targetEl, mockData)` 工具
- [x] 2.2 mockData 结构：`{ self: { name, avatar }, persons: [{id,name,color,avatar,layoutHint}], relations: [{from,to,type}] }`
- [x] 2.3 实现：SVG layer 画 edges + 中点 label；`.graph-node` 用 absolute 定位按 layoutHint 或预置同心圆坐标布局；中心节点固定
- [x] 2.4 实现拖动单节点：mousedown / touchstart 长按 0.4s 后启用拖动，松手记位置到 layoutHint
- [x] 2.5 实现双指缩放（移动端 touchmove with 2 fingers）：scale 0.5x ~ 2.5x，以中心节点为锚
- [x] 2.6 新增 `bindSheet(triggerSelector, sheetSelector)` helper：点击 trigger → 添加 `.is-open`；点击 scrim 或 drag-down 关闭
- [x] 2.7 新增 `bindCheckinState(cardSelector)` helper：处理三态切换（点击「✓ 打卡」→ pending → done；点击「想写点什么吗？」→ 唤起 sheet；保存 sheet 后 → done → collapsed）
- [x] 2.8 所有新 handler 包 try/catch，错误 console.warn 不抛出
- [x] 2.9 抹除现有 `[data-pick-group]` 在屏切换器 chip 上的开发者感（注释清理 + 风格转移到 segmented）

## 3. app.html 屏切换器视觉降级

- [x] 3.1 把右侧 `.screen-switcher` chip 列表替换为顶部 `.screen-tabs` 水平标签条
- [x] 3.2 chip 文案：去掉 `01-14` 数字，仅保留标签名
- [x] 3.3 标签数量超出宽度时 overflow-x: auto，不换行
- [x] 3.4 浏览器实测：标签条可滚动；点击任一标签切换屏

## 4. app.html home-flow 屏（替换旧 today）

- [x] 4.1 重命名 `<section data-screen="today">` 为 `<section data-screen="home-flow">`（保持兼容旧入口可通过 alias 重定向）
- [x] 4.2 顶部固定区：日期 mono 字 + 「你已经活了」+ 巨字「127 天」+ 头像右上
- [x] 4.3 主区域：状态 A（默认）单一 `.checkin-card.is-pending` 卡片，大标题「今日打卡」+ 大按钮「✓ 打卡」+ 副文案「先打个卡，再聊点什么」
- [x] 4.4 状态 B（已打卡未写）：卡片变形为 `.is-done`，文案「今天的存在已记下」+ 次级按钮「想写点什么吗？」（按钮无主色填充，仅描边）
- [x] 4.5 状态 C（已打卡已写）：卡片折叠为小条 `.is-collapsed`「今天已记下 N 条」+ 不显眼的「再写一条」
- [x] 4.6 「✓ 打卡」按钮触发 `bindCheckinState`：CSS class 切换 + 弹簧动效
- [x] 4.7 历史合流区：从主区域下方开始，每个日期分隔条 sticky；同日多条按 createdAt 倒序；穿插「那天是 X 日子」过期提醒卡 + 「我还在」徽章（空打卡日）
- [x] 4.8 移除原 today 屏的「关心动态」「今日提醒」并列 list-rows 风格（如还有残留）
- [x] 4.9 历史区任何条目均不附加「在此处写一条」按钮
- [x] 4.10 移除原「最近帖 查看完整时间线」入口（已合流到本屏）
- [x] 4.11 底部 tab-bar 第 2 项从「时间线」改为「日历」（时间线本就在主页，单独的"时间线" tab 冗余）

## 5. app.html Post Composer 改为 sheet

- [x] 5.1 把 `<section data-screen="post-composer">` 整体内容包装为 `.sheet` 容器，置于 device-screen 内（z-index 高于其它屏）
- [x] 5.2 sheet 顶部加 `.sheet-handle` + 「记一条」标题 + 「关闭」按钮
- [x] 5.3 中部为无边框 textarea，placeholder「今天发生了什么？也可以什么都不写」
- [x] 5.4 底部 4 个圆形小图标：@ / 📷 / ⏰ / 完成（不再露出「Markdown / 保存草稿 / 自动保存」字眼）
- [x] 5.5 触发点改为 home-flow 屏的状态 B/C 中的次级 CTA，通过 `data-sheet-open="post-composer-sheet"` 触发
- [x] 5.6 屏切换器中 `post-composer` 标签不删除，但点击后改为唤起 sheet 而非跳屏（保留以便预览者直达体验）
- [x] 5.7 完成按钮 → 触发状态切换为 C（已写过）+ 关闭 sheet
- [x] 5.8 @ 候选改为二级 sheet：点击 `@` 图标 → 上拉小 sheet 列出最近 @ 过的人 + 搜索框

## 6. app.html 人物 tab 重构

- [x] 6.1 新增 `<section data-screen="person-graph">`：顶部 `.segmented`（「关系图 / 列表」）+ 主区域 `.graph-canvas`
- [x] 6.2 graph-canvas 内调用 `renderPersonGraph` 渲染 mock 关系图：「我」中心 + 妈妈/爸爸/小林/楠楠/老板 5 人，含 4 条 relation（妈↔我妈妈、爸↔我爸爸、爸↔妈伴侣、小林↔我朋友）
- [x] 6.3 mock 数据中故意包含「楠楠」未连任何人（孤立节点），用于演示
- [x] 6.4 拖动单节点可见位置变化；点击节点跳 `person-detail-v2`
- [x] 6.5 切换 segmented 到「列表」→ 跳转 `people-list` 屏（已存在）
- [x] 6.6 顶部右上角加「+ 新人物」浮动小按钮（FAB 风格）
- [x] 6.7 底部 tab-bar 第 3 项「人物」点击 → 默认进入 `person-graph` 而非 `people-list`

## 7. app.html person-detail-v2

- [x] 7.1 新增 `<section data-screen="person-detail-v2">`，移除旧 `person-detail`（或保留为兼容入口）
- [x] 7.2 顶部 `.bio-card` 已有；右上「编辑」入口
- [x] 7.3 中部结构化字段网格（2 列）：性别 / 生日 / MBTI / 星座 / 属性；每行 `.kv-row` 样式
- [x] 7.4 网格下方 `+ 添加自定义` 按钮 → 触发 sheet 输入键值对
- [x] 7.5 mock 「妈妈」的自定义字段示例：`外号: 慢吞吞 / 喜欢: 拿铁 / 怕: 雷雨`
- [x] 7.6 下部「人生经历」事件流：每条 `.event-row` 显示标题 + 折叠描述 + `event-time-hint` + 参与者头像串
- [x] 7.7 mock 事件：
  - 「2007 春节回家」 timeHint=「童年」 participants=[self, mom, dad]
  - 「2018 高三毕业」 timeHint=「高三那年」 participants=[self, mom]
  - 「2020 妈妈去西藏」 timeHint=「2020-06」 participants=[mom]（不含 self → 强调 spec ��则）
  - 「2024 春节包饺子」 timeHint=「去年春节」 participants=[self, mom]
- [x] 7.8 事件流末尾 `+ 写一条经历` 按钮 → 触发 event-composer sheet
- [x] 7.9 事件支持拖拽排序（mock：长按 0.4s 后跟手位移，可视即可不必真持久化）

## 8. app.html event-composer 与 relation-picker sheet

- [x] 8.1 新增 `<section data-screen="event-composer">` 作为 sheet 内容容器
- [x] 8.2 字段：标题 input / 描述 textarea / 时间提示 input (placeholder「高三那年 / 2018-06 / 童年 都可以」) / 参与者头像串（点击可增删）
- [x] 8.3 参与者列表顶部默认含「我」+ 当前查看的人物，可点击增减
- [x] 8.4 新增 `<section data-screen="relation-picker">` 作为 sheet 内容容器
- [x] 8.5 上半「家人」分组横向滚动：爸爸 / 妈妈 / 儿子 / 女儿 / 兄弟 / 姐妹 / 伴侣 / 爷爷 / 奶奶 / 外公 / 外婆 / 叔叔 / 姑姑 / 舅舅 / 阿姨
- [x] 8.6 下半「社会」分组：朋友 / 同学 / 老师 / 同事 / 邻居 / 室友 / 恋人 / 前任
- [x] 8.7 底部「自定义」输入框 + 「保存到自定义」按钮（mock：不真存）

## 9. web.html 同步更新

- [x] 9.1 屏切换器视觉降级：同 app.html
- [x] 9.2 `web-dashboard` 顶部新增「今日打卡」checkin-card 三态卡片（与 home-flow 一致）
- [x] 9.3 新增 `<section data-screen="web-person-graph">`：全宽 graph-canvas，节点 64px 大版
- [x] 9.4 升级 `web-bio-editor` 为 `web-person-detail-v2` 桌面版：左 bio-card 预览 + 中事件流（事件 row 桌面版样式）+ 右结构化字段 + 自定义字段
- [x] 9.5 web 端 Post Composer 改为居中浮层（不是底部 sheet）+ 双栏（左 textarea + 右元信息：参与者 / 时间 / 关联提醒）
- [x] 9.6 nav-rail 调整：写作 / 阅读 / 人物 / 系统 四分组，「人物」分组下两项「关系图 / 列表」

## 10. 备份 UI 重写（app + web）

- [x] 10.1 app `settings` 屏中新增「备份」list-row 入口（→ 新增 `<section data-screen="backup">`）
- [x] 10.2 backup 屏首屏：两个大按钮「导出全部数据」+ 「从备份导入」+ 各自小字说明
- [x] 10.3 点击「导出」→ 弹 sheet 选格式：「便于阅读的文件包（.zip）」/ 「完整数据库文件（.json）」
- [x] 10.4 「云同步」折叠区位于主导出按钮下方：默认收起，点开「也可以同步到云端 →」展开
- [x] 10.5 云端配置 sheet：字段「网盘服务（下拉）/ 网盘地址 / 账号 / 密码 / 文件夹路径 / 上传前加密保护 toggle」
- [x] 10.6 测试连接按钮文案「测试一下」；mock 成功显示「✓ 可以连接」
- [x] 10.7 备份文件名 mock：「还活着 2026-05-13 09-41.zip」
- [x] 10.8 web `web-settings` 屏同步：把原 WebDAV/S3 配置区 全部按上述新文案重写
- [x] 10.9 grep 验证：`grep -rE "WebDAV|S3 兼容|AES-256|PBKDF2|accessKeyId|secretAccessKey|endpoint" docs/design/*.html` 应仅出现在折叠「技术细节」区（如有），否则全无

## 11. PRD 同步（docs/PRD.md）

- [x] 11.1 §3.2 主页模块：改为三态状态机说明（未打卡 / 已打卡未写 / 已打卡已写）
- [x] 11.2 §3.2 移除「快速写入入口（§3.2.5）」独立小节，把写入合入打卡卡片说明
- [x] 11.3 §3.4 人物模块：新增「人物关系图」§3.4.1 作为第一小节（在列表之前）
- [x] 11.4 §3.4 改写「人物页（Person Bio）」为 v2：固定字段网格 + 自定义键值对 + 事件经历流
- [x] 11.5 §3.4 新增「Event 实体」字段说明（title / description / participants / timeHint / sortKey / linkedPostId）
- [x] 11.6 §3.4 新增「事件归属规则」（含 self vs 不含 self 的可见性差异）
- [x] 11.7 §3.6.5 备份：重写为「导出 / 导入主推 + 云同步次级」语言；删除 WebDAV / S3 / AES-256-GCM 等术语
- [x] 11.8 §4 业务规则：新增「关系类型规则」（预设 + 自由自定义 + 8 字上限）
- [x] 11.9 §4 新增「事件归属规则」（与 §3.4 同源，正式化为 4.x）
- [x] 11.10 §4.6 文案规则：补充禁用词清单（WebDAV / S3 / 端到端 / accessKey 等技术术语）
- [x] 11.11 §5.4 数据模型：Person 表新增 `customFields` / `relations` / `layoutHint` 字段；Post 表新增 `linkedEventId`；新增 `events` 表
- [x] 11.12 文档版本号：v5.0 → v6.0 chronicle-pivot + humane-redesign
- [x] 11.13 grep 验证 PRD 无术语残留：`grep -E "WebDAV|S3 兼容|AES-256|PBKDF2" docs/PRD.md` 应仅在禁用词清单中出现

## 12. 一致性与验收

- [x] 12.1 三页交叉对比：index.html 视觉无回归
- [x] 12.2 app 全屏切换测试：home-flow 三态可流转；person-graph 节点可拖；person-detail-v2 自定义字段可加；event-composer sheet 可开关
- [x] 12.3 web 全屏切换测试：dashboard 打卡卡片可状态流转；web-person-graph 可见；web-person-detail-v2 三段式可见
- [x] 12.4 控制台清洁：DevTools Network 与 Console 无错误
- [x] 12.5 键盘可达：Tab 焦点 + ESC 关 sheet
- [x] 12.6 移动视口 393×852：home-flow 三态卡片不溢出；person-graph 节点可见
- [x] 12.7 grep 文案合规：`grep -rE "WebDAV|S3 兼容|AES-256" docs/design/*.html` 全无；`grep -rE "Markdown\|.md\|草稿\|自动保存" docs/design/*.html` 应仅出现在 web-editor 桌面版（保留）
- [x] 12.8 屏数量核对：App ≥ 9（目标含 home-flow + person-graph + person-detail-v2 + event-composer + relation-picker + backup 等）；Web ≥ 7
- [x] 12.9 在 `docs/design/index.html` 顶部注释追加：`<!-- Humane redesign → 苹果风分阶段心流 + 关系图 + 事件流 见 openspec/changes/humane-redesign/ -->`
