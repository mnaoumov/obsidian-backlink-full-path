[Docs](https://github.com/mnaoumov/obsidian-backlink-full-path/)

# Settings

Open **Settings -> Community plugins -> Backlink Full Path** to configure the pane. Each option below lists the setting key stored in the plugin's `data.json`.

## Which path to show

- `pathDepth` - how many parent folders to include (0 shows the whole path).
- `rootPaths` - folders to treat as roots; paths under them are shown relative to the root.
- `shouldReversePathParts` - render the path from the file outwards instead of from the root inwards.
- `shouldShowEllipsisForSkippedPathParts` - show an ellipsis where parts were trimmed by `pathDepth` or a root.

## How it looks

- `shouldHighlightFileName` - visually emphasize the file name within the full path.
- `shouldIncludeExtension` - keep the `.md` (or other) extension in the shown name.
- `shouldDisplayParentPathOnSeparateLine` - put the folder path on its own line above the file name.

Change any of these and watch the Backlinks pane of [[Shared topic]] update live.
