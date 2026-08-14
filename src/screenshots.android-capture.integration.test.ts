/**
 * @file
 *
 * Produces the five mobile screenshots the community-store listing needs
 * (T461-P21), driving the demo vault's fixtures in Obsidian Mobile on a real
 * Android emulator and writing `images/screenshot-mobile-N.png`.
 *
 * The mobile counterpart of the desktop capture suite, showing the same five
 * capabilities. Every shot shows the plugin WORKING — there is deliberately no
 * "plugin disabled" before-shot, because a listing carousel shows these one at a
 * time with no caption. What differs from desktop is the frame — a phone shows the backlinks in a drawer over the note
 * rather than beside it, which is exactly why the mobile set is worth taking
 * rather than reusing the desktop images.
 *
 * There is no mobile equivalent of the desktop viewport override, so the capture
 * is always the device's own framebuffer. The fix is therefore to make the
 * DEVICE the right size: this runs on a dedicated `obsidian_screenshots` AVD
 * built at exactly 900x1600, so the frame already IS the store's size — no crop,
 * no rescale, no letterbox, no post-processing at all.
 *
 * Two alternatives were tried first. Both are dead ends, recorded so they are
 * not retried:
 *
 * - Compositing the shared `obsidian_test` AVD's 1344x2994 frame onto a 900x1600
 *   canvas (scaled to 718x1600 with blurred side margins). On-spec but ugly:
 *   about a third of the image is non-content, because Obsidian's mobile drawer
 *   covers only 84% of the width and the blurred margins eat another 20%.
 * - `adb shell wm size 900x1600` on the shared AVD. The display change is an
 *   Android configuration change that recreates the activity, destroying the
 *   WebView the Appium session is attached to; every later call dies with
 *   `no such window: target window already closed`.
 *
 * The screenshot AVD needs ONE-TIME provisioning and both steps are non-obvious
 * — see [[T461-P21]]. The harness never installs the Obsidian APK, and because
 * it launches emulators with `-no-snapshot-save`, an install performed under
 * that flag is silently discarded. Installing is also not sufficient on its own:
 * Obsidian's first-run onboarding has to be completed by hand once, or
 * `layoutReady` never becomes true and setup fails after the full timeout with
 * `Obsidian layout did not become ready`.
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
  backlink?: BacklinkPaneComponent;
}

/**
 * `App`, reduced to the font-size applier that `obsidian-typings` does not
 * declare. Setting `baseFontSize` alone changes nothing on screen.
 */
interface FontSizeApp {
  updateFontSize(this: void): void;
}

/**
 * `App`, reduced to the inline-title applier, likewise undeclared.
 */
