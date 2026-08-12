# person-tags Specification

## Purpose
TBD - created by archiving change enhance-person-profiles. Update Purpose after archive.
## Requirements
### Requirement: 系统提供标准内置标签体系
系统 SHALL 提供包含 16 个标准 MBTI、12 个星座和 12 个生肖选项的内置标签体系；内置选项 SHALL 使用稳定标识，不允许用户改名或删除。

#### Scenario: 选择 MBTI
- **WHEN** 用户在人物编辑页选择一个 MBTI 类型并保存
- **THEN** 系统将该类型关联到人物并替换其先前的 MBTI 类型

#### Scenario: 星座生肖不可手选
- **WHEN** 人物存在生日
- **THEN** 人物编辑页将星座和生肖显示为生日派生的只读标签，不提供互相冲突的手动选项

### Requirement: 用户可管理自定义文字标签
系统 SHALL 允许用户在设置中创建、改名和删除自定义文字标签，并对去除首尾空白后的标签文本执行非空、长度和大小写无关的唯一性校验。

#### Scenario: 创建自定义标签
- **WHEN** 用户输入有效且未重复的文字标签
- **THEN** 系统创建标签并使其可在人物编辑页选择

#### Scenario: 拒绝重复标签
- **WHEN** 用户创建或改名后的文本与现有自定义标签仅在大小写或首尾空白上不同
- **THEN** 系统拒绝保存并提示标签已存在

#### Scenario: 删除已使用标签
- **WHEN** 用户确认删除一个已分配给人物的自定义标签
- **THEN** 系统删除标签及全部人物关联，并在确认前显示受影响人物数量

### Requirement: 人物可分配多个自定义标签
系统 SHALL 允许一个人物关联多个自定义标签，并防止同一人物重复关联同一标签。

#### Scenario: 保存人物标签
- **WHEN** 用户在人物编辑页选择若干自定义标签并保存
- **THEN** 系统以用户选择为准更新关联，并在人物详情展示已启用体系下的标签

#### Scenario: 内联创建标签
- **WHEN** 用户在人物编辑页输入不存在的有效文字标签并确认创建
- **THEN** 系统创建该自定义标签并立即选中给当前人物

### Requirement: 设置页可管理标签体系状态和顺序
系统 SHALL 允许用户启用、停用和排序 MBTI、星座、生肖与自定义标签体系；停用 SHALL 隐藏体系且阻止新增选择，但不得删除人物已有的显式关联。

#### Scenario: 停用 MBTI 体系
- **WHEN** 用户在设置中停用 MBTI
- **THEN** 人物详情和编辑页隐藏 MBTI，人物原有 MBTI 关联仍保留

#### Scenario: 重新启用体系
- **WHEN** 用户重新启用先前停用的体系
- **THEN** 人物详情和编辑页恢复显示先前保留的数据

#### Scenario: 调整体系顺序
- **WHEN** 用户调整标签体系显示顺序
- **THEN** 人物详情和编辑页按新顺序排列各体系标签

