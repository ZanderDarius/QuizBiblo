# QuizBiblo Development and Deployment Workflow

This file contains mandatory project instructions for Codex and other coding
agents working in this repository.

## Production Site

- Public URL: https://quizbiblo.eveandk.chatgpt.site
- GitHub repository: https://github.com/ZanderDarius/QuizBiblo
- Sites project binding: `.openai/hosting.json`
- Production branch: `main`

The GitHub source is currently a Node-served static application built from
`index.html`, `styles.css`, `script.js`, and `server.js`. Preserve that
architecture unless the user explicitly requests a migration.

The `project_id` in `.openai/hosting.json` identifies the existing ChatGPT
Sites project. Reuse it. Never create a replacement site while that value is
present.

## Definition of Done

A deployable code, UI, server, database, build, configuration, or asset change
is not complete merely because it works locally or has been pushed to GitHub.
It is complete only after all of the following are true:

1. The requested change is implemented locally.
2. Relevant validation and the production build have passed, or any known
   environment-only validation limitation has been clearly identified.
3. The exact source has been committed.
4. The commit has been pushed to the GitHub `main` branch.
5. The same commit has been pushed to the Sites source repository.
6. A new Sites version has been saved from the full 40-character commit SHA.
7. That saved version has been deployed to production.
8. Deployment status has reached `succeeded`, not merely `pending`, `building`,
   or `publishing`.
9. The production URL has been refreshed and the requested change has been
   visually or behaviorally verified on the live site.

Documentation-only changes, including changes to this file, should be pushed
to GitHub but do not require a Sites deployment unless they affect the built
site or the user explicitly requests one.

## Required Workflow

### 1. Inspect Before Editing

- Read `.openai/hosting.json` and preserve its existing `project_id`.
- Run `git status` before editing.
- Preserve unrelated user changes and do not stage them.
- Confirm that `origin` points to the GitHub repository, not the Sites source
  repository and not a URL containing a credential.
- Never store a Sites token in Git configuration, a remote URL, a file, a
  commit, terminal output intended for the user, or documentation.

### 2. Implement the Change

- Make the requested change using the existing project architecture and design
  language.
- For changes that need an obvious deployment check, update or add a visible
  version marker so the live revision can be identified unambiguously.
- Keep `.openai/hosting.json` limited to the Sites project ID and supported
  logical resource bindings.

### 3. Validate Locally

- Run the project's syntax validation:

```powershell
npm run check
```

- Start the local server with `npm start` when browser behavior needs testing.
- This project does not currently define an `npm run build` command. Do not
  invent one or use the temporary Vinext app's build instructions.
- Before a Sites deployment, use the current Sites tooling to produce and
  validate any required deployment output. If the hosting platform requires a
  build format the current static project does not provide, stop and adapt the
  project deliberately rather than silently deploying stale output.
- Fix syntax, packaging, or runtime failures before deployment. Do not describe
  a change as validated if the relevant check did not pass.

### 4. Commit and Push to GitHub

- Review the diff and stage only files belonging to the requested change.
- Commit the exact validated source with a descriptive message.
- Push the current `main` branch to
  `https://github.com/ZanderDarius/QuizBiblo.git`.
- Confirm the GitHub push succeeded before continuing.

### 5. Push the Same Commit to Sites

- Obtain a fresh, short-lived Sites source repository credential for the
  existing project when needed.
- Use the credential only for that command through an HTTP authorization
  header. Do not embed it in the remote URL or persist it in Git config.
- Push the exact current `HEAD` to the Sites source repository's `main` branch.
- Confirm the Sites source branch now points to the same full commit SHA that
  was pushed to GitHub.

GitHub and Sites are separate destinations. A successful GitHub push does not
deploy the website, and a successful Sites source push does not update GitHub.
Both are required for deployable changes.

### 6. Save and Deploy a Sites Version

- Save one Sites version using the full 40-character SHA of the pushed `HEAD`.
- Deploy that exact saved version to the existing public production site.
- Follow any approval requirements presented by the Sites tooling.
- Poll the deployment directly until it reports either `succeeded` or `failed`.
- If it fails, inspect the failure, fix the source, and repeat the workflow with
  a new commit and version. Never report a failed or non-terminal deployment as
  complete.

### 7. Refresh and Verify Production

- Open or reuse the production URL:
  https://quizbiblo.eveandk.chatgpt.site
- Refresh the page after deployment succeeds. Use a hard refresh when stale
  cached assets are possible.
- Verify the requested UI, text, version badge, or behavior on the hosted page,
  not a `file:///` URL and not only a local development server.
- If the embedded Codex browser cannot be controlled, use an available browser
  automation surface such as Google Chrome after the user grants control.
- If no controllable browser is available, do not claim visual verification.
  Ask the user to refresh and confirm the visible result, and keep the task
  explicitly pending verification.

## Final Report

The final response for a deployable change must state:

- what changed;
- that GitHub was updated;
- that the Sites deployment reached `succeeded`;
- the production URL; and
- exactly what was observed during the live-site verification.

Do not call the work complete while deployment is still processing or before
the live result has been checked.
