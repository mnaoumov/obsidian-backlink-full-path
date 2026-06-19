import type {
  App,
  PluginManifest
} from 'obsidian';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { BacklinkFullPathComponent } from './backlink-full-path-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { Plugin } from './plugin.ts';

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  PluginSettingsTabComponent: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/data-handler', () => ({
  PluginDataHandler: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin', () => {
  class MockPluginBase {
    public app: App;
    public manifest: PluginManifest;

    public constructor(app: App, manifest: PluginManifest) {
      this.app = app;
      this.manifest = manifest;
    }

    public addChild(child: unknown): unknown {
      return child;
    }
  }
  return { PluginBase: MockPluginBase };
});

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-event-source', () => ({
  PluginEventSourceImpl: vi.fn()
}));

vi.mock('./backlink-full-path-component.ts', () => ({
  BacklinkFullPathComponent: vi.fn()
}));

vi.mock('./plugin-settings-component.ts', () => ({
  PluginSettingsComponent: vi.fn()
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

interface PluginInternals {
  onloadImpl(): void;
}

function createMockApp(): App {
  return strictProxy<App>({});
}

function createMockManifest(): PluginManifest {
  return strictProxy<PluginManifest>({
    id: 'backlink-full-path',
    name: 'Backlink Full Path'
  });
}

describe('Plugin', () => {
  it('should wire up all components in onloadImpl', () => {
    const app = createMockApp();
    const plugin = new Plugin(app, createMockManifest());
    const addChildSpy = vi.spyOn(plugin, 'addChild');

    castTo<PluginInternals>(plugin).onloadImpl();

    expect(PluginSettingsComponent).toHaveBeenCalledOnce();
    expect(PluginSettingsTab).toHaveBeenCalledOnce();
    expect(BacklinkFullPathComponent).toHaveBeenCalledOnce();
    const EXPECTED_ADD_CHILD_COUNT = 3;
    expect(addChildSpy).toHaveBeenCalledTimes(EXPECTED_ADD_CHILD_COUNT);
  });
});
