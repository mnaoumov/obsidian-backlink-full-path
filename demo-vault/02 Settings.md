# Settings

Open **Settings -> Community plugins -> Backlink Full Path** to configure the pane. Each option below lists the setting key stored in the plugin's `data.json`.

## Which path to show

- `pathDepth`
  - how many parent folders to include (0 shows the whole path).
- `rootPaths`
  - folders to treat as roots; paths under them are shown relative to the root.
- `shouldReversePathParts`
  - render the path from the file outwards instead of from the root inwards.
- `shouldShowEllipsisForSkippedPathParts`
  - show an ellipsis where parts were trimmed by `pathDepth` or a root.

## How it looks

- `shouldHighlightFileName`
  - visually emphasize the file name within the full path.
- `shouldIncludeExtension`
  - keep the `.md` (or other) extension in the shown name.
- `shouldDisplayParentPathOnSeparateLine`
  - put the folder path on its own line above the file name.

Change any of these and watch the Backlinks pane of [Shared topic](<./Materials/01 Backlink full path/Shared topic.md>) update live.

## Try them without leaving this note

Put the pane on screen first, then press the buttons and watch it re-render. Every one of them applies live:

```code-button
---
caption: Open "Shared topic" and show its Backlinks pane
---
await require('/demoSetup.ts').showBacklinks(app);
```

```code-button
---
caption: Show only the immediate parent folder (pathDepth 1)
---
await require('/demoSetup.ts').changeSettings(app, { pathDepth: 1 });
```

Manual equivalent: set **Path depth** to `1`.

```code-button
---
caption: Treat `Materials/01 Backlink full path` as a root
---
await require('/demoSetup.ts').changeSettings(app, { pathDepth: 0, rootPaths: ['Materials/01 Backlink full path'] });
```

Manual equivalent: add that folder to **Root paths** (and set **Path depth** back to `0`).

```code-button
---
caption: Path on its own line, no extension
---
await require('/demoSetup.ts').changeSettings(app, { shouldDisplayParentPathOnSeparateLine: true, shouldIncludeExtension: false });
```

Manual equivalent: turn on **Should display parent path on separate line** and turn off **Should include extension**.

```code-button
---
caption: Read the path from the file outwards
---
await require('/demoSetup.ts').changeSettings(app, { shouldReversePathParts: true });
```

Manual equivalent: turn on **Should reverse path parts**.

```code-button
---
caption: Restore every default
---
await require('/demoSetup.ts').restoreDefaults(app);
```

Manual equivalent: set each option back to the value listed above.
