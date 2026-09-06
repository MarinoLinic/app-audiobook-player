# Lector — local audiobook player

Expo SDK 53 (managed) + expo-router 5, React Native 0.79, TypeScript strict, new architecture enabled.

## Commands

- `npm run start` — Expo dev server (Expo Go works for everything except volume boost > 100%)
- `npm test` — jest-expo unit tests (pure logic only: parsing, sorting, mapping; no RN rendering tests)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — `expo lint`
- `npm run generate-icon` — regenerates `assets/images/*.png` from `scripts/generate-icon.js` (dependency-free PNG encoder)
- `npx expo export --platform android` — bundling smoke test used to verify the app graph resolves

## Architecture

- `metadata/` — pure byte-level tag parsers (ID3v1/v2.2–2.4, MP4 ilst, FLAC/Vorbis). Text decoders are hand-rolled in `metadata/bytes.ts`; never assume TextDecoder exists.
- `utils/` — natural sorting (`1, 2, 10` order), track-number extraction, time formatting, base64, SAF uri helpers, rate/volume math.
- `services/` — AsyncStorage JSON store, LibraryService (SAF folder scan, file import, tag enrichment), PlaybackService (expo-audio wrapper).
- `context/` — LibraryContext (books/settings/progress persistence), PlayerContext (queue, resume, sleep timer, seek arbitration), ThemeContext.
- `app/` — expo-router screens: `(tabs)/index` = Library, `(tabs)/settings`, `book/[id]`, `player` (modal).
- `modules/volume-boost/` — local Expo module implementing Android LoudnessEnhancer (gain in millibels on output mix session 0). Only works in dev/prod builds, never Expo Go; JS side degrades silently.

## Conventions

- Tabs for indentation, no trailing semicolons, single quotes.
- Player seek arbitration: `pendingSeekMs`/`pendingSeekIssued` refs; seeks before `isLoaded` are dropped natively — issue from `onStatus` when loaded.
- File bytes for tag parsing come from `FileSystem.readAsStringAsync(uri, { encoding: 'base64' })`; SAF content uris are supported. Files over 80 MB are skipped (metadata hint falls back to filename).
- Progress is persisted in the `Book.progress` map via `updateTrackProgress`; a track is "finished" at 97% or within the last 10 s.

Read the SDK 53 docs before adding Expo APIs: https://docs.expo.dev/versions/v53.0.0/
