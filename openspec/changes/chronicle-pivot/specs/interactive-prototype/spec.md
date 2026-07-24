## ADDED Requirements

### Requirement: 屏列表更新（App 端）

`docs/design/app.html` 的屏栈 SHALL 按 chronicle-pivot 新心智重整。屏切换器 chip 数量仍 ≥ 9。

移除：`care-manage`、`bind-modal`
重命名：`death-confirm` → `reminder-email`
新增：`timeline`（个人总时间线）、`person-bio`（人物页，取代/升级 person-detail 的内容层次）、`intersection`（交集视图）、`post-composer`（独立撰写器屏）
保留并调整：`login`、`register`、`today`（主页）、`checkin-cal`（保留，但打卡语义弱化）、`checkin-entry`（保留，作为 post-composer 的「短」分支）、`people-list`（砍掉匹配码字段与关心条）、`milestone`、`profile`（去掉「我的匹配码」块与「关心管理」入口，改挂「提醒邮件」入口）、`settings`

#### Scenario: 屏切换器不出现被砍屏

- **WHEN** 检查 `docs/design/app.html` 内屏切换器 chip
- **THEN** 不存在 `data-go="care-manage"` / `data-go="bind-modal"` / `data-go="death-confirm"`
- **AND** 存在 `data-go="timeline"` / `data-go="intersection"` / `data-go="reminder-email"`

#### Scenario: people-list 去社交化

- **WHEN** 检查 `people-list` 屏
- **THEN** 不出现匹配码字段、「关心动态」副标、care-strip / care-item 元素
- **AND** 副标题从「8 位 · 你重要的人」改为「你记录过的人」等中性表达

### Requirement: 屏列表更新（Web 端）

`docs/design/web.html` SHALL 重定位为「桌面写作 / 阅读视图」，屏数量不少于 6。

移除：`web-stories`、`web-story-detail`
保留并调整：`web-auth`（标签改为「私人登录」，不是公共注册入口）
新增：`web-timeline`、`web-bio-editor`（长传编辑器）、`web-intersection`
调整：`web-home` 可改名或用 `web-dashboard` 承担（首屏默认进入 dashboard 而非公共 home）
保留：`web-dashboard`（去除「关心我的人」格子，改为「最近人物」）、`web-editor`（仍保留，作为 `post-composer` 的桌面版）、`web-settings`（去除公共故事相关开关，新增备份 WebDAV/S3 配置块、提醒邮件块）

#### Scenario: 公共故事已移除

- **WHEN** 检查 `docs/design/web.html`
- **THEN** 不存在 `data-screen="web-stories"` 或 `data-screen="web-story-detail"`
- **AND** 不存在「公共前台」nav 分组

#### Scenario: 默认屏不是 home

- **WHEN** 打开 `docs/design/web.html`
- **THEN** `data-initial-screen` 指向 `web-dashboard` 或 `web-timeline`
- **AND** `web-auth` 仅在用户主动点击时到达

### Requirement: 原型交互契约延续

#### Scenario: 事件委托契约不变

- **WHEN** 新增的屏使用 `data-go` / `data-modal-open` / `data-modal-close` / `data-pick-group`
- **THEN** 由 `shared/app-prototype.js` / `shared/web-prototype.js` 统一接管，不在屏内联新 `<script>`

#### Scenario: 新增 renderIntersection helper

- **WHEN** 进入交集视图
- **THEN** `shared/app-prototype.js` / `shared/web-prototype.js` 导出 `renderIntersection(targetEl, dataMock)`，根据预置的 mock 数据绘制 Git branch 样式的 SVG / DOM
- **AND** 不依赖任何 charting 库

## MODIFIED Requirements

### Requirement: App 原型至少包含 9 个可切换子屏

`docs/design/app.html` 内的 App 原型 SHALL 至少包含以下子屏，每屏均可通过屏切换器单独到达，且每屏至少有一个真实可视的内容区域（非占位卡片）。

子屏列表（最低集 — 本次 chronicle-pivot 后）：
- Login（登录）
- Register（注册）
- Today（主页 / 巨字生存天数 / 今日提醒 / 快速写入 / 最近帖）
- Timeline（个人总时间线，反向时序 + 日期分隔 + 过期提醒穿插）
- Checkin Calendar（月日历 + 打卡状态可视 · 打卡语义弱化为「那天我还在」的轻徽章）
- Post Composer（帖子撰写器 / 文本 + 图 + @ + 关联提醒）
- People List（人物列表，去匹配码 / 关心条 / 社交字段）
- Person Bio（人物页 / 卡片 + 长文小传 + 自动聚合时间线）
- Intersection（交集视图 / 类 Git branch 的人物轴）
- Milestone-7（里程碑保留）
- Profile（我的：去匹配码、去关心入口、挂「提醒邮件」入口）
- Settings（偏好设置 / 提醒时间 / 备份 WebDAV / S3）
- Reminder Email（替代 Death Confirm）

#### Scenario: App 子屏数 ≥ 9

- **WHEN** 检查 `docs/design/app.html` 中 `[data-screen]` 节点
- **THEN** 其数量 ≥ 9

#### Scenario: 每屏存在真实内容

- **WHEN** 切换到任一 App 子屏
- **THEN** 屏内显示真实可读的中文 UI 文本与组件（不是占位卡片 + 描述文案）

### Requirement: Web 原型至少包含 7 个可切换子屏

`docs/design/web.html` 内的 Web 原型 SHALL 至少包含以下子屏，每屏均可通过左侧导航或屏切换器到达，每屏均显示真实内容。

子屏列表（最低集 — 本次 chronicle-pivot 后）：
- Web · Dashboard（仪表盘 / 已活 N 天 / 年度热力图 / 最近人物 / 最近编辑）
- Web · Timeline（桌面版个人总时间线）
- Web · Editor（长文 / Post 撰写器桌面版）
- Web · Bio Editor（人物页桌面版，左卡片 + 右长文编辑）
- Web · Intersection（桌面版交集视图）
- Web · Auth（私人登录入口）
- Web · Settings（账号 / 备份 / 提醒邮件）

#### Scenario: Web 子屏数 ≥ 7

- **WHEN** 检查 `docs/design/web.html` 中 `[data-screen]` 节点
- **THEN** 其数量 ≥ 7

#### Scenario: 公共故事已退场

- **WHEN** 检查 Web 导航与屏列表
- **THEN** 不再出现任何「故事列表 / 故事详情 / 投稿 / 公共前台」相关结构
