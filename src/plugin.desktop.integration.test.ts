import {
  evalInObsidian,
  openObsidianSettingsTab
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

const PLUGIN_ID = 'backlink-full-path';

describe('Smoke test', () => {
  it('should load plugin on Desktop', () => {
    const vault = getTemporaryVault();
    expect(vault.path).toBeTruthy();
  });

  it('should open its settings tab', async () => {
    // `tabId` is required. `app.setting.open()` on its own restores the profile's
    // Last opened tab, and a harness-owned profile has never opened one, so the
    // Modal renders zero rows. See obsidian-integration-testing AGENTS.md L38.
    const settingNames = await openObsidianSettingsTab({ tabId: PLUGIN_ID });

    expect(settingNames).toContain('Path depth');
    expect(settingNames).toContain('Root paths');

    // Close it again so the modal does not sit over anything a later test drives.
    await evalInObsidian({
      callback({ app }) {
        app.setting.close();
      }
    });
  });
});
