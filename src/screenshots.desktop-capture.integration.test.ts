/**
 * @file
 *
 * Produces the five desktop screenshots the community-store listing needs,
 * driving the demo vault's fixtures in a real Obsidian and writing
 * `images/screenshots/screenshot-desktop-N.png`.
 *
 * This is a capture script rather than an assertion suite: it runs in the
 * desktop integration project because that is where a real, plugin-enabled
 * Obsidian already exists. Committing it beside the plugin is what makes the set
 * reproducible — when a UI change dates a shot, re-running this regenerates it,
 * and the storyboard is reviewed in the same diff as the change that dated it.
 *
 * Each shot shows a DIFFERENT capability, and each is CAPTIONED by
 * `labelScreenshot` after capture. The caption is what makes shot 2 — the pane
 * without the plugin — safe to include: a listing carousel shows screenshots one
 * at a time, so an unlabelled before-shot reads as a picture of what the plugin
 * DOES rather than of what it fixes. It was dropped for exactly that reason
 * before captions existed.
 *
 * There is no settings-tab shot, and the reason is editorial rather than
 * technical: the listing has five slots, and settings earn one only where the
 * settings themselves are the feature. The five below are five distinct
 * capabilities, and the renderings are the feature.
 *
 * A settings shot IS obtainable, and an earlier version of this note said the
 * opposite: `app.setting.open()` renders nothing on its own, which was read as
 * proof the modal could not be opened at all. The observation was right and the
 * conclusion was not — and neither was the cause this note then gave, which
 * blamed a `containerEl` that `open()` never attaches. The real mechanism is
 * the settings POPOUT: `app.setting` is popout-capable, Obsidian ships the
 * vault config key `settingsPopoutWindow` as `true`, and on desktop `open()`
 * therefore builds the modal in a SECOND Electron window — leaving the driven
 * document with nothing while returning without throwing. Turn that key off and
 * `open()` attaches `containerEl` to the driven document itself.
 *
 * Nothing in this repo has to turn it off. Every vault the harness's global
 * setup provisions — the one `getTemporaryVault()` hands these suites — already
 * carries `settingsPopoutWindow: false`, which is why the bare
 * `openObsidianSettingsTab({ tabId })` call in
 * `plugin.desktop.integration.test.ts` reads real setting rows back with no
 * setup of its own. That helper is the recipe, described in
 * obsidian-integration-testing's AGENTS.md; reach for it rather than reviving
 * the note.
 *
 * The pre-attach the helper still does — appending `containerEl` to
 * `document.body` before `open()`, never after — is a FLOOR rather than the
 * fix. It matters only for a vault that does not carry that default, and it
 * would not be enough for a shot anyway: it keeps `containerEl` reachable as an
 * object, while a capture frames THIS window and a popout leaves this window
 * empty. Only the vault-level default makes a settings shot possible.
 *
 * All of this is specific to the SETTINGS modal, because `settingsPopoutWindow`
 * is a settings-only key and `app.setting` is the only thing that consults it.
 * Ordinary modals open in the driven document either way — `new Modal(app)`
 * followed by `open()` attaches and renders — so a plugin whose feature IS a
 * modal needs none of it.
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
  labelScreenshot,
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
  backlinkDom: BacklinkResultDom;
  setCollapseAll: (this: void, isCollapsed: boolean) => void;
  setExtraContext: (this: void, hasExtraContext: boolean) => void;
  setSortOrder: (this: void, sortOrder: string) => void;
}

/**
 * The backlink leaf's view, reduced to the component above.
 */
interface BacklinkPaneView {
  backlink: BacklinkPaneComponent;
}

/**
 * The pane's linked-mentions result list, reduced to the lookup of files it
 * currently lists.
 */
interface BacklinkResultDom {
  resultDomLookup: Map<BacklinkResultFile, unknown>;
}

/**
 * A file keyed in the pane's result lookup, reduced to its path.
 */
interface BacklinkResultFile {
  path: string;
}

/**
 * `App`, reduced to the inline-title toggle that `obsidian-typings` does not
 * declare.
 */
interface InlineTitleApp {
  updateInlineTitleDisplay: (this: void) => void;
}

/**
 * The desktop side dock, reduced to the resize call. `rightSplit` is typed as
 * the desktop side dock OR the mobile drawer, and only the side dock resizes.
 */
interface ResizableSideDock {
  setSize: (this: void, size: number) => void;
}

/**
 * The settings component's editor entry point.
 */
