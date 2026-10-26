# Changelog

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
