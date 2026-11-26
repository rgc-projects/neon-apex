import { CarSpec, TrackConfig } from '../types';

export type Language = 'zh' | 'en';

const LANG_STORAGE_KEY = 'neon_apex_lang';

const ZH = {
  // Document & Brand
  docTitle: 'NEON APEX · 3D 未来街机赛车',
  brandTag: '未来街机大奖赛 · 2099',

  // Header Actions
  btnLang: 'EN',
  btnLangTitle: '切换语言 / Switch to English',
  btnSettings: '设置',
  btnSettingsTitle: '画质、操控、音频与语言设置',
  btnFullscreen: '全屏',
  btnExitFullscreen: '退出全屏',
  btnFullscreenTitle: '进入 / 退出全屏模式',
  btnTouchOn: '触屏: 开',
  btnTouchOff: '触屏: 关',
  btnTouchTitle: '开启 / 关闭触屏按键',
  btnAudioOn: '声音: 开',
  btnAudioOff: '声音: 关',
  btnAudioTitle: '切换静音 (M)',
  btnControls: '指南',
  btnControlsTitle: '驾驶技巧与操作指南',

  // Mobile Portrait Menu Tabs
  mobTabCars: '🏎 选择超跑',
  mobTabTracks: '🏁 选择赛道',

  // Car Panel
  panelCarsTitle: '选择超跑',
  statSpeed: '极速',
  statAccel: '加速',
  statDrift: '漂移',
  statNitro: '氮气',

  // Track Panel & Hub
  panelTracksTitle: '选择赛道',
  btnCatalog: '图库',
  btnCatalogTitle: '展开全屏赛道图库（搜索、分类、排序与收藏）',
  btnPrevTrack: '上一条赛道',
  btnNextTrack: '下一条赛道',
  btnFavTrack: '收藏 / 取消收藏赛道',
  blueprintBoxTitle: '点击展开全屏赛道图库',
  catAll: '全部',
  catClassic: '经典',
  catDrift: '漂移',
  catMega: '超长',
  catFav: '★收藏',
  catAllFull: '🌐 全部赛道',
  catClassicFull: '🏙️ 经典短程',
  catDriftFull: '🔥 漂移圣地',
  catMegaFull: '🏔️ 超长史诗',
  catFavFull: '★ 我的收藏',
  bankShort: '倾角 {deg}°',
  elevShort: '{m}m 落差',
  hyperShort: '{n} 长直道',
  hyperRowTag: '⚡长直道',
  lapCount: '{n} 圈',
  singleLapLen: '单圈 {len}',
  boostPadsCount: '{n} 加速带',
  jumpRampsCount: '{n} 跳台',
  maxBankLabel: '最大倾角 {deg}°',
  listEmptyFav: '还没有收藏赛道，点击 ☆ 即可收藏',
  listEmptyOther: '该分类暂无赛道',
  btnViewAll: '查看全部',

  // Race Options & Launch
  optDriftNitro: '🔥 漂移同喷',
  optDriftNitroTitle: '默认关闭：漂移时禁止同时使用氮气；开启后可漂移与氮气同时触发',
  optOverdrive: '🚀 长道超频',
  optOverdriveTitle: '仅超长直道综合赛道生效：默认关闭（原版极速）；开启后直道满油自动触发二阶超频提速',
  optHyperNitro: '⚡ 长道满氮',
  optHyperNitroTitle: '仅超长直道综合赛道笔直大直道生效：默认关闭；开启后进入超长直道自动锁定无限氮气',
  stateOn: '开',
  stateOff: '关',
  lapsLabel: '🏁 圈数',
  startRace: '立即开赛',
  launchSubStandard: '{laps} 圈 · 6 台赛车 · 漂移集气加速',
  launchSubMega: '{laps} 圈 · 总长 {km} KM · {tag}',

  // Menu Footer Quick Keys
  keyDrive: '<kbd>W/A/S/D</kbd> 或 <kbd>↑↓←→</kbd> 驾驶',
  keyDrift: '<kbd>SPACE</kbd> 或 <kbd>点刹S</kbd> 漂移',
  keyNitro: '<kbd>SHIFT</kbd> / <kbd>E</kbd> 氮气喷射',
  keyCam: '<kbd>C</kbd> 视角',
  keyReset: '<kbd>R</kbd> 复位',
  creditNote: '3D 车型：Ferrari 458 (vicent091036, CC BY 4.0) + GT3 碳纤套件',

  // Catalog Modal
  catalogTitle: '全球赛道图库',
  catalogSearchPlaceholder: '搜索赛道名、特点（如 秋名山 / 漂移 / 60km）...',
  sortDefault: '排序：默认推荐',
  sortLenAsc: '里程：短 → 长',
  sortLenDesc: '里程：长 → 短',
  sortBankDesc: '倾角：高 → 低',
  catalogSelected: '已选中',
  catalogEmptyTitle: '未找到匹配的赛道',
  catalogEmptyFavSub: '点击任意赛道卡片右上角的 ☆ 即可加入收藏',
  catalogEmptySearchSub: '尝试更换搜索关键词或切换分类标签',
  catalogResetBtn: '重置筛选条件',
  catalogJumpChip: '{n} 跳台',
  catalogHyperChip: '{n} 长直道',

  // Controls Guide Modal
  controlsTitle: '驾驶技巧与操控指南',
  ctrlGasTitle: '油门加速',
  ctrlGasDesc: '倒计时结束瞬间在绿区踩油门触发「完美起步」',
  ctrlBrakeTitle: '点刹起漂 / 刹车',
  ctrlBrakeDesc: '高速打方向时轻点 S 即可像极品飞车一样丝滑甩尾入弯！',
  ctrlSteerTitle: '内切收线 / 反打修正',
  ctrlSteerDesc: '漂移中往弯心打方向收紧走线，反打外侧可稳住大角度横滑',
  ctrlDriftTitle: '手刹漂移（按住）',
  ctrlDriftDesc: '结合弯道 150m/100m/50m 路牌提早起漂，松开即享小喷加速！',
  ctrlNitroTitle: '主动氮气喷射',
  ctrlNitroDesc: '默认漂移中禁止同喷；可在主菜单或暂停页开启「漂移同喷」',
  ctrlAuxTitle: '辅助快捷功能',
  ctrlAuxDesc: 'C 切换追尾/引擎盖视角 · R 复位 · M 静音 · ESC 暂停',
  proTipsHtml:
    '<strong>进阶玩法：</strong> 留意屏幕顶部 <span>弯道预警提示</span> 与赛道边 <span>150m/100m/50m</span> 刹车牌，在弯前果断起漂并借倾斜坡度控时长 · 紧跟对手车尾触发 <span>尾流加速</span> · 冲上跳台获取 <span>滞空特技加分</span>！<br /><strong>📱 手机操控：</strong> 可在「设置 → 操控」自由切换 <span>动态浮动摇杆</span>、<span>经典左右按键</span> 或 <span>重力感应转向</span>，并自定义按键大小、透明度与自动油门。',

  // Unified Settings Modal
  settingsTitle: '游戏设置',
  tabGraphics: '🎨 画质',
  tabControls: '🎮 操控',
  tabAudio: '🔊 音频',
  tabLanguage: '🌐 语言',
  secQualityPreset: '画质预设',
  presetLow: '流畅省电',
  presetMedium: '均衡推荐',
  presetHigh: '高清旗舰',
  presetUltra: '极致原画',
  presetCustom: '自定义',
  presetAutoBtn: '自动检测硬件',
  presetHintLow: '低功耗省电：75% 分辨率、直出管线、无后处理，老机型也能稳帧。',
  presetHintMedium: '主流手机推荐：100% 清晰度、轻量化泛光与 70% 粒子，流畅不烫手。',
  presetHintHigh: '旗舰手机 / 轻薄本：125% 锐利渲染、2× MSAA 与完整特效。',
  presetHintUltra: '桌面端满血原画：高倍率 DPR + 4× MSAA + HDR Bloom + SMAA。',
  presetHintCustom: '已启用自定义画质参数，所有改动均实时生效。',
  optResScale: '渲染分辨率倍率',
  optFpsCap: '帧率上限',
  fpsUnlimited: '不限',
  optAA: '抗锯齿模式',
  aaOff: '关闭',
  aaSmaa: 'SMAA',
  aaMsaa2: '2× MSAA',
  aaMsaa4Smaa: '4× MSAA + SMAA',
  optBloom: '镜头泛光 (Bloom)',
  levelOff: '关闭',
  levelLow: '低',
  levelMedium: '中',
  levelHigh: '高',
  bloomSoft: '柔和',
  bloomCinematic: '电影级',
  optParticles: '粒子与速度线密度',
  optDrawDist: '场景视距',
  distNear: '近（省电）',
  distMedium: '中（均衡）',
  distFar: '远（全视距）',
  optBrightness: '画面亮度',
  optBrightnessDesc: '实时校准场景曝光，适配不同手机屏幕与环境光线',
  optShowFps: '显示实时 FPS / 帧耗时',
  optShowFpsDesc: '在画面边缘显示实时帧率与每帧渲染耗时',

  optSteerMode: '手机转向方式',
  steerJoystick: '浮动摇杆',
  steerButtons: '左右按键',
  steerTilt: '重力感应',
  optAutoThrottle: '手机自动油门',
  optAutoThrottleDesc: '开启后自动持续加速，专注转向、漂移与氮气释放',
  optSteerSens: '触屏转向灵敏度',
  optBtnScale: '触控按键大小',
  optBtnOpacity: '触控按键透明度',
  optHaptics: '震动触觉反馈',
  optHapticsDesc: '漂移、氮气喷射、跳台落地与碰撞时触发手机震动',
  optDefaultCam: '默认驾驶视角',
  camChase: '追尾视角',
  camHood: '引擎盖视角',
  optTouchForce: '显示触屏虚拟按键',
  optTouchForceDesc: '在平板或桌面设备上也可手动开启触屏控制',

  optMasterVol: '主音量',
  optSfxVol: '引擎与环境音效 (SFX)',
  optMusicVol: '合成波背景音乐 (BGM)',
  optMuteAll: '全局静音',

  langSectionTitle: '界面语言',
  langSectionDesc: '切换后立即生效，覆盖菜单、全部赛道介绍、赛中提示与结算界面。',
  langZhName: '简体中文',
  langZhSub: 'Simplified Chinese',
  langEnName: 'English',
  langEnSub: '英语（国际版）',
  btnResetSettings: '恢复默认设置',
  btnSettingsDone: '完成',

  // HUD
  hudPos: '排名',
  hudLap: '圈数',
  hudTime: '用时',
  hudBestLap: '最快圈',
  hudStyle: '特技分',
  hudLive: '● 实时',
  hudNitroSystem: '氮气系统',
  hudGear: '档位',
  hudAutoGas: '自动油门',
  hudManualGas: '手动油门',
  hudTiltOn: '重力: 开',
  hudTiltOff: '重力',
  hudCamChase: '追尾',
  hudCamHood: '车头',
  hudStartRpmHint: '按住 <kbd>W</kbd> 或 <kbd>油门</kbd> 在绿区触发「完美起步」',
  hudWrongWay: '⚠ 逆行警告（按 R 复位）',
  hudSlipstream: '⚡ 尾流加速',
  hudKeyDrift: '<kbd>SPACE</kbd> / <kbd>点刹S</kbd> 漂移',
  hudKeyNitro: '<kbd>SHIFT</kbd> / <kbd>E</kbd> 氮气喷射',
  hudKeyCam: '<kbd>C</kbd> 视角',
  hudKeyReset: '<kbd>R</kbd> 复位',
  hudNitroLocked: '漂移禁用氮气',
  hudNitroInfActive: '★ ∞ 无限氮气爆发!',
  hudNitroInfReady: '∞ 无限氮气就绪',
  hudNitroSuperActive: '★ 超级氮气爆发!',
  hudNitroBoosting: '氮气喷射中!',
  hudNitroSuperReady: '超级氮气就绪',
  hudNitroReady: '氮气就绪',
  hudNitroCharge: '漂移集气中',
  hudOverdriveInf: '⚡ ∞ 无限氮气直道 · {rem}',
  hudOverdrive2: '⚡⚡ 极速超频 II',
  hudOverdrive1: '⚡ DRS 超频 I',
  hudDriftTier0: '漂移中',
  hudDriftTier1: '小喷就绪',
  hudDriftTier2: '超级漂移!',
  hudDriftTier3: '★ 极限漂移 ★',
  hudBankTag: ' · 倾角 {deg}°',
  hudCornerRight: '右弯',
  hudCornerLeft: '左弯',
  hudCornerHairpin: 'U型发卡{dir}{bank}',
  hudCornerTurn: '90° {dir}{bank}',
  hudCornerDist: '{m}m · 起漂',
  hudRotateHint: '📱 横屏游玩视野更宽广，体验更佳',
  hudRotateDismiss: '知道了',

  // Touch Controls
  touchDriftMain: '漂移',
  touchDriftSub: '按住甩尾',
  touchNitroMain: '氮气',
  touchNitroLocked: '漂移禁用',
  touchNitroInf: '∞ 满氮!',
  touchNitroSuper: '超喷!',
  touchBrakeMain: '刹车',
  touchBrakeSub: '点刹',
  touchGasMain: '油门',
  touchRevMain: '轰油',
  touchGasSub: '加速',
  touchLeftLabel: '左转',
  touchRightLabel: '右转',

  // Status & Race Callouts
  msgAutoGasOn: '自动油门：已开启',
  msgAutoGasOff: '手动油门模式',
  msgSteerJoystick: '切换为：浮动摇杆转向',
  msgSteerButtons: '切换为：左右按键转向',
  msgTiltOn: '🧭 重力感应转向：已开启',
  msgTiltUnsupported: '当前设备不支持重力感应',
  msgTiltDenied: '未授予陀螺仪权限',
  msgTiltUnavailable: '无法启用重力感应',
  msgIosFsTip: 'iOS 请点底部分享 →「添加到主屏幕」享无边框真全屏',
  msgBrowserFsTip: '当前浏览器限制全屏，可「添加到主屏幕」全屏畅玩',
  msgTrackReset: '赛道已复位',
  msgCamHood: '引擎盖视角',
  msgCamChase: '追尾视角',
  msgPerfectStart: '⚡ 完美起步! +300',
  msgDriftBoost1: '漂移小喷!',
  msgDriftBoost2: '超级漂移!',
  msgDriftBoost3: '★ 极限漂移 ★',
  msgBoostPad: '⚡ 加速带 +120',
  msgAirTime: '滞空 {s}s! +{pts}',
  msgSuperNitro: '🔥 超级氮气爆发!',
  msgOverdrive1: '⚡ DRS 超频提速 I',
  msgOverdrive2: '⚡⚡ 极速超频 II!',
  msgHyperEnter: '⚡ 超级直道 · ∞ 无限氮气 ({len})',
  msgFinalLap: '★ 最后一圈! ★',
  msgLapProgress: '第 {lap} / {total} 圈',
  msgFinishWin: '🏆 冠军冲线! 第 1 名!',
  msgFinishRank: '🏁 冲线完赛! 第 {rank} 名',
  msgDriftNitroOn: '🔥 漂移同喷：已开启',
  msgDriftNitroOff: '🔒 漂移同喷：已关闭',
  msgOverdriveOn: '🚀 长道超频：已开启',
  msgOverdriveOff: '🔒 长道超频：已关闭',
  msgHyperNitroOn: '⚡ 长道满氮：已开启',
  msgHyperNitroOff: '🔒 长道满氮：已关闭',
  msgSettingsReset: '已恢复默认设置',
  msgAutoQuality: '已匹配「{preset}」画质',
  countdownGo: '出发!',

  // Pause Modal
  pauseTitle: '比赛已暂停',
  pauseResume: '继续比赛',
  pauseSettings: '⚙ 画质 / 操控 / 语言设置',
  pauseDriftNitroOn: '🔥 漂移同步喷气：开（允许同喷）',
  pauseDriftNitroOff: '🔥 漂移同步喷气：关（漂移禁氮）',
  pauseOverdriveOn: '🚀 长道自动超频：开（自动超频）',
  pauseOverdriveOff: '🚀 长道自动超频：关（原版极速）',
  pauseHyperNitroOn: '⚡ 长道直道满氮：开（长直道满氮）',
  pauseHyperNitroOff: '⚡ 长道直道满氮：关（常规氮气）',
  pauseRestart: '重新开赛',
  pauseMenu: '返回主菜单',

  // Results Overlay
  resultsTag: '赛事数据报告',
  resultsWin: '冠军冲线！',
  resultsPodium: '第 {rank} 名 · 登上领奖台！',
  resultsFinished: '第 {rank} 名 · 完赛报告',
  resTotalTime: '总耗时',
  resBestLap: '最快单圈',
  resTopSpeed: '最高时速',
  resLongestDrift: '最长漂移',
  resAirTime: '累计滞空',
  resStyleScore: '特技评分',
  resStandingsTitle: '最终排名',
  resRacing: '完赛中...',
  resYou: ' (你)',
  resPlayerName: '车手',
  btnRaceAgain: '再来一局',
  btnBackMenu: '返回车库',

  // Difficulty Badges
  diffMEDIUM: '中等',
  diffHARD: '困难',
  diffEXTREME: '极限',
  diffGRAND: '史诗',
} as const;

