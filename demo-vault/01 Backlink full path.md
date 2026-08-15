# Backlink full path

Open [Shared topic](<./Materials/01 Backlink full path/Shared topic.md>) and look at its **Backlinks** pane. Three different notes link to it, and all three are named `Meeting`:

- [Projects/Alpha/Meeting](<./Materials/01 Backlink full path/Projects/Alpha/Meeting.md>)
- [Projects/Beta/Meeting](<./Materials/01 Backlink full path/Projects/Beta/Meeting.md>)
- [Notes/Meeting](<./Materials/01 Backlink full path/Notes/Meeting.md>)

Without this plugin, the Backlinks pane lists three identical `Meeting` entries. With it enabled, each one shows its folder path (`Projects/Alpha`, `Projects/Beta`, `Notes`) so you know which is which.

By default Obsidian shows only the note name, which cannot tell three notes called `Meeting` apart:

![The Backlinks pane showing only note names](<./_assets/images/just-name.png>)

With the plugin, each backlink carries its full path:

![The Backlinks pane showing full paths](<./_assets/images/full-path.png>)

## Try it

```code-button
---
caption: Open "Shared topic" and show its Backlinks pane
---
await require('/demoSetup.ts').showBacklinks(app);
```

Manual equivalent: open [Shared topic](<./Materials/01 Backlink full path/Shared topic.md>), then run **Backlinks: Show backlinks** (or click the link icon in the right sidebar).

Each backlink carries its full path. To see what the pane looks like without the plugin - the first screenshot above, but live - turn it off and back on:

```code-button
---
caption: Turn the plugin off
---
await require('/demoSetup.ts').disablePlugin(app);
```

```code-button
---
caption: Turn the plugin back on
---
await require('/demoSetup.ts').enablePlugin(app);
```

Manual equivalent: toggle **Backlink Full Path** in **Settings -> Community plugins**.

Then head to [02 Settings](<./02 Settings.md>) and tweak how the path is rendered - depth, highlighting, extension, ordering, and more.
