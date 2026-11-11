package com.tasteforge.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.Toast;
import android.webkit.ValueCallback;
import java.io.OutputStream;

public final class MainActivity extends Activity {
    private WebView web;
    private byte[] pendingMidi;
    private String pendingName;
    private ValueCallback<Uri[]> picker;
    private static final int SAVE_MIDI = 52;
    private static final int PICK_MIDI = 53;

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        getWindow().setStatusBarColor(Color.rgb(14, 18, 24));
        getWindow().setNavigationBarColor(Color.rgb(14, 18, 24));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(14, 18, 24));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setDefaultTextEncodingName("UTF-8");
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new AndroidBridge(), "TasteForgeAndroid");
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (picker != null) picker.onReceiveValue(null);
                picker = cb;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"audio/midi", "audio/x-midi", "application/octet-stream"});
                try { startActivityForResult(intent, PICK_MIDI); }
                catch (Exception e) { picker.onReceiveValue(null); picker = null; return false; }
                return true;
            }
            @Override public boolean onJsPrompt(WebView v, String url, String message, String defaultValue, JsPromptResult result) {
                EditText text = new EditText(MainActivity.this);
                text.setSingleLine();
                text.setText(defaultValue);
                new AlertDialog.Builder(MainActivity.this).setTitle(message).setView(text)
                    .setPositiveButton("Save", (d, w) -> result.confirm(text.getText().toString()))
                    .setNegativeButton("Cancel", (d, w) -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsAlert(WebView v, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("OK", (d,w) -> result.confirm()).show();
                return true;
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    private class AndroidBridge {
        @JavascriptInterface public void saveMidi(String base64, String filename) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (data.length < 30 || data.length > 2_000_000) throw new IllegalArgumentException("Invalid MIDI size");
                if (data[0] != 'M' || data[1] != 'T' || data[2] != 'h' || data[3] != 'd') throw new IllegalArgumentException("Not a MIDI file");
                final String clean = filename.replaceAll("[^A-Za-z0-9_.-]", "_");
                runOnUiThread(() -> {
                    pendingMidi = data;
                    pendingName = clean.endsWith(".mid") ? clean : clean + ".mid";
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    save.addCategory(Intent.CATEGORY_OPENABLE);
                    save.setType("audio/midi");
                    save.putExtra(Intent.EXTRA_TITLE, pendingName);
                    try { startActivityForResult(save, SAVE_MIDI); }
                    catch (Exception e) { Toast.makeText(MainActivity.this, "File chooser unavailable", Toast.LENGTH_LONG).show(); }
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "MIDI export failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_MIDI) {
            if (picker != null) {
                Uri selected = resultCode == RESULT_OK && data != null ? data.getData() : null;
                picker.onReceiveValue(selected == null ? null : new Uri[]{selected});
                picker = null;
            }
            return;
        }
        if (requestCode == SAVE_MIDI) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingMidi != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new IllegalStateException("Storage unavailable");
                    out.write(pendingMidi);
                    Toast.makeText(this, "Saved " + pendingName + " — import it into FL Studio Mobile", Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Toast.makeText(this, "Could not save MIDI: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            pendingMidi = null;
        }
    }
    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if (picker != null) { picker.onReceiveValue(null); picker = null; }
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
