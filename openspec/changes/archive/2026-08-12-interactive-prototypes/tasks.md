## 1. shared/style.css 增量扩展（design-system）

- [x] 1.1 在 `docs/design/shared/style.css` 文件末尾追加 `/* === interactive prototype additions === */` 注释段，作为本次新增组件类的清晰边界
- [x] 1.2 新增 `.screen-switcher`（容器，flex / wrap / gap）、`.screen-chip`（pill 圆角，hover & focus 可见）、`.screen-chip.is-active`（实色 vital-green 背景 + 白字）类
- [x] 1.3 新增 `.tab-bar` 与 `.tab-bar .tab-item`（图标在上、文字在下、激活态 `--vital-green`、非激活 `--ink-faint`），含安全区适配（`padding-bottom`）
- [x] 1.4 新增 `.nav-rail`（Web 端 200px 宽侧边导航容器）与 `.nav-rail .nav-item`（含 `.is-active` 状态，激活态用 `--warm-coral-soft` 背景）
- [x] 1.5 新增 `.list-row`、`.row-lead`、`.row-body`、`.row-tail` 列表行三段式结构；`.list-row + .list-row` 用 1px `--line` 分隔
- [x] 1.6 新增 `.calendar-cell` 及 `.is-checked / .is-today / .is-retro / .is-empty / .is-future` 状态修饰，圆角 `--radius-sm`，aspect-ratio: 1
- [x] 1.7 新增 `.heatmap` 网格（53 列 × 7 行，gap 2px）与 `.heatmap-cell.l0/.l1/.l2/.l3/.l4` 5 档梯度
- [x] 1.8 新增 `.toggle`（胶囊形开关，44×24px）与 `.toggle.is-on`（`--vital-green` 背景），含视觉过渡 0.2s
- [x] 1.9 新增 `.modal-scrim`（绝对定位、覆盖外框、`rgba(31,35,40,0.35)` 背景）与 `.modal-card`（`--surface` + `--radius-lg` + `--shadow-lift`）
- [x] 1.10 新增 `.mood-chip`（圆角 pill，flex：emoji + 文字）与 `.mood-chip.is-active` 4 种情绪态颜色（开心=`--warm-coral-soft`、平静=`--calm-blue-soft`、低落=`--ink-faint` 浅色、感动=`--memory-gold-soft`）
- [x] 1.11 新增 `.pin-input`（六位匹配码输入：6 个等分小框，`--mono` 字体，居中、字距 0.4em）
- [x] 1.12 新增 `.section-title`（屏内分组标题：mono 11px、字距 0.18em、`--ink-faint`、上边距 16px）
- [x] 1.13 新增 `.greeting-num`（巨字数字组件：sans 56–96px、weight 800、letter-spacing -0.03em；含 `.greeting-num em` 主色强调）
- [x] 1.14 新增 `.fab`（浮动主按钮，56×56 圆形 `--radius-pill` + `--shadow-lift`）与 `.fab-icon`
- [x] 1.15 浏览器打开 `docs/design/index.html` 核对：原视觉 100% 不变（无回归）

## 2. 共用原型 JS（shared/app-prototype.js + shared/web-prototype.js）

- [x] 2.1 新建 `docs/design/shared/app-prototype.js`（< 200 行）：暴露 `bindScreenSwitcher` / `bindTabs` / `bindModal` / `bindToggle` / `bindMoodChip` / `bindPinInput` 等 helper
- [x] 2.2 新建 `docs/design/shared/web-prototype.js`（< 200 行）：复用部分 helper + 新增 `bindNavRail` / `updateAddressBar`
- [x] 2.3 两个 JS 文件均使用事件委托（`document.addEventListener('click', e => …)`），通过 `data-*` 属性触发：`data-go="screen-id"`、`data-tab-group="x" data-tab-target="y"`、`data-modal-open="id"`、`data-modal-close`
- [x] 2.4 添加 ESC 关闭模态、Tab 焦点圈视觉（仅 keydown 焦点显示 outline）、`prefers-reduced-motion` 时禁用过渡
- [x] 2.5 提供 `renderHeatmap(targetEl, dataArr)` 工具：根据 0–4 等级数组渲染 .heatmap，预置一份伪随机演示数据
- [x] 2.6 所有 handler 包 try/catch，错误 console.warn，不抛出