interface SettingsEditableComponent {
  editAndSave: (this: void, settingsEditor: (settings: Record<string, unknown>) => void) => Promise<void>;
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

/**
 * The folder the `rootPaths` shot nominates as a root, so displayed paths drop
 * this prefix and read as `Team/Weekly/Meeting.md`.
 */
const SUBJECT_ROOT_PATH = 'Materials/01 Backlink full path';

/**
 * Extra notes staged for the screenshots ONLY, all named `Meeting` and all
 * linking to the subject note.
 *
 * The demo vault ships three. Seven fills the pane and is a stronger
 * demonstration besides — the more notes share a name, the more obviously the
 * path is what saves you. The task file sanctions this directly: stage the
 * vault content so the payoff is visible in one frame. Kept identical to the
 * mobile suite so the two sets show the same vault.
 */
const STAGED_MEETING_FOLDERS = [
  'Projects/Gamma',
  'Projects/Delta',
  'Archive/2024',
  'Team/Weekly'
];

/**
 * The linked mentions the Backlinks pane lists: three from the demo vault plus
 * the staged ones above.
 */
const BACKLINK_COUNT = 3 + STAGED_MEETING_FOLDERS.length;

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');
const DEMO_VAULT_PATH = join(process.cwd(), 'demo-vault');

beforeAll(async () => {
  const vault = getTemporaryVault();

  // Only the `Materials/` fixtures — the three `Meeting` notes and the note they
  // all link to. The demo vault's own documentation notes (`00 Start`,
  // `01 Backlink full path`, `02 Settings`) ALSO link to the subject note, so
  // shipping the whole vault floods the Backlinks pane with documentation and
  // pushes the three `Meeting` notes — the entire demonstration — off the frame.
  const demoVaultFiles = buildDemoVaultPopulate({ demoVaultPath: DEMO_VAULT_PATH });
  const fixtures = Object.fromEntries(
    Object.entries(demoVaultFiles).filter(([path]) => path.startsWith('Materials/'))
  );

  vault.populate({ ...fixtures, ...buildStagedMeetingNotes() });
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, backlinkCount, lib: { waitUntil }, subjectNotePath }) {
      /*
       * Under the transport's ~30s per-closure cap, not at it. At 30_000 this ceiling was unreachable: the
       * whole eval is killed at the cap first, and reported as a bare transport timeout naming the harness
       * rather than the wait that overran — and the settle below shares the same budget, so the closure was
       * already over it before the wait began. What is waited on here lands in well under a second.
       */
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 12_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;
      const BACKLINKS_PANE_WIDTH_IN_PIXELS = 560;

      // The author's plugins are all shot in the default DARK theme so the sets read as one
      // series (`moonstone` is the light one). Spelled inline rather than passed
      // via `input`, because `changeTheme` takes a literal union that a
      // serialized string would widen away.
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
        predicate: () => document.querySelectorAll('.backlink-pane .tree-item-inner').length >= backlinkCount,
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      // Frame the shot on the feature. The file explorer and a half-empty editor
      // otherwise take most of a 1200x800 frame while the paths — the thing being
      // sold — sit in a narrow strip on the right.
      app.workspace.leftSplit.collapse();
      const rightSplit: unknown = app.workspace.rightSplit;
      (rightSplit as ResizableSideDock).setSize(BACKLINKS_PANE_WIDTH_IN_PIXELS);

      // The note's own `# Shared topic` heading already titles it, so Obsidian's
      // inline title renders the name twice.
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
    input: { backlinkCount: BACKLINK_COUNT, subjectNotePath: SUBJECT_NOTE_PATH },
    vaultPath: vaultPath()
  });

  // Every row is a `Meeting.md`, and the pane's default sort compares basenames only, so it ties on all of
  // them. A tie keeps insertion order, and the backlink search inserts in the order its async file reads
  // complete, which differs from run to run. Give each fixture a distinct, fixed mtime in path order and
  // sort old-to-new, so the rows read in path order every run.
  await evalInObsidian({
    async callback({ app, backlinkCount, lib: { waitUntil }, subjectNotePath, subjectRootPath }) {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 12_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;
      // 2024-01-01T00:00:00Z, one minute apart: fixed values, so nothing about the run leaks into the order.
      const BASE_MTIME = 1_704_067_200_000;
      const MTIME_STEP_IN_MILLISECONDS = 60_000;

      const fixtureFiles = app.vault.getMarkdownFiles()
        .filter((fixtureFile) => fixtureFile.path.startsWith(`${subjectRootPath}/`))
        .sort((a, b) => a.path.localeCompare(b.path));
      const expectedMtimes = new Map<string, number>();
      for (const [index, fixtureFile] of fixtureFiles.entries()) {
        const mtime = BASE_MTIME + index * MTIME_STEP_IN_MILLISECONDS;
        expectedMtimes.set(fixtureFile.path, mtime);
        await app.vault.modify(fixtureFile, await app.vault.read(fixtureFile), { mtime });
      }

      await waitUntil({
        message: 'every fixture note to carry its stamped mtime',
        predicate: () => fixtureFiles.every((fixtureFile) => fixtureFile.stat.mtime === expectedMtimes.get(fixtureFile.path)),
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      const backlinkView: unknown = app.workspace.getLeavesOfType('backlink')[0]?.view;
      const backlinks = (backlinkView as BacklinkPaneView).backlink;
      backlinks.setSortOrder('byModifiedTimeReverse');

      // Each `modify` re-indexes its note and the pane re-runs its search, dropping and re-adding rows as the
      // reads land. A fixed settle is not enough: the mobile suite shot one run of three with a row missing
      // in every frame. So wait until every linking note is back, both in the resolved links and in the
      // pane's linked-mentions lookup, before settling.
      await waitUntil({
        message: 'the Backlinks pane to list every Meeting note again after the mtime stamp',
        predicate: () => {
          const linkingPaths = fixtureFiles
            .filter((fixtureFile) => app.metadataCache.resolvedLinks[fixtureFile.path]?.[subjectNotePath] !== undefined)
            .map((fixtureFile) => fixtureFile.path);
          const listedPaths = new Set([...backlinks.backlinkDom.resultDomLookup.keys()].map((file) => file.path));
          return linkingPaths.length === backlinkCount && linkingPaths.every((path) => listedPaths.has(path));
        },
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { backlinkCount: BACKLINK_COUNT, subjectNotePath: SUBJECT_NOTE_PATH, subjectRootPath: SUBJECT_ROOT_PATH },
    vaultPath: vaultPath()
  });
});

describe('desktop store screenshots', () => {
  it('1 - every backlink carries its full path', async () => {
    await setSettings({ pathDepth: 0, rootPaths: [], shouldDisplayParentPathOnSeparateLine: false, shouldReversePathParts: false });
    await shoot(1, 'Every backlink shows its full folder path');
  });

  it('2 - the same pane without the plugin, for contrast', async () => {
    // A before-shot is only safe BECAUSE of the caption. A listing carousel
    // shows screenshots one at a time, so an unlabelled one reads as a picture
    // of what the plugin does, not of what it fixes.
    await setPluginEnabled(false);
    await shoot(2, 'Without the plugin: seven notes, all named Meeting');
    await setPluginEnabled(true);
  });

  it('3 - rootPaths shows each path relative to a folder you nominate', async () => {
    await setSettings({ pathDepth: 0, rootPaths: [SUBJECT_ROOT_PATH], shouldReversePathParts: false });
    await shoot(3, 'Show paths relative to a folder you choose');
    await setSettings({ rootPaths: [] });
  });

  it('4 - pathDepth trims deep paths to the folder that matters', async () => {
    // The depth counts the FILE NAME too, so 2 keeps exactly one folder. Depth 1
    // keeps none, rendering identical trimmed rows — the very confusion this
    // plugin exists to remove, which is no way to sell it.
    await setSettings({ pathDepth: 2, shouldDisplayParentPathOnSeparateLine: false });
    await shoot(4, 'Trim long paths to the folder that matters');
  });

  it('5 - the path can read outwards from the file', async () => {
    await setSettings({ pathDepth: 0, shouldReversePathParts: true });
    await shoot(5, 'Or read the path outwards, file name first');
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
    notes[`${SUBJECT_ROOT_PATH}/${folder}/Meeting.md`] = `# Meeting\n\nNotes from the ${folder} meeting. Related to `
      + `[Shared topic](<${upwards}Shared topic.md>).\n`;
  }

  return notes;
}

/**
 * Enables or disables the plugin, for the one shot that shows the state its
 * absence leaves behind.
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

      // Toggling the plugin closes the pane, so it has to be re-opened.
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
async function setSettings(settings: Record<string, boolean | number | string[]>): Promise<void> {
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
async function shoot(index: number, caption: string): Promise<void> {
  const bytes = await captureObsidianScreenshot({
    heightInPixels: HEIGHT_IN_PIXELS,
    vaultPath: vaultPath(),
    widthInPixels: WIDTH_IN_PIXELS
  });

  // Captioned AFTER capture, so the frame stays an untouched Obsidian window and
  // rewording a label needs no re-shoot. The band covers the status bar, which
  // is chrome rather than content.
  const labeled = await labelScreenshot(bytes, { text: caption });

  expect(readPngDimensions(labeled)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-desktop-${String(index)}.png`), labeled);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
