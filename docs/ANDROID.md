# Android development (`mobile/android/`)

Native Android side of the lofipix mobile app: a fresh bare React Native CLI app
(no Expo), built with Gradle. The mobile app is being developed in small
increments; keep the app building and launching on a connected Android device
at every step. See `docs/MOBILE.md` for the target camera, file storage, and
PowerSync design.

| Setting | Value |
| --- | --- |
| Package name / namespace | `app.lofipix.mobile` |
| Record IDs | UUIDv7 via `uuidv7()` from the `uuid` package; generated offline on-device |

## Android Studio

Download and install [Android Studio](https://developer.android.com/studio).

Once installed, open Android Studio and install the required SDK components via **SDK Manager** (or `sdkmanager`):

- Android SDK Platform (latest stable, e.g. API level 35)
- Android SDK Build-Tools (latest)
- Android Emulator
- Google Play Intel x86 Atom_64 System Image (or any emulator system image you plan to run)

Configure environment variables (add to `~/.bashrc`):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

Then:

```bash
source ~/.bashrc
```

Verify the Android SDK is visible:

```bash
android sdk list
```

## Project setup

Install the Node.js version pinned in `mobile/.tool-versions` with ASDF, then
install the locked JavaScript dependencies with npm:

```bash
cd mobile
asdf install
npm install
```

Use `npm install` from `mobile/` when adding or changing dependencies so
`mobile/package-lock.json` stays up to date. The mobile app is not part of the
root Bun workspace; do not use Bun in `mobile/`.

## Incremental Android development

Use the device build as an acceptance check after each small change:

1. Confirm the untouched starter app builds and launches on the connected device.
2. Add one native dependency or screen at a time, and rebuild/reinstall with
   `npm run android` after native dependency or Android configuration changes.
3. Keep Metro running with `npm start` in a separate terminal while iterating on
   JavaScript/TypeScript changes. Metro reloads do not rebuild native modules.
4. Test each native feature on the device before proceeding: camera permission
   and preview, app-private file write/read, then PowerSync local SQLite write
   and persistence across restarts.

The active camera target is `react-native-vision-camera` (VisionCamera, not
`react-native-camera-kit` and not Apple's VisionKit). Add its Android manifest
permission and any required Gradle/native setup following the installation docs
for the version compatible with the React Native version in `mobile/package.json`.
Request camera permission only when entering capture. App-private photo files do
not require broad external storage or media permissions.

## Running the app

Start the Metro bundler:

```bash
npm start
```

Run on Android (requires an emulator running or a device connected with USB debugging enabled):

```bash
npm run android
```

Run on iOS (macOS only, requires Xcode):

```bash
npm run ios
```

## Testing on a physical Android device

### 1. Enable Developer options on the phone

1. Open **Settings → About phone → Software information**
2. Tap **Build number** 7 times until you see "You are now a developer!" (you may need to confirm your PIN/password).
3. Go back to **Settings → Developer options**

### 2. Enable USB debugging

In **Developer options**, enable:

- **USB debugging** — allows `adb` to install and debug apps over USB.
- **Install via USB** (if present) — allows installing apps from your computer without extra prompts on some OEM ROMs.

Keep the screen unlocked during first connection so you can accept the authorization prompt.

### 3. Connect the device via USB

1. Use a data-capable USB cable (charge-only cables will not work).
2. Plug the phone into your computer.
3. On the phone, when prompted "Allow USB debugging?", verify the computer's RSA key fingerprint and tap **Allow**. Optionally check "Always allow from this computer".
4. If the connection mode prompt appears, select **File transfer / MTP** or **No data transfer** — USB debugging works in either mode, but avoid "Charge only" on devices that disable data in that mode.

Verify the device is detected:

```bash
adb devices
```

Expected output lists your device as `device` (not `unauthorized` or `offline`):

```
List of devices attached
<serial>    device
```

If it shows `unauthorized`, unlock the phone and accept the RSA prompt again (you can revoke/re-prompt via **Developer options → Revoke USB debugging authorizations**).

### 4. Run the app on the device

Start Metro and deploy:

```bash
cd mobile
npm start
# in another terminal:
npm run android
```

React Native will install and launch the debug APK on the connected device when `adb devices` shows exactly one device. If multiple devices/emulators are connected, specify the target:

```bash
adb devices                    # note the serial
npx react-native run-android --deviceId <serial>
```

For USB-connected devices, Metro's dev server (default port 8081) is reachable via `adb reverse` (set up automatically by the React Native CLI). If the app can't reach Metro, run manually:

```bash
adb reverse tcp:8081 tcp:8081
```

Then reload the app (shake device → Reload, or `adb shell input keyevent 82` to open the dev menu).

### View development logs

```bash
adb logcat -s ReactNativeJS
```

For a specific device, use `adb -s <serial> logcat -s ReactNativeJS`. Failed sign-in requests in development log the method, URL and error message without credentials or tokens.

### 5. Use the device in Android Studio

1. Open `mobile/android/` in Android Studio (or open the project root and let it sync Gradle).
2. Wait for Gradle sync to complete.
3. In the toolbar, open the **device selector** (running devices dropdown, next to the run configuration).
4. Your physical device should appear under **Physical** when USB debugging is connected and authorized. Select it.
5. Click **Run** (▶) or **Debug** (🐞) with the `app` configuration to build and deploy.

Android Studio uses the same `adb` connection — if `adb devices` shows the device, Studio should list it. If not, try **File → Sync Project with Gradle Files**, restart `adb` (`adb kill-server && adb start-server`), or replug the cable.

### Wireless debugging (optional, Android 11+)

To debug without a cable on Android 11+:

1. In **Developer options**, enable **Wireless debugging**.
2. Tap **Wireless debugging → Pair device with pairing code** (or use QR pairing from Android Studio's **Pair Devices Using Wi-Fi**).
3. Pair: `adb pair <ip>:<pairing-port>` and enter the code.
4. Connect: `adb connect <ip>:<connect-port>` (shown on the Wireless debugging screen).
5. Verify with `adb devices`, then run as usual.

## Verification

React Native ships with a doctor command to check your environment:

```bash
npx react-native doctor
```

## Version pins

Node.js, Java, and Ruby versions are pinned in `mobile/.tool-versions` and managed by ASDF:

```
nodejs 24.22.2
ruby 3.4.10
java openjdk-17.0.2
```

Run `asdf install` inside `mobile/` to install the pinned versions.
