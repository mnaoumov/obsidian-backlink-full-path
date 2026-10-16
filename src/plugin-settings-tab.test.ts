import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventMap } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { SettingGroup } from 'obsidian';

import { SettingEx } from '@mnaoumov/obsidian-lib/setting-ex';
import { AsyncEvents } from '@mnaoumov/typescript-lib/async-events';
import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
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
  // The component must be loaded before its settings can be edited; @mnaoumov/obsidian-lib.
  // Makes setProperty/editAndSave throw when the component is not loaded.
  await pluginSettingsComponent.loadWithPromises();
  const plugin = strictProxy<Plugin>({ app: app.asOriginalType__() });
  const tab = new PluginSettingsTab({
    plugin,
    pluginSettingsComponent
  });

  return tab;
}

function getSettingNames(tab: PluginSettingsTab): string[] {
  return tab.getSettingDefinitions().map((definition) => 'name' in definition ? definition.name : '');
}

/**
 * Invokes every row's `render` callback the way Obsidian does when the tab is opened, so the bindings are
 * still exercised now that the rows are declarative.
 *
 * @param tab - The settings tab.
 */
function renderSettings(tab: PluginSettingsTab): void {
  for (const definition of tab.getSettingDefinitions()) {
    if ('render' in definition) {
      definition.render(new SettingEx(tab.containerEl), castTo<SettingGroup>(null));
    }
  }
}

beforeAll(() => {
  // The @mnaoumov/obsidian-lib bind() probes setPlaceholderValue to detect text-based components.
  for (const prototype of [ToggleComponentClass.prototype, DropdownComponentClass.prototype, TextComponentClass.prototype]) {
    if (!('setPlaceholderValue' in prototype)) {
      Object.defineProperty(prototype, 'setPlaceholderValue', { value: undefined });
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
    renderSettings(tab);
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
