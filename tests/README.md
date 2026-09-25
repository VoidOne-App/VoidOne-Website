# Website stability checks

These lightweight checks protect the live release integration, the command deck and the PWA shell
from regressions that static syntax checks alone cannot catch.

| Check | Guards |
| --- | --- |
| `release-api-contract.js` | The GitHub Releases client keeps its fallback and filtering behaviour. |
| `seo-contract.js` | Every page keeps language, description, viewport and title contracts. |
| `site-sync-contract.js` | Website wording stays aligned with the current VoidOne release pipeline. |
| `deck-contract.js` | Runtime wiring, accent decks, service worker, manifest, offline shell and datasets. |

Run them locally with `node tests/<file>` from the repository root. They have no dependencies and
are executed by Website CI on every push.
