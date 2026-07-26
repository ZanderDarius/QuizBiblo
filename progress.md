Original prompt: Increment the site version and follow the complete GitHub and ChatGPT Sites deployment workflow to verify it works.

## 2026-07-25

- Updated the visible build label from 0.1.1 to 0.1.2.
- Aligned the package version with the visible site version.
- `npm run check` passed.
- Playwright rendered the local site without a reported console failure.
- Visually confirmed `Build version: 0.1.2` in the local browser screenshot.
- TODO: Push the exact commit to GitHub and Sites, deploy it, and verify production.

## 2026-07-25 - Version 0.1.3

- Incremented the visible and package versions from 0.1.2 to 0.1.3.
- `npm run check` passed for version 0.1.3.
- Playwright rendered the local site without a reported console failure.
- Visually confirmed `Build version: 0.1.3` in the local browser screenshot.
- TODO: Push to GitHub and Sites, deploy, and verify production.
- Sites version 3 failed because the project had no `build` script.
- Added a Sites-compatible build that packages static assets and the room API worker.
- The first worker test exposed unreplaced repeated asset placeholders; updated the build to replace every occurrence.
- `npm run check` and `npm test` now pass, including the Sites worker lifecycle test.
- TODO: Create a new commit/version, redeploy, and verify production.
