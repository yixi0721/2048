package com.cream.game2048;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.window.OnBackInvokedDispatcher;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView web;
    private long lastExitBack = 0;

    private void handleBack() {
        web.evaluateJavascript("(function(){const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return 'handled';}const end=document.querySelector('#mineEnd:not([hidden]) #mineEndClose');if(end){end.click();return 'handled';}const keep=document.querySelector('#keepPlaying');if(keep){keep.click();return 'handled';}return 'none';})()", result -> {
            if ("\"handled\"".equals(result)) return;
            String path = web.getUrl();
            if (path != null && !path.endsWith("/index.html") && !path.endsWith("/")) {
                if (web.canGoBack()) web.goBack();
                else web.loadUrl("https://" + HOST + "/index.html");
                return;
            }
            long now = SystemClock.elapsedRealtime();
            if (now - lastExitBack < 2000) finish();
            else {
                lastExitBack = now;
                Toast.makeText(this, "再按一次返回退出游戏", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override public void onBackPressed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) handleBack();
        else super.onBackPressed();
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getDecorView().getWindowInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            );
        }
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xfff8f3e9);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) web.setDefaultFocusHighlightEnabled(false);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!"https".equals(request.getUrl().getScheme()) || !HOST.equals(request.getUrl().getHost()))
                    return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", Collections.emptyMap(), null);
                String path = request.getUrl().getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.contains("..") || path.contains("\\"))
                    return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", Collections.emptyMap(), null);
                String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : "application/octet-stream";
                try {
                    InputStream stream = getAssets().open("www" + path);
                    return new WebResourceResponse(mime, "UTF-8", 200, "OK", Collections.emptyMap(), stream);
                } catch (IOException error) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), null);
                }
            }
        });
        setContentView(web);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        hideSystemBars();
        web.loadUrl("https://" + HOST + "/index.html");
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }
}