## 3. App 原型重构（docs/design/app.html）

- [x] 3.1 移除现有「主流程 / 关心与里程碑」占位卡片九宫格 + 「日记样张」区，仅保留页眉 / page-header / 顶部 chip
- [x] 3.2 在页面中央放置 `.device-phone`（393×852 设备外框），右侧（或下方）放置 `.screen-switcher` chip 列表（≥ 12 chip）
- [x] 3.3 创建 `<section data-screen="login">`：mono 标语、「你好,今天还好吗?」标题、手机号 / 验证码 input、登录按钮、第三方 OAuth icon 行
- [x] 3.4 创建 `<section data-screen="register">`：「从今天起,开始记录」标题、表单、密码强度条、协议勾选、创建账号按钮
- [x] 3.5 创建 `<section data-screen="today">`：日期 eyebrow、「已活 127 天」巨字、连续打卡副标、「今日打卡」`.checkin-card`（gradient + CTA）、关心动态条、生日提醒 `.list-row`、每日一句 `.quote-card`、底部 `.tab-bar`
- [x] 3.6 创建 `<section data-screen="checkin-calendar">`：返回条、统计行（总天数 / 连续 / 记录）、月日历 `.calendar` 网格（用 `.calendar-cell` 渲染 5–6 周）、近期记录列表、`.tab-bar`
- [x] 3.7 创建 `<section data-screen="checkin-entry">`：返回条 + 「什么都不写」CTA、巨标题「今天有意义的事」、上传占位 `.photo-upload`、`<textarea>`、`.mood-chip` 心情九宫格、保存按钮
- [x] 3.8 创建 `<section data-screen="people-list">`：返回条 + 「+ 添加」按钮、过滤 chip 行、生日 `.birthday-card`、`.list-row` 人物列表、`.tab-bar`
- [x] 3.9 创建 `<section data-screen="person-detail">`：返回条 + 「编辑」、人物 hero（avatar + 名字 + 元数据）、基本信息 `.info-grid`（2×2）、个人印象 `.panel`、关系时间轴、重要日期网格
- [x] 3.10 创建 `<section data-screen="care-manage">`：「我的匹配码」`.panel` + `.pin-input`、输入对方匹配码绑定区、待确认列表、已绑定 `.list-row` 列表
- [x] 3.11 创建 `<section data-screen="bind-modal">` （或在 care-manage 内置 `.modal-scrim` + `.modal-card`）：头像 + 名字 + 共享范围说明 + 拒绝 / 同意按钮
- [x] 3.12 创建 `<section data-screen="milestone-7">`：里程碑 tag + 巨字「7」+ 「连续 7 天 你是真的在认真活着」+ 引言 + 里程碑列表（7 / 365）+ 「继续活着 →」按钮
- [x] 3.13 创建 `<section data-screen="profile">`：返回 + 个人 hero + 我的匹配码 chip + 数据三宫格 + 年度像素图（用 `renderHeatmap` 渲染）+ 设置入口 `.list-row`、`.tab-bar`
- [x] 3.14 创建 `<section data-screen="settings">`：偏好设置标题 + 打卡提醒 toggle + 提醒时间 row + 外观切换三选一 + 通知开关组 + 数据备份入口 + 退出登录
- [x] 3.15 创建 `<section data-screen="death-confirm">`：标题 + 警告卡 + 启用 toggle + 触发天数 chip 互斥（3 / 7 / 14 / 30 天）+ 紧急联系人 input + 邮件预览 `.panel`
- [x] 3.16 在 HTML 末尾引入 `<script src="shared/app-prototype.js" defer></script>`，调用 `init()` 启动绑定
- [x] 3.17 浏览器实测：屏切换 chip 全部可达；today.tab-bar 切换「主页 / 打卡 / 人物 / 我的」与 chip 对应屏一致；返回按钮回到上一屏；模态可由 ESC 关闭

## 4. Web 原型重构（docs/design/web.html）

