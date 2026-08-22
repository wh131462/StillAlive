## 1. Foundation and data model

- [x] 1.1 Extend shared types with music, book, excerpt, reading-note source, playback mode and parse-status entities.
- [x] 1.2 Add SQLite migrations, repositories and app-state methods for music, books, excerpts, source metadata and persisted preferences.
- [x] 1.3 Add local file import helpers with extension/MIME validation, sandbox copy, checksum and temporary-file cleanup.
- [x] 1.4 Extend backup snapshot, ZIP paths, validation, migration and restore logic for music and book assets.

## 2. Music library and player

- [x] 2.1 Implement music import/edit/delete flows in the “我的 → 音乐盒” screen.
- [x] 2.2 Add “喜欢的音乐” management to person details, including self/person ownership changes.
- [x] 2.3 Implement singleton music playback provider/controller with queue aggregation, shuffle, list-loop and single-loop modes.
- [x] 2.4 Add draggable global mini-player under the root layout with play/pause, close and navigation to full player.
- [x] 2.5 Add full player screen with seek bar, previous/next, mode switch, queue source filters and error recovery.

## 3. Bookshelf and reading

- [x] 3.1 Implement bookshelf import, metadata editing, sorting, search, delete and parse-status UI.
- [x] 3.2 Implement reader adapter boundary and PDF rendering path; EPUB remains the initial reflow engine boundary.
- [x] 3.3 Add book detail and reader screens with progress persistence and resume position.
- [x] 3.4 Add excerpt selection/storage, excerpt list, delete and source-location display.
- [x] 3.5 Extend existing editor entry flow to create reading reviews/notes with immutable quote blocks and book/excerpt source metadata.

## 4. Verification and compatibility

- [x] 4.1 Update PRD and current OpenSpec specs with final supported formats, UX rules, data model and platform limitations.
- [x] 4.2 Add unit coverage for queue transitions, ownership/deletion semantics, format status handling and backup migrations.
- [x] 4.3 Run mobile typecheck/build checks and validate old backup restore with empty new collections.
- [x] 4.4 Record iOS/Android real-device acceptance items for audio session, large files, PDF rendering and protected ebook behavior.

## 5. Music state model correction

- [x] 5.1 Replace single-owner music fields with independent self/person collection relations and migrate existing records.
- [x] 5.2 Store playback session as track IDs plus queue sources and derive current display data from the live library.
- [x] 5.3 Update music box, person favorites and full player to use the collection relation APIs.
- [x] 5.4 Verify deletion, route visibility, typecheck and iOS/Android builds.

## 6. Music interaction redesign

- [x] 6.1 Update PRD and music specs with the library/detail/queue interaction hierarchy.
- [x] 6.2 Redesign the music box around library summary, play-all/shuffle, search and row action sheets.
- [x] 6.3 Focus the full player on playback controls and move source selection plus track lists into a queue sheet.
- [x] 6.4 Add queue access from the mini-player, verify person favorite playback, typecheck and iOS/Android builds.

## 7. Reading interaction redesign

- [x] 7.1 Update PRD and reading specs with the content/control/tool-sheet hierarchy and format capability boundaries.
- [x] 7.2 Redesign the PDF reader around an immersive reading surface, collapsible controls and safe-area-aware navigation.
- [x] 7.3 Add real PDF page targeting, a cross-platform excerpt sheet, note entry and reader background controls.
- [x] 7.4 Run typecheck, strict OpenSpec validation and iOS/Android builds.

## 8. Production reading engine replacement

- [ ] 8.1 Build a minimal Expo 57 / RN 0.86 development build spike for `epubjs-react-native`; verify local sandbox EPUB, TOC, CFI restore, text selection and theme/font updates on iOS and Android.
- [ ] 8.2 Build a minimal PDF renderer spike using `react-native-pdf` or an equivalent maintained native renderer; verify local large PDF, page count, page jump, zoom, rotation and safe-area layout on iOS and Android.
- [x] 8.3 Replace the current DOM `<embed>` surface with `BookReaderAdapter` implementations and a capability-driven `ReaderSessionController`; retain `<embed>` only as a temporary fallback for unsupported web preview, never as the production reader.
- [x] 8.4 Add `BookLocator`, `ReaderCapabilities`, chapter cache and per-book reading preferences; migrate existing `page:N` locations to `pdf-page` locators without losing progress.
- [x] 8.5 Implement the reference interaction structure: full-screen immersive正文 with the system status bar hidden, bottom-right time/battery HUD, floating tap-to-reveal controls, TOC/excerpts/notes drawer, display drawer, safe-area-aware control states, and no mini-player while the full reader is open.
- [x] 8.6 Implement EPUB selection-to-excerpt with CFI/context snapshots and PDF capability-gated selection/manual excerpt labeling; add highlighter restore where the selected engine supports it.
- [x] 8.7 Add real-device acceptance for 50 MB+ books, background/foreground resume, orientation, dynamic font settings, failed/protected/unsupported states and backup restore.
- [ ] 8.8 Only after the engine spikes pass, decide whether the no-DRM MOBI parser is stable enough for release; AZW/AZW3 remain outside the new import list and historical records stay archive-only.

## 13. Extended reflow book formats

- [x] 13.1 Remove AZW/AZW3 from new picker and directory import extensions while preserving historical records and backups.
- [x] 13.2 Add no-DRM MOBI and FB2 parsing with a local, rebuildable EPUB cache and protected/failed status handling.
- [x] 13.3 Add TXT and HTML/HTM normalization to the same reflow reader with safe script/link filtering.
- [x] 13.4 Extend reflow locators, excerpts, settings and backup validation for converted formats.
- [x] 13.5 Run typecheck, tests, build, strict OpenSpec validation and diff checks for the extended format matrix.

## 9. Book batch import and deduplication

- [x] 9.1 Extend local book import helpers with multi-file selection, recursive directory selection and checksum validation.
- [x] 9.2 Update the bookshelf import flow to skip existing and in-batch duplicate checksums and summarize batch results.
- [x] 9.3 Run typecheck, tests, build, strict OpenSpec validation and diff checks.

## 10. PDF continuous scrolling

- [x] 10.1 Separate observed PDF pages from imperative page navigation so vertical scrolling does not snap to page boundaries.
- [x] 10.2 Run typecheck, tests, build, strict OpenSpec validation and diff checks.

## 11. Reading note editor access

- [x] 11.1 Allow validated book and excerpt note sources to enter the editor without today's check-in while preserving the ordinary journal guard.
- [x] 11.2 Run typecheck, tests, build, strict OpenSpec validation and diff checks.

## 12. Encrypted music import

- [x] 12.1 Pin and audit the MIT-licensed Rust decoder core; confirm NCM, selected QMC/MGG/MFLAC, and KGM/KGMA vectors, and reject KGG/external-key formats.
- [x] 12.2 Add an Expo native module under `apps/mobile/modules/` with iOS/Android bindings and a bounded, file-based `unlock` API; do not bridge whole audio buffers through JS.
- [x] 12.3 Add `MusicImportCoordinator` to probe extensions and magic bytes, route encrypted inputs, validate decoded MP3/FLAC output, extract metadata, and commit media plus track atomically.
- [x] 12.4 Update picker MIME/extension handling, progress/cancel/error states, temporary-file cleanup, and backup behavior so only validated unencrypted files enter the library.
- [ ] 12.5 Run decoder fixture tests, malformed-input/fuzz limits, `pnpm typecheck`, `pnpm test`, `pnpm build`, `git diff --check`, and iOS/Android real-device acceptance with large files.
