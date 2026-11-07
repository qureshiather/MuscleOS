#!/usr/bin/env bash
# Captures and frames the store screenshots. See docs/mobile/store-screenshots.md.
#
# Usage: capture.sh [--dark] [--build] <ios|android|all> [outDir]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE="$(cd "$HERE/../.." && pwd)"
IOS_BUNDLE=com.muscle-os.app
ANDROID_PKG=app.muscleos
ANDROID_MAIN="$ANDROID_PKG/com.muscleos.app.MainActivity"
# Which frame of the looping squat demo to keep: the burst is timed to catch the bottom of the rep.
DEMO_FRAME=3

DARK=()
BUILD=0
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --dark) DARK=(--dark) ;;
    --build) BUILD=1 ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
PLATFORM="${POSITIONAL[0]:-}"
SUFFIX="${DARK:+-dark}"
VERSION="$(node -p "require('$MOBILE/app.json').expo.version")"
OUT="${POSITIONAL[1]:-$HOME/Downloads/muscleos-store-screenshots-$VERSION}"
[[ "$PLATFORM" =~ ^(ios|android|all)$ ]] || { sed -n 4p "${BASH_SOURCE[0]}"; exit 1; }

WORK="$(mktemp -d)"
seed() { node "$HERE/seed.mjs" "$WORK/seed.json" "$@" ${DARK[@]+"${DARK[@]}"} >/dev/null; }

# ---- iOS --------------------------------------------------------------------------------------

