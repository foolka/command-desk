# Command Desk

[Русский](../README.md) · [Українська](README.uk.md)

Private release **0.2.0**. A local Windows Twitch command builder that replies as the broadcaster. No separate bot account, Streamer.bot or hosted backend is required.

![Command editor](screenshots/editor-light.png)

## Features

- Editable commands and aliases, including Cyrillic.
- Up to 12 ordered steps: participant selection, a random line, an integer, or intermediate text.
- Fully editable replies with named variables anywhere in the text; up to three messages per invocation.
- Random participants from Twitch's connected chat users, including silent users. Refreshed approximately every 30 seconds, independent of message history. Every unique eligible person has the same chance.
- An explicit username argument can replace a random target. Online presence is not verified.
- Roles, cooldowns, pause, bot exclusions, replay and self-reply protection.
- A local simulator that never posts to Twitch, persistent drafts, backups, additive import/export.
- Russian, Ukrainian and English; light and dark themes. Switching language leaves user-authored content unchanged.

![Dark theme](screenshots/editor-dark.png)
![Random response](screenshots/random-reply.png)

## Install

Download the EXE installer or portable ZIP from the private [Releases](https://github.com/foolka/command-desk/releases). Windows 10/11 x64.

The installer uses `%LOCALAPPDATA%\Programs\Command Desk`. Extract the portable ZIP and run `CommandDesk.exe` without installing. **Both builds use `%APPDATA%\CommandDesk` for the same Windows user**, not a database beside the executable. This avoids divergent profiles when folders or shortcuts change. Only one instance can run. To move to another computer, export your commands and sign in again.

Builds are currently unsigned. Check the release source and SHA-256; do not disable Windows security.

Open Connection → Sign in with Twitch → Open Twitch and authorize using the displayed code. Create a command, edit its steps, run a local test, then enable and save it. New commands start disabled. The window close button exits; the separate tray button hides it. `--start-tray` starts without showing the window.

After updating from 0.1.x, sign in with Twitch once more to grant `moderator:read:chatters`. Existing commands and text are preserved and use the new participant source without resaving. Until permission is granted, random targets are unavailable; explicit usernames and random text replies still work.

## Templates

Built-ins: `{user}`, `{login}`, `{channel}`, `{command}`, `{args}`, `{arg1}`. Each step defines another result, such as `{target}`, `{choice}` or `{amount}`. Results may be used by later steps and replies.

```text
{user} {action} {target} {amount} times!
```

Each reply line is a separate chat message, limited to 500 final characters. Unknown or forward-referenced variables prevent saving. Templates do not execute code. Missing-target and invalid-username replies are editable; leave them empty to stay silent.

## Data and Limits

Twitch permissions: `user:read:chat`, `user:write:chat`, `moderator:read:chatters`. Tokens are encrypted with Windows secure storage. There is no embedded client secret, analytics or developer upload.

The memory-only participant list comes from [Get Chatters](https://dev.twitch.tv/docs/api/reference#get-chatters), not chat messages. It includes connected chat users, not every video viewer, and Twitch reports joins/leaves with a delay. All pages must load before replacing the list. Failed requests or a snapshot older than 90 seconds suspend random targets and report the reason in the interface/history; there is no fallback to old messages. Known bots and configured exclusions are omitted, but bot detection is not infallible.

History retains 200 diagnostic/reply records and can be cleared. Bounded message IDs prevent reprocessing. The send queue holds 30 messages, expires at 20 seconds, and permits at most 20 sends per 30 seconds with 1.2-second spacing. Ambiguous network failures are never automatically resent. Shared-chat messages from other channels are ignored.

When Shared Chat is active, Twitch distributes replies from the streamer's account to all participating channels. User-token replies cannot be restricted to the source channel.

Twenty command/settings snapshots are retained in `backups`; credentials are excluded. Imports are additive and fully rejected on naming conflicts. An existing missing/corrupt/redirected database is never silently replaced. Uninstalling keeps the profile.

The future OBS plugin is a separate product with its own repository and profile, not part of this release.

## Build

Node.js 24.14.x, Windows x64, Inno Setup 6. Run `npm ci`, `npm run assets`, `npm test`, `npm run test:ui`, `npm run build`, then set `ISCC_EXE` and run `npm run installer`. Tests use isolated profiles and mock Twitch. Forks must register their own Public Twitch application and replace `twitch-client.json`; end users do not need developer registrations.

GPL-2.0-or-later. Authentication and some packaging tools adapted from Alert Desk, © FermionaPlay. This repository has no runtime or build dependency on sibling projects.
