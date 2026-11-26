# NEON APEX — 跨平台测试与验收手册（Testing & QA Playbook）

本文档定义 **NEON APEX**（Web 桌面端、手机网页端与 Android APK 原生端）的完整验证标准、实操命令与基准实测记录。每次功能迭代、赛道新增、UI 改版或发包前，均应按本手册逐层验证。

---

## 一、 四层质量验证体系总览

| 验证层级 | 目标范围 | 触发条件 | 通过门槛 |
| :--- | :--- | :--- | :--- |
| **L1 静态与构建校验** | TypeScript 类型、Vite 产物、Cloudflare Workers 包、Capacitor 同步 | 每次提交前必跑 | 全部命令退出码 `0` |
| **L2 赛道几何与漂移物理仿真** | 净空无穿模、无自交、四模式漂移物理跑圈 | 新增或修改任意赛道/物理参数 | `minSep3D >= 100m`、地形/桥墩零穿模、全弯可顺滑起漂 |
| **L3 多视口 Web 浏览器验收** | 桌面 `1280×800`、安卓 20:9 横屏 `915×412`、竖屏 `390×844` | 改动 UI、CSS、i18n、画质或操控 | `0` 控制台/WebGL 报错、`0` 横向溢出、关键视图截屏无遮挡 |
| **L4 真机 / Android 16 模拟器实测** | APK 签名与离线资产、冷启动、沉浸横屏、返回键、WebView 帧率与 `logcat` | 改动原生壳、Capacitor、画质管线或发版前 | `0` 崩溃、`0` `AndroidRuntime:E` / `Capacitor/Console:E`、离线资源全加载 |

---

## 二、 L1：静态编译、Workers 预检与 Capacitor 同步

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'E:\AI\google\neon-apex'

# 1. 类型检查 + 生产构建 + Cloudflare Workers 打包预检
npm run deploy:dry

