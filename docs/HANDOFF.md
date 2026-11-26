# NEON APEX — 项目交接与运维手册（Project Handoff）

> **交接日期**：2026-11-27  
> **当前生产版本**：`v2.0.1`（Android `versionCode = 3` / `versionName = "2.0.1"`）  
> **主分支**：`main`（本地已完成全局 PBR 光照校准与实时「画面亮度」功能提交）

---

## 一、 项目全景快照

| 维度 | 详细信息 |
| :--- | :--- |
| **项目仓库** | `https://github.com/rgc-projects/neon-apex`（本地：`E:\AI\google\neon-apex`） |
| **线上 Web 域名** | `https://neon-apex.gcrdev.top`（Cloudflare Workers Static Assets，`wrangler.jsonc` → `./dist`） |
| **Android 包名** | `top.gcrdev.neonapex`（Capacitor 7，`minSdk = 23`，`compileSdk / targetSdk = 35`） |
| **本地最新安装包** | `releases/NEON-APEX-v2.0.0-android.apk`（`5.0 MB`，gitignored，由 CI Run `#45813287500` 下载并已实机验收） |
| **Git 分支状态** | `main` 与 `origin/main` 同步（`feat/mobile-android-i18n` 已快进合并回 `main`） |
| **核心规模** | 34 个 TypeScript/CSS 源码文件、10 条 3D 赛道（3.4 km – 60.7 km）、3 台 GT 超跑、5 名 AI 对手、100% 离线资产 |

---

## 二、 关键演进里程碑（Commit 脉络）

1. **视觉与物理基座（`05333b0` → `bd96cb3`）**
   - 写实 PBR 材质与金属车漆重制、4× WebGL2 MSAA + HDR `UnrealBloomPass` + `SMAAPass`、真解耦侧滑角漂移与点刹起漂、桥墩/山体零穿模修复、移动端动态零偏置浮动摇杆与拇指扇形布局。
2. **多主题与超长史诗赛道矩阵（`ecb23db` → `ca4cec9`）**
   - 陆续建成 10 条风格各异的赛道：摩纳哥低倾角街道、11.9 km 极境环岛大满贯、1:1 真实 60.7 km 曼岛 TT（配 O(1) 空间哈希与双层零穿模地形）、川藏 G318 怒江 72 拐、20.8 km 极光星湾 24 弯迷宫、26.1 km 超级秋名山 v2（35° 极限倾角、±12.6% 过山车坡度与 5 大蛇形漂移区）。
   - 将漂移同喷、长道超频、长道满氮全部拆分为互相独立的**默认关闭**开关（持久化至 `localStorage`）。
3. **3A 级可扩展赛道选择系统（`872cde7`）**
   - 重构右侧赛道栏为固定高度紧凑主面板 + 全屏 1040px 蓝图图库弹窗（搜索 / 分类 / 排序 / 本地收藏），可平滑支撑 50–100+ 条赛道。
4. **双语国际化 + 手游设置中心 + Capacitor 7 安卓出包（`4d26863`）**
   - 新增集中式 `zh / en` i18n 引擎消除所有中英混排；新增 4 标签设置弹窗（画质预设与 6 项实时调节 + FPS 浮窗、3 种手机转向模式与热区微调、3 路独立音量、语言切换）；集成 Capacitor 7 原生壳与 GitHub Actions 云端自动编译 APK 流水线。
5. **Android 16 实机验收与 WebView 专项提速（`1fd7002`）**
   - 在官方 Android 16 虚拟手机实机跑通全流程并针对 WebView 瓶颈优化 `SpeedLinesOverlay`、`HUD` 离屏小地图缓存与移动端 `backdrop-filter` 移除，实测赛中帧率提升 +35%~45%，并修复 20:9 英文横屏微截断。
6. **全图光照与 PBR 可读性精调 + 实时「画面亮度」校准（`2026-11-27`）**
   - 在保留 `ACESFilmicToneMapping` 高对比夜景/日落氛围的前提下，逐图实景截屏校准全部 10 条赛道的柏油反照率（`#212835`–`#282c36`）、9 套主题阴影面半球补光与基准曝光（`1.19–1.27`）；抬高 `dirRimLight` 仰角并优化东京湾水面粗糙度消除左侧低角度高光发白；柔化玩家头灯光束边缘并微调松林/混凝土暗部材质；在 `⚙ 设置 → 🎨 画质` 新增独立于画质预设的中英双语 **`画面亮度 / Scene Brightness`（`80%–140%`）** 实时滑块。
   - 完成 Android 16 真机（`23113RKC6C` / `vermeer`，`1440×3200`）USB 实装验证（冷启动 `588 ms`）。

---

## 三、 当前本机开发与测试环境清单

接手人或后续 Agent 在本机工作时可直接复用以下已就绪环境：

