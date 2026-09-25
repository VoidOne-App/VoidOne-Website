Release integration stability checks are executed by Website CI.

The command deck adds two more guarantees that are checked the same way:

- Every page loads the shared runtime (`js/core/env.js`, `js/core/site.js`, `js/core/hud.js`) exactly
  once, so preferences and the HUD behave identically across languages and directories.
- Live GitHub telemetry must fail honestly: cached snapshot when offline, `github unreachable` when
  nothing is cached, never an invented number.
