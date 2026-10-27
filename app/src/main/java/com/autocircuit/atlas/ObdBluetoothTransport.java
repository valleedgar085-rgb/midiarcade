package com.autocircuit.atlas;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.SystemClock;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Fixed allowlist ELM327 Bluetooth Classic RFCOMM; never sends ECU write/clear/actuator commands. */
public final class ObdBluetoothTransport {
    public interface Events { void adapter(JSONObject value); void live(JSONObject value); }
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final List<String> LIVE_PIDS=Arrays.asList("010C","010B","0106","0107","010E","0105","0111","0142");
    private final Context context;
    private final Events events;
    private volatile BluetoothSocket socket;
    private volatile Thread thread;
    private volatile boolean cancel=false;

    public ObdBluetoothTransport(Context context, Events events) { this.context=context;this.events=events; }

    private BluetoothAdapter adapter() {
        BluetoothManager m=(BluetoothManager)context.getSystemService(Context.BLUETOOTH_SERVICE);
        return m==null?null:m.getAdapter();
    }
    private boolean allowed() {
        return Build.VERSION.SDK_INT<31 || context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;
    }
    private JSONObject event(String type) {JSONObject o=new JSONObject();try{o.put("type",type);}catch(JSONException ignored){}return o;}
    private void put(JSONObject o,String k,Object v){try{o.put(k,v);}catch(JSONException ignored){}}
    private void state(String s){JSONObject e=event("state");put(e,"state",s);events.adapter(e);}
    private void liveState(String s,String msg){JSONObject e=event("live-state");put(e,"state",s);put(e,"message",msg);events.live(e);}
    private void fail(String message){JSONObject e=event("error");put(e,"message",message);events.adapter(e);}

    public void status(){
        BluetoothAdapter a=adapter();JSONObject e=event("permissions");
        put(e,"hasBluetooth",a!=null);put(e,"canConnect",allowed());
        put(e,"runtimePermissionRequired",Build.VERSION.SDK_INT>=31);
        put(e,"enabled",a!=null && allowed() && a.isEnabled()); events.adapter(e);
    }
    public void paired(){
        JSONObject e=event("paired");JSONArray devices=new JSONArray();
        if (!allowed()){ fail("Nearby devices permission is required.");return; }
        BluetoothAdapter a=adapter();
        if (a==null || !a.isEnabled()){fail("Turn on Bluetooth first.");return;}
        try{
            Set<BluetoothDevice> bonded=a.getBondedDevices();
            for(BluetoothDevice d:bonded){
                JSONObject item=new JSONObject();
                put(item,"name",d.getName()==null?"Paired device":d.getName());
                put(item,"address",d.getAddress());devices.put(item);
            }
        }catch(SecurityException se){fail("Nearby devices permission denied.");return;}
        put(e,"devices",devices);events.adapter(e);
    }

