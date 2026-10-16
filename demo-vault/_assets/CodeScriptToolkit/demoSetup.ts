import type { App } from 'obsidian';

import { Notice } from 'obsidian';

// No library import on purpose: CodeScript Toolkit resolves only obsidian and its own bundled modules inside
// the vault, so these helpers talk to Obsidian's plugin manager directly.

const PLUGIN_ID = 'backlink-full-path';
const SHARED_TOPIC_PATH = 'Materials/01 Backlink full path/Shared topic.md';

interface DemoSettingsPatch {
  pathDepth?: number;
  rootPaths?: string[];
  shouldDisplayParentPathOnSeparateLine?: boolean;
  shouldHighlightFileName?: boolean;
  shouldIncludeExtension?: boolean;
  shouldReversePathParts?: boolean;
  shouldShowEllipsisForSkippedPathParts?: boolean;
}

interface PluginWithSettingsComponent {
  pluginSettingsComponent: {
    editAndSave(editor: (settings: DemoSettingsPatch) => void): Promise<void>;
  };
}

/**
 * Opens the note every `Meeting` links to and reveals the Backlinks pane next to it — the pane this
 * whole vault is about, and the one thing the reader has to have on screen before any setting below
 * means anything.
 *
 * Manual equivalent: open `Shared topic`, then run **Backlinks: Show backlinks** (or click the link
 * icon in the right sidebar).
 */
export async function showBacklinks(app: App): Promise<void> {
  const note = app.vault.getFileByPath(SHARED_TOPIC_PATH);
  if (!note) {
    new Notice('"Shared topic" is missing from Materials/.');
    return;
  }

  await app.workspace.getLeaf(false).openFile(note);
  app.commands.executeCommandById('backlink:open-backlinks');
}

/**
 * Applies a settings patch, live, through the plugin's own settings component. The Backlinks pane
 * re-renders as soon as it lands.
 *
 * Manual equivalent: change the same option in **Settings -> Community plugins -> `Backlink Full Path`**.
 */
export async function changeSettings(app: App, patch: DemoSettingsPatch): Promise<void> {
  const plugin = app.plugins.plugins[PLUGIN_ID] as unknown as PluginWithSettingsComponent | undefined;
  if (!plugin) {
    new Notice('Turn the plugin on first.');
    return;
  }

  await plugin.pluginSettingsComponent.editAndSave((settings) => {
    Object.assign(settings, patch);
  });
  new Notice('Applied. Look at the Backlinks pane.');
}

/**
 * Restores every setting this vault changes.
 *
 * Manual equivalent: reset the same options to the values listed in `02 Settings.md`.
 */
export async function restoreDefaults(app: App): Promise<void> {
  await changeSettings(app, {
    pathDepth: 0,
    rootPaths: [],
    shouldDisplayParentPathOnSeparateLine: false,
    shouldHighlightFileName: true,
    shouldIncludeExtension: true,
    shouldReversePathParts: false,
    shouldShowEllipsisForSkippedPathParts: true
  });
}

/**
 * Turns the plugin off, so the Backlinks pane falls back to Obsidian's three identical `Meeting`
 * entries — the before half of the two screenshots.
 *
 * Manual equivalent: toggle `Backlink Full Path` off in **Settings -> Community plugins**.
 */
export async function disablePlugin(app: App): Promise<void> {
  await app.plugins.disablePluginAndSave(PLUGIN_ID);
  new Notice('Plugin off — the three backlinks are now indistinguishable.');
}

/**
 * Turns the plugin back on.
 *
 * Manual equivalent: toggle `Backlink Full Path` back on in **Settings -> Community plugins**.
 */
export async function enablePlugin(app: App): Promise<void> {
  await app.plugins.enablePluginAndSave(PLUGIN_ID);
  new Notice('Plugin on — each backlink carries its folder path again.');
}
