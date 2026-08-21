# Codex – Core Rules

You are working in a real production codebase.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## Global Language & Output Rules
- Always respond with Model:[current-model]
- Always respond in Simplified Chinese
- Be concise, technical, and precise
- No fluff, no praise, no motivational language
- Explain only what is necessary

---

## Core Behavior
- Prefer correctness over cleverness
- Prefer minimal, safe changes
- Never assume missing requirements
- If information is missing or uncertain, say so explicitly
- Never hide confusion — surface tradeoffs instead

---

## Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

---

## Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked
- No abstractions for single-use code
- No "flexibility" or "configurability" that wasn't requested
- No error handling for impossible scenarios
- If you write 200 lines and it could be 50, rewrite it

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

---

## Code Rules
- Do NOT change business logic unless explicitly asked
- Install or introduce dependencies when they are necessary to complete the requested feature; document the reason and keep additions minimal
- Do NOT refactor unrelated code
- Keep changes local, minimal, and reviewable
- Always follow the project's ESLint specifications

---

## Mobile Feedback Rules

- Route all application-owned mobile notifications, errors, confirmations, action choices, and text prompts through `apps/mobile/src/shared/feedback.ts`.
- Never import or call React Native `Alert`, `AlertButton`, `ToastAndroid`, or `ActionSheetIOS`, and never use browser `alert`, `confirm`, or `prompt` for application messages.
- Preserve existing button labels, cancel behavior, destructive intent, callbacks, and navigation effects when migrating feedback calls.
- Dedicated workflow dialogs that require custom content, such as update progress or permission instructions, must reuse `apps/mobile/src/shared/components/feedback-dialog.tsx` so their presentation remains consistent.
- Ordinary forms, pickers, menus, and media viewers may continue to use feature-owned `Modal` components when they are not notifications or confirmations.
- Before finishing a mobile change, scan the current source tree and confirm that no prohibited native feedback call was introduced.

---

## Directory Structure Rules

Keep the repository organized by deployable application and business capability. New files and moved files must follow the existing structure below.

### Repository Layout

```text
apps/
  mobile/                  Expo React Native application
  portal/                  Static product portal
packages/
  types/                   Cross-application data types
  tokens/                  Cross-application design tokens
docs/                      Current product documentation
openspec/                  Product change specifications
patches/                   pnpm dependency patches
scripts/                   Repository-level scripts
release/                   Release metadata
archive/                   Historical material only
```

- Put independently runnable or deployable products in `apps/`.
- Create a workspace package only when multiple applications consume it, or when it has independent build, test, and stable-contract value.
- Do not create workspace packages for small modules used only by mobile.
- Put repository-level scripts in `scripts/` and application-specific scripts in the application's `scripts/` directory.
- Never commit build output, caches, dependency directories, or local signing material as source.

### Mobile Layout

```text
apps/mobile/
  app/                     Expo Router entries and layouts
  assets/                  Static application assets
  modules/                 Local Expo native modules
  scripts/                 Mobile development and build scripts
  src/
    application/           Application composition, providers, global state entry
    features/              Business-capability implementations
    infrastructure/        Database, files, notifications, platform adapters
    shared/                Business-neutral code reused across features
    shims/                 Third-party compatibility layers
    types/                 Local declarations for missing third-party types
```

### Mobile Placement Rules

- Keep `apps/mobile/app/` as a thin routing layer. Ordinary route files should only export their feature screen; `_layout.tsx` may contain routing and provider composition, but no feature workflow.
- Put feature code in `src/features/<feature>/`. Co-locate screens, feature-specific components, state, domain rules, and adapters by business capability.
- Add subdirectories inside a feature only when file count and responsibilities justify them. Do not create a directory abstraction for one file.
- A feature must not import another feature's screen. Coordinate cross-feature workflows in `src/application/`.
- Put code in `src/shared/` only when at least two features use it and it has no clear business owner. `shared/` must not import `features/`, routes, or platform implementations.
- Keep database models, schema migrations, row mapping, repository contracts, and repository implementations separated under `src/infrastructure/database/`.
- Infrastructure code must not import screens or UI components. Put cross-layer contracts in `packages/types`, a feature domain type, or an infrastructure contract file.
- Keep only cross-feature state and lifecycle composition in `src/application/`. Feature-specific state must remain in its feature.
- Never create `apps/mobile/src/app/`; Expo Router treats it as the route root and it would shadow `apps/mobile/app/`.

Do not recreate these legacy technology-layer directories:

```text
apps/mobile/src/components/
apps/mobile/src/data/
apps/mobile/src/domain/
apps/mobile/src/state/
apps/mobile/src/theme/
apps/mobile/src/update/
```

After directory changes, verify at minimum:

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Also confirm that route entries remain thin, imports resolve, no legacy directory was reintroduced, and no empty directory or orphan workspace package remains.

---

## Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting
- Don't refactor things that aren't broken
- Match existing style, even if you'd do it differently
- If you notice unrelated dead code, mention it — don't delete it

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused
- Don't remove pre-existing dead code unless asked

The test: Every changed line should trace directly to the user's request.

---

## Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## File & Artifact Creation Rules
- Never create example files unless explicitly requested
- Never create test files unless explicitly requested
- Never create fix summaries, implementation summaries, or similar documentation files unless explicitly specified

---

## Terminal & Runtime Rules
- When using terminal tools, avoid restarting the project unless absolutely necessary
- Assume the project is designed to run continuously

---

## Reasoning Rules
- Give conclusions first, then reasoning
- Clearly separate confirmed facts from assumptions
- Never guess framework, library, or environment behavior
- If behavior is uncertain, suggest how to verify instead of guessing

---

## HTML & Markup Rules
- When writing special characters inside HTML tags, always use their corresponding HTML entity form

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

Follow these rules strictly unless explicitly overridden by the user.
