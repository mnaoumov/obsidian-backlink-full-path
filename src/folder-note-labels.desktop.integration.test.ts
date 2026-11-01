import type { BacklinkView } from '@obsidian-typings/obsidian-public-latest';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

/*
 * Guards the folder-note labels in a real Obsidian: in a vault where every note is `index`, the title property and the
 * folder name are what tell the backlinks apart. Reads the title through the real metadata cache, which the unit tests
 * can only stub.
 */

const PLUGIN_ID = 'backlink-full-path';
const TARGET_PATH = 'folder-note-labels-target.md';
const FOLDER_PATH = 'folder-note-labels';
const TITLED_PATH = `${FOLDER_PATH}/alpha/index.md`;
const UNTITLED_PATH = `${FOLDER_PATH}/beta/index.md`;
const SETTLE_IN_MS = 3000;
const SCENARIO_TIMEOUT_IN_MS = 120_000;

interface Label {
  readonly fileName: string;
  readonly parentPath: string;
}

interface SettingsEditableComponent {
  readonly editAndSave: (this: void, settingsEditor: (settings: Record<string, unknown>) => void) => Promise<void>;
}

interface SettingsEditablePlugin {
  readonly pluginSettingsComponent: SettingsEditableComponent;
}

interface SettingsPatch {
  readonly folderNoteFileNames: string[];
  readonly titlePropertyName: string;
}

async function readLabels(patch: SettingsPatch): Promise<readonly Label[]> {
  return await evalInObsidian({
    async callback({
      app,
      FOLDER_PATH: folderPath,
      PATCH: settingsPatch,
      PLUGIN_ID: pluginId,
      SETTLE_IN_MS: settleInMs,
      TARGET_PATH: targetPath,
      TITLED_PATH: titledPath,
      UNTITLED_PATH: untitledPath
    }): Promise<readonly Label[]> {
      const targetFile = app.vault.getFileByPath(targetPath) ?? await app.vault.create(targetPath, '');
      for (const path of [`${folderPath}/alpha`, `${folderPath}/beta`]) {
        if (!app.vault.getFolderByPath(path)) {
          await app.vault.createFolder(path);
        }
      }
      if (!app.vault.getFileByPath(titledPath)) {
        await app.vault.create(titledPath, `---\ntitle: Alpha project\n---\n[[${targetFile.basename}]]\n`);
      }
      if (!app.vault.getFileByPath(untitledPath)) {
        await app.vault.create(untitledPath, `[[${targetFile.basename}]]\n`);
      }

      const loadedPlugin: unknown = app.plugins.getPlugin(pluginId);
      if (!loadedPlugin) {
        throw new Error(`Plugin ${pluginId} is not loaded.`);
      }
      const plugin = loadedPlugin as SettingsEditablePlugin;
      await plugin.pluginSettingsComponent.editAndSave((settings) => {
        Object.assign(settings, settingsPatch);
      });

      await app.workspace.getLeaf(false).openFile(targetFile);
      if (app.workspace.getLeavesOfType('backlink').length === 0) {
        await app.workspace.getRightLeaf(false)?.setViewState({ active: true, type: 'backlink' });
      }
      await sleep(settleInMs);

      const backlinkLeaf = app.workspace.getLeavesOfType('backlink')[0];
      if (!backlinkLeaf) {
        throw new Error('The backlinks pane did not open.');
      }
      await backlinkLeaf.loadIfDeferred();
      const items = [...(backlinkLeaf.view as BacklinkView).backlink.backlinkDom.resultDomLookup.values()];
      const labels = items.map((item) => {
        const shadowRoot = item.el.querySelector('.backlink-full-path')?.shadowRoot;
        return {
          fileName: shadowRoot?.querySelector('[part="file-name"]')?.textContent ?? '',
          parentPath: shadowRoot?.querySelector('[part="parent-path"]')?.textContent ?? ''
        };
      });

      await plugin.pluginSettingsComponent.editAndSave((settings) => {
        Object.assign(settings, { folderNoteFileNames: [], titlePropertyName: '' });
      });

      return labels.sort((a, b) => a.fileName.localeCompare(b.fileName));
    },
    input: {
      FOLDER_PATH,
      PATCH: patch,
      PLUGIN_ID,
      SETTLE_IN_MS,
      TARGET_PATH,
      TITLED_PATH,
      UNTITLED_PATH
    },
    vaultPath: getTemporaryVault().path
  });
}

describe('folder-note labels', () => {
  it('shows the file name by default', async () => {
    const labels = await readLabels({ folderNoteFileNames: [], titlePropertyName: '' });

    expect(labels.map((label) => label.fileName)).toEqual(['index.md', 'index.md']);
  }, SCENARIO_TIMEOUT_IN_MS);

  it('shows the title property, else the folder name', async () => {
    const labels = await readLabels({ folderNoteFileNames: ['index'], titlePropertyName: 'title' });

    expect(labels).toEqual([
      { fileName: 'Alpha project', parentPath: `${FOLDER_PATH}/alpha/` },
      { fileName: 'beta', parentPath: `${FOLDER_PATH}/` }
    ]);
  }, SCENARIO_TIMEOUT_IN_MS);
});
