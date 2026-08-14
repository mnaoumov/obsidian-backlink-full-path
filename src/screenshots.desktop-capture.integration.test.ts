/**
 * @file
 *
 * Produces the five desktop screenshots the community-store listing needs
 * (T461-P21), driving the demo vault's fixtures in a real Obsidian and writing
 * `images/screenshot-desktop-N.png`.
 *
 * This is a capture script rather than an assertion suite: it runs in the
 * desktop integration project because that is where a real, plugin-enabled
 * Obsidian already exists. Committing it beside the plugin is what makes the set
 * reproducible — when a UI change dates a shot, re-running this regenerates it,
 * and the storyboard is reviewed in the same diff as the change that dated it.
 *
 * Each shot shows a DIFFERENT capability: the payoff, the problem it removes,
 * and three alternative renderings.
 *
 * There is deliberately NO settings-tab shot. Obsidian's settings modal attaches
 * itself through `activeWindow`/`activeDocument`, and under CDP evaluation
 * `activeWindow !== window`, so `app.setting.open()` builds the modal but never
 * lands it in the document being captured — in hidden AND visible mode alike.
 * The renderings below are the feature anyway, which is the only condition under
 * which a settings screenshot would have earned a slot.
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  buildDemoVaultPopulate,
  captureObsidianScreenshot,
  evalInObsidian,
  readPngDimensions
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

/**
 * The slice of Obsidian's backlink pane this storyboard drives.
 */
interface BacklinkPaneComponent {
  setCollapseAll(this: void, isCollapsed: boolean): void;
  setExtraContext(this: void, hasExtraContext: boolean): void;
}

/**
 * The backlink leaf's view, reduced to the component above.
 */
interface BacklinkPaneView {
  backlink: BacklinkPaneComponent;
}

/**
 * `App`, reduced to the inline-title toggle that `obsidian-typings` does not
 * declare.
 */
interface InlineTitleApp {
  updateInlineTitleDisplay(this: void): void;
}

/**
 * The desktop side dock, reduced to the resize call. `rightSplit` is typed as
 * the desktop side dock OR the mobile drawer, and only the side dock resizes.
 */
interface ResizableSideDock {
  setSize(this: void, size: number): void;
}

/**
 * The settings component's editor entry point.
 */
interface SettingsEditableComponent {
  editAndSave(this: void, settingsEditor: (settings: Record<string, unknown>) => void): Promise<void>;
}

/**
 * The plugin, reduced to the settings surface this storyboard edits.
 */
interface SettingsEditablePlugin {
  pluginSettingsComponent: SettingsEditableComponent;
}

const PLUGIN_ID = 'backlink-full-path';
const WIDTH_IN_PIXELS = 1200;
const HEIGHT_IN_PIXELS = 800;

/**
 * The note every `Meeting` links to — the one whose Backlinks pane is the
 * demonstration.
 */
const SUBJECT_NOTE_PATH = 'Materials/01 Backlink full path/Shared topic.md';

const IMAGES_DIRECTORY = join(process.cwd(), 'images');
const DEMO_VAULT_PATH = join(process.cwd(), 'demo-vault');

