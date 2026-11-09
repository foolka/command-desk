# Changelog

## 0.4.3 - 2026-11-09

- Reply format uses directly clickable Chat message / Twitch announcement buttons instead of a native popup.
- Every command has a visible full-height color stripe, including unselected and hovered rows. Unsaved color edits preview immediately and remain drafts.
- Editor fields have an explicit theme-aware caret and focus outline. Window activation restores focus to the editor; confirmations stay inside the app rather than blocking native dialogs.
- Existing commands, drafts, order, activation, history and Twitch sign-in are preserved.

## 0.4.2 - Included in 0.4.3

- Command authors and target-step participants are rendered as explicit @mentions, including random targets, manual targets and self-targeting. Localized display names use the account login for a valid mention.
- Existing templates such as `@{target}` do not produce doubled @ signs; intermediate text and random replies preserve mentions. `{login}` stays unprefixed for URLs and plain-text uses.
- Existing command definitions, drafts, history, activation and Twitch sign-in are unchanged.

## 0.4.1 - Included in 0.4.3

- Command selection works immediately after startup even when an unfinished draft was restored.
- Incomplete edits are kept per command when switching, including text and sidebar color. Switching never applies edits to live chat; Save and Discard affect only the selected command.
- Existing single-command drafts are retained, and all parked drafts survive restart and are included in backups. Commands, activation, ordering and Twitch sign-in remain unchanged.

## 0.4.0 - 2026-11-09

- Configurable per-viewer repeat protection: by default the third consecutive use of a command within 60 seconds warns, the next blocks commands for 90 seconds, and subsequent violations in the same stream block for 10 minutes. Twitch chat remains available. Penalties survive reconnects and app restarts; a confirmed new stream resets them.
- Different viewers no longer block each other by default. Existing personal cooldowns and saved shared cooldown values are preserved; shared cooldown enforcement is now opt-in under Protection.
- The bounded reply queue accepts bursts from multiple viewers, retains pending replies during a socket reconnect, and gives interactive replies precedence over waiting timers. Automatic duplicate suppression no longer silences manual information commands.
- Ordered text/reply selection by a number step, with editable source and an independent random mode. Existing choice lists following an `amount` step use ordered selection without replacing their text.
- Drag commands to reorder the sidebar, or use the editor arrow buttons. Each command can have its own full-height sidebar stripe, independent of Twitch announcement color.
- Russian, Ukrainian and English settings/help, isolated concurrency/spam/order tests, installer and portable builds. Existing commands, drafts, IDs, enabled states, history and Twitch sign-in are preserved.

## 0.3.1

- First public release: installer and portable ZIP, three languages and two themes.
- New profiles start with ten disabled example commands and a disabled command-list auto announcement.
- Timed announcements resolve `{commands}` to the enabled public command list; empty or oversized results are skipped.
- Existing profiles, command text, enabled states, history and Twitch authorization are preserved on update. Deleted examples never reappear automatically.
- Compatible with Launch Desk OBS 0.3.0 automatic discovery and normal/tray launch.

## 0.3.0 - 2026-11-08

- Clear template picker, three-stage visual builder and a large immediate command switch.
- One-random-reply mode (up to 100 variants), clickable variables and ten disabled examples covering all step types and information announcements.
- Twitch announcements and editable auto-announcement blocks: global and per-block time/message gates, live-only default, fair rotation, persistent duplicate protection and no catch-up after restart.
- New sign-in requests `moderator:manage:announcements`; existing ordinary commands remain available without reauthorizing.
- Viewport-clamped tooltips outside scroll containers; Russian, Ukrainian and English UI/docs and updated screenshots.
- Existing IDs, texts, enabled states, history, profile and sign-in preserved. Examples append disabled without replacing existing triggers.

## 0.2.1

- Added an explicit Windows taskbar pin button and live status in the standalone app settings, in RU/UK/EN. Windows asks for confirmation; unsupported systems show manual instructions.
- Kept installer identity, executable path and shortcut icon stable across updates. A shortcut belonging to another app copy is never silently redirected.
- Added isolated pinning tests for consent cancellation, duplicate clicks, shortcuts and trusted renderer access. OBS plugins and profiles are unchanged.

## 0.2.0 - 2026-10-22

- Random targets now come from Twitch Get Chatters, including silent connected users; the 15-minute and 30-message modes are removed.
- Refreshes approximately every 30 seconds with complete pagination, deduplication, expiry and no fallback to message history after errors.
- Added participant-list status and a one-time reauthorization notice for `moderator:read:chatters`. Existing chat permissions remain valid for commands without random targets.
- Existing command text, settings, activation and sign-in data are preserved. Legacy participant settings use the new source without rewriting saved commands.
- Updated Russian, Ukrainian and English UI/docs and regression coverage for actual SDK parameters, silent users, lost access, partial pages and late requests.

## 0.1.1 - 2026-10-21

- Explicit enabled/disabled labels and an active-command count, independent of Twitch connection status.
- History now explains why a known command was skipped: disabled, paused, permission or cooldown.
- Added regression coverage for saving activation, restart persistence and real Twitch SDK event/send adapters with mocked transport.
- Existing commands, settings and sign-in are preserved. No command is enabled automatically by the update.

## 0.1.0 - 2026-10-20

- First private desktop release, separate from the planned OBS plugin.
- Configurable command workflows, participant pools, random lists/numbers and editable reply templates.
- Broadcaster OAuth, EventSub chat, safe outbound queue, cooldowns, roles and duplicate protection.
- Russian/Ukrainian/English, light/dark themes, simulator and real interface screenshots.
- Persistent drafts, protected profile identity, backups and additive import/export.
- Windows x64 installer and portable ZIP sharing a stable per-user profile.
