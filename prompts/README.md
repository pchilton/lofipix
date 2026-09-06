# prompts/ — the task inbox

This folder holds development tasks for AI coding agents (Kilo Code in VS Code, Hermes agents). Write the spec once here, then tell any agent: **"implement `prompts/NNNN`"**.

## How it works

1. **Author**: copy `_template.md` to `NNNN-<slug>.md` using the next free number (zero-padded, 4 digits), fill it in.
2. **Assign**: give the agent the prompt number or path. The agent reads `AGENTS.md` first (repo rules), then the prompt file.
3. **Execute**: the agent treats the Definition of Done checkboxes as acceptance criteria and verifies them with real commands.
4. **Complete**: when done and verified, mark the task completed (see below) so it stays as history instead of looking like open work.

## Marking a task completed

Add a `**Status:** completed (YYYY-MM-DD)` under the title.
Rename the file from `NNNN-<slug>.md` to `NNNN-<slug>.done.md`

## Authoring rules

- **One task per file.** If a task has two independent deliverables, split it into two prompts.
- **Keep prompts lean.** Stable context (stack, conventions, architecture) belongs in `AGENTS.md` and `README.md` — reference those, don't restate them.
- **Be explicit about scope.** "Out of scope" bullets prevent agents from gold-plating.
- **Definition of Done must be checkable.** Prefer commands (`pnpm typecheck`, `pnpm test`, `docker compose build`) over vibes ("works correctly").
- **Dependencies**: if a task depends on an earlier prompt, say so in Context.

## Example

See `_template.md` for the format. A minimal real prompt:

```markdown
# Task: scaffold the web app

**Status:** open

## Context
- `web/` is planned but doesn't exist (see README directory table).

## Scope
- Create `web/` as a SolidJS + Vite app configured for static export.
- Out of scope: routing, styling beyond a placeholder page, deployment.

## Constraints
- Match AGENTS.md conventions; TypeScript only.

## Definition of Done
- [ ] `web/` builds with `npm run build` producing static output
- [ ] README directory table still accurate
```
