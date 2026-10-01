# Obsidian Task Feature Library

Keep nested task lists in sync and make scheduled tasks easier to scan in
[Obsidian](https://obsidian.md). This TypeScript plugin adds automatic parent
checkboxes and start-time highlighting, with an independent toggle for each
feature.

[![CI](https://github.com/philsyr/obsidian-task-feature-library/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/philsyr/obsidian-task-feature-library/actions/workflows/ci.yml)

[Install](#installation) · [Design](#design) · [Development](#development) ·
[Report an issue](https://github.com/philsyr/obsidian-task-feature-library/issues)

## Features

### Automatic parent checkboxes

Task hierarchy is derived from standard Markdown indentation. A checkbox task
becomes a parent when the checkbox tasks that follow it have a greater indent:

```md
- [ ] Prepare the release
  - [x] Verify the build
  - [ ] Write the changelog
```

Complete **Write the changelog**, and **Prepare the release** becomes `[x]`
automatically. Reopen either child, and its parent becomes `[ ]` again.

- The parent becomes `[x]` when all of its direct and nested child tasks are
  complete.
- Reopening any child changes its parent back to `[ ]`.
- Any number of nesting levels is supported.
- Tasks with the same indentation remain siblings.
- No custom checkbox appearance, commands, or HTML markers are added.

Standard Markdown `[ ]` and `[x]` states remain the source of truth. Legacy
markers created by version `0.1.0` are removed when a note is synchronized.

### Start-time highlighting

A task is recognized as a scheduled item when its text starts with a valid
24-hour time in `HH:MM` format:

```md
- [ ] 09:30 Team call
- [ ] 14:05 Doctor appointment
```

Only a single start time is supported. Time ranges such as `09:30-10:30` and
`09:30 - 10:30` are intentionally ignored. The plugin changes only the color
of the `HH:MM` token; it does not add row backgrounds, borders, stripes,
animations, or custom completion effects.

## Settings

Open **Settings → Task Feature Library**. Each feature has its own toggle:

- **Automatic parent checkboxes** controls parent-state synchronization.
- **Start-time highlighting** controls recognition and highlighting of
  `HH:MM` task prefixes.

Both features are enabled by default. Changes take effect without restarting
Obsidian.

## Design

The plugin separates Markdown parsing, feature behavior, and Obsidian lifecycle
management so the task rules can be tested independently of the app.

| Area                | Implementation                                                                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task hierarchy      | [`src/core/task-tree.ts`](src/core/task-tree.ts) builds a tree from indentation and derives parent completion from its leaf tasks. It skips frontmatter and fenced code examples.                                                                        |
| Focused edits       | The same core computes source ranges for checkbox changes, checks that edits are still valid, and applies them from the bottom up. Tests cover stale edits and preserved CRLF line endings.                                                              |
| Feature composition | [`TaskFeature`](src/features/feature.ts) defines editor extensions, Reading View decoration, and cleanup. A [shared registry](src/features/registry.ts) drives both feature lifecycle and settings.                                                      |
| App integration     | [`src/main.ts`](src/main.ts) activates features and refreshes views when settings change. [Parent synchronization](src/features/parent-tasks/feature.ts) uses editor transactions for open notes and vault processing for other modified Markdown files. |
| Time highlighting   | [`src/features/timed-tasks/`](src/features/timed-tasks/) shares parsing rules between CodeMirror decorations and Reading View processing. Cleanup restores the original text when the feature is disabled.                                               |

Task state stays in standard Markdown. Parent synchronization updates checkbox
characters in the note; time highlighting changes the rendered time token.
Obsidian's native checkbox styling is preserved.

## Installation

Requires **Obsidian 1.5.0 or later**, as declared in the plugin manifest.

### From a release

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest
   [GitHub release](https://github.com/philsyr/obsidian-task-feature-library/releases/latest).
2. Create this directory inside your vault:

   ```text
   <your-vault>/.obsidian/plugins/task-feature-library/
   ```

3. Place the three downloaded files in that directory.
4. Open **Settings → Community plugins** and enable **Task Feature Library**.

### From source

Use Node.js 20 to match the CI environment.

```bash
git clone https://github.com/philsyr/obsidian-task-feature-library.git
cd obsidian-task-feature-library
npm ci
npm run build
```

Copy the generated `main.js` together with `manifest.json` and `styles.css` to
the plugin directory shown above, then reload Obsidian.

## Development

```bash
npm ci
npm run dev
```

`npm run dev` rebuilds `main.js` when source files change. Load the generated
plugin in an Obsidian vault to try changes in the app.

Run the same checks as [CI](.github/workflows/ci.yml):

```bash
npm run format:check
npm test
npm run build
```

The build runs TypeScript checking before bundling with esbuild. To check types
on their own, run `npm run typecheck`.

The [Vitest suite](tests/) covers task-tree parsing and updates, legacy-marker
migration, valid and invalid time prefixes, feature composition, Reading View
decoration and cleanup with jsdom, and CSS behavior. These are automated checks;
changes to editor interaction should also be tried in Obsidian.

To add a feature, implement `TaskFeature`, register it in
`src/features/registry.ts`, and add tests for its rules and cleanup behavior.
For bug reports, include the Obsidian and plugin versions, a minimal Markdown
example, and whether the issue happens in the editor or Reading View.

## License

[MIT](LICENSE)
