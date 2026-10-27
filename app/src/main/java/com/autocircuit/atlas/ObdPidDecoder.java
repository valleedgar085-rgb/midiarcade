package com.autocircuit.atlas;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure Java, testable OBD-II Mode 01 PID decoder. No vehicle timing conclusion is produced here. */
public final class ObdPidDecoder {
    private ObdPidDecoder() {}

    public static final class Reading {
        public final String pid;
        public final double value;
        public final String units;
        public final String label;
        public Reading(String pid, double value, String units, String label) {
            this.pid=pid; this.value=value; this.units=units; this.label=label;
        }
    }

    /** Handles ELM responses with spaces, compact hex, and optional headers or length bytes. */
    public static int[] bytesForPid(String pid, String response, int minimumBytes) {
        if (pid == null || !pid.matches("01[0-9A-Fa-f]{2}") || response == null) return null;
        String replyPrefix = "41" + pid.substring(2).toUpperCase(Locale.US);
        for (String line : response.replace('\r','\n').split("\\n")) {
            String compact = line.toUpperCase(Locale.US).replaceAll("\\s+", "");
            if (compact.contains("NODATA") || compact.contains("ERROR") || compact.contains("STOPPED")) continue;
            // Some adapters include an ECU header and a payload-length byte. Mode/PID is the anchor.
            int at = compact.indexOf(replyPrefix);
            if (at < 0) continue;
            String tail = compact.substring(at + replyPrefix.length());
            if (tail.length() < minimumBytes * 2) continue;
            List<Integer> b = new ArrayList<>();
            for (int i=0;i+1<tail.length();i+=2) {
                String pair=tail.substring(i,i+2);
                if (!pair.matches("[0-9A-F]{2}")) break;
                b.add(Integer.parseInt(pair,16));
            }
            if (b.size() >= minimumBytes) {
                int[] decoded=new int[b.size()];
                for(int i=0;i<b.size();i++) decoded[i]=b.get(i);
                return decoded;
            }
        }
        return null;
    }

    /** SAE J1979 PID support bits, 0100 = 01..20; 0120 = 21..40; 0140 = 41..60. */
    public static boolean supportsPid(String bitmapCommand, String response, int pid) {
        int base = "0140".equals(bitmapCommand) ? 0x40 : "0120".equals(bitmapCommand) ? 0x20 : 0;
        if (!"0100".equals(bitmapCommand) && !"0120".equals(bitmapCommand) && !"0140".equals(bitmapCommand)) return false;
        if (pid <= base || pid > base + 32) return false;
        int[] bytes=bytesForPid(bitmapCommand,response,4);
        if (bytes==null) return false;
        int offset=pid-base-1;
        return (bytes[offset/8] & (0x80 >>> (offset % 8))) != 0;
    }

    public static Reading decode(String pid, String response) {
        if (pid==null) return null;
        String p=pid.toUpperCase(Locale.US);
        int need=("010C".equals(p) || "0142".equals(p))?2:1;
        int[] b=bytesForPid(p,response,need);
        if(b==null)return null;
        double value;
        String unit,label;
        switch(p) {
            case "010C": value=(b[0]*256+b[1])/4.0; unit="rpm"; label="Engine RPM"; break;
            case "010B": value=b[0];unit="kPa";label="MAP absolute pressure";break;
            case "0106": value=(b[0]-128)*100.0/128.0;unit="%";label="Short-term fuel trim B1";break;
            case "0107": value=(b[0]-128)*100.0/128.0;unit="%";label="Long-term fuel trim B1";break;
            case "010E": value=b[0]/2.0-64;unit="° BTDC";label="ECU ignition advance";break;
            case "0105": value=b[0]-40;unit="°C";label="Coolant temperature";break;
            case "0111": value=b[0]*100.0/255.0;unit="%";label="Throttle position";break;
            case "0142": value=(b[0]*256+b[1])/1000.0;unit="V";label="ECU control module voltage";break;
            default:return null;
        }
        return new Reading(p,value,unit,label);
    }

    /** ATRV is adapter-measured input voltage, not the ECU's own PID 0142. */
    public static Reading decodeAdapterVoltage(String response) {
        if(response==null)return null;
        Matcher m=Pattern.compile("(?i)(\\d{1,2}(?:\\.\\d{1,2})?)\\s*V\\b").matcher(response);
        if(!m.find())return null;
        double voltage=Double.parseDouble(m.group(1));
        if(voltage<0 || voltage>25) return null;
        return new Reading("ATRV",voltage,"V","Adapter-reported voltage");
    }
}
