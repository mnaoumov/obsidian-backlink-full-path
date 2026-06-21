/* eslint-disable @typescript-eslint/no-extraneous-class -- Test mocks of the plugin's own sibling modules need constructor-only classes. */
import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { Component } from 'obsidian';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

interface AppGlobal {
  app: AppOriginal;
}

interface SettingTabsHolder {
  settingTabs__: unknown[];
}

const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

// --- Mocks for the plugin's OWN sibling modules (allowed: not obsidian-dev-utils / obsidian-test-mocks) ---

const hoisted = vi.hoisted(() => ({
  backlinkFullPathComponentConstructor: vi.fn(),
  pluginSettingsComponentConstructor: vi.fn(),
  pluginSettingsTabConstructor: vi.fn()
}));

vi.mock('./plugin-settings-component.ts', () => ({
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  PluginSettingsComponent: class extends Component {
    public constructor(params: unknown) {
      super();
      hoisted.pluginSettingsComponentConstructor(params);
    }
  }
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: class {
    public constructor(params: unknown) {
      hoisted.pluginSettingsTabConstructor(params);
    }
  }
}));

vi.mock('./backlink-full-path-component.ts', () => ({
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  BacklinkFullPathComponent: class extends Component {
    public constructor(params: unknown) {
      super();
      hoisted.backlinkFullPathComponentConstructor(params);
    }
  }
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

const manifest = castTo<PluginManifest>({
  author: 'test',
  description: 'test',
  id: 'backlink-full-path',
  minAppVersion: '1.0.0',
  name: 'Backlink Full Path',
  version: '1.0.0'
});

let app: AppOriginal;

async function createLoadedPlugin(): Promise<Plugin> {
  const plugin = new Plugin(app, manifest);
  // PluginBase.onload is async, and the synchronous mock Component.load() would not await it, so the real async load path is driven directly (as the obsidian-dev-utils reference test does).
  await plugin.onload();
  return plugin;
}

function seedOnRawTarget(strictProxiedObject: object, key: string, value: unknown): void {
  const proxyWithTarget = castTo<Partial<Record<symbol, object>>>(strictProxiedObject);
  const rawTarget = proxyWithTarget[STRICT_PROXY_TARGET_SYMBOL] ?? strictProxiedObject;
  castTo<Record<string, unknown>>(rawTarget)[key] = value;
}

describe('Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const appMock = App.createConfigured__();
    appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
      cb();
    });
    app = appMock.asOriginalType__();

    // Seed the obsidianDevUtilsState holder on the raw target behind the strict-proxy App so the real getObsidianDevUtilsState can read/write it (the proxy throws on first access to an unassigned property).
    seedOnRawTarget(app, 'obsidianDevUtilsState', {});

    // Expose the app as the global instance so dev-utils helpers that resolve shared state without an explicit app argument read/write the same seeded holder.
    castTo<AppGlobal>(window).app = app;
  });

  it('should load the plugin without throwing', async () => {
    const plugin = await createLoadedPlugin();
    expect(plugin).toBeInstanceOf(Plugin);
  });

  it('should wire up all components in onloadImpl', async () => {
    await createLoadedPlugin();
    expect(hoisted.pluginSettingsComponentConstructor).toHaveBeenCalledOnce();
    expect(hoisted.pluginSettingsTabConstructor).toHaveBeenCalledOnce();
    expect(hoisted.backlinkFullPathComponentConstructor).toHaveBeenCalledOnce();
  });

  it('should register the settings tab with the plugin', async () => {
    const plugin = await createLoadedPlugin();
    expect(castTo<SettingTabsHolder>(plugin).settingTabs__).toHaveLength(1);
  });
});
/* eslint-enable @typescript-eslint/no-extraneous-class -- End of test file. */
