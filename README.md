# Obsidian Task Feature Library

A modular [Obsidian](https://obsidian.md) plugin that adds independently
toggleable task enhancements while preserving Obsidian's native task styling.

## Features

### Automatic parent checkboxes

Task hierarchy is derived from standard Markdown indentation. A checkbox task
becomes a parent when the checkbox tasks that follow it have a greater indent:

```md
- [ ] Prepare the release
  - [x] Verify the build
  - [ ] Write the changelog
```

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

## Installation

### From a release

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest
   GitHub release.
2. Create this directory inside your vault:

   ```text
   <your-vault>/.obsidian/plugins/task-feature-library/
   ```

3. Place the three downloaded files in that directory.
4. Open **Settings → Community plugins** and enable **Task Feature Library**.

### From source

Node.js 20 or later is recommended.

```bash
git clone https://github.com/philsyr/obsidian-task-feature-library.git
cd obsidian-task-feature-library
npm install
npm run build
```

Copy the generated `main.js` together with `manifest.json` and `styles.css` to
the plugin directory shown above, then reload Obsidian.

## Development

```bash
npm install
npm run dev
```

Available checks:

```bash
npm run format:check
npm run typecheck
npm test
npm run build
```

Each feature implements the `TaskFeature` interface and provides its editor
extensions, Reading View processing, and cleanup behavior. Feature metadata
and factories live in `src/features/registry.ts`; the settings screen is built
from the same registry.

Contributions and bug reports are welcome.

## License

[MIT](LICENSE)
