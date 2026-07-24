## ADDED Requirements

### Requirement: 备份语言去技术化

设置页备份相关 UI SHALL 用本地化的人话替代技术术语。

#### Scenario: 主推路径为"导出 / 导入"

- **WHEN** 用户进入「设置 → 备份」
- **THEN** 首屏主区域是两个大按钮：「导出全部数据」+ 「从备份导入」
- **AND** 「导出」按钮下方小字说明：「会生成一个 .zip 文件，包含你的全部日记、人物、提醒。你可以保存到电脑、U 盘，或同步到云盘。」
- **AND** 「导入」按钮下方小字说明：「从之前导出的文件恢复数据。注意这会覆盖现在的内容。」

#### Scenario: 导出格式选择

- **WHEN** 用户点击「导出全部数据」
- **THEN** sheet 弹出格式选择：
  - 「便于阅读的文件包（.zip）」（推荐）
  - 「完整数据库文件（.json）」
- **AND** 不出现「Markdown / SQLite / SHA-256 / IndexedDB dump」等术语

#### Scenario: 云同步降级为次级

- **WHEN** 用户进入「设置 → 备份」
- **THEN** 主导出 / 导入按钮下方有一个折叠小条：「也可以同步到云端 →」
- **AND** 展开后显示「目前支持坚果云、Nextcloud 这类标准网盘」+ 「添加云端」按钮
- **AND** **不**显示 WebDAV / S3 / AES-256-GCM / PBKDF2 等术语

### Requirement: 云端配置使用人话

#### Scenario: 添加云端

- **WHEN** 用户点击「添加云端」
- **THEN** 弹出配置 sheet，字段命名为：
  - 「网盘服务」（下拉：坚果云 / Nextcloud / 自建网盘）
  - 「服务器地址」
  - 「账号」
  - 「密码」（小字「建议用应用专用密码」）
  - 「文件夹路径」
- **AND** 不出现 WebDAV / S3 / endpoint / region / accessKeyId / secretAccessKey 等字眼

#### Scenario: 加密用人话

- **WHEN** 配置 sheet 底部
- **THEN** 含一个 toggle：「上传前加密保护」+ 小字「打开后，文件需要密码才能打开，请记好密码」
- **AND** 不出现「端到端 / AES-256-GCM / PBKDF2 / iv / salt」等术语

#### Scenario: 测试连接友好

- **WHEN** 用户填写完点击「测试一下」
- **THEN** 成功时显示「✓ 可以连接」；失败时显示具体问题：「地址写错了？」「账号或密码不对？」「网络不通？」
- **AND** 不直接抛 HTTP 状态码或异常堆栈

## MODIFIED Requirements

### Requirement: 备份打包与命名

系统 SHALL 将一次备份打包为单一 `.zip`（兼容 App 与 Web 双端），内部结构固定：

```
/manifest.json          # 元数据：appVersion / schemaVersion / deviceId / exportedAt
/data.json              # 结构化数据（统一 JSON 格式，跨端可读；App 端可选额外 db.sqlite）
/media/<hash>.<ext>     # 图片按 SHA-256 内容哈希命名，去重
/readme.txt             # 一段简短的人话说明，告诉用户这个包是什么、怎么用
```

#### Scenario: 备份包自解释

- **WHEN** 用户下载任一备份包并手动解压
- **THEN** 看到 `readme.txt` 用普通话解释包内容："这是你在『还活着』的全部数据。如果想恢复，把这个 zip 文件交给『还活着』的「从备份导入」即可。"
- **AND** `data.json` 是可读的 JSON，不必专业工具也能用文本编辑器查看

#### Scenario: 文件命名友好

- **WHEN** 备份文件自动命名
- **THEN** 文件名为「还活着 YYYY-MM-DD HH-MM.zip」（包含中文 + 时间），不使用纯英文 + ISO 时间戳
- **AND** 用户在文件管理器里一眼看出这是哪天的备份
