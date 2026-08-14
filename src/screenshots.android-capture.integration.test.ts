/**
 * @file
 *
 * Produces the five mobile screenshots the community-store listing needs
 * (T461-P21), driving the demo vault's fixtures in Obsidian Mobile on a real
 * Android emulator and writing `images/screenshot-mobile-N.png`.
 *
 * The mobile counterpart of the desktop capture suite, and the same storyboard:
 * the payoff, the problem it removes, and three alternative renderings. What
 * differs is the frame — a phone shows the backlinks in a drawer over the note
 * rather than beside it, which is exactly why the mobile set is worth taking
 * rather than reusing the desktop images.
 *
 * There is no mobile equivalent of the desktop viewport override, so the capture
 * is always the device's own framebuffer — 1344x2992 on the shared
 * `obsidian_test` AVD, roughly 9:20 against the store's 9:16. Rather than crop
 * away a fifth of the frame or stretch it, each shot is composed onto the
 * store's canvas by `fitScreenshotToCanvas`: scaled to 718x1600, centred, with
 * the 91px margins either side filled by a blurred copy of the same frame.
 *
 * Two alternatives were tried and rejected. A dedicated 900x1600 AVD reaches
 * Appium but Obsidian's layout never becomes ready on it. Resizing the shared
 * AVD with `adb shell wm size` is an Android configuration change that recreates
 * the activity, destroying the WebView the Appium session is attached to — every
 * later call dies with `no such window: target window already closed`.
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
  fitScreenshotToCanvas,
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
const WIDTH_IN_PIXELS = 900;
const HEIGHT_IN_PIXELS = 1600;

/**
 * The note every `Meeting` links to — the one whose Backlinks pane is the
 * demonstration.
 */
const SUBJECT_NOTE_PATH = 'Materials/01 Backlink full path/Shared topic.md';

const IMAGES_DIRECTORY = join(process.cwd(), 'images');
const DEMO_VAULT_PATH = join(process.cwd(), 'demo-vault');

beforeAll(async () => {
  const vault = getTemporaryVault();

  // Only the `Materials/` fixtures — see the desktop suite for why the demo
  // Vault's own documentation notes are left out.
  const demoVaultFiles = buildDemoVaultPopulate({ demoVaultPath: DEMO_VAULT_PATH });
  const fixtures = Object.fromEntries(
    Object.entries(demoVaultFiles).filter(([path]) => path.startsWith('Materials/'))
  );

  vault.populate(fixtures);
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, subjectNotePath }) {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 60_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;
      const BACKLINK_COUNT = 3;

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

      // On a phone the backlinks live in a drawer that opens OVER the note, so
      // The drawer has to be expanded for the pane to be in frame at all.
      app.workspace.rightSplit.expand();

      // Context excerpts turn every entry into a block of highlighted raw
      // Markdown, burying the path in the entry's title — and a phone frame has
      // Far less room to spare than the desktop one.
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

describe('mobile store screenshots', () => {
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
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      if (shouldEnable) {
        await app.plugins.enablePlugin(pluginId);
      } else {
        await app.plugins.disablePlugin(pluginId);
      }

      app.commands.executeCommandById('backlink:open');
      app.workspace.rightSplit.expand();
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
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      const plugin: unknown = app.plugins.getPlugin(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} is not loaded.`);
      }

      await (plugin as SettingsEditablePlugin).pluginSettingsComponent.editAndSave((current) => {
        Object.assign(current, values);
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { pluginId: PLUGIN_ID, settings },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the device screen, composes it onto the store's canvas, and writes it
 * as `images/screenshot-mobile-<index>.png`.
 *
 * The size is asserted on the COMPOSED image rather than the capture, because
 * the capture is whatever the AVD's screen happens to be — that is the whole
 * reason the composition step exists.
 *
 * @param index - The 1-based listing position.
 */
async function shoot(index: number): Promise<void> {
  const captured = await captureObsidianScreenshot({ vaultPath: vaultPath() });
  const fitted = await fitScreenshotToCanvas(captured, {
    canvasHeightInPixels: HEIGHT_IN_PIXELS,
    canvasWidthInPixels: WIDTH_IN_PIXELS
  });

  expect(readPngDimensions(fitted)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), fitted);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
