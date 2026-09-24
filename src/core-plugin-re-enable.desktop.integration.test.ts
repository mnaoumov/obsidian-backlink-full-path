import type { BacklinkView } from '@obsidian-typings/obsidian-public-latest';
import type { App } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

/*
 * Guards how this plugin answers the core Backlinks plugin being disabled and enabled again. The pane patch
 * sits on the `ResultDom` prototype, which outlives the pane: a disable leaves it installed and an enable reuses
 * the same class. So an enable must install the patch only when it is not already installed - measured in a real
 * Obsidian, patching on every enable stacked one more wrapper per toggle - and must still install it when the
 * core plugin was disabled while this plugin loaded, because then there was no pane to patch until now.
 *
 * Each step is its own `evalInObsidian`, because the settle sleeps would otherwise share one per-eval budget.
 * The `ResultDom` prototype is kept on `window` between steps: while the core plugin is disabled there is no pane
 * to reach it through.
 */

const PLUGIN_ID = 'backlink-full-path';
const TARGET_PATH = 'core-plugin-re-enable-target.md';
const LINKER_FOLDER_PATH = 'core-plugin-re-enable-folder';
const LINKER_PATH = `${LINKER_FOLDER_PATH}/core-plugin-re-enable-linker.md`;
const SETTLE_IN_MS = 3000;
const SCENARIO_TIMEOUT_IN_MS = 120_000;

interface ResultDomPrototypeState {
  addResult?: unknown;
  readonly prototype: Record<string, unknown>;
}

type Step = 'disableCorePlugin' | 'enableCorePlugin' | 'readAddResult' | 'reloadPlugin' | 'renderTarget' | 'setUp';

interface StepResult {
  readonly isAddResultSameAsRecorded: boolean;
  readonly renderedCaptions: readonly string[];
}

async function runStep(step: Step): Promise<StepResult> {
  return await evalInObsidian({
    async callback({
      app,
      LINKER_FOLDER_PATH: linkerFolderPath,
      LINKER_PATH: linkerPath,
      PLUGIN_ID: pluginId,
      SETTLE_IN_MS: settleInMs,
      STEP: currentStep,
      TARGET_PATH: targetPath
    }): Promise<StepResult> {
      const stateKey = 'coreBacklinksReEnableResultDomPrototypeState';
      function readState(): ResultDomPrototypeState | undefined {
        return Reflect.get(window, stateKey) as ResultDomPrototypeState | undefined;
      }

      const corePlugin = app.internalPlugins.getPluginById('backlink');
      if (!corePlugin) {
        throw new Error('The core Backlinks plugin is missing.');
      }

      async function getBacklinkView(obsidianApp: App): Promise<BacklinkView | null> {
        const backlinkLeaf = obsidianApp.workspace.getLeavesOfType('backlink')[0];
        if (!backlinkLeaf) {
          return null;
        }
        await backlinkLeaf.loadIfDeferred();
        return backlinkLeaf.view as BacklinkView;
      }

      function readCurrentAddResult(): unknown {
        return readState()?.prototype['addResult'];
      }

      let renderedCaptions: string[] = [];

      switch (currentStep) {
        case 'disableCorePlugin': {
          // `true` is the `isEnabledByUser` argument the Core plugins settings toggle passes.
          corePlugin.disable(true);
          await sleep(settleInMs);
          break;
        }
        case 'enableCorePlugin': {
          await corePlugin.enable(true);
          await sleep(settleInMs);
          break;
        }
        case 'readAddResult': {
          break;
        }
        case 'reloadPlugin': {
          await app.plugins.disablePlugin(pluginId);
          await app.plugins.enablePlugin(pluginId);
          await sleep(settleInMs);
          break;
        }
        case 'renderTarget': {
          const targetFile = app.vault.getFileByPath(targetPath);
          if (!targetFile) {
            throw new Error('The target note is missing.');
          }
          await app.workspace.getLeaf(false).openFile(targetFile);
          corePlugin.instance.openBacklinksForActiveFile(true);
          await sleep(settleInMs);
          const backlinkView = await getBacklinkView(app);
          renderedCaptions = [...backlinkView?.backlink.backlinkDom.resultDomLookup.values() ?? []].map((item) => item.el.querySelector('.tree-item-inner')?.textContent ?? '');
          break;
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
          corePlugin.instance.openBacklinksForActiveFile(true);
          await sleep(settleInMs);
          const backlinkView = await getBacklinkView(app);
          if (!backlinkView) {
            throw new Error('The backlinks pane did not open.');
          }
          const state: ResultDomPrototypeState = {
            prototype: Object.getPrototypeOf(backlinkView.backlink.backlinkDom) as Record<string, unknown>
          };
          Reflect.set(window, stateKey, state);
          break;
        }
        default: {
          break;
        }
      }

      const state = readState();
      const isAddResultSameAsRecorded = state?.addResult === readCurrentAddResult();
      if (state) {
        state.addResult = readCurrentAddResult();
      }

      return {
        isAddResultSameAsRecorded,
        renderedCaptions
      };
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

describe('core Backlinks plugin re-enable', () => {
  it('does not stack another patch on the result prototype on every enable', async () => {
    await runStep('setUp');

    await runStep('disableCorePlugin');
    const afterFirstToggle = await runStep('enableCorePlugin');
    await runStep('disableCorePlugin');
    const afterSecondToggle = await runStep('enableCorePlugin');

    expect(afterFirstToggle.isAddResultSameAsRecorded).toBe(true);
    expect(afterSecondToggle.isAddResultSameAsRecorded).toBe(true);
  }, SCENARIO_TIMEOUT_IN_MS);

  it('patches the pane when the core plugin is enabled after this plugin loaded without it', async () => {
    await runStep('setUp');

    await runStep('disableCorePlugin');
    const afterReloadWithoutCorePlugin = await runStep('reloadPlugin');
    const afterEnable = await runStep('enableCorePlugin');
    const rendered = await runStep('renderTarget');

    // Reloading unloads the patch, so the method changes back to the bare one.
    expect(afterReloadWithoutCorePlugin.isAddResultSameAsRecorded).toBe(false);
    expect(afterEnable.isAddResultSameAsRecorded).toBe(false);
    expect(rendered.renderedCaptions).toEqual([LINKER_PATH]);
  }, SCENARIO_TIMEOUT_IN_MS);
});
