# MIDI Arcade Privacy Policy

**Effective date:** July 26, 2026  
**App:** MIDI Arcade (`com.midiarcade.app`)  
**Developer/publisher:** MIDI Arcade, under the developer identity displayed on its Google Play listing  
**Privacy contact:** Use the developer contact address displayed under App support on MIDI Arcade's Google Play listing.

## Plain-language summary

MIDI Arcade is a local-first music creation and piano improvisation app. It does not require an account. The current app does not include advertising, analytics, behavioral tracking, crash-reporting services, or a developer-operated cloud service. Song ideas, MIDI performances, practice statistics, and settings are processed and stored on the user's device unless the user explicitly exports or shares a MIDI file.

## Information the app handles

### Music and practice data stored on the device

To restore the user's session, MIDI Arcade saves app data in local application storage. This can include:

- generated song notes, arrangement sections, tempo, title, instruments, and mix settings;
- mute, solo, lock, selected-track, guide, keyboard-range, and workflow settings;
- a recorded piano take represented as MIDI notes, timing, duration, and velocity;
- on-device take feedback and practice statistics, including best score, session count, streak, and the last practice date; and
- the date and time at which the local session was saved.

This data is used only to provide app features such as autosave, playback, editing, practice feedback, and MIDI export. MIDI Arcade does not transmit it to the developer.

### MIDI devices and MIDI input

Hardware MIDI access begins only after the user chooses to find or connect a keyboard. Depending on the device and Android environment, the app may display a connected MIDI device's name and manufacturer. It processes MIDI note-on, note-off, velocity, channel, and sustain-pedal messages on the device so the user can hear, record, and score a performance.

MIDI device identifiers and names are not included in the saved session. The normal connection flow does not request MIDI System Exclusive access. MIDI Arcade records note events, not microphone audio, and does not access the microphone to create a take.

### Information the developer does not collect

The current version does not collect or receive:

- names, email addresses, account credentials, contacts, precise location, advertising identifiers, or payment information;
- the user's generated songs, recorded MIDI takes, MIDI-device identity, or exported files;
- in-app analytics events, usage profiles, or cross-app tracking data; or
- microphone recordings, photos, videos, or files from the user's media library.

Because the developer does not receive personal data from the app, the developer does not sell or share app data for advertising.

Google Play and Android may independently provide the developer with aggregate or de-identified store performance, install/uninstall, rating, and Android Vitals crash/ANR diagnostics under Google's own terms. This platform reporting is not produced by an analytics or crash-reporting SDK inside MIDI Arcade and does not include the user's MIDI notes, song content, or exported files.

## MIDI export and user-directed sharing

When the user selects Export, MIDI Arcade creates a Standard MIDI File on the device. On Android, the app writes a temporary `.mid` file to its cache and opens the Android share/save sheet. The user decides whether to save the file or send it to another app, device, or service.

MIDI Arcade does not upload the export to the developer. A destination selected by the user may process the file under its own privacy policy. Temporary cache files may remain until Android removes them or the user clears the app's storage. Copies saved or shared outside MIDI Arcade are controlled by the user and are not removed when app storage is cleared.

## Retention, deletion, and device backups

Local session data remains until it is replaced, cleared through Android's app-storage controls, or removed when the app is uninstalled. A recorded take can also be cleared from Jam Studio. Exported copies must be deleted from their destination by the user.

The Android release configuration disables app backup and explicitly excludes app data from cloud backup and device-to-device transfer. Exported copies that the user saves elsewhere remain subject to the selected destination's backup behavior. The MIDI Arcade developer does not receive or control those copies or backups.

## Permissions

MIDI Arcade should request access only when needed for a feature the user starts, such as connecting compatible MIDI hardware or opening Android's share sheet. It does not need access to the user's audio library, photos, contacts, location, or microphone for its current features. The production Android manifest and Google Play Data Safety answers must remain aligned with this behavior.

## Security

Local app data is protected by Android's application sandbox and the security controls of the user's device. No storage method is perfectly secure, so users should protect their device and use care when sharing exported MIDI files.

## Children's privacy

MIDI Arcade is a general music-creation tool and is not directed to children under 13. The developer does not knowingly collect personal information from children through the app. If the Play target-audience selection later includes children, the developer must reassess this policy and all applicable Families requirements before release.

## Changes to this policy

If MIDI Arcade later adds accounts, cloud sync, analytics, advertising, crash reporting, or any other data collection, this policy and the Google Play Data Safety form must be updated before that collection begins. Material changes will be reflected by a new effective date.

## Contact

Privacy questions can be sent to the monitored developer contact address displayed under **App support** on MIDI Arcade's Google Play listing. When contacting the developer, include “MIDI Arcade privacy” in the subject line.
