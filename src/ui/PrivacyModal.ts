import { nativeBridge } from '../platform/NativeBridge';
import { i18n } from '../i18n/i18n';

const PRIVACY_CONSENT_KEY = 'neon_apex_privacy_consent_v1';
export const PRIVACY_POLICY_URL = 'https://neon-apex.gcrdev.top/privacy.html';

function hasPrivacyConsent(): boolean {
  try {
    return window.localStorage.getItem(PRIVACY_CONSENT_KEY) === 'accepted';
  } catch {
    return true;
  }
}

function savePrivacyConsent(): void {
  try {
    window.localStorage.setItem(PRIVACY_CONSENT_KEY, 'accepted');
  } catch {
    // Ignore restricted storage environments
  }
}

function buildFullPolicyHtml(): string {
  return `
    <div class="privacy-full-text">
      <p><strong>运营主体：</strong>逐梦星空工作室 ｜ <strong>更新与生效日期：</strong>2026年11月28日</p>
      <p><strong>一、信息收集与使用：</strong>《NEON APEX》为纯单机离线 3D 街机竞速游戏，无需账号登录、无商业广告、无应用内付费。本游戏不收集、不向外部服务器上传您的姓名、手机号、位置、通讯录、相册或 IMEI / OAID / MAC 等设备标识符，仅在您的设备本地保存画质、操控偏好、收藏赛道与单圈最快成绩。</p>
      <p><strong>二、系统权限说明：</strong>仅使用基础震动触觉反馈（可在设置中关闭）、横屏显示及您主动开启重力感应转向时的本地传感器倾角计算，不申请相机、麦克风、定位、通讯录或相册等敏感权限。</p>
      <p><strong>三、第三方 SDK：</strong>本游戏本体未接入任何第三方广告、统计、社交或支付 SDK，不向第三方共享个人信息。通过 TapTap / TapPlay 启动时的平台防沉迷服务由 TapTap 平台独立提供并受其隐私政策约束。</p>
      <p><strong>四、数据删除与未成年人保护：</strong>您可在游戏「设置」中恢复默认设置，或清除应用数据 / 卸载应用以彻底删除全部本地记录。本游戏适龄提示为 8+，不收集未成年人个人信息。</p>
      <p><strong>五、联系我们：</strong>如有任何隐私相关疑问，请联系 <strong>rgc20000318@163.com</strong>（15 个工作日内回复）。</p>
      <p>独立网页版：<a href="${PRIVACY_POLICY_URL}" target="_blank" rel="noopener noreferrer">${PRIVACY_POLICY_URL}</a></p>
    </div>
  `;
}

function mountPrivacyModal(mode: 'consent' | 'viewer', onAccepted?: () => void): void {
  const existing = document.getElementById('privacy-consent-modal');
  if (existing) existing.remove();

  const isEn = i18n.lang === 'en';
  const overlay = document.createElement('div');
  overlay.id = 'privacy-consent-modal';
  overlay.className = 'privacy-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  if (mode === 'consent') {
    overlay.innerHTML = `
      <div class="privacy-modal-card">
        <div class="privacy-modal-header">
          <span class="privacy-badge">NEON APEX · 逐梦星空工作室</span>
          <h2>${isEn ? 'Privacy Policy Notice' : '用户隐私保护提示'}</h2>
        </div>
        <div class="privacy-modal-body">
          <p class="privacy-lead">
            ${
              isEn
                ? 'Welcome to NEON APEX! This is a pure offline single-player racing game with no ads, no accounts, and no in-app purchases. We do not collect or upload personal data — settings and lap records are stored strictly on your local device.'
                : '欢迎体验《NEON APEX》！本游戏为<strong>纯单机离线</strong>竞速游戏，无广告、无内购、无需登录，<strong>不收集或上传任何个人身份信息及设备敏感标识符</strong>，仅在本地设备保存画质设置与最佳单圈成绩。'
            }
          </p>
          <p class="privacy-sub">
            ${
              isEn
                ? 'Please read our full Privacy Policy before entering the game:'
                : '进入游戏前，请阅读并同意我们的'
            }
            <button type="button" id="btn-privacy-toggle-full" class="privacy-link-btn">
              ${isEn ? 'View Full Privacy Policy' : '《NEON APEX 隐私政策》完整正文'}
            </button>
            <a class="privacy-ext-link" href="${PRIVACY_POLICY_URL}" target="_blank" rel="noopener noreferrer">
              ${isEn ? '(Web Version)' : '（独立网页版）'}
            </a>
          </p>
          <div id="privacy-full-panel" class="privacy-full-panel hidden">
            ${buildFullPolicyHtml()}
          </div>
          <div id="privacy-decline-tip" class="privacy-decline-tip hidden">
            ${
              isEn
                ? 'You must agree to the Privacy Policy to play. You may close this page or tap Agree below.'
                : '需同意《隐私政策》后方可进入游戏；您可以关闭页面，或点击下方「同意并进入」。'
            }
          </div>
        </div>
        <div class="privacy-modal-actions">
          <button type="button" id="btn-privacy-decline" class="privacy-btn ghost">
            ${isEn ? 'Decline & Exit' : '不同意并退出'}
          </button>
          <button type="button" id="btn-privacy-accept" class="privacy-btn primary">
            ${isEn ? 'Agree & Enter' : '同意并进入游戏'}
          </button>
        </div>
      </div>
    `;
  } else {
    overlay.innerHTML = `
      <div class="privacy-modal-card">
        <div class="privacy-modal-header">
          <span class="privacy-badge">NEON APEX · 逐梦星空工作室</span>
          <h2>${isEn ? 'NEON APEX Privacy Policy' : '《NEON APEX》隐私政策'}</h2>
        </div>
        <div class="privacy-modal-body">
          <div class="privacy-full-panel">
            ${buildFullPolicyHtml()}
          </div>
        </div>
        <div class="privacy-modal-actions">
          <button type="button" id="btn-privacy-close" class="privacy-btn primary">
            ${isEn ? 'Close' : '我知道了'}
          </button>
        </div>
      </div>
    `;
  }

  document.body.appendChild(overlay);

  const toggleBtn = overlay.querySelector<HTMLButtonElement>('#btn-privacy-toggle-full');
  const fullPanel = overlay.querySelector<HTMLElement>('#privacy-full-panel');
  toggleBtn?.addEventListener('click', () => {
    fullPanel?.classList.toggle('hidden');
  });

  overlay.querySelector('#btn-privacy-accept')?.addEventListener('click', () => {
    savePrivacyConsent();
    overlay.remove();
    onAccepted?.();
  });

  overlay.querySelector('#btn-privacy-decline')?.addEventListener('click', () => {
    if (nativeBridge.isNative) {
      nativeBridge.exitApp();
    } else {
      overlay.querySelector('#privacy-decline-tip')?.classList.remove('hidden');
    }
  });

  overlay.querySelector('#btn-privacy-close')?.addEventListener('click', () => {
    overlay.remove();
  });
}

/**
 * Ensures first-launch privacy policy consent BEFORE initializing game engine, audio, or local storage writes.
 * On returning launches, immediately invokes onAccepted() with zero visual interruption.
 */
export function ensurePrivacyConsent(onAccepted: () => void): void {
  if (hasPrivacyConsent()) {
    onAccepted();
    return;
  }
  mountPrivacyModal('consent', onAccepted);
}

/** Opens the standalone in-game Privacy Policy viewer from the Settings screen. */
export function openPrivacyPolicyViewer(): void {
  mountPrivacyModal('viewer');
}
