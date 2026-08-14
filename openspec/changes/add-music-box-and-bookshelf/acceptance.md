# 真机验收记录

## 2026-08-14 自动验证

- [x] Expo 57 autolinking 在 iOS/Android 同时识别 `react-native-pdf`、`react-native-blob-util`、`react-native-webview` 和 `react-native-gesture-handler`。
- [x] iOS、Android production bundle 均完成；移动端阅读路径不再导入 DOM `<embed>`。
- [x] TypeScript、`git diff --check` 和 `openspec validate add-music-box-and-bookshelf --strict` 通过。
- [x] Android 原生配置已越过 `react-native-pdf` 与 `react-native-webview` 的旧 AGP 声明；项目补丁固定复用 Expo 57 根工程插件。
- [ ] Android 原生编译等待本机缓存或联网构建环境提供 `commons-lang3`、AndroidPdfViewer、PdfiumAndroid、Gson、AndroidX WebKit 等 Maven artifact；当前按仓库网络规则未下载。
- [ ] iOS CocoaPods 已完成新模块 autolinking/codegen，随后因本机缺少 `cmake` 且离线环境没有 Hermes 源码停止，尚未安装到模拟器。
- [ ] 当前没有 Android 设备；iOS 模拟器未完成原生依赖编译，因此以下行为项仍是发布门禁，不标记为通过。

## iOS

- 导入 mp3/m4a 音乐，锁屏与切换路由后继续播放；验证静音模式、暂停、关闭和下一首。
- 拖动悬浮播放器到四角，确认不会被刘海、底部 Home Indicator 或 Tab Bar 遮挡，重启后位置恢复。
- 导入大文件音频和 PDF，确认导入耗时、空间占用与失败提示可理解，失败不留下半成品。
- 打开 PDF，翻页后退出再进入，确认页码与进度恢复；保存摘抄并从摘抄创建观后感。
- 导入 DRM EPUB/MOBI/AZW，确认显示 unsupported/protected 状态且原始文件仍可删除或重新导入。
- EPUB development build 验证目录、CFI 恢复、字号/行距/页边距/主题、选区摘抄和安全区。
- PDF renderer 验证真实页码、总页数（若可用）、缩放、旋转、iOS 选区/Android 手动摘抄和 50 MB+ 文件。

## Android

- 验证后台音频会话、耳机/系统音量变化、播放错误后跳过下一首。
- 验证悬浮播放器拖动边界适配不同屏幕和导航模式，关闭后不删除曲库文件。
- 验证旧 ZIP 备份恢复后新音乐盒、书架为空，现有日记/人物/相册不受影响。
- 验证新 ZIP 备份恢复音频、书籍、摘抄和阅读笔记来源，校验 checksum 与路径安全。
- 验证 PDF 大文件加载与页面方向切换；不支持格式显示原因，不执行转码或 DRM 破解。
- 验证阅读页打开时音乐悬浮播放器不重叠，退出阅读页后全局音乐会话按原规则恢复。