export type I18nKey = keyof typeof ZH;

const EN: Record<I18nKey, string> = {
  // Document & Brand
  docTitle: 'NEON APEX · 3D Arcade Racing',
  brandTag: 'CYBER ARCADE GP · 2099',

  // Header Actions
  btnLang: '中文',
  btnLangTitle: 'Switch to Chinese / 切换为简体中文',
  btnSettings: 'SETTINGS',
  btnSettingsTitle: 'Graphics, Controls, Audio & Language Settings',
  btnFullscreen: 'FULLSCREEN',
  btnExitFullscreen: 'EXIT FS',
  btnFullscreenTitle: 'Toggle Fullscreen Mode',
  btnTouchOn: 'TOUCH: ON',
  btnTouchOff: 'TOUCH: OFF',
  btnTouchTitle: 'Toggle On-Screen Touch Controls',
  btnAudioOn: 'AUDIO ON',
  btnAudioOff: 'MUTED',
  btnAudioTitle: 'Toggle Audio (M)',
  btnControls: 'GUIDE',
  btnControlsTitle: 'Driving Tips & Controls',

  // Mobile Portrait Menu Tabs
  mobTabCars: '🏎 MACHINES',
  mobTabTracks: '🏁 CIRCUITS',

  // Car Panel
  panelCarsTitle: 'SELECT MACHINE',
  statSpeed: 'TOP SPEED',
  statAccel: 'ACCEL',
  statDrift: 'DRIFT',
  statNitro: 'NITRO',

  // Track Panel & Hub
  panelTracksTitle: 'SELECT CIRCUIT',
  btnCatalog: 'CATALOG',
  btnCatalogTitle: 'Open Full Circuit Catalog (Search, Filter, Sort & Favorites)',
  btnPrevTrack: 'Previous Circuit',
  btnNextTrack: 'Next Circuit',
  btnFavTrack: 'Favorite / Unfavorite Circuit',
  blueprintBoxTitle: 'Click to open Full Circuit Catalog',
  catAll: 'ALL',
  catClassic: 'CLASSIC',
  catDrift: 'DRIFT',
  catMega: 'MEGA',
  catFav: '★FAV',
  catAllFull: '🌐 ALL CIRCUITS',
  catClassicFull: '🏙️ CLASSIC',
  catDriftFull: '🔥 DRIFT TOUGE',
  catMegaFull: '🏔️ MEGA EPIC',
  catFavFull: '★ FAVORITES',
  bankShort: 'BANK {deg}°',
  elevShort: '{m}m ELEV',
  hyperShort: '{n} HYPER',
  hyperRowTag: '⚡HYPER',
  lapCount: '{n} LAP',
  singleLapLen: 'LAP {len}',
  boostPadsCount: '{n} BOOSTS',
  jumpRampsCount: '{n} JUMPS',
  maxBankLabel: 'MAX BANK {deg}°',
  listEmptyFav: 'No favorite tracks yet — tap ☆ to star one',
  listEmptyOther: 'No circuits in this category',
  btnViewAll: 'SHOW ALL',

  // Race Options & Launch
  optDriftNitro: '🔥 DRIFT NITRO',
  optDriftNitroTitle: 'Default OFF: blocks nitro while drifting. Turn ON to boost mid-drift.',
  optOverdrive: '🚀 OVERDRIVE',
  optOverdriveTitle: 'Mega circuits only: auto-triggers 2-stage straightaway overdrive at full throttle.',
  optHyperNitro: '⚡ HYPER NITRO',
  optHyperNitroTitle: 'Mega circuits only: unlocks infinite nitro on ultra-long straight corridors.',
  stateOn: 'ON',
  stateOff: 'OFF',
  lapsLabel: '🏁 LAPS',
  startRace: 'START RACE',
  launchSubStandard: '{laps} LAPS · 6 RACERS · DRIFT TO BOOST',
  launchSubMega: '{laps} LAPS · {km} KM TOTAL · {tag}',

  // Menu Footer Quick Keys
  keyDrive: '<kbd>W/A/S/D</kbd> or <kbd>Arrows</kbd> Drive',
  keyDrift: '<kbd>SPACE</kbd> or <kbd>Tap S</kbd> Drift',
  keyNitro: '<kbd>SHIFT</kbd> / <kbd>E</kbd> Nitro',
  keyCam: '<kbd>C</kbd> Camera',
  keyReset: '<kbd>R</kbd> Reset',
  creditNote: '3D Car: Ferrari 458 (vicent091036, CC BY 4.0) + GT3 Carbon Aero',

  // Catalog Modal
  catalogTitle: 'CIRCUIT CATALOG',
  catalogSearchPlaceholder: 'Search tracks, features (e.g. Akina / Drift / 60km)...',
  sortDefault: 'Sort: Featured',
  sortLenAsc: 'Length: Short → Long',
  sortLenDesc: 'Length: Long → Short',
  sortBankDesc: 'Banking: Steep → Flat',
  catalogSelected: 'SELECTED',
  catalogEmptyTitle: 'No Matching Circuits',
  catalogEmptyFavSub: 'Tap ☆ on any circuit card to add it to your favorites',
  catalogEmptySearchSub: 'Try another keyword or switch category filters',
  catalogResetBtn: 'RESET FILTERS',
  catalogJumpChip: '{n} JUMPS',
  catalogHyperChip: '{n} HYPER',

  // Controls Guide Modal
  controlsTitle: 'PILOT BRIEFING & CONTROLS',
  ctrlGasTitle: 'Throttle / Perfect Start',
  ctrlGasDesc: 'Hold throttle in the green RPM zone when countdown ends for a Perfect Start.',
  ctrlBrakeTitle: 'Tap-Brake Drift / Brake',
  ctrlBrakeDesc: 'Tap S while turning at speed to kick the tail out into an effortless drift!',
  ctrlSteerTitle: 'Apex Line & Counter-Steer',
  ctrlSteerDesc: 'Steer inward to tighten your arc, or counter-steer outward to hold wide angles.',
  ctrlDriftTitle: 'Handbrake Drift (Hold)',
  ctrlDriftDesc: 'Watch 150m/100m/50m corner boards, initiate early, and release for Mini Boost!',
  ctrlNitroTitle: 'Active Nitro Boost',
  ctrlNitroDesc: 'Locked mid-drift by default; toggle Drift Nitro in Menu or Pause for simultaneous boost.',
  ctrlAuxTitle: 'Quick Shortcuts',
  ctrlAuxDesc: 'C Camera View · R Track Reset · M Mute Audio · ESC Pause Race',
  proTipsHtml:
    '<strong>PRO TIPS:</strong> Watch top <span>Corner Alerts</span> and <span>150m/100m/50m</span> boards to time drifts · Draft behind rivals for <span>Slipstream Boost</span> · Hit ramps for <span>Air Time</span> bonus!<br /><strong>📱 MOBILE CONTROLS:</strong> Open <span>Settings → Controls</span> to pick <span>Floating Joystick</span>, <span>Left/Right Buttons</span>, or <span>Tilt Steering</span>, and tune scale, opacity & auto-gas.',

  // Unified Settings Modal
  settingsTitle: 'GAME SETTINGS',
  tabGraphics: '🎨 GRAPHICS',
  tabControls: '🎮 CONTROLS',
  tabAudio: '🔊 AUDIO',
  tabLanguage: '🌐 LANGUAGE',
  secQualityPreset: 'QUALITY PRESET',
  presetLow: 'LOW',
  presetMedium: 'MEDIUM',
  presetHigh: 'HIGH',
  presetUltra: 'ULTRA',
  presetCustom: 'CUSTOM',
  presetAutoBtn: 'AUTO DETECT',
  presetHintLow: 'Battery saver: 75% scale, direct WebGL path, zero post-FX for smooth FPS on older devices.',
  presetHintMedium: 'Recommended for most phones: 100% crispness, soft bloom & 70% particles, cool thermals.',
  presetHintHigh: 'Flagship phones & laptops: 125% sharp render, 2× MSAA & full visual effects.',
  presetHintUltra: 'Full Desktop fidelity: high DPR + 4× WebGL2 MSAA + HDR Bloom + SMAA.',
  presetHintCustom: 'Custom graphics profile active. All adjustments apply in real time.',
  optResScale: 'Render Resolution Scale',
  optFpsCap: 'Frame Rate Limit',
  fpsUnlimited: 'MAX',
  optAA: 'Anti-Aliasing',
  aaOff: 'OFF',
  aaSmaa: 'SMAA',
  aaMsaa2: '2× MSAA',
  aaMsaa4Smaa: '4× MSAA + SMAA',
  optBloom: 'Lens Bloom',
  levelOff: 'OFF',
  levelLow: 'LOW',
  levelMedium: 'MED',
  levelHigh: 'HIGH',
  bloomSoft: 'SOFT',
  bloomCinematic: 'CINEMATIC',
  optParticles: 'Particles & Speed Lines',
  optDrawDist: 'Draw Distance',
  distNear: 'NEAR',
  distMedium: 'MEDIUM',
  distFar: 'FAR',
  optBrightness: 'Scene Brightness',
  optBrightnessDesc: 'Live exposure calibration for OLED/LCD displays and ambient light',
  optShowFps: 'Live FPS / Frame Time',
  optShowFpsDesc: 'Show live FPS and ms/frame performance badge',

  optSteerMode: 'Mobile Steering Mode',
  steerJoystick: 'JOYSTICK',
  steerButtons: 'BUTTONS',
  steerTilt: 'TILT GYRO',
  optAutoThrottle: 'Mobile Auto-Accelerate',
  optAutoThrottleDesc: 'Automatically holds full gas so you focus on steering, drifting & nitro',
  optSteerSens: 'Touch Steering Sensitivity',
  optBtnScale: 'Touch Button Size',
  optBtnOpacity: 'Touch Controls Opacity',
  optHaptics: 'Haptic Vibration',
  optHapticsDesc: 'Tactile feedback on drifts, nitro bursts, landings & collisions',
  optDefaultCam: 'Default Camera View',
  camChase: 'CHASE',
  camHood: 'HOOD',
  optTouchForce: 'Show On-Screen Controls',
  optTouchForceDesc: 'Force-enable virtual touch controls on tablets or desktop screens',

  optMasterVol: 'Master Volume',
  optSfxVol: 'Engine & SFX Volume',
  optMusicVol: 'Synthwave BGM Volume',
  optMuteAll: 'Mute All Audio',

  langSectionTitle: 'Display Language',
  langSectionDesc: 'Applies immediately across menus, circuit lore, live HUD telemetry & results.',
  langZhName: '简体中文',
  langZhSub: 'Simplified Chinese',
  langEnName: 'English',
  langEnSub: 'International English',
  btnResetSettings: 'RESET DEFAULTS',
  btnSettingsDone: 'DONE',

  // HUD
  hudPos: 'POS',
  hudLap: 'LAP',
  hudTime: 'TIME',
  hudBestLap: 'BEST LAP',
  hudStyle: 'STYLE',
  hudLive: '● LIVE',
  hudNitroSystem: 'NITRO SYSTEM',
  hudGear: 'GEAR',
  hudAutoGas: 'AUTO',
  hudManualGas: 'MANUAL',
  hudTiltOn: 'TILT: ON',
  hudTiltOff: 'TILT',
  hudCamChase: 'CHASE',
  hudCamHood: 'HOOD',
  hudStartRpmHint: 'HOLD <kbd>W</kbd> OR <kbd>REV</kbd> IN GREEN ZONE FOR PERFECT START',
  hudWrongWay: '⚠ WRONG WAY (PRESS R TO RESET)',
  hudSlipstream: '⚡ SLIPSTREAM BOOST',
  hudKeyDrift: '<kbd>SPACE</kbd> / <kbd>Tap S</kbd> Drift',
  hudKeyNitro: '<kbd>SHIFT</kbd> / <kbd>E</kbd> Nitro',
  hudKeyCam: '<kbd>C</kbd> View',
  hudKeyReset: '<kbd>R</kbd> Reset',
  hudNitroLocked: 'DRIFT LOCKED',
  hudNitroInfActive: '★ ∞ INFINITE NITRO!',
  hudNitroInfReady: '∞ INFINITE READY',
  hudNitroSuperActive: '★ SUPER NITRO!',
  hudNitroBoosting: 'BOOSTING!',
  hudNitroSuperReady: 'SUPER READY',
  hudNitroReady: 'READY',
  hudNitroCharge: 'DRIFT TO CHARGE',
  hudOverdriveInf: '⚡ ∞ HYPER STRAIGHT · {rem}',
  hudOverdrive2: '⚡⚡ HYPER OVERDRIVE II',
  hudOverdrive1: '⚡ DRS OVERDRIVE I',
  hudDriftTier0: 'DRIFTING',
  hudDriftTier1: 'MINI BOOST',
  hudDriftTier2: 'SUPER DRIFT!',
  hudDriftTier3: '★ ULTRA DRIFT ★',
  hudBankTag: ' · BANK {deg}°',
  hudCornerRight: 'RIGHT',
  hudCornerLeft: 'LEFT',
  hudCornerHairpin: 'HAIRPIN {dir}{bank}',
  hudCornerTurn: '90° {dir}{bank}',
  hudCornerDist: '{m}m · DRIFT',
  hudRotateHint: '📱 Rotate to landscape for wider race view',
  hudRotateDismiss: 'GOT IT',

  // Touch Controls
  touchDriftMain: 'DRIFT',
  touchDriftSub: 'HOLD',
  touchNitroMain: 'NITRO',
  touchNitroLocked: 'LOCKED',
  touchNitroInf: '∞ MAX!',
  touchNitroSuper: 'SUPER!',
  touchBrakeMain: 'BRAKE',
  touchBrakeSub: 'TAP',
  touchGasMain: 'GAS',
  touchRevMain: 'REV',
  touchGasSub: 'PEDAL',
  touchLeftLabel: 'LEFT',
  touchRightLabel: 'RIGHT',

  // Status & Race Callouts
  msgAutoGasOn: 'AUTO GAS: ON',
  msgAutoGasOff: 'MANUAL GAS PEDAL',
  msgSteerJoystick: 'STEERING: FLOATING JOYSTICK',
  msgSteerButtons: 'STEERING: LEFT / RIGHT BUTTONS',
  msgTiltOn: '🧭 TILT STEERING ON',
  msgTiltUnsupported: 'TILT NOT SUPPORTED',
  msgTiltDenied: 'TILT PERMISSION DENIED',
  msgTiltUnavailable: 'TILT UNAVAILABLE',
  msgIosFsTip: 'iOS: Tap Share → Add to Home Screen for borderless fullscreen',
  msgBrowserFsTip: 'Browser restricted fullscreen — Add to Home Screen for fullscreen',
  msgTrackReset: 'TRACK RESET',
  msgCamHood: 'HOOD CAMERA',
  msgCamChase: 'CHASE CAMERA',
  msgPerfectStart: '⚡ PERFECT START! +300',
  msgDriftBoost1: 'DRIFT BOOST!',
  msgDriftBoost2: 'SUPER DRIFT!',
  msgDriftBoost3: '★ ULTRA DRIFT ★',
  msgBoostPad: '⚡ BOOST PAD +120',
  msgAirTime: 'AIR TIME {s}s! +{pts}',
  msgSuperNitro: '🔥 SUPER NITRO OVERDRIVE!',
  msgOverdrive1: '⚡ DRS OVERDRIVE I',
  msgOverdrive2: '⚡⚡ HYPER OVERDRIVE II!',
  msgHyperEnter: '⚡ HYPER STRAIGHT · ∞ NITRO ({len})',
  msgFinalLap: '★ FINAL LAP! ★',
  msgLapProgress: 'LAP {lap} / {total}',
  msgFinishWin: '🏆 FINISH! 1ST PLACE!',
  msgFinishRank: '🏁 FINISH! #{rank}',
  msgDriftNitroOn: '🔥 DRIFT NITRO: ON',
  msgDriftNitroOff: '🔒 DRIFT NITRO: OFF',
  msgOverdriveOn: '🚀 STRAIGHT OVERDRIVE: ON',
  msgOverdriveOff: '🔒 STRAIGHT OVERDRIVE: OFF',
  msgHyperNitroOn: '⚡ HYPER STRAIGHT NITRO: ON',
  msgHyperNitroOff: '🔒 HYPER STRAIGHT NITRO: OFF',
  msgSettingsReset: 'Settings Reset to Defaults',
  msgAutoQuality: 'Auto Quality: {preset}',
  countdownGo: 'GO!',

  // Pause Modal
  pauseTitle: 'RACE PAUSED',
  pauseResume: 'RESUME RACE',
  pauseSettings: '⚙ SETTINGS (GRAPHICS / CONTROLS / LANG)',
  pauseDriftNitroOn: '🔥 DRIFT NITRO: ON (SIMULTANEOUS)',
  pauseDriftNitroOff: '🔥 DRIFT NITRO: OFF (LOCKED)',
  pauseOverdriveOn: '🚀 STRAIGHT OVERDRIVE: ON',
  pauseOverdriveOff: '🚀 STRAIGHT OVERDRIVE: OFF',
  pauseHyperNitroOn: '⚡ HYPER STRAIGHT NITRO: ON',
  pauseHyperNitroOff: '⚡ HYPER STRAIGHT NITRO: OFF',
  pauseRestart: 'RESTART RACE',
  pauseMenu: 'MAIN MENU',

  // Results Overlay
  resultsTag: 'TELEMETRY REPORT',
  resultsWin: '1ST PLACE VICTORY!',
  resultsPodium: '{rank} PLACE PODIUM!',
  resultsFinished: 'FINISHED {rank}',
  resTotalTime: 'TOTAL TIME',
  resBestLap: 'BEST LAP',
  resTopSpeed: 'TOP SPEED',
  resLongestDrift: 'LONGEST DRIFT',
  resAirTime: 'AIR TIME',
  resStyleScore: 'STYLE SCORE',
  resStandingsTitle: 'FINAL CLASSIFICATION',
  resRacing: 'RACING...',
  resYou: ' (YOU)',
  resPlayerName: 'PLAYER',
  btnRaceAgain: 'RACE AGAIN',
  btnBackMenu: 'GARAGE & TRACKS',

  // Difficulty Badges
  diffMEDIUM: 'MEDIUM',
  diffHARD: 'HARD',
  diffEXTREME: 'EXTREME',
  diffGRAND: 'GRAND',
};

