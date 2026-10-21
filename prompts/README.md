# prompts/ — the task inbox

This folder holds development tasks for AI coding agents (Kilo Code in VS Code, Hermes agents). Write the spec once here, then tell any agent: **"implement `prompts/NNNN`"**.

## How it works

1. **Author**: copy `_template.md` to `NNNN-<slug>.md` using the next free number (zero-padded, 4 digits), fill in Context, Scope, Constraints and Definition of Done.
2. **Interview**: the agent reviews the requirements and interviews the author about them, checking for conflicting approaches and suggesting improvements. Agreed answers are written into the prompt's **Decisions (from interview)** section. If nothing needs clarifying, that section reads `No interview decisions required`. The agent does not implement anything during the interview.
3. **Assign**: once the interview is finished, the author says **"implement"** and gives the agent the prompt number or path. The agent reads `AGENTS.md` first (repo rules), then the prompt file, including its decisions.
4. **Execute**: the agent treats the Definition of Done checkboxes as acceptance criteria and verifies them with real commands.
5. **Complete**: when done and verified, mark the task completed (see below) so it stays as history instead of looking like open work.

## Marking a task completed

Add a `**Status:** completed (YYYY-MM-DD)` under the title.
Rename the file from `NNNN-<slug>.md` to `NNNN-<slug>.done.md`

## Authoring rules

- **One task per file.** If a task has two independent deliverables, split it into two prompts.
- **Keep prompts lean.** Stable context (stack, conventions, architecture) belongs in `AGENTS.md` and `README.md` — reference those, don't restate them.
- **Be explicit about scope.** "Out of scope" bullets prevent agents from gold-plating.
- **Definition of Done must be checkable.** Prefer commands (`bun run build`, `bun run typecheck`) over vibes ("works correctly").
- **Dependencies**: if a task depends on an earlier prompt, say so in Context.

## Example

See `_template.md` for the format. A minimal real prompt:

```markdown
# Task: scaffold the web app

**Status:** open

## Context
- `www/` is planned but doesn't exist (see README directory table).

## Interview

Interview me about the requirements in this file. Check for any conflicts in approaches, make suggestions for improvements. Iterate updates to this file during the interview process, and only when I say "implement" to implement the changes.

## Decisions (from interview)

No interview decisions required

## Scope
- Create `www/` as a SolidJS + Vite app configured for static export.
- Out of scope: routing, styling beyond a placeholder page, deployment.

## Constraints
- Match AGENTS.md conventions; TypeScript only.

## Definition of Done
- [ ] `www/` builds with `bun run build` producing static output
- [ ] README directory table still accurate
```
