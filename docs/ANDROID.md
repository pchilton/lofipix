# Android development (`mobile/android/`)

Native Android side of the lofipix mobile app: bare React Native CLI (no Expo),
React Navigation native-stack, PowerSync SQLite, built with Gradle.

| Package name / namespace | `app.lofipix.mobile`
Record ids use `uuidv7()` from the `uuid` package (see AGENTS.md), minted offline on the device.
`react-native-camera-kit`



### Android Studio

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

Install JavaScript dependencies:

```bash
cd mobile
npm install
```

## Running the app

Start the Metro bundler:

```bash
npm start
```

Run on Android (requires an emulator running or a device connected with USB debugging enabled):

```bash
npm run android
# or
npx react-native run-android
```

Run on iOS (macOS only, requires Xcode):

```bash
npm run ios
# or
npx react-native run-ios
```

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