# 2. 同步 Web 产物与 4 个原生插件至 Android 工程
npx cap sync android
```

**验收要点**：
- `tsc --noEmit` 零报错；
- `vite build` 正常拆出独立 `three` chunk 与 `index` chunk，`dist/` 含 16 个静态资产（含 `models/supercar.glb`、`draco/draco_decoder.wasm`、`manifest.json`）；
- `wrangler deploy --dry-run` 正常识别 `./dist` 全部静态资源；
- `cap sync android` 正常识别全部 4 个插件：`@capacitor/app`、`@capacitor/haptics`、`@capacitor/screen-orientation`、`@capacitor/status-bar`。

---

## 三、 L2：赛道几何净空与物理仿真标准

新增或修改赛道（`src/config/*Track.ts`、`TrackSpline.ts`、`TrackBuilder.ts`、`SceneryBuilder.ts`）时，严格对照 [docs/TRACK_AND_DRIFT_DESIGN.md](./TRACK_AND_DRIFT_DESIGN.md) 验证：

1. **几何与零穿模**：
   - 非相邻路段（间隔 > 180m）3D 最小间距 `minSep3D >= 100m`；
   - 高架桥盖梁与立柱在最高 `35°` 倾角下 `capBelowRoad >= 3.3m`、`colCornerBelowRoad >= 3.3m`；
   - 全线山体/峡谷/湖泊地形网格路沿净空 `minTerrainClearance > 5m`（高耸山道推荐 `>= 9m`）；
   - 加速带与跳台在参数 `t` 上至少错开 `0.015`，跳台不在隧道内，落地距下一个急弯 `>= 120m`。
2. **四模式漂移仿真**：
   - `BRAKE_TAP` 点刹入弯整圈 `wallHits <= 1`；
   - `DRIFT` 模式圈速显著快于 `GRIP_ONLY`，且 `wallHits <= 3`；
   - 超长综合赛道（`island` / `manx` / `akina`）在默认双开关关闭时回归纯原版极速与常规氮气，开启开关后蛇形区与发卡弯 `0%` 误触发无限氮气。

---

## 四、 L3：多视口浏览器功能与视觉验收清单

启动本地服务：`npm run dev -- --port 5179 --strictPort`，依次在 3 套目标视口检查：

### 1. Desktop 桌面端（`1280×800`）
- [ ] 默认进入 `Ultra（极致原画）`：3D 法拉利 458 金属漆面反射、灯光与背景城市正常渲染，`0` WebGL/Console 报错。
- [ ] **双语切换**：点击顶栏 `🌐 EN / 中文`，主菜单标题、3 台超跑介绍与属性条、10 条赛道名称与详情、开赛按钮、暂停页、结算页均瞬间切换为纯净单语，**无中英混排 `/` 换行**。
- [ ] **可扩展赛道中心与图库**：右侧主面板高度固定不溢出（与左侧对称）；`◀ / ▶` 翻页、`★` 收藏（刷新后持久化）、分类计数、`🌐 图库 10` 全屏弹窗 3 列网格、关键字搜索（中英文双向命中，如 `秋名` / `Akina` → `2 / 10`）、里程/倾角排序、选图联动均正常。
- [ ] **4 标签设置中心（`⚙ 设置`）**：
  - `🎨 画质`：在 `流畅省电 / 均衡推荐 / 高清旗舰 / 极致原画` 间实时热切换不黑屏、不报错；开启 `显示实时 FPS / 帧耗时` 后浮窗正常显示且不遮挡 Logo/HUD。
  - `🎮 操控`：3 种转向方式（浮动摇杆 / 左右按键 / 重力感应）、自动油门、灵敏度/缩放/透明度滑块正常生效。
  - `🔊 音频`：主音量 / SFX / BGM 滑块与全局静音联动正常。
  - `🌐 语言`：简体中文 / English 卡片实时切换正常。

### 2. Android 20:9 横屏（`915×412`）
- [ ] 整页零水平溢出（`scrollWidth <= clientWidth`），左右面板与中下开赛区布局平衡。
- [ ] 英文模式下 `SELECT CIRCUIT` 与 `CATALOG 10` 完整单行显示不截断；左侧 `TOP SPEED / ACCEL / DRIFT / NITRO` 与车名/徽章单行对齐不换行。
- [ ] 切换「左右按键」转向模式并开赛，左下 `◀ 左转 / ▶ 右转` 与右下扇形 `漂移 / 氮气 / 刹车` 布局合理无重叠，FPS 浮窗位于底部居中不遮挡左上排名盒。
- [ ] 赛中点击暂停 → 打开设置弹窗，确认设置弹窗正常叠置在暂停层上方（`z-index: 120`）且无 WebGL 穿层黑屏。

### 3. Mobile 竖屏（`390×844`）
- [ ] 顶栏 6 枚操作图标（含 `EN` 语言钮与 `⚙` 设置钮）完整收纳在单行内无孤立换行。
- [ ] 「选择超跑 / 选择赛道」移动端 Tab 正常切换，赛道图库 2 列卡片徽章与 `☆` 收藏按钮无碰撞。
- [ ] 设置弹窗画质页零水平滚动条，`抗锯齿模式` 下 `4× MSAA + SMAA` 自动整行换排不截断文字。

---

## 五、 L4：Android APK 完整性与实机 / 模拟器验收步骤

### 1. APK 包体与签名完整性检查
```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('E:\AI\google\neon-apex\releases\NEON-APEX-v2.0.0-android.apk')
$entries = $zip.Entries | Select-Object -ExpandProperty FullName
@(
  'AndroidManifest.xml',
  'classes.dex',
  'assets/public/index.html',
  'assets/public/models/supercar.glb',
  'assets/public/draco/draco_decoder.wasm',
  'assets/capacitor.config.json'
) | ForEach-Object { "$_ : $($entries -contains $_)" }
"Signature : $(($entries | Where-Object { $_ -match '^META-INF/.*\.(RSA|DSA|EC)$' }) -join ', ')"
$zip.Dispose()
```

### 2. Android 16 官方模拟器实机联调流程
> ⚠️ **注意**：本机另装有网易 MuMu 模拟器，测试时务必只使用官方 `android` CLI 管理的 `emulator-5554`（`medium_phone`）或用户显式连接的 USB 真机，**切勿连接或操作 `127.0.0.1:16512` 等用户个人 MuMu 实例**。

```powershell
$android = "$env:USERPROFILE\AppData\AndroidCLI\android.exe"
$adb     = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$apk     = "E:\AI\google\neon-apex\releases\NEON-APEX-v2.0.0-android.apk"
$serial  = "emulator-5554"

# 1. 启动虚拟手机（若尚未运行）
& $android emulator start medium_phone

# 2. 卸载旧版（CI 每次使用临时 debug 签名，跨 CI 构建覆盖安装前需先卸载）并安装新版
& $adb -s $serial uninstall top.gcrdev.neonapex 2>$null
& $adb -s $serial install -g $apk

# 3. 清空日志并冷启动 App
& $adb -s $serial logcat -c
& $adb -s $serial shell am start -W -n top.gcrdev.neonapex/.MainActivity

# 4. 检查横屏锁定与沉浸全屏状态
& $adb -s $serial shell "dumpsys window | grep -E 'mCurrentFocus|mCurrentRotation'"

# 5. 截屏并视觉检查（使用 android screen capture，可加 --annotate 定位坐标）
& $android screen capture --device $serial -o "$env:TEMP\neon_android_check.png"

# 6. 测试物理返回键状态机（弹窗内 -> 关闭弹窗；赛中 -> 暂停；主菜单 -> 最小化）
& $adb -s $serial shell input keyevent KEYCODE_BACK

# 7. 检查崩溃与 WebView 控制台错误（预期输出为空）
& $adb -s $serial shell pidof top.gcrdev.neonapex
& $adb -s $serial logcat -d -v brief AndroidRuntime:E Capacitor/Console:E "*:S"
```

---

## 六、 当前版本（v2.0.1 / `1fd7002`）实测基线记录

| 测试环境 | 分辨率 / 平台 | 实测项目 | 实测结果 |
| :--- | :--- | :--- | :--- |
| **Cloudflare 构建** | `npm run deploy:dry` | TS 类型 + Vite + Wrangler 16 资产 | **PASS**（`0` errors，1.20s） |
| **GitHub Actions CI** | Ubuntu + Node 22 + JDK 21 + SDK 35 | `Build Android APK` Run `#45813287500` | **PASS**（`1m44s`，`5.0 MB` 已签名 APK） |
| **Desktop Web** | `1280×800` Chromium | 中英切换、图库、4 标签设置、画质切换、FPS | **PASS**（`0` 报错，Ultra 满血 `143 FPS`） |
| **Mobile Web 横屏** | `915×412` Chromium | 菜单布局、左右按键转向开赛、暂停叠置设置 | **PASS**（`0` 报错，`0` 溢出，`165 FPS`） |
| **Mobile Web 竖屏** | `390×844` Chromium | 单行顶栏 6 图标、赛道 Tab、设置页零横滚 | **PASS**（`0` 报错，`0` 溢出） |
| **Android 16 原生 APK** | `medium_phone` (`2400×1080`, API 36, WHPX) | 离线启动、横屏沉浸全屏、中英切换、图库、400 km/h 竞速、摇杆操控、返回键暂停 | **PASS**（冷启 `1.24s`，`0` 崩溃，`0` `AndroidRuntime:E`；优化后起步 `29→42 FPS`、6 车混战 `17→23 FPS`） |
