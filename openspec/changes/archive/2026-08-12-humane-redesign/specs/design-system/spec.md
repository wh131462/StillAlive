## ADDED Requirements

### Requirement: Apple HIG 风格的新组件

设计系统 SHALL 追加以下组件类，遵循 Apple Human Interface Guidelines 的精神（少装饰、强对比、留白、术语隐藏）。所有类只引用现有 token。

#### Scenario: checkin-card 三态

- **WHEN** 检查 `.checkin-card` 及其修饰类 `.is-pending / .is-done / .is-collapsed`
- **THEN** 三态共享同一根节点，通过 class 切换实现
- **AND** `.is-done` 状态下卡片高度变化时使用 `cubic-bezier(0.34, 1.56, 0.64, 1)` 弹簧曲线，时长 380ms

#### Scenario: sheet 上拉浮层

- **WHEN** 检查 `.sheet` 与 `.sheet-scrim`
- **THEN** sheet 从屏底滑入，圆角 `--radius-lg`（仅顶部），含拖拽指示条 `.sheet-handle`（36×4px 圆角灰）
- **AND** scrim 不透明度 30%；点击 scrim 触发 sheet 关闭

#### Scenario: graph-canvas

- **WHEN** 检查 `.graph-canvas`
- **THEN** 容器为 relative + overflow:hidden 的全屏区域
- **AND** 内置 `.graph-node`（圆形）/`.graph-edge`（svg line）/ `.graph-edge-label`（中点文字）类

#### Scenario: kv-row 自定义字段

- **WHEN** 检查 `.kv-row`
- **THEN** 横向 flex：左 `kv-key`（mono 11px 大写字距）+ 右 `kv-value`（sans 14px）
- **AND** 用于人物详情自定义字段、事件 timeHint 等紧凑信息呈现

#### Scenario: segmented-control

- **WHEN** 检查 `.segmented`（人物 tab 顶部「关系图 / 列表」切换）
- **THEN** 胶囊形容器内含 2-3 个等宽段，激活段填充 `--surface` + 阴影 + 主色字
- **AND** 非激活段透明背景 + `--ink-faint` 字

### Requirement: 屏切换器降级

`docs/design/app.html` 与 `docs/design/web.html` 的屏切换器 SHALL 去掉编号 chip 风格，改为顶部水平标签条（pill 简洁版，无数字）。

#### Scenario: 视觉简化

- **WHEN** 渲染屏切换器
- **THEN** chip 不再显示 `01-14` 编号；仅显示标签名（如「主页 / 时间线 / 人物 / 我的 / 写一条 / 关系图」）
- **AND** 切换器位于设备外框上方水平排列；超过宽度时横向滚动而非换行
- **AND** 激活态用细底线 + 主色字，不用整段填充
