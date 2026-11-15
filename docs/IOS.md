# iOS development (`mobile/ios/`)

Native iOS side of the lofipix mobile app: a fresh bare React Native CLI app
(no Expo), built with Xcode. The mobile app is being developed in small
increments. See `docs/MOBILE.md` for the target camera, file storage, and
PowerSync design.

| Setting | Value |
| --- | --- |
| Package name / namespace | `app.lofipix` |
| Record IDs | UUIDv7 via `uuidv7()` from the `uuid` package; generated offline on-device |

## Xcode

Install Xcode

## Project setup

Install the Node.js version pinned in `mobile/.tool-versions` with ASDF, then
install the locked JavaScript dependencies with npm:

```bash
cd mobile
asdf install
npm install
bundle install
```

```bash
cd mobile/ios
pod install
```

Use `npm install` from `mobile/` when adding or changing dependencies so
`mobile/package-lock.json` stays up to date. The mobile app is not part of the
root Bun workspace; do not use Bun in `mobile/`.

## Check environment

`npx react-native doctor`

## Running the app

Metro bundler will open in the background.


```bash
npm run ios
```
