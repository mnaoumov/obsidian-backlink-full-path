import type { View } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

/*
 * Guards the scope of the caption rewrite. The patch sits on the prototype of Obsidian's `ResultDom`, which is one
 * class shared by the backlinks lists, core Search and embedded `query` blocks, so without a check of its own every
 * file caption in those was rewritten to the full-path form too. Only the backlinks lists may change.
 */

const FOLDER_PATH = 'other-result-lists-folder';
const HIT_BASENAME = 'other-result-lists-hit';
const HIT_PATH = `${FOLDER_PATH}/${HIT_BASENAME}.md`;
const HIT_CONTENT = 'quartz marmalade';
const QUERY_NOTE_PATH = 'other-result-lists-query.md';
/*
 * Matched by content, never by `path:` - a path match makes Obsidian itself print the path as the caption, with the
 * matched part highlighted, which reads exactly like the rewrite. The regex keeps the query block's own note, which
 * holds the query text rather than the phrase, from matching itself.
 */
const SEARCH_QUERY = String.raw`/quartz\s+marmalade/`;
const SETTLE_IN_MS = 3000;
const SCENARIO_TIMEOUT_IN_MS = 120_000;

type Step = 'readQueryBlockCaptions' | 'readSearchCaptions';

async function runStep(step: Step): Promise<readonly string[]> {
  return await evalInObsidian({
    async callback({
      app,
      FOLDER_PATH: folderPath,
      HIT_CONTENT: hitContent,
      HIT_PATH: hitPath,
      QUERY_NOTE_PATH: queryNotePath,
      SEARCH_QUERY: searchQuery,
      SETTLE_IN_MS: settleInMs,
      STEP: currentStep
    }): Promise<readonly string[]> {
      if (!app.vault.getFolderByPath(folderPath)) {
        await app.vault.createFolder(folderPath);
      }
      if (!app.vault.getFileByPath(hitPath)) {
        await app.vault.create(hitPath, hitContent);
      }

      function readCaptions(view: View, containerSelector: string): string[] {
        const captionEls = view.containerEl.querySelectorAll(`${containerSelector} .search-result-file-title .tree-item-inner`);
        return [...captionEls].map((captionEl) => captionEl.textContent);
      }

      switch (currentStep) {
        case 'readQueryBlockCaptions': {
          const queryNote = app.vault.getFileByPath(queryNotePath) ?? await app.vault.create(queryNotePath, `\`\`\`query\n${searchQuery}\n\`\`\`\n`);
          const leaf = app.workspace.getLeaf(false);
          await leaf.openFile(queryNote, { state: { mode: 'preview' } });
          await sleep(settleInMs);
          return readCaptions(leaf.view, '.internal-query');
        }
        case 'readSearchCaptions': {
          app.internalPlugins.getPluginById('global-search')?.instance.openGlobalSearch(searchQuery);
          await sleep(settleInMs);
          const searchLeaf = app.workspace.getLeavesOfType('search')[0];
          if (!searchLeaf) {
            throw new Error('The search pane did not open.');
          }
          await searchLeaf.loadIfDeferred();
          return readCaptions(searchLeaf.view, '.search-result-container');
        }
        default: {
          return [];
        }
      }
    },
    input: {
      FOLDER_PATH,
      HIT_CONTENT,
      HIT_PATH,
      QUERY_NOTE_PATH,
      SEARCH_QUERY,
      SETTLE_IN_MS,
      STEP: step
    },
    vaultPath: getTemporaryVault().path
  });
}

describe('result lists other than the backlinks', () => {
  it('leaves the core Search captions alone', async () => {
    const captions = await runStep('readSearchCaptions');

    expect(captions).toEqual([HIT_BASENAME]);
  }, SCENARIO_TIMEOUT_IN_MS);

  it('leaves the embedded query block captions alone', async () => {
    const captions = await runStep('readQueryBlockCaptions');

    expect(captions).toEqual([HIT_BASENAME]);
  }, SCENARIO_TIMEOUT_IN_MS);
});
