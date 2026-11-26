import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Platform-safe Native Bridge for Capacitor 7 (Android / iOS) + Zero-impact Web fallback.
 * Guarantees 100% Web & Cloudflare Workers compatibility while unlocking native Android
 * edge-to-edge immersive fullscreen, landscape lock, hardware Back button handling, and Haptics.
 */
class NativeBridgeImpl {
  private backHandlers: (() => boolean)[] = [];
  private pauseHandlers: (() => void)[] = [];
  private initialized = false;

  public get isNative(): boolean {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }

  public get platform(): 'android' | 'ios' | 'web' {
    try {
      const p = Capacitor.getPlatform();
      if (p === 'android' || p === 'ios') return p;
      return 'web';
    } catch {
      return 'web';
    }
  }

  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.isNative) return;

    document.body.classList.add('native-app', `native-${this.platform}`);

    // Edge-to-edge immersive fullscreen (hides system status bar cleanly)
    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    void StatusBar.hide().catch(() => {});

    // Lock sensor landscape inside native racing app
    void ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});

    // Intercept Android hardware Back button cleanly (close modal -> pause/resume -> exit)
    void App.addListener('backButton', () => {
      for (let i = this.backHandlers.length - 1; i >= 0; i--) {
        if (this.backHandlers[i]()) return;
      }
      void App.minimizeApp().catch(() => {});
    }).catch(() => {});

    // Auto-pause active race if app switches to background (incoming call / home gesture)
    void App.addListener('appStateChange', (state) => {
      if (!state.isActive) {
        for (const cb of this.pauseHandlers) cb();
      } else {
        // Re-assert immersive status bar hide on resume
        void StatusBar.hide().catch(() => {});
      }
    }).catch(() => {});
  }

  public onBackButton(handler: () => boolean): () => void {
    this.backHandlers.push(handler);
    return () => {
      const idx = this.backHandlers.indexOf(handler);
      if (idx >= 0) this.backHandlers.splice(idx, 1);
    };
  }

  public onAppBackground(handler: () => void): () => void {
    this.pauseHandlers.push(handler);
    return () => {
      const idx = this.pauseHandlers.indexOf(handler);
      if (idx >= 0) this.pauseHandlers.splice(idx, 1);
    };
  }

  public haptic(pattern: number | number[]): void {
    if (this.isNative) {
      const dur = Array.isArray(pattern) ? (pattern[0] ?? 16) : pattern;
      const style =
        dur >= 28 ? ImpactStyle.Heavy : dur >= 16 ? ImpactStyle.Medium : ImpactStyle.Light;
      void Haptics.impact({ style }).catch(() => {
        void Haptics.vibrate({ duration: dur }).catch(() => {});
      });
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore unsupported browsers (e.g. iOS Safari)
    }
  }
}

export const nativeBridge = new NativeBridgeImpl();