beforeAll(async () => {
  const vault = getTemporaryVault();

  // Only the `Materials/` fixtures — the three `Meeting` notes and the note they
  // All link to. The demo vault's own documentation notes (`00 Start`,
  // `01 Backlink full path`, `02 Settings`) ALSO link to the subject note, so
  // Shipping the whole vault floods the Backlinks pane with documentation and
  // Pushes the three `Meeting` notes — the entire demonstration — off the frame.
  const demoVaultFiles = buildDemoVaultPopulate({ demoVaultPath: DEMO_VAULT_PATH });
  const fixtures = Object.fromEntries(
    Object.entries(demoVaultFiles).filter(([path]) => path.startsWith('Materials/'))
  );

  vault.populate(fixtures);
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, subjectNotePath }) {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 30_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;
      const BACKLINK_COUNT = 3;
      const BACKLINKS_PANE_WIDTH_IN_PIXELS = 560;

      // The whole fleet is shot in the default DARK theme so the sets read as one
      // Series (`moonstone` is the light one). Spelled inline rather than passed
      // Via `input`, because `changeTheme` takes a literal union that a
      // Serialized string would widen away.
      app.changeTheme('obsidian');

      const backlinkPlugin = app.internalPlugins.getPluginById('backlink');
      await backlinkPlugin?.enable();

      await waitUntil({
        message: 'the subject note to appear in the vault',
        predicate: () => Boolean(app.vault.getFileByPath(subjectNotePath)),
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      const file = app.vault.getFileByPath(subjectNotePath);
      if (!file) {
        throw new Error(`The subject note is missing from the vault: ${subjectNotePath}`);
      }

      await app.workspace.getLeaf(false).openFile(file);
      app.commands.executeCommandById('backlink:open');

      await waitUntil({
        message: 'the Backlinks pane to list the three Meeting notes',
        predicate: () => document.querySelectorAll('.backlink-pane .tree-item-inner').length >= BACKLINK_COUNT,
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      // Frame the shot on the feature. The file explorer and a half-empty editor
      // Otherwise take most of a 1200x800 frame while the paths — the thing being
      // Sold — sit in a narrow strip on the right.
      app.workspace.leftSplit.collapse();
      const rightSplit: unknown = app.workspace.rightSplit;
      (rightSplit as ResizableSideDock).setSize(BACKLINKS_PANE_WIDTH_IN_PIXELS);

      // The note's own `# Shared topic` heading already titles it, so Obsidian's
      // Inline title renders the name twice.
      app.vault.setConfig('showInlineTitle', false);
      const inlineTitleApp: unknown = app;
      (inlineTitleApp as InlineTitleApp).updateInlineTitleDisplay();

      // Context excerpts turn every entry into a block of highlighted raw
      // Markdown, burying the path in the entry's title.
      const backlinkView: unknown = app.workspace.getLeavesOfType('backlink')[0]?.view;
      if (backlinkView) {
        (backlinkView as BacklinkPaneView).backlink.setExtraContext(false);
        (backlinkView as BacklinkPaneView).backlink.setCollapseAll(true);
      }

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { subjectNotePath: SUBJECT_NOTE_PATH },
    vaultPath: vaultPath()
  });
});

describe('desktop store screenshots', () => {
  it('1 - backlinks carry their full path, so three notes called Meeting are told apart', async () => {
    await setSettings({ pathDepth: 0, shouldDisplayParentPathOnSeparateLine: false, shouldReversePathParts: false });
    await shoot(1);
  });

  it('2 - without the plugin the same pane is three identical Meeting rows', async () => {
    await setPluginEnabled(false);
    await shoot(2);
    await setPluginEnabled(true);
  });

  it('3 - the folder path can sit on its own line above the file name', async () => {
    await setSettings({ shouldDisplayParentPathOnSeparateLine: true });
    await shoot(3);
  });

  it('4 - pathDepth trims deep paths to the folder that matters, with an ellipsis', async () => {
    // `partsToSkipCount = parentPathParts.length - pathDepth + 1`, so the depth
    // Counts the file name too: 2 keeps exactly one folder. Depth 1 keeps NONE,
    // Rendering three identical `.../Meeting.md` rows — the very confusion this
    // Plugin exists to remove, which is no way to sell it.
    await setSettings({ pathDepth: 2, shouldDisplayParentPathOnSeparateLine: false });
    await shoot(4);
  });

  it('5 - the path can read outwards from the file, for scanning by file name first', async () => {
    await setSettings({ pathDepth: 0, shouldReversePathParts: true });
    await shoot(5);
  });
});

/**
 * Enables or disables the plugin, so a shot can show the state its absence
 * leaves behind.
 *
 * @param isEnabled - Whether the plugin should be on.
 */
async function setPluginEnabled(isEnabled: boolean): Promise<void> {
  await evalInObsidian({
    async callback({ app, isEnabled: shouldEnable, pluginId }) {
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      if (shouldEnable) {
        await app.plugins.enablePlugin(pluginId);
      } else {
        await app.plugins.disablePlugin(pluginId);
      }

      // The pane only re-renders on the next recompute, so nudge it.
      app.commands.executeCommandById('backlink:open');
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { isEnabled, pluginId: PLUGIN_ID },
    vaultPath: vaultPath()
  });
}

/**
 * Applies plugin settings and waits for the Backlinks pane to re-render.
 *
 * @param settings - The setting values to apply.
 */
async function setSettings(settings: Record<string, boolean | number>): Promise<void> {
  await evalInObsidian({
    async callback({ app, pluginId, settings: values }) {
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      const plugin: unknown = app.plugins.getPlugin(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} is not loaded.`);
      }

      await (plugin as SettingsEditablePlugin).pluginSettingsComponent.editAndSave((current) => {
        Object.assign(current, values);
      });

      // `saveSettings` triggers the pane refresh; give it a frame to land.
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { pluginId: PLUGIN_ID, settings },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the current Obsidian window and writes it as
 * `images/screenshot-desktop-<index>.png`, failing if it does not come back at
 * exactly the size the store listing expects.
 *
 * @param index - The 1-based listing position.
 */
async function shoot(index: number): Promise<void> {
  const bytes = await captureObsidianScreenshot({
    heightInPixels: HEIGHT_IN_PIXELS,
    vaultPath: vaultPath(),
    widthInPixels: WIDTH_IN_PIXELS
  });

  expect(readPngDimensions(bytes)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-desktop-${String(index)}.png`), bytes);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
