/**
 * @file
 *
 * Tests for the PluginSettingsTab class.
 */

import type { PluginManifest } from 'obsidian';

import {
  App,
  ToggleComponent
} from 'obsidian-test-mocks/obsidian';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { Plugin } from './plugin.ts';

interface DisplayedTabResult {
  names: string[];
  tab: PluginSettingsTab;
}

/**
 * Creates a PluginSettingsTab attached to a freshly created Plugin and calls display().
 *
 * @returns An object with the tab and the extracted setting names.
 */
function createDisplayedTab(): DisplayedTabResult {
  const plugin = createPlugin();
  const pluginSettingsComponent = Reflect.get(plugin, 'pluginSettingsComponent') as InstanceType<
    typeof import('./plugin-settings-component.ts').PluginSettingsComponent
  >;

  const tab = new PluginSettingsTab({
    plugin,
    pluginSettingsComponent
  });

  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Not ready to migrate `display()`.
  tab.display();
  const names = getSettingNames(tab.containerEl);
  return { names, tab };
}

/**
 * Creates a Plugin instance with mocked dependencies.
 *
 * @returns The created Plugin.
 */
function createPlugin(): Plugin {
  const app = App.createConfigured__();
  const manifest: PluginManifest = {
    author: 'test',
    description: 'test',
    id: 'backlink-full-path',
    minAppVersion: '0.0.0',
    name: 'Backlink Full Path',
    version: '1.0.0'
  };
  return new Plugin(app.asOriginalType__(), manifest);
}

/**
 * Extracts setting names from the tab's containerEl after calling display().
 *
 * Each Setting mock creates a settingEl > [controlEl, infoEl > [nameEl, descEl]].
 * The nameEl is the second-level div that contains the setting name text.
 *
 * @param containerEl - The container element.
 * @returns The array of setting name strings.
 */
function getSettingNames(containerEl: HTMLElement): string[] {
  const names: string[] = [];
  for (const settingEl of containerEl.children) {
    // SettingEl contains [controlEl, infoEl].
    // InfoEl contains [nameEl, descEl].
    const infoEl = settingEl.children[1];
    if (infoEl) {
      const nameEl = infoEl.children[0];
      if (nameEl?.textContent) {
        names.push(nameEl.textContent);
      }
    }
  }
  return names;
}

/**
 * Patches missing mock properties on obsidian-test-mocks components
 * that obsidian-dev-utils's `bind()` method probes via strict proxy.
 */
function patchMissingMockProperties(): void {
  // Obsidian-dev-utils checks for setPlaceholderValue to detect text-based components.
  if (!('setPlaceholderValue' in ToggleComponent.prototype)) {
    Object.defineProperty(ToggleComponent.prototype, 'setPlaceholderValue', { value: undefined });
  }
}

beforeAll(() => {
  patchMissingMockProperties();
});

describe('PluginSettingsTab', () => {
  it('should be constructable', () => {
    const plugin = createPlugin();
    const pluginSettingsComponent = Reflect.get(plugin, 'pluginSettingsComponent') as InstanceType<
      typeof import('./plugin-settings-component.ts').PluginSettingsComponent
    >;
    const tab = new PluginSettingsTab({
      plugin,
      pluginSettingsComponent
    });
    expect(tab).toBeInstanceOf(PluginSettingsTab);
  });

  describe('display', () => {
    it('should create all 7 settings', () => {
      const { names } = createDisplayedTab();
      const EXPECTED_SETTING_COUNT = 7;
      expect(names.length).toBe(EXPECTED_SETTING_COUNT);
    });

    it('should create Include extension setting', () => {
      const { names } = createDisplayedTab();
      expect(names).toContain('Include extension');
    });

    it('should create Path depth setting', () => {
      const { names } = createDisplayedTab();
      expect(names).toContain('Path depth');
    });

    it('should create Show ellipsis for skipped path parts setting', () => {
      const { names } = createDisplayedTab();
      expect(names).toContain('Show ellipsis for skipped path parts');
    });

    it('should create Highlight file name setting', () => {
      const { names } = createDisplayedTab();
      expect(names).toContain('Highlight file name');
    });

    it('should create Reverse path parts setting', () => {
      const { names } = createDisplayedTab();
      expect(names).toContain('Reverse path parts');
    });

    it('should create Display parent path on separate line setting', () => {
      const { names } = createDisplayedTab();
      expect(names).toContain('Display parent path on separate line');
    });

    it('should create Root paths setting', () => {
      const { names } = createDisplayedTab();
      expect(names).toContain('Root paths');
    });
  });
});