capture_ios() {
  local udid="${IOS_UDID:-$(xcrun simctl list devices available | grep 'iPhone 17 Pro Max' | tail -1 | grep -oE '[0-9A-F-]{36}')}"
  local raw="$OUT/raw/ios$SUFFIX"
  mkdir -p "$raw"
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null

  if [[ $BUILD == 1 ]]; then
    (cd "$MOBILE/ios" && pod install >/dev/null && xcodebuild -workspace MuscleOS.xcworkspace -scheme MuscleOS \
      -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath build ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO -quiet)
    git -C "$MOBILE" checkout -- ios/Podfile.lock
  fi
  xcrun simctl install "$udid" "$MOBILE/ios/build/Build/Products/Release-iphonesimulator/MuscleOS.app"

  xcrun simctl status_bar "$udid" override --time 9:41 --batteryState discharging --batteryLevel 100 \
    --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4

  shot() { xcrun simctl io "$udid" screenshot "$raw/$1.png" 2>/dev/null; }
  tap_label() { axe tap --label "$1" --udid "$udid" >/dev/null; sleep 2; }
  # iOS asks before opening a custom scheme; the coordinates are its Open button on a 6.9" screen.
  open_link() {
    xcrun simctl openurl "$udid" "$1"; sleep 1.5
    if axe describe-ui --udid "$udid" | grep -q 'Open in'; then axe tap -x 293 -y 515 --udid "$udid" >/dev/null; fi
    sleep 3
  }
  restart() {
    xcrun simctl terminate "$udid" "$IOS_BUNDLE" 2>/dev/null || true
    if [[ $# -gt 0 ]]; then node "$HERE/seed-ios.mjs" "$udid" "$1"; fi
    xcrun simctl launch "$udid" "$IOS_BUNDLE" >/dev/null; sleep 6
  }

  # A first launch creates the storage directory the seed writes into.
  restart
  seed --no-active; restart "$WORK/seed.json"; shot workouts
  tap_label Recovery; shot recovery
  tap_label History; shot history
  open_link 'muscleos://program?id=builtin_ppl'; shot program
  open_link 'muscleos://exercise-progression?exerciseId=squat'; shot progression

  restart
  tap_label Exercises
  axe tap -x 220 -y 165 --udid "$udid" >/dev/null; sleep 1
  axe type 'Barbell Squat' --udid "$udid" >/dev/null; sleep 2
  axe tap --label 'Barbell Squat, Quads · Glutes · Lower Back, Free Weight · Barbell' --udid "$udid" >/dev/null; sleep 6
  for i in 0 1 2 3 4 5; do xcrun simctl io "$udid" screenshot "$WORK/ios-frame-$i.png" 2>/dev/null; sleep 0.3; done
  cp "$WORK/ios-frame-$DEMO_FRAME.png" "$raw/exercise-detail.png"

  seed --rest-seconds=110; restart "$WORK/seed.json"
  open_link 'muscleos://active-workout'; shot active-workout

  xcrun simctl status_bar "$udid" clear
  xcrun simctl shutdown "$udid"
  node "$HERE/compose.mjs" ${DARK[@]+"${DARK[@]}"} ios "$raw" "$OUT/ios$SUFFIX"
}

# ---- Android ----------------------------------------------------------------------------------

restore_android() {
  [[ -f "$WORK/RKStorage.backup" ]] || return 0
  adb shell am force-stop "$ANDROID_PKG"
  adb shell "run-as $ANDROID_PKG sh -c 'rm -f databases/RKStorage-journal; cat > databases/RKStorage'" < "$WORK/RKStorage.backup"
  adb shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null
  adb shell settings put global sysui_demo_allowed 0
  adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.threebutton
  adb shell rm -f /sdcard/ui.xml
}

capture_android() {
  local raw="$OUT/raw/android$SUFFIX"
  mkdir -p "$raw"
  adb get-state >/dev/null

  if [[ $BUILD == 1 ]]; then
    # Seeding needs run-as, which needs a debuggable build. The flag never reaches git.
    local gradle="$MOBILE/android/app/build.gradle"
    sed -i '' 's/^        release {$/        release {\n            debuggable true/' "$gradle"
    (cd "$MOBILE/android" && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain -q) \
      || { git -C "$MOBILE" checkout -- android/app/build.gradle; exit 1; }
    git -C "$MOBILE" checkout -- android/app/build.gradle
  fi
  adb install -r "$MOBILE/android/app/build/outputs/apk/release/app-release.apk" >/dev/null
  adb shell pm grant "$ANDROID_PKG" android.permission.POST_NOTIFICATIONS

  shot() { adb exec-out screencap -p > "$raw/$1.png"; }
  tap_label() {
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null
    adb exec-out cat /sdcard/ui.xml > "$WORK/ui.xml"
    local xy
    xy="$(python3 "$HERE/find-android-node.py" "$WORK/ui.xml" "$1")"
    adb shell input tap $xy
    sleep 2
  }
  open_link() { adb shell am start -a android.intent.action.VIEW -d "'$1'" "$ANDROID_PKG" >/dev/null 2>&1 || true; sleep 6; }
  start_app() { adb shell am force-stop "$ANDROID_PKG"; adb shell am start -n "$ANDROID_MAIN" >/dev/null; sleep 8; }
  seed_db() {
    adb shell am force-stop "$ANDROID_PKG"
    adb exec-out run-as "$ANDROID_PKG" cat databases/RKStorage > "$WORK/RKStorage"
    python3 "$HERE/seed-android.py" "$WORK/RKStorage" "$WORK/seed.json"
    adb shell "run-as $ANDROID_PKG sh -c 'rm -f databases/RKStorage-journal; cat > databases/RKStorage'" < "$WORK/RKStorage"
  }

  # The app has to have run once for its database to exist. Keep what was there to put back after.
  adb shell am start -n "$ANDROID_MAIN" >/dev/null; sleep 8
  adb shell am force-stop "$ANDROID_PKG"
  adb exec-out run-as "$ANDROID_PKG" cat databases/RKStorage > "$WORK/RKStorage.backup"
  trap restore_android EXIT

  adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural
  demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
  adb shell settings put global sysui_demo_allowed 1
  demo enter
  demo clock -e hhmm 0941
  demo network -e wifi show -e level 4 -e fully true
  demo network -e mobile hide
  demo network -e nosim hide
  demo battery -e level 100 -e plugged false
  demo notifications -e visible false

  seed --no-active; seed_db; start_app; shot workouts
  tap_label Recovery; shot recovery
  tap_label History; shot history
  open_link 'muscleos://program?id=builtin_ppl'; shot program
  open_link 'muscleos://exercise-progression?exerciseId=squat'; shot progression

  start_app
  tap_label Exercises
  tap_label 'Search by'
  adb shell input text 'Barbell%sSquat'; sleep 2
  tap_label 'Barbell Squat,'; sleep 5
  for i in 0 1 2 3 4 5; do adb exec-out screencap -p > "$WORK/android-frame-$i.png"; sleep 0.4; done
  cp "$WORK/android-frame-$DEMO_FRAME.png" "$raw/exercise-detail.png"

  seed --rest-seconds=110; seed_db; start_app
  open_link 'muscleos://active-workout'; shot active-workout

  restore_android
  trap - EXIT
  node "$HERE/compose.mjs" ${DARK[@]+"${DARK[@]}"} android "$raw" "$OUT/android$SUFFIX"
}

[[ "$PLATFORM" == android ]] || capture_ios
[[ "$PLATFORM" == ios ]] || capture_android
rm -rf "$WORK"