- [x] 4.1 移除现有「公共前台 / 个人后台」占位卡片九宫格 + 「长文样张」区，仅保留页眉
- [x] 4.2 在页面中央放置 `.device-mac`（1280×800 含三色按钮 + 地址栏 chrome）；外框右上方放置 `.screen-switcher`（≥ 7 chip）
- [x] 4.3 设备外框内部用左右双栏布局：左侧 `.nav-rail`（站点导航 + 后台导航），右侧主内容区切换不同 `<section data-screen>`
- [x] 4.4 创建 `<section data-screen="web-home">`：巨字 slogan、近期精选故事网格（封面 + 标题 + 元数据）、活跃人物统计、「订阅故事」CTA
- [x] 4.5 创建 `<section data-screen="web-stories">`：左侧分类筛选、右侧故事卡列表（时间轴样式），支持匿名 / 半公开标签
- [x] 4.6 创建 `<section data-screen="web-story-detail">`：左侧目录、中间 Fraunces 长文（含 dropcap、引文）、右侧留言输入框 + 留言列表
- [x] 4.7 创建 `<section data-screen="web-auth">`：单列表单（登录 / 注册 tab 切换）、OAuth 按钮、匹配码呈现
- [x] 4.8 创建 `<section data-screen="web-dashboard">`：欢迎语 + 巨字「已活 127 天」、年度 `.heatmap`（53×7）置顶、4 个总览卡（连续打卡 / 关心我的人 / 最近编辑 / 待办）
- [x] 4.9 创建 `<section data-screen="web-editor">`：左侧目录大纲、中间长写作区（mock textarea）、右侧封面 / 标签 / 发布设置面板
- [x] 4.10 创建 `<section data-screen="web-settings">`：账号 / 隐私 / 通知 / 数据导出 / 死亡确认配置 5 个分组，每组用 `.panel` 包裹
- [x] 4.11 屏切换时同步更新顶部地址栏文本：公共屏 `stillalive.app/...`，后台屏 `stillalive.app/app/...`
- [x] 4.12 在 HTML 末尾引入 `<script src="shared/web-prototype.js" defer></script>`，启动绑定
- [x] 4.13 浏览器实测：屏切换 chip 与左侧 nav-rail 双向同步；公共/后台分流的地址栏正确；编辑器写作区可输入

## 5. frontend-design 视觉精修（关键屏）

- [x] 5.1 为 App `today` 屏调用 frontend-design skill 做视觉精修：CTA 视觉权重、巨字与副标的间距节奏、关心动态条的 avatars 堆叠
- [x] 5.2 为 App `person-detail` 屏调用 frontend-design：hero 渐变、印象卡的引号装饰、时间轴 dot 的视觉
- [x] 5.3 为 Web `web-story-detail` 屏调用 frontend-design：dropcap 与正文节奏、左目录 sticky、留言区分割线
- [x] 5.4 review 上述精修：颜色 / 圆角 / 字体仍来自 var(--*)；新增样式只落在 `shared/style.css`（不在 HTML 内联）
- [x] 5.5 grep 验证：`grep -rn "color: #" docs/design/{app,web}.html` 应仅返回设备外框等少量必要 hex；其它全部用 var

## 6. 一致性与验收

- [x] 6.1 三页交叉对比：`index.html` 视觉无回归；`app.html` / `web.html` 字体 / 主色 / 阴影 / 圆角与 index 完全一致
- [x] 6.2 全量屏切换测试：App 端 ≥ 9 屏全部可达，每屏切换 < 100ms 无白屏；Web 端 ≥ 7 屏全部可达
- [x] 6.3 微交互测试：心情互斥 / tag 切换 / toggle / 模态 / pin 输入 / 触发天数 chip 全部可点击产生预期视觉变化
- [x] 6.4 控制台清洁：DevTools Network 与 Console 无错误（404 字体除外，本就是远程 CDN）
- [x] 6.5 移动端视口检查：DevTools 切换 iPhone 14 Pro，App 原型设备外框居中、屏切换器换行可读
- [x] 6.6 键盘可达：Tab 在 chip 间可见焦点圈；ESC 关闭模态生效
- [x] 6.7 grep token 守恒：`grep -E "^\s*--(bg|ink|vital|warm|memory|calm|radius|shadow|space)" docs/design/shared/style.css` 数值与 vibrant-design-refresh 完成时一致
- [x] 6.8 在 `docs/design/index.html` 顶部注释中追加一行：「子页交互预览 → app.html / web.html（屏切换器 + 原生 JS）」
