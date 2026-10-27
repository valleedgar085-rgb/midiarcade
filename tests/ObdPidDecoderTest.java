import com.autocircuit.atlas.ObdPidDecoder;
public final class ObdPidDecoderTest {
    private static int assertions=0;
    static void ok(boolean cond, String name) {assertions++;if(!cond) throw new AssertionError(name);}
    static void near(double actual,double expected,double tolerance,String name) {ok(Math.abs(actual-expected)<=tolerance,name+": "+actual);}
    public static void main(String[] args) {
        near(ObdPidDecoder.decode("010C","41 0C 0B B8\r>").value,750,0.001,"rpm");
        near(ObdPidDecoder.decode("010C","7E8 04 41 0C 0B B8\r>").value,750,0.001,"rpm with headers");
        near(ObdPidDecoder.decode("010B","410B23\r>").value,35,0.001,"MAP");
        near(ObdPidDecoder.decode("0106","410684\r>").value,3.125,0.001,"STFT");
        near(ObdPidDecoder.decode("0107","41077C\r>").value,-3.125,0.001,"LTFT");
        near(ObdPidDecoder.decode("010E","410E9C\r>").value,14,0.001,"ignition advance");
        near(ObdPidDecoder.decode("0105","41055A\r>").value,50,0.001,"coolant");
        near(ObdPidDecoder.decode("0111","41117F\r>").value,127*100.0/255,0.001,"throttle");
        near(ObdPidDecoder.decode("0142","41423880\r>").value,14.464,0.001,"control voltage");
        near(ObdPidDecoder.decodeAdapterVoltage("ATRV\r14.2V\r>").value,14.2,0.001,"adapter voltage");
        ok(ObdPidDecoder.decode("010C","NO DATA\r>")==null,"no data");
        ok(ObdPidDecoder.decode("010C","410DFF\r>")==null,"wrong PID");
        ok(ObdPidDecoder.supportsPid("0100","41 00 FF FF FF FF",0x0C),"supported RPM");
        ok(!ObdPidDecoder.supportsPid("0100","41 00 00 00 00 00",0x0C),"unsupported RPM");
        ok(ObdPidDecoder.supportsPid("0120","41 20 FF FF FF FF",0x42)==false,"0142 out of 0120 range");
        ok(ObdPidDecoder.supportsPid("0140","41 40 FF FF FF FF",0x42),"0142 in 0140 range");
        ok(ObdPidDecoder.decodeAdapterVoltage("NO DATA")==null,"voltage absent");
        System.out.println("PASS " +assertions+" OBD decoder assertions");
    }
}
