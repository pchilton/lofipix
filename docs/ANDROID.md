# Android development (`mobile/android/`)

Native Android side of the lofipix mobile app: bare React Native CLI (no Expo),
React Navigation native-stack, PowerSync SQLite, built with Gradle.

## Tool versions

| Component | Version | Notes |
|---|---|---|
| Android Studio | Latest stable (e.g. 2024.3.x / Meerkat or newer) | Download from developer.android.com; bundle includes its own JDK |
| Android SDK / compileSdk | 36 (Android 15) | `compileSdk rootProject.ext.compileSdkVersion` in `mobile/android/app/build.gradle:78` |
| targetSdk | 36 | `mobile/android/app/build.gradle:84` |
| minSdk | 24 (Android 7.0 Nougat) | `mobile/android/app/build.gradle:83` |
| Build tools | 36.0.0 | `mobile/android/build.gradle:3` |
| NDK | 27.1.12297006 | `mobile/android/build.gradle:7` |
| Gradle | 9.4.1 | `mobile/android/gradle/wrapper/gradle-wrapper.properties` |
| AGP (`com.android.tools.build:gradle`) | Not pinned | Version resolved by the React Native Gradle Plugin |
| Kotlin | 2.2.0 | `mobile/android/build.gradle:8` |
| React Native | 0.88.1 | `mobile/package.json:31` |
| Package name / namespace | `app.lofipix.mobile` | `mobile/android/app/build.gradle:80` |

Record ids use `uuidv7()` from the `uuid` package (see AGENTS.md), minted offline on the device.

## Installing Android Studio on Debian Linux 13 (trixie)

1. Install prerequisite packages:

   ```bash
   sudo apt update
   sudo apt install -y curl unzip wget libc6 libncurses5 libstdc++6 lib32z1
   ```

   AGP 8.x builds require a JDK; Android Studio bundles one, but Gradle command-line
   builds need a system JDK:

   ```bash
   sudo apt install -y openjdk-17-jdk
   ```

2. Download Android Studio:

   ```bash
   wget https://redirector.gvt1.com/edgedl/android/studio/ide-zips/<latest>/android-studio-<version>-linux.tar.gz
   ```

   Get the current `<latest>` URL from https://developer.android.com/studio.

3. Extract to `/opt` and launch:

   ```bash
   sudo tar -xzf android-studio-*-linux.tar.gz -C /opt
   /opt/android-studio/bin/studio.sh
   ```

   On first run, Android Studio downloads additional components and prompts for
   the SDK location.

4. Add a desktop entry (`~/.local/share/applications/android-studio.desktop`) so it
   appears in the applications menu:

   ```ini
   [Desktop Entry]
   Name=Android Studio
   Exec=/opt/android-studio/bin/studio.sh %f
   Icon=/opt/android-studio/bin/studio.png
   Type=Application
   Categories=Development;IDE;
   ```

5. Add SDK tools to PATH in `~/.bashrc` / `~/.zshrc`:

   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
   ```

   Then `source ~/.bashrc` (or restart the shell) and verify:

   ```bash
   adb version
   emulator -version
   sdkmanager --version
   ```

## Downloading the Android SDK and Android emulator

Use Android Studio's SDK Manager (`Tools > SDK Manager` in Studio, or `sdkmanager`
from the command line):

### Via Android Studio UI

- **SDK Platforms tab**: install `Android 15.0 ("Vanilla Ice Cream")` (API 36).
- **SDK Tools tab**: install
  - `Android SDK Build-Tools` (36.0.0)
  - `Android SDK Platform-Tools`
  - `Android Emulator`
  - `Android SDK Command-line Tools (latest)`
  - `Google Play Intel x86 Atom System Image` or `Google APIs ARM 64 v8a System Image`
    (for the emulator; match the CPU architecture of your host — x86_64 on most PCs,
    arm64 on Apple Silicon).

### Via command line

```bash
# List available packages
sdkmanager --list

# Install what the lofipix app needs
sdkmanager "platform-tools" \
           "platforms;android-36" \
           "build-tools;36.0.0" \
           "emulator" \
           "cmdline-tools;latest" \
           "system-images;android-36;google_apis_playstore;x86_64"

# Accept any remaining licenses
sdkmanager --licenses
```

### Create an emulator (AVD)

```bash
avdmanager create avd -n lofipix_pixel8 \
  -k "system-images;android-36;google_apis_playstore;x86_64" \
  -g "google_apis_playstore" \
  -d "pixel_8"
emulator -avd lofipix_pixel8
```

Use a Google Play system image if you need Google Play Services (e.g. for camera
permissions or maps); otherwise `google_apis` is smaller.

## Running the app on Android

```bash
cd mobile
bun android            # react-native run-android
```

Requires an emulator running or a physical device with USB debugging enabled and
`adb devices` showing it. The Metro bundler must be reachable; Android emulators
map host `localhost` to `10.0.2.2` (see `docs/MOBILE.md`, Environment configuration).

## Android-specific notes

- `minSdkVersion 24` — devices below Android 7.0 are not supported.
- Cleartext traffic is allowed in debug builds only
  (`mobile/android/app/build.gradle:99`); production builds disable it.
- Signing: debug builds use the bundled `debug.keystore`; release builds need a
  production keystore (see React Native signed APK docs) — the repo does not sign
  or publish releases (`docs/DEPLOYMENT.md`).
- Camera capture uses `react-native-camera-kit`; grant camera permission at
  runtime on the device/emulator.
