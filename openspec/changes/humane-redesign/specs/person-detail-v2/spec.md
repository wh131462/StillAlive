## ADDED Requirements

### Requirement: 人物详情三段式

`person-detail-v2` 屏 SHALL 由三段构成：顶部头像与基本信息卡 / 中部结构化字段 / 下部事件经历流。

#### Scenario: 顶部头像卡

- **WHEN** 进入某人物详情
- **THEN** 顶部展示大头像 + 姓名（24pt sans bold）+ 一行印象短语（13pt 灰）+ 主题色横条
- **AND** 右上角有「编辑」入口

#### Scenario: 结构化字段（中部）

- **WHEN** 浏览中部
- **THEN** 以两列网格呈现固定字段：性别 / 生日 / MBTI / 星座 / 属性（金木水火土 / 用户可改）
- **AND** 字段为空时不显示空槽，仅显示已填写的字段
- **AND** 网格下方有「+ 添加自定义」按钮

#### Scenario: 事件经历流（下部）

- **WHEN** 浏览下部
- **THEN** 按 `sortKey` 倒序展示该人物的所有 `Event`
- **AND** 每条事件显示：`title`（大）+ `description`（可折叠 2 行）+ `timeHint`（mono 灰）+ 「同时参与的人」头像串
- **AND** 流末尾有「+ 写一条经历」按钮

### Requirement: 自定义键值对字段

#### Scenario: 添加自定义字段

- **WHEN** 用户在结构化字段网格底部点击「+ 添加自定义」
- **THEN** 弹出 sheet 让用户输入 `键`（最长 8 字）+ `值`（最长 24 字）
- **AND** 保存后该键值对加入该人物的 `customFields[]`，在网格中以同一两列样式显示

#### Scenario: 自定义字段无类型约束

- **WHEN** 用户输入自定义字段
- **THEN** `值` 一律为字符串；不支持日期 / 数字校验（保持轻量）
- **AND** 示例提示文案："外号 = 小笨蛋 / 喜欢 = 拿铁"

#### Scenario: 自定义字段可编辑可删除

- **WHEN** 用户长按某自定义字段
- **THEN** 弹出操作菜单：编辑 / 删除
- **AND** 编辑修改的是当前人物的 `customFields[]`，不影响其它人物

### Requirement: Event 实体

系统 SHALL 引入独立的 `Event` 实体记录人物经历，与 Post 并列但用途不同。

字段：
- `id`: string, UUID v4
- `title`: string（标题，最长 40 字）
- `description`: string（Markdown，可选）
- `participants`: array of `personId`（包含 `self` 表示「我」）
- `timeHint`: string（自由格式："高三那年" / "2018-06" / "2018 暑假" / "童年"）
- `sortKey`: number（用户拖拽产生的排序权重；默认 = createdAt 毫秒数）
- `createdAt`: ISO-8601
- `updatedAt`: ISO-8601

#### Scenario: 模糊时间

- **WHEN** 用户在事件编辑器输入 `timeHint`
- **THEN** 输入框为纯文本，无任何日期格式校验
- **AND** 支持类似 "高三那年"、"2018-06"、"2018 暑假"、"童年"、"上个月" 等任何字符串

#### Scenario: 拖拽排序

- **WHEN** 用户在事件流中长按某事件 → 上下拖动
- **THEN** 该事件的 `sortKey` 被调整，使其落在拖到的位置
- **AND** UI 立即重排
- **AND** 不影响 `createdAt`（创建时间）

#### Scenario: 事件归属"参与者"

- **WHEN** 创建一条 Event，`participants = [personA, personB]`（不含 self）
- **THEN** 该 Event 出现在 personA 与 personB 的事件流中
- **AND** **不出现**在主页的历史合流（因为「我」不是参与者）

#### Scenario: 事件含「我」时也属于我

- **WHEN** 创建一条 Event，`participants = [self, personA]`
- **THEN** 该 Event 出现在 personA 的事件流中
- **AND** **同时出现**在主页的历史合流（因为「我」是参与者）

#### Scenario: 事件来源两种

- **WHEN** 创建 Event
- **THEN** 有两条路径：
  - 路径 A：从人物详情 → 「+ 写一条经历」直接创建（用户主动）
  - 路径 B：用户在每日打卡的 Post 中 @ 某人 → 系统**询问**是否同时记为该人的经历（提示 toast，非默认行为）
- **AND** 路径 B 创建的 Event 与原 Post 双向关联（点击 Event 可跳到原 Post）

#### Scenario: 事件可编辑可删除

- **WHEN** 用户在事件流中点击某事件 → 编辑
- **THEN** 进入编辑 sheet，可修改所有字段
- **AND** 删除事件不影响关联 Post（仅断开 Event ↔ Post 关联）

### Requirement: 关系数据存储

`Person` 实体 SHALL 新增以下字段：

- `customFields`: array of `{ key: string; value: string }`
- `relations`: array of `{ targetId: string; type: string }`（`targetId` = personId 或 `'self'`；`type` = 关系类型字符串）

#### Scenario: 关系双向冗余

- **WHEN** 用户为 personA 添加关系 "妈妈 → self"
- **THEN** personA 的 relations 中添加 `{ targetId: 'self', type: '妈妈' }`
- **AND** 同时在「我」的 relations 中添加 `{ targetId: personA.id, type: '儿子' / '女儿' / null }`，关系类型用户在添加时一并指定（"我对 ta 来说是？"）
- **AND** 若用户不指定反向关系，则反向关系 type 为 null（仅记录连接，不标注语义）
