import type {
  BacklinkView,
  ResultDomItem
} from '@obsidian-typings/obsidian-public-latest';
import type {
  MarkdownView,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

/*
 * Guards loading this plugin while the core Backlinks plugin is enabled but its pane is closed - an ordinary state,
 * since the pane is only a sidebar tab. The patch sits on a prototype this plugin can only reach through a backlinks
 * component on screen, so there is nothing to patch at load. Measured in a real Obsidian 1.14.2 before the fix:
 * reopening the pane rendered the plain note name, and nothing patched until a restart with the pane open.
 *
 * Each step is its own `evalInObsidian`, because the settle sleeps would otherwise share one per-eval budget. Every
 * case leaves the pane open again, since the suites share one vault and the next one expects it there.
 */

const PLUGIN_ID = 'backlink-full-path';
const TARGET_PATH = 'closed-backlinks-pane-target.md';
const LINKER_FOLDER_PATH = 'closed-backlinks-pane-folder';
const LINKER_PATH = `${LINKER_FOLDER_PATH}/closed-backlinks-pane-linker.md`;
const SETTLE_IN_MS = 3000;
const SCENARIO_TIMEOUT_IN_MS = 120_000;

type Step =
  | 'closePaneAndReloadPlugin'
  | 'disableBacklinksInDocument'
  | 'enableBacklinksInDocument'
  | 'openPane'
  | 'readInDocumentCaptions'
  | 'setUp';

async function runStep(step: Step): Promise<readonly string[]> {
  return await evalInObsidian({
    async callback({
      app,
      LINKER_FOLDER_PATH: linkerFolderPath,
      LINKER_PATH: linkerPath,
      PLUGIN_ID: pluginId,
      SETTLE_IN_MS: settleInMs,
      STEP: currentStep,
      TARGET_PATH: targetPath
    }): Promise<readonly string[]> {
      const corePlugin = app.internalPlugins.getPluginById('backlink');
      if (!corePlugin) {
        throw new Error('The core Backlinks plugin is missing.');
      }
      const backlinkPluginInstance = corePlugin.instance;

      function getTargetLeaf(): undefined | WorkspaceLeaf {
        return app.workspace.getLeavesOfType('markdown').find((leaf) => (leaf.view as MarkdownView).file?.path === targetPath);
      }

      function readCaptions(resultDomLookup: Map<TFile, ResultDomItem> | undefined): string[] {
        return [...resultDomLookup?.values() ?? []].map((item) => item.el.querySelector('.tree-item-inner')?.textContent ?? '');
      }

      /*
       * In-document backlinks are toggled per note view, for the active one - the command palette's
       * "Toggle backlinks in document" - not through the plugin options.
       */
      async function setBacklinksInDocument(isEnabled: boolean): Promise<void> {
        const targetLeaf = getTargetLeaf();
        if (!targetLeaf) {
          throw new Error('The target note is not open.');
        }
        const isShown = Boolean((targetLeaf.view as MarkdownView).backlinks);
        if (isShown === isEnabled) {
          return;
        }
        app.workspace.setActiveLeaf(targetLeaf, { focus: true });
        backlinkPluginInstance.toggleBacklinksInDocument(false);
        await sleep(settleInMs);
      }

      switch (currentStep) {
        case 'closePaneAndReloadPlugin': {
          for (const backlinkLeaf of app.workspace.getLeavesOfType('backlink')) {
            backlinkLeaf.detach();
          }
          await app.plugins.disablePlugin(pluginId);
          await app.plugins.enablePlugin(pluginId);
          await sleep(settleInMs);
          return [];
        }
        case 'disableBacklinksInDocument': {
          await setBacklinksInDocument(false);
          return [];
        }
        case 'enableBacklinksInDocument': {
          await setBacklinksInDocument(true);
          return [];
        }
        case 'openPane': {
          if (app.workspace.getLeavesOfType('backlink').length === 0) {
            await app.workspace.getRightLeaf(false)?.setViewState({ active: true, type: 'backlink' });
            await sleep(settleInMs);
          }
          const backlinkLeaf = app.workspace.getLeavesOfType('backlink')[0];
          if (!backlinkLeaf) {
            throw new Error('The backlinks pane did not open.');
          }
          await backlinkLeaf.loadIfDeferred();
          return readCaptions((backlinkLeaf.view as BacklinkView).backlink.backlinkDom.resultDomLookup);
        }
        case 'readInDocumentCaptions': {
          return readCaptions((getTargetLeaf()?.view as MarkdownView | undefined)?.backlinks?.backlinkDom.resultDomLookup);
        }
        case 'setUp': {
          const targetFile = app.vault.getFileByPath(targetPath) ?? await app.vault.create(targetPath, '');
          if (!app.vault.getFolderByPath(linkerFolderPath)) {
            await app.vault.createFolder(linkerFolderPath);
          }
          if (!app.vault.getFileByPath(linkerPath)) {
            await app.vault.create(linkerPath, `[[${targetFile.basename}]]`);
          }
          await app.workspace.getLeaf(false).openFile(targetFile);
          await sleep(settleInMs);
          return [];
        }
        default: {
          return [];
        }
      }
    },
    input: {
      LINKER_FOLDER_PATH,
      LINKER_PATH,
      PLUGIN_ID,
      SETTLE_IN_MS,
      STEP: step,
      TARGET_PATH
    },
    vaultPath: getTemporaryVault().path
  });
}

describe('loading with the backlinks pane closed', () => {
  afterEach(async () => {
    await runStep('openPane');
  }, SCENARIO_TIMEOUT_IN_MS);

  it('patches the pane when it is opened later', async () => {
    await runStep('setUp');
    await runStep('disableBacklinksInDocument');
    await runStep('closePaneAndReloadPlugin');

    const captions = await runStep('openPane');

    expect(captions).toEqual([LINKER_PATH]);
  }, SCENARIO_TIMEOUT_IN_MS);

  it('patches through the in-document backlinks when only those are on screen', async () => {
    await runStep('setUp');
    await runStep('enableBacklinksInDocument');
    try {
      await runStep('closePaneAndReloadPlugin');

      const captions = await runStep('readInDocumentCaptions');

      expect(captions).toEqual([LINKER_PATH]);
    } finally {
      await runStep('disableBacklinksInDocument');
    }
  }, SCENARIO_TIMEOUT_IN_MS);
});
