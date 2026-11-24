# NEON APEX — 赛道设计与街机漂移手感工程规范

本文档永久保存我们在反复调研现代街机赛车（*Forza Horizon*、*OutRun 2*、*Need for Speed Heat*、*Mario Kart*、*Gran Turismo 7*）以及多轮全赛道物理仿真验证后沉淀下来的**赛道建模标准、漂移物理参数与验收清单**。后续每次新增或调整赛道，均应遵循本规范。

---

## 一、 赛道几何与比例规范（Modern Highway Proportions）

1. **推荐尺度与路面宽度**
   - 基准控制点在 `scalePoints(pts, 1.55, 1.15)` 下展开，单圈实测长度控制在 **`3,300m – 4,300m`**（单圈高速完赛时间约 `32s – 44s`，3 圈总时长约 `1分40秒 – 2分15秒`）。
   - 路面宽度 `roadWidth` 控制在 **`26m – 32m`**（双向四车道 + 路肩规模），保证 6 车并排超车、外-内-外走线与大角度横滑（35°–40°）时拥有充足容错空间。
   - `TrackSpline` 统一使用闭环向心 Catmull-Rom 样条，采样密度 `sampleCount = 1500`（每段步长 ~2.4m），保证高车速（400+ km/h）下曲率与坡度平滑无折角。

2. **弯道类型与倾角（`inwardBankDeg`）控制漂移时长机制**
   - 坐标系约定：`[right, up, -tangent]` 为右手系；`curvature > 0` 表示向右转；`inwardBankDeg` 统一填**正角度值**，`TrackSpline` 自动根据曲率符号向弯心倾斜。
   - **小角度 / 平直技术型 U 型弯（`0° – 12°`）**：
     - 弯中速度收敛略强（约 `64%–84%` 极速），保留轻微向外离心推力，玩家需提前外切入弯并积极内打/反打控线。
     - 蓄气速率较快（`bankChargePace ≈ 1.25× – 1.38×`），适合短促干脆的发卡弯快蓄快喷（Tier 1–2 / 3）。
   - **中倾角高速 90° / 折返弯（`14° – 24°`）**：
     - 兼顾高速入弯与稳健抓地，适合连续 S 弯与都市高架匝道。
   - **大倾角碗状 U 型弯（`28° – 35°`，如赞德沃特 / 纽北卡鲁塞尔）**：
     - 弯心向心支持强，车速维持在 `87%–97%` 极速；蓄气节奏平滑拉长（`bankChargePace ≈ 0.78×`），可稳定维持 3–4 秒超长横滑并获得最高 `+50%` 氮气充能加成。

3. **安全几何与零穿模铁律**
   - **无自交间距**：任意非相邻路段（沿赛道间隔 > 180m）的 3D 最小距离必须 **`>= 100m`**。
   - **零桥墩/地形穿模**：
     - 高架桥 T 型混凝土横梁必须跟随赛道真实倾角 `bankQuat` 旋转，并下沉至 `-4.35 * up`（高于箱梁底面净空 ≥ 3.35m）。
     - 桥墩立柱顶部按左右偏移位置在倾斜箱梁底面的真实高度截断，确保在 `35°` 倾角下仍低于路面 `≥ 3.3m`。
     - 山地 3D 地形必须按 `nearestY - halfWidth * sin(|bank|) - 8.5m` 加深开挖，且两侧净空 `>= halfWidth + 26m`。
     - 树木最小离路距 `>= halfWidth + 9.5m`，隧道顶部大型设备最低点离路面 `>= +18m`。
   - **功能道具不重叠**：
     - 地面加速带（`boostPads`）与飞跃跳台（`jumpRamps`）之间在归一化参数 `t` 上至少错开 `0.015`（~55m）以上；跳台不得置于隧道区间（`tunnelZones`）内，且跳台落点距离下一个急弯至少留出 `120m` 落地制动缓冲。

4. **弯前视觉预告标准**
   - 所有曲率 `|κ| > 0.006` 的弯道入口前自动生成 **150m / 100m / 50m** 距离刹车牌 + 弯外侧反光黑黄导向牌 + 内外侧 FIA 红白立体路肩。
   - `CarPhysics.scanUpcomingCorner()` 扫描前方 `30m – 210m`（触发阈值 `0.0052 / 0.0062`），驱动顶部 `#corner-callout` 实时提示弯向、是否发卡弯、倾角与剩余距离。

---

## 二、 现代街机漂移物理设计规范（`CarPhysics.ts`）

1. **车头朝向与速度矢量真解耦**
   - `yawOffset`：车辆实际速度方向（相对赛道切线）。
   - `headingYaw = yawOffset + slipAngle`：车头视觉与动态朝向；真实侧滑角 `slipAngle` 在 `12° – 41°` 之间随玩家转向输入实时变化，并驱动前轮自动反打（Counter-Steer）。
   - **出弯零甩尾铁律**：结束漂移瞬间保持 `yawOffset` 连续，立即令 `headingYaw = yawOffset`、`angularVel = 0`，仅让 `visualSlipAngle` 平滑回正，杜绝出弯猛拉撞墙。

2. **双触发起漂 + S 弯无缝换向**
   - **手刹起漂**：按住 `Space`（手机端 `DRIFT`）。
   - **点刹起漂（Brake-to-Drift）**：车速 > `130 km/h`（`36 m/s`）且打方向时轻点 `S / ↓`（或手机 `BRAKE`，< 0.28s）自动锁入漂移。
   - **S 弯无缝换向**：漂移中反打方向进入反向急弯（持续 > `0.14s`），自动结算上一段漂移小喷并丝滑切换至新弯方向，无卡死感。

