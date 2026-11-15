const fs = require('node:fs');
const path = require('node:path');

const appJsonPath = path.resolve(__dirname, '../app.json');
const buildGradlePath = path.resolve(__dirname, '../android/app/build.gradle');

// 1. Read app.json
const appJsonRaw = fs.readFileSync(appJsonPath, 'utf-8');
const appJson = JSON.parse(appJsonRaw);

const versionName = appJson.versionName || "1.0.0";
const versionCode = Math.floor(Date.now() / 1000);

appJson.versionName = versionName;
appJson.versionCode = versionCode;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2), 'utf-8');

console.log("setting application versions");
console.log(appJson);

// Sync to android/app/build.gradle
if (fs.existsSync(buildGradlePath)) {
  let gradleContent = fs.readFileSync(buildGradlePath, 'utf-8');
  
  gradleContent = gradleContent.replace(
    /versionCode\s+\d+/,
    `versionCode ${versionCode}`
  );
  
  gradleContent = gradleContent.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${versionName}"`
  );

  fs.writeFileSync(buildGradlePath, gradleContent, 'utf-8');
  console.log('✓ Synced version data to android/app/build.gradle');
}