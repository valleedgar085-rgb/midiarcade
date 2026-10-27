# AutoCircuit Atlas Lab v0.3.9 — Android Studio source

**Status:** Source project with new native live ELM327 monitor; `javac` PID decoder tests and browser UI smoke tests passed. **Not yet compiled into an APK or verified against a physical Honda ECU.** The previously tested v0.3.8 Android source was not accessible; this is an independent follow-on from the saved v0.3.4 web prototype and manual-workbench update, not an in-place patch of v0.3.8.

## Main capabilities

- Paired **Bluetooth Classic SPP** (RFCOMM UUID `00001101-0000-1000-8000-00805F9B34FB`) ELM327-compatible devices, Android 8+.
- Runtime Nearby devices / `BLUETOOTH_CONNECT` permission on Android 12+; no discovery and no location permission.
- Fixed read-only OBD requests: RPM `010C`, MAP `010B`, STFT `0106`, LTFT `0107`, ECU ignition advance `010E`, coolant `0105`, throttle `0111`, optional ECU voltage `0142`, ELM-reported adapter voltage `ATRV`.
- Supported PID bitmap gating (`0100`, `0120`, `0140`), one-PID-at-a-time polling, time-stamped readings, missing/stale values shown as unavailable, capture up to 1,200 samples in active memory, save up to eight local sessions, CSV export through Android document picker.
- Legacy read-only scan and recorded example preserved; neither is electrical wiring verification.
- Honda F23A manual evidence checklist; no automated determination that the belt is correctly timed.

## Open and build

1. Open this folder as a project in Android Studio with Android SDK Platform 35 installed and JDK 17.
2. Project uses Android Gradle Plugin **8.6.1** and Gradle **8.7**. The ZIP doesn't bundle the Gradle wrapper executable/JAR because those distribution binaries were unavailable in this build environment. If Android Studio prompts for a Gradle installation, select or install Gradle 8.7, or generate the standard Gradle wrapper (`gradle wrapper --gradle-version 8.7`).
3. Run `gradle :app:assembleDebug` or select **Build > Build APK(s)** once Gradle is configured. APK path: `app/build/outputs/apk/debug/app-debug.apk`.
4. Alternative: push this entire folder to a GitHub repository, then choose **Actions > Build AutoCircuit Atlas Lab APK > Run workflow**. The included workflow installs Gradle and uploads a downloadable APK artifact.
5. On your phone, pair a supported **Bluetooth Classic** ELM327 interface named e.g. `OBDII` in Android Settings before launching. BLE-only/Wi-Fi adapters aren't implemented.
6. Open **Tests > Live OBD sensor monitor**, review the mechanical-safety checkbox, then **Choose paired adapter > Find paired adapters > Live monitor**. Wait for **LIVE FROM ECU** and genuine PID samples before assessing values. Tap **Fill manual assessment** then **Analyze** if you want guided interpretation.

The package application ID is `com.autocircuit.atlas.dev` and app title is **AutoCircuit Atlas Lab** to avoid overwriting another AutoCircuit Atlas version.

## Safety/accuracy

- This monitor sends information-only OBD requests. It does not clear DTCs, actuate devices, reflash modules, infer ECU wiring, or perform passive sniffing.
- Never operate the phone while driving; scan with the vehicle stationary.
- **Suspected loose pulley, broken key, improper tensioner setup, or uncertain cam timing must be inspected with the engine off before running it.** Live OBD readings cannot verify camshaft timing.
- `010E` is ECU-reported ignition advance, **not crank-to-cam mechanical alignment**.
- `ATRV` is adapter supply voltage; `0142` is an ECU-reported control-module voltage and only displayed if supported.
- On some older Hondas the ISO 9141/K-line communications can be slow; requests are sequential. Unsupported PIDs remain unknown. Cheap ELM clones may not support the vehicle's actual protocol. Hardware communication and APK builds require testing.

## Verified offline tests

```sh
mkdir -p tests/out
javac -d tests/out app/src/main/java/com/autocircuit/atlas/ObdPidDecoder.java tests/ObdPidDecoderTest.java
java -cp tests/out ObdPidDecoderTest
```

Web preview is the bundled `app/src/main/assets/index.html`; without the native bridge it intentionally cannot connect by Bluetooth.
