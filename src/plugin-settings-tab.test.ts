/**
 * @file
 *
 * Tests for the PluginSettingsTab class.
 */

import type { Plugin as ObsidianPlugin } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

/**
 * Creates a mock plugin object for testing.
 *
 * @returns A mock plugin.
 */
function createMockPlugin(): ObsidianPlugin {
  const app = App.createConfigured__();
  return {
    app: app.asOriginalType__(),
    manifest: {
      author: 'test',
      description: 'test',
      id: 'backlink-full-path',
      minAppVersion: '0.0.0',
      name: 'Backlink Full Path',
      version: '1.0.0'
    }
  } as unknown as ObsidianPlugin;
}

describe('PluginSettingsTab', () => {
  it('should be constructable', () => {
    const plugin = createMockPlugin();
    const settingsComponent = new PluginSettingsComponent({
      loadData: vi.fn().mockResolvedValue(null),
      saveData: vi.fn().mockResolvedValue(undefined)
    });

    const tab = new PluginSettingsTab({
      plugin,
      settingsComponent
    });

    expect(tab).toBeInstanceOf(PluginSettingsTab);
  });

  it('should have a containerEl after construction', () => {
    const plugin = createMockPlugin();
    const settingsComponent = new PluginSettingsComponent({
      loadData: vi.fn().mockResolvedValue(null),
      saveData: vi.fn().mockResolvedValue(undefined)
    });

    const tab = new PluginSettingsTab({
      plugin,
      settingsComponent
    });

    expect(tab.containerEl).toBeDefined();
  });
});
