package com.autocircuit.atlas;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Android-native Bluetooth Classic SPP bridge for the bundled, offline Atlas UI. */
public final class MainActivity extends Activity {
    private static final int REQUEST_BT=101,REQUEST_ENABLE=102,REQUEST_EXPORT=103,REQUEST_IMPORT=104;
    private WebView page;
    private ObdBluetoothTransport transport;
    private String pendingExport="";
    private boolean ready=false;

    @Override public void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7,21,27));
        getWindow().setNavigationBarColor(Color.rgb(7,21,27));
        page=new WebView(this);
        page.setBackgroundColor(Color.rgb(9,18,25));
        page.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        WebSettings settings=page.getSettings();
        settings.setJavaScriptEnabled(true); // Only bundled, local assets are loaded.
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        page.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){
                Uri url=request.getUrl();
                // Never allow the privileged JS bridge to run in remote web content.
                return !"file".equals(url.getScheme()) || !"/android_asset/index.html".equals(url.getPath());
            }
            @Override public void onPageFinished(WebView view,String url){
                ready=url.startsWith("file:///android_asset/");
                if(ready && transport!=null) transport.status();
            }
        });
        page.addJavascriptInterface(new BluetoothBridge(),"AtlasObd");
        page.addJavascriptInterface(new FileBridge(),"AndroidBridge");
        setContentView(page);
        transport=new ObdBluetoothTransport(this,new ObdBluetoothTransport.Events(){
            @Override public void adapter(JSONObject value){sendToUi("onAtlasAdapterEvent",value);}
            @Override public void live(JSONObject value){sendToUi("onAtlasLiveEvent",value);}
        });
        page.loadUrl("file:///android_asset/index.html");
    }
    private void sendToUi(String name,JSONObject obj){
        runOnUiThread(()->{
            if(!ready || page==null)return;
            String quoted=JSONObject.quote(obj.toString());
            page.evaluateJavascript("if(window."+name+")window."+name+"(JSON.parse("+quoted+"));",null);
        });
    }
    private BluetoothAdapter adapter(){BluetoothManager manager=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);return manager==null?null:manager.getAdapter();}
    private boolean hasBtPermission(){return Build.VERSION.SDK_INT<31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;}

    private final class BluetoothBridge {
        @JavascriptInterface public void getBluetoothStatus(){transport.status();}
        @JavascriptInterface public void requestBluetoothPermission(){runOnUiThread(()->{
            if(Build.VERSION.SDK_INT>=31 && !hasBtPermission())requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},REQUEST_BT);
            else transport.status();
        });}
        @JavascriptInterface public void enableBluetooth(){runOnUiThread(()->{
            if(!hasBtPermission()){transport.status();return;}
            BluetoothAdapter a=adapter();if(a==null){transport.status();return;}
            if(!a.isEnabled())startActivityForResult(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE),REQUEST_ENABLE);
            else transport.status();
        });}
        @JavascriptInterface public void openAppPermissions(){runOnUiThread(()->{
            Intent i=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()));startActivity(i);
        });}
        @JavascriptInterface public void openBluetoothSettings(){runOnUiThread(()->startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));}
        @JavascriptInterface public void listPairedAdapters(){transport.paired();}
        @JavascriptInterface public void runReadOnlyScan(String address,String profile){transport.start(address,profile,false);}
        @JavascriptInterface public void startLiveMonitor(String address,String profile){transport.start(address,profile,true);}
        @JavascriptInterface public void stopReadOnlyScan(){transport.stop();}
        @JavascriptInterface public void stopLiveMonitor(){transport.stop();}
    }
    private final class FileBridge {
        @JavascriptInterface public void saveReport(String filename,String contents){
            if(contents==null || contents.length()>2_000_000)return;
            String safe=(filename==null?"atlas-report.json":filename).replaceAll("[^a-zA-Z0-9._-]","_");
            if(safe.length()>100)safe=safe.substring(0,100);
            final String fileName=safe;
            runOnUiThread(()->{
                pendingExport=contents;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.setType(fileName.endsWith(".csv")?"text/csv":"application/json");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_TITLE,fileName);
                startActivityForResult(intent,REQUEST_EXPORT);
            });
        }
        @JavascriptInterface public void importVehiclePack(){runOnUiThread(()->{
            Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.setType("application/json");i.addCategory(Intent.CATEGORY_OPENABLE);
            startActivityForResult(i,REQUEST_IMPORT);
        });}
    }
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if(requestCode==REQUEST_BT)transport.status();
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==REQUEST_ENABLE){transport.status();return;}
        if(resultCode!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();
        try{
            if(requestCode==REQUEST_EXPORT){
                try(OutputStream out=getContentResolver().openOutputStream(uri,"w")){
                    if(out==null)throw new IllegalStateException("Output stream unavailable");
                    out.write(pendingExport.getBytes(StandardCharsets.UTF_8));out.flush();
                }finally{pendingExport="";}
            }else if(requestCode==REQUEST_IMPORT){
                byte[] b;
                try(InputStream in=getContentResolver().openInputStream(uri)){
                    if(in==null)throw new IllegalStateException("Input stream unavailable");
                    java.io.ByteArrayOutputStream tmp=new java.io.ByteArrayOutputStream();
                    byte[] chunk=new byte[2048];int n;
                    while((n=in.read(chunk))!=-1){if(tmp.size()+n>65536)throw new IllegalArgumentException("Reference pack exceeds 64 KiB");tmp.write(chunk,0,n);}
                    b=tmp.toByteArray();
                }
                String json=new String(b,StandardCharsets.UTF_8);
                runOnUiThread(()->page.evaluateJavascript("if(window.onAtlasPackImport)window.onAtlasPackImport("+JSONObject.quote(json)+");",null));
            }
        }catch(Exception e){
            JSONObject err=new JSONObject();try{err.put("type","error");err.put("message","File operation failed: "+e.getMessage());}catch(Exception ignored){}
            sendToUi("onAtlasAdapterEvent",err);
        }
    }
    @Override protected void onResume(){super.onResume();if(transport!=null)transport.status();}
    @Override protected void onDestroy(){ready=false;if(transport!=null)transport.stop();if(page!=null){page.removeJavascriptInterface("AtlasObd");page.removeJavascriptInterface("AndroidBridge");page.destroy();page=null;}super.onDestroy();}
}
