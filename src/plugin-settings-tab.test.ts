import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventMap } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { AsyncEvents } from 'obsidian-dev-utils/async-events';
import { noopAsync } from 'obsidian-dev-utils/function';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  App,
  DropdownComponent as DropdownComponentClass,
  TextComponent as TextComponentClass,
  ToggleComponent as ToggleComponentClass
} from 'obsidian-test-mocks/obsidian';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import type { Plugin } from './plugin.ts';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

class MockDataHandler implements DataHandler {
  public async loadData(): Promise<unknown> {
    await noopAsync();
    return {};
  }

  public async saveData(): Promise<void> {
    await noopAsync();
  }
}

async function createTab(): Promise<PluginSettingsTab> {
  const app = App.createConfigured__();
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler: new MockDataHandler(),
    pluginEventSource: new AsyncEvents<PluginEventMap>()
  });
  // The component must be loaded before its settings can be edited; obsidian-dev-utils.
  // Makes setProperty/editAndSave throw when the component is not loaded.
  await pluginSettingsComponent.loadWithPromises();
  const plugin = strictProxy<Plugin>({ app: app.asOriginalType__() });
  const tab = new PluginSettingsTab({
    plugin,
    pluginSettingsComponent
  });

  tab.displayLegacy();
  return tab;
}

function getSettingNames(tab: PluginSettingsTab): string[] {
  const names: string[] = [];
  for (const settingEl of Array.from(tab.containerEl.children)) {
    const infoEl = settingEl.children[1];
    const nameEl = infoEl?.children[0];
    if (nameEl?.textContent) {
      names.push(nameEl.textContent);
    }
  }
  return names;
}

beforeAll(() => {
  // Obsidian-dev-utils' bind() probes setPlaceholderValue to detect text-based components.
  for (const proto of [ToggleComponentClass.prototype, DropdownComponentClass.prototype, TextComponentClass.prototype]) {
    if (!('setPlaceholderValue' in proto)) {
      Object.defineProperty(proto, 'setPlaceholderValue', { value: undefined });
    }
  }
});

describe('PluginSettingsTab', () => {
  it('should be constructable', async () => {
    const tab = await createTab();
    expect(tab).toBeInstanceOf(PluginSettingsTab);
  });

  it('should render all settings bound to the correct properties', async () => {
    const tab = await createTab();
    const names = getSettingNames(tab);
    expect(names).toStrictEqual([
      'Include extension',
      'Path depth',
      'Show ellipsis for skipped path parts',
      'Highlight file name',
      'Reverse path parts',
      'Display parent path on separate line',
      'Root paths'
    ]);
  });
});
