## ADDED Requirements

### Requirement: 导航组件类扩展

设计系统 SHALL 在 `shared/style.css` 中新增导航相关组件类（底部 tab bar、顶部返回条、Web 端侧边导航、屏切换 chip 组），复用现有 token。

#### Scenario: 底部 tab bar 存在

- **WHEN** 检查 `shared/style.css`
- **THEN** 存在 `.tab-bar` 与 `.tab-bar .tab-item`（含激活态 `.tab-item.is-active`）类定义
- **AND** 激活态颜色使用 `--vital-green`（或其他主色 token），非激活态使用 `--ink-faint`

#### Scenario: 屏切换 chip 组

- **WHEN** 检查 `shared/style.css`
- **THEN** 存在 `.screen-switcher`（容器）与 `.screen-chip`（单项）类，激活态用 `.screen-chip.is-active`

### Requirement: 列表与行组件类

设计系统 SHALL 新增统一的列表行组件类，适用于人物列表、菜单列表、设置列表、关心列表等。

#### Scenario: list-row 基础结构

- **WHEN** 使用 `<li class="list-row">` 或 `<div class="list-row">`
- **THEN** 行内以 flex 水平排列：`.row-lead`（头像/图标）、`.row-body`（主副文本）、`.row-tail`（右侧尾巴，如箭头或徽标）
- **AND** 多行之间有 `1px` 分隔线（颜色为 `--line`）

### Requirement: 日历与热力图组件类

设计系统 SHALL 新增日历单元格与年度热力图相关组件类。

#### Scenario: 日历单元格状态

- **WHEN** 检查 `.calendar-cell` 及其修饰类
- **THEN** 存在以下状态：`.is-checked`（已打卡，用 `--vital-green-soft` 背景）、`.is-today`（今天，用 `--vital-green` 边框）、`.is-retro`（补签，虚线边）、`.is-empty`（非本月，`--ink-faint` 色）

#### Scenario: 热力图等级

- **WHEN** 检查 `.heatmap-cell`
- **THEN** 存在 `.l0 / .l1 / .l2 / .l3 / .l4` 5 档等级类
- **AND** 等级颜色为 `--vital-green` 在不同透明度下的梯度

### Requirement: 表单控件扩展

设计系统 SHALL 新增 toggle 开关、pin 码输入、心情选择器等表单控件类，仍遵循 vibrant 风格（`--radius-*`、`--shadow-soft`、主色 token）。

#### Scenario: toggle 开关

- **WHEN** 使用 `<div class="toggle"></div>`
- **THEN** 渲染为胶囊形开关，点击后通过 `.is-on` 切换视觉
- **AND** 激活色使用 `--vital-green`

#### Scenario: 心情选择器

- **WHEN** 在 Check-in Entry 使用 `.mood-chip` 构建心情九宫格
- **THEN** 激活态 `.mood-chip.is-active` 使用对应情绪点缀色（如开心=warm-coral-soft，平静=calm-blue-soft）

### Requirement: 模态与浮层

设计系统 SHALL 新增模态浮层组件类（遮罩 + 居中卡片）。

#### Scenario: 模态组成

- **WHEN** 使用 `.modal-scrim` + `.modal-card`
- **THEN** 遮罩覆盖 `设备外框` 区域且半透明黑色（`rgba(31,35,40,0.35)` 级别）
- **AND** 模态卡使用 `--surface` 背景 + `--radius-lg` + `--shadow-lift`

### Requirement: 向后兼容

设计系统 SHALL 保持 `vibrant-design-refresh` 已建立的公共 API（token 与组件类）向后兼容，不修改其数值或语义。

#### Scenario: 令牌未被修改

- **WHEN** 比较 `shared/style.css` 中的 `:root` 变量
- **THEN** `--bg / --ink / --vital-green / --warm-coral / --memory-gold / --calm-blue / --radius-sm / --radius-md / --radius-lg / --radius-pill / --shadow-soft / --shadow-lift / --space-1..10` 的数值与 `vibrant-design-refresh` 完成时相同

#### Scenario: 既有组件类未被破坏

- **WHEN** `index.html` 使用 `.btn-primary / .panel / .specimen-tag / .diary-text` 等
- **THEN** 视觉与交互行为与 `vibrant-design-refresh` 完成时相同