- **Node.js**：`v20.12.0` / `npm 10.9.3`（Windows 原生）。
- **Java 注意事项**：Windows 本机目前仅装有 `JDK 8`（`D:\DeveloperTools\Java\jdk-1.8`），不满足 Android Gradle 8.11 / AGP 8.7 所需的 `JDK 21`，因此 **APK 编译统一通过 GitHub Actions 云端完成**（若需本地编译，请安装 Temurin JDK 21 并设置 `JAVA_HOME`）。
- **GitHub CLI（WSL）**：WSL 内 `/usr/bin/gh` 已登录账号 `rgc318`，具备 `gist`、`read:org`、`repo`、`workflow` 权限，可用于推送代码与下载 CI 产出的 APK。
- **Android CLI & 官方模拟器（Windows）**：
  - CLI 路径：`C:\Users\15116\AppData\AndroidCLI\android.exe`（v1.1，已加入用户 PATH）
  - SDK / ADB：`C:\Users\15116\AppData\Local\Android\Sdk\platform-tools\adb.exe`
  - 虚拟设备：`medium_phone`（Android 16 / API 36，`1080×2400`，WHPX + RTX 4070 Ti 硬件加速），可通过侧边栏 **Android Device Hub** 面板启动与实时投屏（Mirror）。
  - ⚠️ **安全隔离提醒**：本机另装有网易 MuMu 模拟器（`D:\Program Files\Netease\MuMuPlayer-12.0`），内含用户个人游戏实例，任何自动化脚本禁止连接或操作 MuMu 端口。

---

## 四、 常见扩展开发速查（Developer Recipes）

### 1. 新增一条赛道
1. 在 `src/config/` 新增 `<newTrack>.ts`（遵循 [docs/TRACK_AND_DRIFT_DESIGN.md](./TRACK_AND_DRIFT_DESIGN.md) 几何与零穿模规范）。
2. 在 `src/config/tracks.ts` 的 `TRACK_CONFIGS` 中注册；若引入新 `TrackTheme`，在 `src/types.ts`、`src/track/SceneryBuilder.ts` 与 `src/game/GameEngine.ts`（`loadTrack` 光照）补齐主题实现。
3. **必做**：在 `src/i18n/i18n.ts` 的 `TRACK_EN_DESC` 补充该赛道的英文标题、副标题与介绍。
4. 运行几何净空与四模式漂移仿真 + `npm run deploy:dry`。

### 2. 新增一台超跑
1. 在 `src/config/cars.ts` 的 `CAR_SPECS` 追加车辆参数与物理调校。
2. 如需新外观套件，在 `src/vehicle/CarModel.ts` 扩展 `bodyStyle`。
3. **必做**：在 `src/i18n/i18n.ts` 的 `CAR_EN_DESC` 与 `CAR_ZH_SUB` 补充中英文副标题与描述。

### 3. 新增一种语言（如繁中 / 日语）
1. 在 `src/i18n/i18n.ts` 扩展 `Language` 类型，复制 `EN` 字典新增对应语言表，并在 `CAR_*` / `TRACK_*` 映射表补充本地化文案。
2. 在 `src/ui/SettingsUI.ts` 的 `renderLanguageTab()` 增加语言选择卡片，并将顶栏快速切换调整为循环切换或跳转设置语言页。

### 4. 发布新版 Android APK
1. 在 `android/app/build.gradle` 递增 `versionCode` 与 `versionName`（若需同步更新产物文件名，一并更新 `.github/workflows/build-android.yml`）。
2. 推送至 `main` 后，在 GitHub Actions 等待 `Build Android APK` 绿灯，或在 WSL 执行：
   ```bash
   gh run list -R rgc-projects/neon-apex --workflow "Build Android APK" --limit 3
   gh run download <RUN_ID> -R rgc-projects/neon-apex -n neon-apex-android-apk -D /mnt/e/AI/google/neon-apex/releases
   ```

---

## 五、 已知局限与下阶段演进建议（Backlog）

| 优先级 | 项目 | 说明与落地方式 |
| :---: | :--- | :--- |
| **P1** | **正式固定 Release 签名（Keystore）** | 当前 CI 使用临时 `debug.keystore` 签名，真机跨次覆盖安装新版 APK 时需先卸载旧版；建议生成固定 `.jks` 存入 GitHub Secrets（`ANDROID_KEYSTORE_BASE64` 等），并在 `android/app/build.gradle` 配置正式 `signingConfigs.release`，即可支持无缝覆盖升级与上架应用商店。 |
| **P1** | **升级 GitHub Actions 节点版本** | `.github/workflows/build-android.yml` 中 `actions/setup-java@v4` 等已收到 Node 24 弃用提示，后续升级至 `actions/checkout@v5`、`actions/setup-java@v5`、`actions/setup-node@v5` 与最新 `gradle/actions/setup-gradle` 即可消除告警。 |
| **P2** | **移动端 3D LOD 与真机深度调优** | 当前在 Android 16 模拟器已提速 +35%~45%；后续可针对中低端安卓真机进一步做远景树木/建筑分档实例数缩放（Low 档减半）、动态关闭非关键 AI 车尾焰粒子，以及在发车加载期增加预编译提示避免首帧掉帧。 |
| **P2** | **新增可游玩玩法扩展** | 计时幽灵车（Ghost Replay，持久化最佳圈速轨迹）、本地单圈排行榜、自定义车漆涂装编辑器、蓝牙手柄（Gamepad API）支持，以及 iOS Capacitor 打包支持（需 macOS / Xcode）。 |
| **P3** | **清理已合并的旧功能分支** | `feat/mobile-android-i18n` 已快进合并至 `main`，确认无需回溯后可按需删除本地与远端该分支。 |