    public synchronized void start(String address,String profile,boolean monitor){
        if (!allowed()){fail("Grant Nearby devices permission first.");return;}
        if (thread!=null && thread.isAlive()){fail("A scan is already running. Stop it first.");return;}
        if (!address.matches("(?i)^([0-9a-f]{2}:){5}[0-9a-f]{2}$")) {fail("Invalid Bluetooth device address.");return;}
        if (!"generic-obd2".equals(profile) && !"gm-j1850-vpw".equals(profile)) {fail("Unsupported protocol selection.");return;}
        cancel=false;
        thread=new Thread(()->work(address,profile,monitor),"Atlas-ELM327");
        thread.start();
    }
    public synchronized void stop(){
        cancel=true;
        BluetoothSocket s=socket;
        if (s!=null){try{s.close();}catch(IOException ignored){}}
        Thread t=thread;if(t!=null)t.interrupt();
    }
    private void work(String address,String profile,boolean monitor) {
        try {
            state("connecting"); if(monitor)liveState("connecting","Opening paired Bluetooth Classic adapter…");
            BluetoothAdapter a=adapter();
            if(a==null||!a.isEnabled())throw new IOException("Bluetooth is off.");
            if(!allowed())throw new IOException("Bluetooth permission not granted.");
            BluetoothDevice d=a.getRemoteDevice(address);
            if(d.getBondState()!=BluetoothDevice.BOND_BONDED)throw new IOException("Adapter is not paired in Android settings.");
            JSONObject ae=event("adapter");put(ae,"name",d.getName()==null?"Paired adapter":d.getName());events.adapter(ae);
            JSONObject pe=event("profile");put(pe,"profileId",profile);events.adapter(pe);
            BluetoothSocket s=d.createRfcommSocketToServiceRecord(SPP);
            socket=s;
            s.connect();
            if(cancel)return;
            InputStream in=s.getInputStream();OutputStream out=s.getOutputStream();
            state("initializing");if(monitor)liveState("initializing","Initializing ELM interface and checking supported PIDs…");
            String atIdentity=send("ATI",in,out,5000);
            if(atIdentity.trim().isEmpty())throw new IOException("Adapter did not answer identification command.");
            for(String cmd:new String[]{"ATE0","ATL0","ATS0","ATH0","AT"+("gm-j1850-vpw".equals(profile)?"SP2":"SP0")})send(cmd,in,out,4200);
            if(monitor) {
                monitorLoop(in,out);
            } else {
                state("reading");
                for(String command:new String[]{"ATI","ATDP","ATRV","0100","010C","010D","0902"}){
                    if(cancel)break;
                    String raw=send(command,in,out,"0100".equals(command)?12000:5500);
                    JSONObject e=event("observation");put(e,"command",command);put(e,"raw",raw);events.adapter(e);
                }
                if(!cancel)state("complete");
            }
        }catch(SecurityException e){fail("Bluetooth access denied.");if(monitor)liveState("error","Bluetooth permission denied.");else state("error");}
        catch(Exception e){if(!cancel){String message=e.getMessage()==null?"Unknown Bluetooth error":e.getMessage();fail(message);if(monitor)liveState("error",message);else state("error");}}
        finally{
            BluetoothSocket s=socket;socket=null;
            if(s!=null){try{s.close();}catch(IOException ignored){}}
            state("disconnected");
            if(monitor)liveState("stopped",cancel?"Disconnected by user.":"Session ended.");
        }
    }
    private String send(String cmd, InputStream in, OutputStream out, long timeoutMs) throws IOException {
        if(cancel)throw new IOException("Stopped");
        // Fixed command call sites only, never arbitrary input from the web page.
        out.write((cmd+"\r").getBytes(StandardCharsets.US_ASCII));out.flush();
        ByteArrayOutputStream data=new ByteArrayOutputStream();
        long deadline=SystemClock.elapsedRealtime()+timeoutMs;
        while(!cancel && SystemClock.elapsedRealtime()<deadline){
            int available=in.available();
            if(available>0){
                byte[] buf=new byte[Math.min(available,256)];
                int n=in.read(buf);
                if(n<0)throw new IOException("Adapter connection closed");
                for(int i=0;i<n;i++){
                    if(buf[i]=='>')return new String(data.toByteArray(),StandardCharsets.US_ASCII);
                    if(data.size()<4096)data.write(buf[i]);
                    else throw new IOException("Oversized ELM reply");
                }
            }else SystemClock.sleep(20);
        }
        if(cancel)throw new IOException("Stopped");
        throw new IOException("ELM reply timed out for "+cmd+". Check vehicle ignition and adapter protocol.");
    }
    private void monitorLoop(InputStream in,OutputStream out)throws IOException{
        String bitmap=send("0100",in,out,12000);
        if(ObdPidDecoder.bytesForPid("0100",bitmap,4)==null)throw new IOException("No valid Mode 01 supported-PID reply. Check ignition, ECU protocol, and ELM adapter.");
        boolean canNextBitmap=ObdPidDecoder.supportsPid("0100",bitmap,0x20);
        String bitmap20=canNextBitmap?send("0120",in,out,6000):"";
        boolean canForty=ObdPidDecoder.supportsPid("0120",bitmap20,0x40);
        String bitmap40=canForty?send("0140",in,out,6000):"";
        List<String> toPoll=new ArrayList<>();
        for(String pid:LIVE_PIDS){
            int pidId=Integer.parseInt(pid.substring(2),16);
            boolean supported= pidId<=0x20 ? ObdPidDecoder.supportsPid("0100",bitmap,pidId)
                :ObdPidDecoder.supportsPid("0140",bitmap40,pidId);
            if(supported)toPoll.add(pid);
        }
        if(toPoll.isEmpty())throw new IOException("ECU does not report any supported live PIDs from this dashboard.");
        JSONObject meta=event("live-capabilities");JSONArray arr=new JSONArray();for(String p:toPoll)arr.put(p);put(meta,"pids",arr);events.live(meta);
        state("reading");liveState("reading","ECU responding. PIDs are polled sequentially; values are not simultaneous.");
        int cycle=0;int consecutiveTimeouts=0;
        while(!cancel && cycle<10000) {
            for(String pid:toPoll){
                if(cancel)break;
                try {
                    String raw=send(pid,in,out,4500);
                    ObdPidDecoder.Reading reading=ObdPidDecoder.decode(pid,raw);
                    if(reading!=null){publish(reading,raw);consecutiveTimeouts=0;}
                }catch(IOException e) {
                    if(cancel)break;
                    if(++consecutiveTimeouts>=4)throw new IOException("Multiple consecutive PID timeouts; verify adapter and ignition.");
                }
            }
            if(cancel)break;
            if(cycle%3==0){ // Adapter supply voltage, not ECU PID 0142.
                try{String raw=send("ATRV",in,out,4000);ObdPidDecoder.Reading v=ObdPidDecoder.decodeAdapterVoltage(raw);if(v!=null)publish(v,raw);}catch(IOException e){if(cancel)break;}
            }
            cycle++;
        }
    }
    private void publish(ObdPidDecoder.Reading r,String raw){
        JSONObject e=event("sample");put(e,"pid",r.pid);put(e,"label",r.label);put(e,"value",r.value);
        put(e,"units",r.units);put(e,"raw",raw.length()>200?raw.substring(0,200):raw);
        put(e,"at",System.currentTimeMillis());events.live(e);
    }
}
