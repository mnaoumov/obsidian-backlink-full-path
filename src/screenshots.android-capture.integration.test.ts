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
 * The image size is the DEVICE's, not a requested one: there is no mobile
 * equivalent of the desktop viewport override. So this runs on a dedicated
 * `obsidian_screenshots` AVD built at exactly 900x1600 (density 320, a phone
 * sized 450x800 dp), configured in `scripts/vitest-config.ts`, and captures its
 * framebuffer natively — no crop, no rescale. The shared `obsidian_test` AVD is
 * a Pixel 10 Pro XL at 1344x2992 (~9:20) and cannot produce the store's size.
 *
 * Resizing the shared AVD at runtime with `adb shell wm size` was tried first
 * and does NOT work: the display change is an Android configuration change that
 * recreates the activity, which destroys the WebView the Appium session is
 * attached to — every later call dies with `no such window: target window
 * already closed`. The device has to be the right size before the session is
 * established, which means a separate AVD.
 *
 * That AVD needs provisioning by hand ONCE; see [[T461-P21]] for the exact
 * steps. The harness never installs the Obsidian APK, and — because it launches
 * emulators with `-no-snapshot-save` — an install performed under that flag is
 * silently discarded.
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
 * Captures the device screen and writes it as
 * `images/screenshot-mobile-<index>.png`, failing if the AVD is not the
 * 900x1600 one the store listing expects.
 *
 * @param index - The 1-based listing position.
 */
async function shoot(index: number): Promise<void> {
  const bytes = await captureObsidianScreenshot({ vaultPath: vaultPath() });

  expect(readPngDimensions(bytes)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), bytes);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
