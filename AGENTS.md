# Command Desk

- Keep this repository and releases private until explicitly authorized.
- Independent desktop product; no runtime imports from other Desk repositories.
- Never commit OAuth, profiles, chat history, databases or personal diagnostic reports.
- Profile is always %APPDATA%\CommandDesk for installed and portable builds on a given Windows account.
- A future OBS plugin must have a separate repository, profile, application ID and installation.
- No automatic sending during tests. All tests use isolated profiles and mock Twitch.
- Preserve existing command data and identity on updates. Never replace a missing existing database with an empty one.
- Use literal UTF-8 copy. Only use p inside b-text and never add a class to p.
