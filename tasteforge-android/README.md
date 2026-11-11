# TasteForge Android — Offline Adaptive MIDI Studio

Android application (independent from MIDI Arcade), version 1.0.

## Build with Android Studio

1. Download the branch `build/tasteforge-android-v1` as ZIP or clone it.
2. In Android Studio choose **Open** and select the **tasteforge-android** folder (not the MIDI Arcade repository root).
3. Allow Gradle sync to finish with JDK 17 and Android SDK Platform 35.
4. Choose **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. Find the debug APK at `tasteforge-android/app/build/outputs/apk/debug/app-debug.apk`.
6. Copy the APK to the phone and install it. Android will ask for permission to install from the file manager.

To build in a terminal that has Android SDK and Java 17 available:

```sh
cd tasteforge-android
gradle :app:assembleDebug
```

The source uses Android Gradle Plugin 8.7.3 and Gradle 8.10.2. The GitHub workflow uses the same versions and is available under **Actions > TasteForge Android APK**.

## What works offline

- Melody, chords, and bass generation in the selected key and scale
- Three candidate directions, tempo, 4-32 bars, creativity control, repeatable numerical seeds
- Web Audio audition and melody piano-roll display
- Per-producer learning from 1-5 star ratings and imported MIDI patterns
- Local saved composition collection
- Standard multitrack MIDI SMF type-1 export (melody/chords/bass), Android system file picker

## MIDI export

Open a composition and choose **ALL MIDI**, **MELODY**, **CHORDS**, or **BASS**. Android opens a system document picker. Save the .mid file where FL Studio Mobile can access it. Import it into FL Studio Mobile using its MIDI import feature.

## Privacy and limits

All processing takes place on the device, using WebView JavaScript and Android's document picker. No network permission is needed. Personal taste memory is a preference-learning model based on feedback and extracted MIDI note/rhythm features. It is not consciousness. No soundfonts or synth sample packs are bundled.

**Build status:** The GitHub Actions workflows currently exit before starting Gradle, so the build must be verified when Actions runners become available or using a local Android Studio installation.