const CAR_EN_DESC: Record<string, { subtitle: string; desc: string }> = {
  'apex-v12': {
    subtitle: 'GT3 CORSA · BALANCED',
    desc: 'All-round GT3 balance combining high-speed downforce, crisp turn-in and predictable drift control.',
  },
  'phantom-x': {
    subtitle: 'LE MANS SPEC · TOP SPEED',
    desc: 'Low-drag endurance speed monster with the highest top speed and ferocious twin-turbo nitro thrust.',
  },
  'drift-k': {
    subtitle: 'TOUGE DRIFT GT · DRIFT MASTER',
    desc: 'Lightweight mountain drift weapon with massive swan-neck wing, snap rotation and rapid nitro charge.',
  },
};

const CAR_ZH_SUB: Record<string, string> = {
  'apex-v12': 'GT3 赛道版 · 全能均衡',
  'phantom-x': '勒芒耐力版 · 极速猛兽',
  'drift-k': '山道漂移版 · 甩尾大师',
};

const TRACK_EN_DESC: Record<string, { title: string; sub: string; desc: string }> = {
  'neo-tokyo': {
    title: 'TOKYO BAYSHORE EXPWY',
    sub: 'METROPOLIS ELEVATED NIGHT',
    desc: '29m wide elevated metropolitan highway blending crisp 90° interchanges, 22° banked ramps and a 30° skyline bowl hairpin.',
  },
  'hyperion-bay': {
    title: 'HYPERION BAY BRIDGE',
    sub: 'GOLDEN HOUR CABLE-STAYED',
    desc: '32m ultra-wide golden-hour suspension bridge featuring a 34° Zandvoort ocean bowl U-turn and Suzuka-style flowing S-curves.',
  },
  'sub-zero': {
    title: 'SUB-ZERO EXPRESS TUNNEL',
    sub: 'SUBTERRANEAN KARUSSELL',
    desc: 'Vaulted concrete underground expressway with giant turbine vents, a steep 35° Karussell bowl and tight 90° bunker chicanes.',
  },
  'akina-touge': {
    title: 'AKINA MOUNTAIN PASS',
    sub: 'NOCTURNAL ALPINE TOUGE',
    desc: '27m moonlit pine-forest mountain pass with warm sodium lamps, 4 varied-bank downhill hairpins and dramatic cliff plunges.',
  },
  'monaco-harbor': {
    title: 'MONACO HARBOR GP',
    sub: 'TECHNICAL LOW-BANK STREET',
    desc: 'Precision 28m harbor street circuit with 5 technical 4°–11° flat hairpins and a waterfront tunnel for pure exit-speed mastery.',
  },
  'apex-island': {
    title: 'APEX GRAND ISLAND',
    sub: '11.9 KM COASTAL GRAND TOUR',
    desc: 'Epic 11.9 km island tour linking metropolis streets, twin-pylon suspension bridge, 34° ocean bowl, volcanic pass & arch tunnel.',
  },
  'isle-of-man': {
    title: 'ISLE OF MAN TT',
    sub: 'SNAEFELL MOUNTAIN · 60.7 KM',
    desc: '1:1 full-scale 60.7 km (37.73 mi) Snaefell Mountain Course with 16 historic landmarks, 160+ bends and Sulby / Mountain Mile hyper straights.',
  },
  'nujiang-72': {
    title: 'NUJIANG 72 BENDS',
    sub: 'G318 YELA PLATEAU TOUGE',
    desc: 'Tribute to Tibet’s legendary G318 cliff switchbacks: 154m drop, 6 stacked Z-hairpins, canyon steel bridge and 5 uphill switchbacks.',
  },
  'aurora-fjord': {
    title: 'AURORA FJORD LABYRINTH',
    sub: '20.8 KM ARCTIC 24-BEND MAZE',
    desc: '20.8 km starfish-shaped basalt fjord drift labyrinth with 11 peninsula spurs, 24+ relentless hairpins and shimmering northern lights.',
  },
  'super-akina': {
    title: 'SUPER AKINA TOUGE',
    sub: '26.1 KM EXTREME SERPENTINE',
    desc: 'The ultimate 26.1 km evolution of Akina Pass: 35° banked canyon walls, ±13% rollercoaster plunges, 33 serpentine S-bends & 3 super straights.',
  },
};

