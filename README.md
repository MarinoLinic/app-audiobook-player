# Lector

A local audiobook player for Android, built with Expo and React Native. Import audio files or choose a device folder, browse books and tracks, and resume listening from saved progress.

![Lector workflow diagram](docs/overview.svg)

## Run

```powershell
npm ci
npm start
```

Use an Expo SDK 53 compatible development client. `npm run android` opens the Android development target; `npm run ios` needs macOS and the iOS tooling. Volume boost above 100% uses the local Android module and requires a development or production build; it does not work in Expo Go.

## Use

Import files or a folder from the Library, open a book, and select a track. The player supports seeking, playback speed, a sleep timer and saved per-track progress. Settings and progress are stored on the device with AsyncStorage. Back up your original audio separately.

Metadata readers handle ID3, MP4 and FLAC/Vorbis tags. Files above the metadata reader's 80 MB limit fall back to filename hints; this limit concerns tag inspection.

## Project map

| Path | Purpose |
| --- | --- |
| `app/` | Library, settings, book and player screens |
| `context/` | Library, playback, theme and persistence state |
| `services/` | File import, storage and audio playback |
| `metadata/` | Byte-level audio tag parsers |
| `modules/volume-boost/` | Android LoudnessEnhancer bridge |
| `components/Logo.tsx`, `scripts/generate-icon.js` | App mark and PNG generation |

## Checks and continuation

```powershell
npm test -- --runInBand
npm run typecheck
npm run lint
```

Read [AGENTS.md](AGENTS.md) before editing. Keep native seek timing, SAF content URIs and metadata fallbacks intact. This documentation update does not certify a new mobile release or device test.
