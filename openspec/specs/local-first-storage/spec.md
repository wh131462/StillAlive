# local-first-storage Specification

## Purpose
TBD - created by archiving change chronicle-pivot. Update Purpose after archive.
## Requirements
### Requirement: 本地主存优先

系统 SHALL 把用户所有数据（Post / Reminder / Person / Mention / 附件）存储在用户设备本地，服务器仅作为用户自选的二级备份。

- Web 主存：IndexedDB（schema v1 定义实体对象库 + 必要索引）；附件 blob 存于 IndexedDB 的 object store。
- App 主存：SQLite（schema v1 定义表结构）用于结构化数据；附件（图片）存入应用沙盒文件系统，数据库仅存相对路径。

#### Scenario: 离线可用

- **WHEN** 用户处于无网络环境
- **THEN** 读写 Post / Reminder / Person / 编辑 biography 等所有核心操作正常完成
- **AND** 不出现任何网络错误或功能降级提示

#### Scenario: 无服务器也可用

- **WHEN** 用户从未配置任何二级备份目标
- **THEN** 产品全部功能可用，仅设置页提示「未开启备份」

### Requirement: 备份协议为标准协议

系统 SHALL 支持将本地数据导出至用户自建服务器，协议限定为 WebDAV 或 S3 兼容（含 MinIO / R2 / B2）。

#### Scenario: WebDAV 配置

- **WHEN** 用户在「备份」设置中选择 WebDAV
- **THEN** 需填写 `serverUrl` + `username` + `password`（或 app-password）+ `rootPath`
- **AND** 「测试连接」按钮发起一次 `PROPFIND` 到 rootPath 验证可达与可写

#### Scenario: S3 兼容配置

- **WHEN** 用户选择 S3 兼容
- **THEN** 需填写 `endpoint` + `region` + `accessKeyId` + `secretAccessKey` + `bucket` + `keyPrefix`
- **AND** 「测试连接」发起一次 `HeadBucket` 验证

#### Scenario: 不支持私有专有协议

- **WHEN** 用户尝试使用任何专有云 SDK（Dropbox / iCloud Drive / OneDrive SDK）
- **THEN** 设计稿不提供该选项；仅 WebDAV 和 S3 兼容入口

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

### Requirement: 同步语义单向与手动

系统 SHALL 在本次 MVP 中仅支持「单向上传备份」，不做增量双向同步。

#### Scenario: 手动备份

- **WHEN** 用户在设置页点击「立即备份」
- **THEN** 打包当前本地数据 + 未上传过的新媒体文件，推送到目标
- **AND** 记录最近备份时间戳到本地 `backupMeta.lastSyncedAt`

#### Scenario: 周期备份

- **WHEN** 用户配置「每周自动备份」
- **THEN** 应用空闲期尝试一次自动备份，失败则静默重试最多 3 次
- **AND** 失败原因（认证 / 磁盘满 / 网络）记入本地日志，不弹窗

#### Scenario: 不做跨设备合并

- **WHEN** 用户在两个设备上各自写入
- **THEN** 设计稿明确告知「备份是单向快照，不会自动合并跨设备数据」
- **AND** 高级选项中提供「从备份覆盖本地」手动恢复入口（带红色二次确认）

### Requirement: 隐私与加密

系统 SHALL 在备份上传前对敏感内容提供可选的客户端加密。

#### Scenario: 可选加密

- **WHEN** 用户在备份设置中启用「端到端加密」并设置一个口令
- **THEN** 备份包上传前用 AES-256-GCM 加密，口令以 PBKDF2-SHA256（iter ≥ 200000）派生
- **AND** 服务器仅存到密文 + salt + iv；口令只存于用户记忆 + 本地 keychain（如可用）

#### Scenario: 未加密明示

- **WHEN** 用户未启用加密
- **THEN** 设置页显示黄色提示「备份未加密，若服务器被他人访问则内容可读」

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

云端配置 UI MUST 使用面向普通用户的字段名称和反馈，不得暴露底层协议、加密算法或异常堆栈。

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

