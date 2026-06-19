import type { Plugin } from 'obsidian';
import type { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettings } from './plugin-settings.ts';

import { PluginSettingsTab } from './plugin-settings-tab.ts';

vi.mock('obsidian-dev-utils/obsidian/setting-ex', () => {
  class MockSettingEx {
    public constructor(public readonly containerEl: HTMLElement) {
    }

    public addMultipleText(cb: (component: unknown) => void): this {
      cb({ setMin: vi.fn() });
      return this;
    }

    public addNumber(cb: (component: unknown) => void): this {
      cb({ setMin: vi.fn() });
      return this;
    }

    public setDesc(): this {
      return this;
    }

    public setName(): this {
      return this;
    }
  }

  return { SettingEx: MockSettingEx };
});

describe('PluginSettingsTab', () => {
  it('should display all settings bound to the correct properties', () => {
    const settings = strictProxy<PluginSettings>({
      pathDepth: 0,
      rootPaths: [],
      shouldDisplayParentPathOnSeparateLine: false,
      shouldHighlightFileName: true,
      shouldIncludeExtension: true,
      shouldReversePathParts: false,
      shouldShowEllipsisForSkippedPathParts: true
    });

    const pluginSettingsComponent = strictProxy<PluginSettingsComponentBase<PluginSettings>>({
      on: vi.fn().mockReturnValue({ id: 'ref' }),
      settings
    });

    const plugin = strictProxy<Plugin>({
      app: {
        workspace: {
          on: vi.fn().mockReturnValue({ id: 'test' })
        }
      }
    });

    const tab = new PluginSettingsTab({
      plugin,
      pluginSettingsComponent
    });

    tab.containerEl = activeDocument.createElement('div');

    const bindSpy = vi.spyOn(tab, 'bind').mockReturnValue({ setMin: vi.fn() });

    tab.displayLegacy();

    const EXPECTED_BIND_COUNT = 7;
    expect(bindSpy).toHaveBeenCalledTimes(EXPECTED_BIND_COUNT);
    expect(bindSpy.mock.calls.map((call) => call[1])).toEqual([
      'shouldIncludeExtension',
      'pathDepth',
      'shouldShowEllipsisForSkippedPathParts',
      'shouldHighlightFileName',
      'shouldReversePathParts',
      'shouldDisplayParentPathOnSeparateLine',
      'rootPaths'
    ]);
  });
});
