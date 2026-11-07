# Store screenshots

The App Store and Google Play screenshots are real captures of a Release build, framed with a
device and marketing copy. Scripts live in `apps/mobile/scripts/store-screenshots/`. The images
aren't in git; they're written to `~/Downloads/muscleos-store-screenshots-<version>/`.

| Store | Size | Folders |
|-------|------|---------|
| App Store | 1320×2868 (6.9") | `ios/`, `ios-dark/` |
| Google Play | 1080×1920 (9:16) | `android/`, `android-dark/` |

## Regenerating

Requires a booted Android emulator, an iPhone 17 Pro Max simulator (`IOS_UDID` picks a specific
one), [AXe](https://github.com/cameroncooke/AXe), ffmpeg and Google Chrome. `--build` needs
`apps/mobile/.env`, and builds must come from an up-to-date `main`.

```sh
# Omit --build to reuse the last builds, and --dark for the light set
apps/mobile/scripts/store-screenshots/capture.sh --build --dark all
```

Check `06-exercises.png` afterwards. The demo keeps looping during capture, so it may catch the
wrong moment of the rep; change `DEMO_FRAME` in `capture.sh` if so.

To reword or reorder, edit `slides.mjs` and re-run `compose.mjs` against the captures in the
output folder's `raw/`:

```sh
node apps/mobile/scripts/store-screenshots/compose.mjs --dark ios <out>/raw/ios-dark <out>/ios-dark
```

## What it does to your devices

- **iOS:** installs the build on the simulator and overwrites that app's data with the demo log.
- **Android:** installs a debuggable Release build over `app.muscleos`, because seeding needs
  `run-as`. AsyncStorage is backed up and restored afterwards, as are the navigation and status
  bars, but the build stays installed. Use an emulator, not a phone with data you care about.

## Demo data

`seed.mjs` writes eight weeks of Push Pull Legs in kg, dated relative to now, and a Push workout
in progress with the rest timer running. It's invented: no real training log appears in a
screenshot. The rest timer keeps counting, so captures show slightly different times.

## Copy rules

Every claim has to be true of the shipped app, so check the feature specs when changing copy.
Leave the price out: the copy says "Every feature, for everyone" rather than "free".