type LangListener = (lang: Language) => void;

class I18nManager {
  private currentLang: Language;
  private readonly listeners = new Set<LangListener>();

  constructor() {
    this.currentLang = this.detectInitialLang();
    this.syncDocumentMeta();
  }

  private detectInitialLang(): Language {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'zh' || saved === 'en') return saved;
    } catch {
      // Ignore storage access restrictions
    }
    const nav = (typeof navigator !== 'undefined' ? navigator.language || '' : '').toLowerCase();
    return nav.startsWith('zh') ? 'zh' : 'en';
  }

  public get lang(): Language {
    return this.currentLang;
  }

  public get isZh(): boolean {
    return this.currentLang === 'zh';
  }

  public setLang(lang: Language): void {
    if (lang === this.currentLang) {
      this.applyDomTranslations();
      return;
    }
    this.currentLang = lang;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage failures
    }
    this.syncDocumentMeta();
    this.applyDomTranslations();
    for (const cb of this.listeners) {
      cb(lang);
    }
  }

  public toggleLang(): Language {
    const next: Language = this.currentLang === 'zh' ? 'en' : 'zh';
    this.setLang(next);
    return next;
  }

  public subscribe(listener: LangListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private syncDocumentMeta(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = this.currentLang === 'zh' ? 'zh-CN' : 'en';
    document.title = this.t('docTitle');
  }

  public t(key: I18nKey, vars?: Record<string, string | number>): string {
    const dict = this.currentLang === 'zh' ? ZH : EN;
    let str = dict[key] ?? ZH[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  }

  public applyDomTranslations(root: ParentNode = document): void {
    if (typeof document === 'undefined') return;
    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n as I18nKey;
      if (key) el.textContent = this.t(key);
    });
    root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
      const key = el.dataset.i18nHtml as I18nKey;
      if (key) el.innerHTML = this.t(key);
    });
    root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder as I18nKey;
      if (key) el.placeholder = this.t(key);
    });
    root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
      const key = el.dataset.i18nTitle as I18nKey;
      if (key) el.title = this.t(key);
    });
    root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
      const key = el.dataset.i18nAria as I18nKey;
      if (key) el.setAttribute('aria-label', this.t(key));
    });
  }

  public formatLapPill(laps: number): string {
    if (this.currentLang === 'zh') return `${laps} 圈`;
    return laps === 1 ? '1 LAP' : `${laps} LAPS`;
  }

  public formatLapShort(laps: number): string {
    if (this.currentLang === 'zh') return `${laps} 圈`;
    return `${laps}L`;
  }

  public getCarArchetype(car: CarSpec): string {
    return this.currentLang === 'zh' ? car.archetypeZh : car.archetype;
  }

  public getCarSubtitle(car: CarSpec): string {
    if (this.currentLang === 'zh') return CAR_ZH_SUB[car.id] ?? car.subtitle;
    return CAR_EN_DESC[car.id]?.subtitle ?? `${car.subtitle} · ${car.archetype}`;
  }

  public getCarDesc(car: CarSpec): string {
    if (this.currentLang === 'zh') return car.description;
    return CAR_EN_DESC[car.id]?.desc ?? car.description;
  }

  public getTrackName(track: TrackConfig): string {
    if (this.currentLang === 'zh') return track.nameZh;
    return TRACK_EN_DESC[track.id]?.title ?? track.name;
  }

  public getTrackSub(track: TrackConfig): string {
    if (this.currentLang === 'zh') return track.name;
    return TRACK_EN_DESC[track.id]?.sub ?? track.name;
  }

  public getTrackDesc(track: TrackConfig): string {
    if (this.currentLang === 'zh') return track.description;
    return TRACK_EN_DESC[track.id]?.desc ?? track.description;
  }

  public getDifficultyLabel(diff: TrackConfig['difficulty']): string {
    return this.t(`diff${diff}` as I18nKey);
  }
}

export const i18n = new I18nManager();
export const t = (key: I18nKey, vars?: Record<string, string | number>): string => i18n.t(key, vars);