interface InlineTitleApp {
  updateInlineTitleDisplay(this: void): void;
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

/**
 * The folder the `rootPaths` shot nominates as a root, so displayed paths drop
 * this prefix and read as `Team/Weekly/Meeting.md`.
 */
const SUBJECT_ROOT_PATH = 'Materials/01 Backlink full path';

/**
 * Base font size for the mobile shots, against Obsidian's 16px default.
 */
const MOBILE_FONT_SIZE_IN_PIXELS = 18;

/**
 * Extra notes staged for the screenshots ONLY, all named `Meeting` and all
 * linking to the subject note.
 *
 * The demo vault ships three, which is enough to make the point on a 3:2
 * desktop frame but leaves two thirds of a 9:20 phone frame empty. Seven fills
 * the column with clean path rows, and is a stronger demonstration besides —
 * the more notes share a name, the more obviously the path is what saves you.
 * The task file sanctions this directly: stage the vault content so the payoff
 * is visible in one frame.
 */
const STAGED_MEETING_FOLDERS = [
  'Projects/Gamma',
  'Projects/Delta',
  'Archive/2024',
  'Team/Weekly'
];

const IMAGES_DIRECTORY = join(process.cwd(), 'images');
const DEMO_VAULT_PATH = join(process.cwd(), 'demo-vault');

/**
 * Diagnostics from the setup closure, surfaced by the first test so a failed
 * mobile layout is readable instead of silent.
 */
let setupDiagnostics: unknown;

beforeAll(async () => {
  const vault = getTemporaryVault();

  // Only the `Materials/` fixtures — see the desktop suite for why the demo
  // Vault's own documentation notes are left out.
  const demoVaultFiles = buildDemoVaultPopulate({ demoVaultPath: DEMO_VAULT_PATH });
  const fixtures = Object.fromEntries(
    Object.entries(demoVaultFiles).filter(([path]) => path.startsWith('Materials/'))
  );

  vault.populate({ ...fixtures, ...buildStagedMeetingNotes() });
  await vault.syncToDevice();

  setupDiagnostics = await evalInObsidian({
    async callback({ app, fontSizeInPixels, lib: { waitUntil }, subjectNotePath }) {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 20_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;
      // Three from the demo vault plus the four staged above; waiting for the
      // Full set stops a shot being taken while the pane is still filling in.
      const BACKLINK_COUNT = 7;

      // A closure runs inside ONE Appium `execute/sync` call, which WebDriver
      // Caps around 30s — well below the harness's own timeouts. A longer wait
      // In here dies as an opaque `script timeout` rather than as a readable
      // Assertion failure, so keep every in-closure wait comfortably under it.
      const RENDER_TIMEOUT_IN_MILLISECONDS = 20_000;

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
        message: 'the Backlinks pane to list every Meeting note',
        predicate: () => document.querySelectorAll('.backlink-pane .tree-item-inner').length >= BACKLINK_COUNT,
        timeoutInMilliseconds: RENDER_TIMEOUT_IN_MILLISECONDS
      });

      // On a phone the backlinks live in a drawer that opens OVER the note, so
      // The drawer has to be expanded for the pane to be in frame at all.
      app.workspace.rightSplit.expand();

      // Slightly bigger type, because a 900x1600 listing image is read as a
      // THUMBNAIL. Not much bigger: the paths are long, and past ~18px the
      // Entry titles start wrapping mid-word, which reads as a rendering bug.
      app.vault.setConfig('baseFontSize', fontSizeInPixels);
      const fontApp: unknown = app;
      (fontApp as FontSizeApp).updateFontSize();

      // The note's own `# Shared topic` heading already titles it, so Obsidian's
      // Inline title renders the name twice. `updateOptions` does NOT pick this
      // Up — the setting is applied by toggling a class on `document.body`.
      app.vault.setConfig('showInlineTitle', false);
      (fontApp as InlineTitleApp).updateInlineTitleDisplay();

      // Context excerpts OFF, exactly as on desktop. Turning them on to fill a
      // Phone frame was tried and is much worse: the excerpts are the notes'
      // Raw markdown, so `[Shared topic](<../../Shared topic.md>)` in yellow
      // Highlight becomes the largest thing in the image. The frame is filled
      // Instead by staging MORE same-named notes — see the populate map above.
      const backlinkView: unknown = app.workspace.getLeavesOfType('backlink')[0]?.view;
      const backlinks = (backlinkView as BacklinkPaneView | null)?.backlink;
      backlinks?.setExtraContext(false);
      backlinks?.setCollapseAll(true);

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return {
        hasBacklinkComponent: Boolean(backlinks),
        paneItems: document.querySelectorAll('.backlink-pane .tree-item-inner').length
      };
    },
    input: { fontSizeInPixels: MOBILE_FONT_SIZE_IN_PIXELS, subjectNotePath: SUBJECT_NOTE_PATH },
    vaultPath: vaultPath()
  });
});

describe('mobile store screenshots', () => {
  it('renders the backlinks pane the shots are framed on', () => {
    // Surfaced as an assertion because vitest swallows console output from an
    // Integration worker, and a silently-wrong layout produces five bad images.
    expect(setupDiagnostics).toMatchObject({ hasBacklinkComponent: true });
  });

  it('1 - backlinks carry their full path, so seven notes called Meeting are told apart', async () => {
    await setSettings({ pathDepth: 0, shouldDisplayParentPathOnSeparateLine: false, shouldReversePathParts: false });
    await shoot(1);
  });

  it('2 - rootPaths shows each path relative to a folder you nominate', async () => {
    // Deliberately NOT a "plugin disabled" before-shot. A listing carousel shows
    // These one at a time with no caption, so an unlabelled before-shot reads as
    // "this plugin shows six identical Meeting rows" — the opposite of the
    // Message. Every shot in the set therefore shows the plugin WORKING.
    await setSettings({ pathDepth: 0, rootPaths: [SUBJECT_ROOT_PATH], shouldReversePathParts: false });
    await shoot(2);
    await setSettings({ rootPaths: [] });
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
 * Builds the staged `Meeting` notes described by {@link STAGED_MEETING_FOLDERS}.
 *
 * Each links to the subject note with a relative Markdown link, matching the
 * demo vault's own fixtures so every backlink entry looks the same.
 *
 * @returns A populate map of vault-relative paths to note content.
 */
function buildStagedMeetingNotes(): Record<string, string> {
  const notes: Record<string, string> = {};

  for (const folder of STAGED_MEETING_FOLDERS) {
    const depth = folder.split('/').length;
    const upwards = '../'.repeat(depth);
    notes[`Materials/01 Backlink full path/${folder}/Meeting.md`] = `# Meeting\n\nNotes from the ${folder} meeting. Related to `
      + `[Shared topic](<${upwards}Shared topic.md>).\n`;
  }

  return notes;
}

/**
 * Applies plugin settings and waits for the Backlinks pane to re-render.
 *
 * @param settings - The setting values to apply.
 */
async function setSettings(settings: Record<string, boolean | number | string[]>): Promise<void> {
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

  // The AVD is 900x1600, so the device frame IS the store's size — no crop, no
  // Rescale, no letterbox. Asserting it here is what keeps that true: run this
  // Against any other AVD and it fails loudly instead of quietly shipping an
  // Off-spec image.
  expect(readPngDimensions(captured)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), captured);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
