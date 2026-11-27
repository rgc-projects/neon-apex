package top.gcrdev.neonapex;

import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.view.ActionMode;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Arrays;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Set FLAG_SECURE before setContentView so Xiaomi HyperOS ContentCatcher (传送门/图片识别)
        // and other OEM screen-sniffing assistants skip this window and NEVER steal long-press touches!
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        super.onCreate(savedInstanceState);

        // Keep phone screen awake during tilt/auto-gas races
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // True edge-to-edge rendering into notch / punch-hole display cutout area
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        applyImmersiveFullscreen();
        setupAntiAssistAndGestureGuards();

        // Allow seamless Web Audio synthwave & engine audio + block OS long-press / screen-assist popups
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            webView.setBackgroundColor(0xFF040714);
            // Guarantee GPU-accelerated compositing layer for 90-120Hz WebGL racing
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

            // Disable WebView long-clickable state WITHOUT attaching an OnLongClickListener
            // (Android's setOnLongClickListener silently resets longClickable=true, causing
            // WebView to trigger 400ms long-press gesture cancellation / dropped touches!)
            webView.setLongClickable(false);
            webView.setHapticFeedbackEnabled(false);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                webView.setImportantForContentCapture(
                    View.IMPORTANT_FOR_CONTENT_CAPTURE_NO_EXCLUDE_DESCENDANTS
                );
            }
        }
    }

    @Override
    public void onActionModeStarted(ActionMode mode) {
        super.onActionModeStarted(mode);
        // Immediately dismiss any OS floating Copy / Translate / Search action bar over gameplay
        if (mode != null) {
            mode.finish();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        applyImmersiveFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveFullscreen();
        }
    }

    private void setupAntiAssistAndGestureGuards() {
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            decor.setImportantForContentCapture(
                View.IMPORTANT_FOR_CONTENT_CAPTURE_NO_EXCLUDE_DESCENDANTS
            );
        }
        // Exclude bottom-left and bottom-right thumb zones (<=200dp per edge) from OS back-swipe gestures
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            decor.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> {
                int w = r - l;
                int h = b - t;
                if (w <= 0 || h <= 0) return;
                float density = getResources().getDisplayMetrics().density;
                int edgeW = Math.round(72f * density);
                int maxZoneH = Math.min(h, Math.round(196f * density));
                int topY = Math.max(0, h - maxZoneH);
                Rect leftThumb = new Rect(0, topY, edgeW, h);
                Rect rightThumb = new Rect(Math.max(0, w - edgeW), topY, w, h);
                v.setSystemGestureExclusionRects(Arrays.asList(leftThumb, rightThumb));
            });
        }
    }

    private void applyImmersiveFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }
    }
}