3. **内弯贴路肩缓冲 & 外弯防撞柔和限幅**
   - 利用 `innerClearance` 与 `outerClearance` 渐变系数，在距内/外护栏 `2.6m – 8.1m` 范围内柔和衰减横向切入角，让玩家贴着 FIA 红白路肩丝滑擦弯而不猛撞护栏。

4. **漂移禁氮干脆切断规则（默认关闭「漂移同步喷气」）**
   - 当 `allowDriftNitro === false` 时，进入或处于漂移期间立即关闭 `isNitroActive`、`isSuperNitro`，并同步清空残留的 `miniBoostTimer` 与 `boostPadTimer`、屏蔽排气管橙色尾焰与高速光带拖尾，确保漂移过程干净纯粹、零残余火焰；开启「漂移同步喷气」开关后允许自由叠加。

---

## 三、 新赛道上线验收标准（强制自动化验证）

每新增或修改一条赛道，必须运行两套无头校验脚本并通过：
1. **净空检查**（`check_clearance.ts`）：确认所有路段 `lowEdgeAboveFloor > 5m`、`capBelowRoad >= 3.3m`、`colCornerBelowRoad >= 3.3m`。
2. **四模式物理全跑仿真**（`test_drift.ts`）：
   - `minSep3D >= 100m`（无自交）；
   - `BRAKE_TAP` 模式整圈 `wallHits <= 1`；
   - `DRIFT` 模式圈速显著快于 `GRIP_ONLY` 且 `wallHits <= 3`；
   - 每个设计的 U 型弯 / 90° 弯均能自然触发完整漂移并获得 Tier 1–3 出弯加速。

---

## 四、 超长环岛 / 多地貌大满贯赛道规范（Mega Island Grand Circuit）

当赛道总长超过 `4,500m`（如 `apex-island` `11.9 km` 与 `isle-of-man` `30.15 km`）时，需同步满足以下扩展规范：
1. **动态样条精度与物理米制缓冲区（`TrackSpline.ts`）**：
   - 标准赛道（`<= 4,500m`）保持 `sampleCount = 1500` 不变；超长赛道按 `Math.min(13000, Math.round(totalLength / 2.6))` 自适应扩充采样点（`30.15 km` 对应 `11,595` 段），保证每段步长稳定在 `~2.6m`。
   - 发车直道与跳台坡道倾角展平范围改按物理米数计算（发车前 `45m–165m`，跳台前 `70m` / 后 `90m`），避免按归一化 `t` 比例在 12–30km 赛道上过度拉伸；弯前 `150m/100m/50m` 距离牌统一采用 `InstancedMesh`（全图仅 3 次绘制调用）。
2. **节奏叙事与真实地标分区（参考 *Forza Horizon Goliath* / *Nürburgring Nordschleife* / *Isle of Man TT Snaefell Mountain Course*）**：
   - **极境环岛大满贯（`apex-island`，`11.9 km` × 2 圈）**：海港都市 -> 双塔跨海悬索桥 + 34° 海洋碗弯 -> 76m 火山松林鸟居与悬崖发卡 -> 1.3km 穿山弧形隧道 + 33° 卡鲁塞尔 -> 灯塔半岛 5°–9° 低倾角发卡 + 铃鹿 S 弯 -> 海湾跳台冲刺。
   - **曼岛 TT 斯奈菲尔环岛（`isle-of-man`，`30.15 km` × 1 圈，按 1:2 半尺寸精确还原真实 60.725 km / 37.73 英里、最高峰 422m 赛道）**：道格拉斯 TT 大看台 -> Bray Hill 下坡 -> Quarterbridge -> Braddan S 弯 -> Crosby -> Ballacraine -> Glen Helen 连续林谷弯 -> Cronk-y-Voddy 跳台 -> Kirk Michael -> Ballaugh 飞跃石桥 -> Quarry Bends -> 2km Sulby 极速直道 -> Kerrowmoar -> Ramsey 6° 发卡弯 -> Waterworks -> Gooseneck 上山 -> 荒凉无树的 A18 Snaefell 紫石南高地、Mountain Mile、30° Verandah、Bungalow 与 150m Hailwood's Height 山顶跳台 -> Windy Corner -> Creg-ny-Baa 酒馆弯 -> Brandish -> Governor's Bridge 冲线。
   - 每个分区入口设置专属分区高速龙门路牌（文字加 `maxWidth` 防与车道箭头重叠）与标志性地标，降低超长赛道视觉疲劳并强化路感记忆。
3. **超大世界渲染与空间哈希零穿模地形雕刻（`SceneryBuilder.ts`）**：
   - 相机远裁面提升至 `7600m`，天空盒半径 `3900–5600m`，动态海面扩展至 `14–26 km` 并对齐赛道几何中心。
   - 超长赛道 3D 环岛山地高度场（如 `260×260` 网格）采用 **220m 2D 空间哈希网格**将路基雕刻加速至 `< 40ms`，并严格遵循 `Math.min(rawTerrainY, nearestY - nearestBankDrop - 10.5)` 规则：海峡下保持海底沉没于海面之下，山坡路基处严格下挖至倾斜路沿下方 `>= 10.5m`，且经全采样点三角插值净空审计（要求全线路面边缘高于地形 `>= 6m`）。
