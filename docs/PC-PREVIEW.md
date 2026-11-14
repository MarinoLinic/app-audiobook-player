# Lector PC runtime

The PC launcher runs the existing React Native interface through its installed Expo web compiler. `public/phone.html` contains a local iframe capped at 430 x 900 pixels, fitting smaller windows automatically. The app stays in a phone layout on a desktop; this is not Android emulation.

## Launch and stop

- `Open PC.cmd`: start or reuse this checkout's server, then open its dedicated browser app window.
- `Stop PC.cmd`: stop only the recorded Node process tree after verifying its command points to this checkout's Expo CLI. Close its browser window separately.
- `Setup PC.cmd`: install package-lock.json dependencies with npm, requiring network access for uncached packages.
- `npm run pc -- -NoBrowser`: start without opening a window for isolated QA.
- `npm run pc:status`: print the recorded process and verified local URL.
- `npm run pc:stop`: stop the owned server.

The fixed URL is http://localhost:8181/phone.html. The owned server automatically stops about two hours after the latest Open PC invocation. This is a finite lifetime, not interaction tracking: reopen the launcher to renew it during a long session. A hidden watchdog checks the exact owned Node process before stopping it and ends when that process stops. Its interval is five seconds; no activity, keys, mouse movement or window contents are collected. The optional -LifetimeSeconds argument (10-7200) permits a short isolated timeout check. A second launch reuses the server; a named mutex prevents overlapping launch/stop operations. A conflicting port fails visibly rather than selecting a new origin and hiding saved data. Stop the server before moving the repository. After moving it, rerun Setup PC.cmd if the existing node_modules runtime needs rebuilding. After source changes, stop and reopen: the bounded launcher uses Expo CI mode rather than background source watching.

The local server binds to localhost, sets EXPO_OFFLINE=1 and EXPO_NO_TELEMETRY=1, and limits Metro to two workers. It does not use EAS hosting, an Expo login, a phone connection, API keys or a Windows startup service. Its process state and logs live in ignored `.local/pc-preview/`. Local bundling can take longer on the first opening. Errors are in server-error.log and launcher-error.log there.

## Saved data

Open PC.cmd uses an independent Edge, Chrome or Brave app profile at `%LOCALAPPDATA%/Marino/PCAppPreviews/lector`. The app origin is http://localhost:8181. Both profile and origin must remain stable to see existing PC data. Phone data and your normal browser profile are not migrated, read or overwritten. Normal browser cache/eviction/private-mode rules still apply; export backups and keep original source files. Browser storage is not an encrypted secret store.

Fresh QA contexts belong under `C:/Users/marin/agent-files/trash/project-reviews/repository-cleanup/app-audiobook-player/`, never the user profile. Use fictional records and synthetic audio only. Do not download an emulator or upgrade the Expo SDK for PC preview maintenance. The three repositories carry self-contained copies of the launcher and phone wrapper; no sibling checkout is needed at runtime.

## Implementation and validation

LibraryService.web imports explicitly selected audio files into the lector-media IndexedDB database, with stable lector-media: track URIs. PlaybackService.web resolves them to short-lived Blob URLs and uses browser media events; release cancels pending loads, detaches listeners, stops audio and revokes those URLs. The native LibraryService and PlaybackService stay in place. The browser range slider avoids the SDK 53 community-slider findDOMNode call that is incompatible with React 19. Native sliders, SAF folder scans and Android volume boost remain native.

Only SDK 53 compatible react-dom 19.0.0 and react-native-web 0.20.0 were added; the installed Expo bundledNativeModules map supplied those versions. No SDK upgrade or emulator was installed. Audio decoding follows browser codec support; this does not certify every MP3/M4B/FLAC file, background/suspended playback or native audio routing. Metadata reads retain the 80 MiB cap. Browser audio storage is quota-limited and can be evicted; originals remain the backup.

Checks: npm test -- --runInBand; npm run typecheck; npm run lint; git diff --check. The real browser flow imported a synthetic 1,280,044-byte WAV, played/paused it, verified saved progress and resumed playback after a browser restart, changed a persisted theme, and exercised keyboard seek/volume controls. All89existing unit tests, final TypeScript and lint checks passed. The normal Open PC.cmd also started its dedicated Edge app window, which was closed after verification. The identical shared watchdog passed a30-second lifetime test in TrackLogger, stopping its owned server within the five-second polling interval. Preserve native seek arbitration and source URI handling during maintenance.
