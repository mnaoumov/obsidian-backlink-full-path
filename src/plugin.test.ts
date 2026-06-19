import type {
  BacklinkView,
  ResultDom,
  ResultDomItem,
  ResultDomResult
} from '@obsidian-typings/obsidian-public-latest';
import type {
  PluginManifest,
  TFile
} from 'obsidian';
import type { StrictProxyPartial } from 'obsidian-dev-utils/strict-proxy';

import {
  bypassStrictProxy,
  strictProxy
} from 'obsidian-dev-utils/strict-proxy';
import {
  App,
  MarkdownView,
  WorkspaceLeaf
} from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettings } from './plugin-settings.ts';

import { Plugin } from './plugin.ts';

interface MockCorePlugin {
  enabled: boolean;
  instance: object;
}

interface SettingsComponentProxy {
  on(...args: never[]): void;
  settings: PluginSettings;
}

interface TestPluginResult {
  readonly app: ReturnType<typeof App.createConfigured__>;
  readonly plugin: Plugin;
}

function createMockFile(path: string): TFile {
  const parts = path.split('/');
  const name = parts.at(-1) ?? '';
  const dotIndex = name.lastIndexOf('.');
  const basename = dotIndex >= 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex >= 0 ? name.slice(dotIndex + 1) : '';
  return mockProxy<TFile>({
    basename,
    extension,
    name,
    path
  });
}

function createMockResultDomItem(hasTreeItemInner: boolean): ResultDomItem {
  const el = activeDocument.createElement('div');
  if (hasTreeItemInner) {
    const inner = activeDocument.createElement('div');
    inner.classList.add('tree-item-inner');
    inner.textContent = 'Original';
    el.appendChild(inner);
  }
  return mockProxy<ResultDomItem>({ el });
}

function createTestManifest(): PluginManifest {
  return {
    author: 'test',
    description: 'test',
    id: 'backlink-full-path',
    minAppVersion: '0.0.0',
    name: 'Backlink Full Path',
    version: '1.0.0'
  };
}

function createTestPlugin(): TestPluginResult {
  const app = App.createConfigured__();
  const manifest = createTestManifest();
  const plugin = new Plugin(app.asOriginalType__(), manifest);
  return { app, plugin };
}

function getSettingsComponent(plugin: Plugin): SettingsComponentProxy {
  return Reflect.get(plugin, 'pluginSettingsComponent') as SettingsComponentProxy;
}

function markPluginLoaded(plugin: Plugin): void {
  Reflect.set(bypassStrictProxy(plugin), '_loaded', true);
  const wrapperComponent = Reflect.get(bypassStrictProxy(plugin), 'wrapperComponent') as object;
  Reflect.set(bypassStrictProxy(wrapperComponent), '_loaded', true);
}

function mockInternalPlugins(plugin: Plugin, returnValue: unknown): ReturnType<typeof vi.fn> {
  const getPluginById = vi.fn().mockReturnValue(returnValue);
  Reflect.set(bypassStrictProxy(plugin.app), 'internalPlugins', strictProxy({ getPluginById }));
  return getPluginById;
}

function mockObsidianDevUtilsState(plugin: Plugin): void {
  Reflect.set(bypassStrictProxy(plugin.app), 'obsidianDevUtilsState', {});
  const globalApp = Reflect.get(window, 'app') as unknown;
  if (globalApp) {
    Reflect.set(bypassStrictProxy(globalApp), 'obsidianDevUtilsState', {});
  }
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is used in the body for strictProxy<T>.
function mockProxy<T>(partial: object): T {
  return strictProxy<T>(partial as StrictProxyPartial<T>);
}

function privateMethod(obj: object, name: string): (...args: never[]) => unknown {
  const fn = Reflect.get(obj, name) as (...args: never[]) => unknown;
  return fn.bind(obj);
}

describe('Plugin', () => {
  it('should be constructable', () => {
    const { plugin } = createTestPlugin();
    expect(plugin).toBeInstanceOf(Plugin);
  });

  it('should have the correct manifest id', () => {
    const { plugin } = createTestPlugin();
    expect(plugin.manifest.id).toBe('backlink-full-path');
  });

  describe('onload', () => {
    it('should register saveSettings event listener', async () => {
      const { plugin } = createTestPlugin();
      mockObsidianDevUtilsState(plugin);

      const settingsComponent = getSettingsComponent(plugin);
      const onSpy = vi.spyOn(settingsComponent, 'on');

      await plugin.onload();

      expect(onSpy).toHaveBeenCalledWith('saveSettings', expect.any(Function));
    });

    it('should call refreshBacklinkPanels when saveSettings is triggered', async () => {
      const { plugin } = createTestPlugin();
      mockObsidianDevUtilsState(plugin);

      const refreshBacklinkPanels = vi.fn().mockResolvedValue(undefined);
      Reflect.set(plugin, 'refreshBacklinkPanels', refreshBacklinkPanels);

      const settingsComponent = getSettingsComponent(plugin);
      let savedCallback: (() => Promise<void>) | undefined;
      vi.spyOn(settingsComponent, 'on').mockImplementation(
        ((_event: never, callback: never) => {
          savedCallback = callback;
        }) as (...args: never[]) => void
      );

      await plugin.onload();

      expect(savedCallback).toBeDefined();
      if (savedCallback) {
        await savedCallback();
      }

      expect(refreshBacklinkPanels).toHaveBeenCalled();
    });
  });

  describe('onLayoutReady', () => {
    it('should return early when backlinks core plugin is not found', async () => {
      const { plugin } = createTestPlugin();

      const getPluginById = mockInternalPlugins(plugin, undefined);

      const onLayoutReady = privateMethod(plugin, 'onLayoutReady');
      await onLayoutReady();

      expect(getPluginById).toHaveBeenCalledWith('backlink');
    });

    it('should patch but not call patchBacklinksPane when backlinks plugin is disabled', async () => {
      const { plugin } = createTestPlugin();
      markPluginLoaded(plugin);

      const instanceProto = {};
      const backlinksCorePlugin = mockProxy<MockCorePlugin>({
        enabled: false,
        instance: Object.create(instanceProto)
      });

      mockInternalPlugins(plugin, backlinksCorePlugin);

      const patchBacklinksPane = vi.fn().mockResolvedValue(undefined);
      Reflect.set(plugin, 'patchBacklinksPane', patchBacklinksPane);

      const onLayoutReady = privateMethod(plugin, 'onLayoutReady');
      await onLayoutReady();

      expect(patchBacklinksPane).not.toHaveBeenCalled();
    });

    it('should call patchBacklinksPane and refreshBacklinkPanels when backlinks plugin is enabled', async () => {
      const { plugin } = createTestPlugin();
      markPluginLoaded(plugin);

      const instanceProto = {};
      const backlinksCorePlugin = mockProxy<MockCorePlugin>({
        enabled: true,
        instance: Object.create(instanceProto)
      });

      mockInternalPlugins(plugin, backlinksCorePlugin);

      const patchBacklinksPane = vi.fn().mockResolvedValue(undefined);
      const refreshBacklinkPanels = vi.fn().mockResolvedValue(undefined);
      Reflect.set(plugin, 'patchBacklinksPane', patchBacklinksPane);
      Reflect.set(plugin, 'refreshBacklinkPanels', refreshBacklinkPanels);

      const onLayoutReady = privateMethod(plugin, 'onLayoutReady');
      await onLayoutReady();

      expect(patchBacklinksPane).toHaveBeenCalled();
      expect(refreshBacklinkPanels).toHaveBeenCalled();
    });

    it('should invoke onUserEnable patch that calls onBacklinksCorePluginEnable', async () => {
      const { plugin } = createTestPlugin();
      markPluginLoaded(plugin);

      const instanceProto = { onUserEnable: vi.fn() };
      const backlinksCorePlugin = mockProxy<MockCorePlugin>({
        enabled: false,
        instance: Object.create(instanceProto) as object
      });

      mockInternalPlugins(plugin, backlinksCorePlugin);

      const onBacklinksCorePluginEnable = vi.fn();
      Reflect.set(plugin, 'onBacklinksCorePluginEnable', onBacklinksCorePluginEnable);

      const onLayoutReady = privateMethod(plugin, 'onLayoutReady');
      await onLayoutReady();

      const patchedOnUserEnable = instanceProto.onUserEnable as () => void;
      patchedOnUserEnable.call(backlinksCorePlugin.instance);

      expect(onBacklinksCorePluginEnable).toHaveBeenCalled();
    });

    it('should register unload callback that calls refreshBacklinkPanels', async () => {
      const { plugin } = createTestPlugin();
      markPluginLoaded(plugin);

      const instanceProto = {};
      const backlinksCorePlugin = mockProxy<MockCorePlugin>({
        enabled: false,
        instance: Object.create(instanceProto)
      });

      mockInternalPlugins(plugin, backlinksCorePlugin);

      const refreshBacklinkPanels = vi.fn().mockResolvedValue(undefined);
      Reflect.set(plugin, 'refreshBacklinkPanels', refreshBacklinkPanels);

      const registerCallbacks: (() => void)[] = [];
      vi.spyOn(plugin, 'register').mockImplementation((cb: () => void) => {
        registerCallbacks.push(cb);
      });

      const onLayoutReady = privateMethod(plugin, 'onLayoutReady');
      await onLayoutReady();

      expect(registerCallbacks.length).toBeGreaterThan(0);
      const callback = registerCallbacks[0];
      if (callback) {
        callback();
      }

      expect(refreshBacklinkPanels).toHaveBeenCalled();
    });
  });

  describe('addResult', () => {
    let plugin: Plugin;
    let addResult: (...args: never[]) => unknown;

    beforeEach(() => {
      const result = createTestPlugin();
      plugin = result.plugin;
      addResult = privateMethod(plugin, 'addResult');
    });

    it('should replace tree-item-inner content with generated backlink title', () => {
      const file = createMockFile('folder/subfolder/note.md');
      const resultDomItem = createMockResultDomItem(true);
      const next = vi.fn().mockReturnValue(resultDomItem);
      const resultDom = mockProxy<ResultDom>({});
      const result = mockProxy<ResultDomResult>({});

      const returnedItem = (addResult as (...args: unknown[]) => unknown)(next, resultDom, file, result, 'content', true) as ResultDomItem;

      expect(next).toHaveBeenCalledWith(file, result, 'content', true);
      expect(returnedItem).toBe(resultDomItem);

      const inner = resultDomItem.el.querySelector('.tree-item-inner');
      expect(inner?.textContent).not.toBe('Original');
    });

    it('should not modify result when tree-item-inner is absent', () => {
      const file = createMockFile('note.md');
      const resultDomItem = createMockResultDomItem(false);
      const next = vi.fn().mockReturnValue(resultDomItem);
      const resultDom = mockProxy<ResultDom>({});
      const result = mockProxy<ResultDomResult>({});

      const returnedItem = (addResult as (...args: unknown[]) => unknown)(next, resultDom, file, result, 'content') as ResultDomItem;
      expect(returnedItem).toBe(resultDomItem);
    });
  });

  describe('generateBacklinkTitle', () => {
    let plugin: Plugin;
    let settings: PluginSettings;

    beforeEach(() => {
      const result = createTestPlugin();
      plugin = result.plugin;
      settings = getSettingsComponent(plugin).settings;
    });

    function callGenerateBacklinkTitle(file: TFile): HTMLDivElement {
      const fn = privateMethod(plugin, 'generateBacklinkTitle');
      return (fn as (...args: unknown[]) => unknown)(file) as HTMLDivElement;
    }

    it('should include extension when shouldIncludeExtension is true', () => {
      settings.shouldIncludeExtension = true;
      const file = createMockFile('folder/note.md');
      const container = callGenerateBacklinkTitle(file);
      const fileNameSpan = container.shadowRoot?.querySelector('[part="file-name"]');
      expect(fileNameSpan?.textContent).toBe('note.md');
    });

    it('should exclude extension when shouldIncludeExtension is false', () => {
      settings.shouldIncludeExtension = false;
      const file = createMockFile('folder/note.md');
      const container = callGenerateBacklinkTitle(file);
      const fileNameSpan = container.shadowRoot?.querySelector('[part="file-name"]');
      expect(fileNameSpan?.textContent).toBe('note');
    });

    it('should show file at root with no parent path', () => {
      const file = createMockFile('note.md');
      const container = callGenerateBacklinkTitle(file);
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan).toBeNull();
    });

    it('should show parent path with trailing separator', () => {
      settings.shouldReversePathParts = false;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const file = createMockFile('folder/note.md');
      const container = callGenerateBacklinkTitle(file);
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('folder/');
    });

    it('should strip root path prefix', () => {
      settings.rootPaths = ['folder'];
      const file = createMockFile('folder/subfolder/note.md');
      const container = callGenerateBacklinkTitle(file);
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('subfolder/');
    });

    it('should strip nested root path prefix', () => {
      settings.rootPaths = ['folder/subfolder'];
      const file = createMockFile('folder/subfolder/deep/note.md');
      const container = callGenerateBacklinkTitle(file);
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('deep/');
    });

    it('should limit depth with pathDepth setting', () => {
      settings.pathDepth = 2;
      settings.shouldShowEllipsisForSkippedPathParts = false;
      const file = createMockFile('a/b/c/note.md');
      const container = callGenerateBacklinkTitle(file);
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('c/');
    });

    it('should add ellipsis for skipped parts when enabled', () => {
      settings.pathDepth = 2;
      settings.shouldShowEllipsisForSkippedPathParts = true;
      const file = createMockFile('a/b/c/note.md');
      const container = callGenerateBacklinkTitle(file);
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('.../c/');
    });

    it('should not add ellipsis when pathDepth does not truncate', () => {
      settings.pathDepth = 5;
      settings.shouldShowEllipsisForSkippedPathParts = true;
      const file = createMockFile('a/b/note.md');
      const container = callGenerateBacklinkTitle(file);
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('a/b/');
    });

    it('should reverse path parts when shouldReversePathParts is true', () => {
      settings.shouldReversePathParts = true;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const file = createMockFile('a/b/note.md');
      const container = callGenerateBacklinkTitle(file);
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe(' \u2190 b \u2190 a');
    });

    it('should display parent path on separate line without separator', () => {
      settings.shouldDisplayParentPathOnSeparateLine = true;
      settings.shouldReversePathParts = false;
      const file = createMockFile('folder/note.md');
      const container = callGenerateBacklinkTitle(file);
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('folder');
    });

    it('should set dataset attributes for highlighting', () => {
      settings.shouldHighlightFileName = true;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const file = createMockFile('note.md');
      const container = callGenerateBacklinkTitle(file);
      expect(container.dataset['shouldHighlightFileName']).toBe('true');
      expect(container.dataset['shouldDisplayParentPathOnSeparateLine']).toBe('false');
    });

    it('should include full-path span with file path', () => {
      const file = createMockFile('folder/note.md');
      const container = callGenerateBacklinkTitle(file);
      const fullPathSpan = container.querySelector('.full-path');
      expect(fullPathSpan?.textContent).toBe('folder/note.md');
    });

    it('should prepend parent path when not reversed and not on separate line', () => {
      settings.shouldReversePathParts = false;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const file = createMockFile('folder/note.md');
      const container = callGenerateBacklinkTitle(file);
      const firstChild = container.shadowRoot?.firstElementChild;
      expect(firstChild?.getAttribute('part')).toBe('parent-path');
    });

    it('should append parent path when reversed and not on separate line', () => {
      settings.shouldReversePathParts = true;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const file = createMockFile('folder/note.md');
      const container = callGenerateBacklinkTitle(file);
      const lastChild = container.shadowRoot?.lastElementChild;
      expect(lastChild?.getAttribute('part')).toBe('parent-path');
    });

    it('should not prepend when displaying on separate line', () => {
      settings.shouldReversePathParts = false;
      settings.shouldDisplayParentPathOnSeparateLine = true;
      const file = createMockFile('folder/note.md');
      const container = callGenerateBacklinkTitle(file);
      const lastChild = container.shadowRoot?.lastElementChild;
      expect(lastChild?.getAttribute('part')).toBe('parent-path');
    });
  });

  describe('getBacklinkView', () => {
    it('should return null when no backlink leaf exists', async () => {
      const { plugin } = createTestPlugin();

      const getBacklinkView = privateMethod(plugin, 'getBacklinkView');
      const view = await getBacklinkView();
      expect(view).toBeNull();
    });

    it('should return the view when a backlink leaf exists', async () => {
      const { plugin } = createTestPlugin();

      const mockView = mockProxy<BacklinkView>({});
      const mockLeaf = mockProxy<WorkspaceLeaf>({
        loadIfDeferred: vi.fn().mockResolvedValue(undefined),
        view: mockView
      });

      Reflect.set(plugin.app.workspace, 'getLeavesOfType', vi.fn().mockReturnValue([mockLeaf]));

      const getBacklinkView = privateMethod(plugin, 'getBacklinkView');
      const view = await getBacklinkView();

      expect(mockLeaf.loadIfDeferred).toHaveBeenCalled();
      expect(view).toBe(mockView);
    });
  });

  describe('refreshBacklinkPanels', () => {
    it('should call reloadBacklinksView', async () => {
      const { plugin } = createTestPlugin();

      const reloadBacklinksView = vi.fn().mockResolvedValue(undefined);
      Reflect.set(plugin, 'reloadBacklinksView', reloadBacklinksView);

      const refreshBacklinkPanels = privateMethod(plugin, 'refreshBacklinkPanels');
      await refreshBacklinkPanels();

      expect(reloadBacklinksView).toHaveBeenCalled();
    });
  });

  describe('reloadBacklinksView', () => {
    it('should do nothing when no backlink view exists', async () => {
      const { plugin } = createTestPlugin();

      const getBacklinkView = vi.fn().mockResolvedValue(null);
      Reflect.set(plugin, 'getBacklinkView', getBacklinkView);

      const reloadBacklinksView = privateMethod(plugin, 'reloadBacklinksView');
      await reloadBacklinksView();

      expect(getBacklinkView).toHaveBeenCalled();
    });

    it('should not recompute when backlink view has no file', async () => {
      const { plugin } = createTestPlugin();

      const recomputeBacklink = vi.fn();
      const backlinkView = mockProxy<BacklinkView>({
        backlink: mockProxy({ recomputeBacklink }),
        file: null
      });

      Reflect.set(plugin, 'getBacklinkView', vi.fn().mockResolvedValue(backlinkView));

      const reloadBacklinksView = privateMethod(plugin, 'reloadBacklinksView');
      await reloadBacklinksView();

      expect(recomputeBacklink).not.toHaveBeenCalled();
    });

    it('should recompute when backlink view has a file', async () => {
      const { plugin } = createTestPlugin();

      const mockFile = createMockFile('note.md');
      const recomputeBacklink = vi.fn();
      const backlinkView = mockProxy<BacklinkView>({
        backlink: mockProxy({ recomputeBacklink }),
        file: mockFile
      });

      Reflect.set(plugin, 'getBacklinkView', vi.fn().mockResolvedValue(backlinkView));

      const reloadBacklinksView = privateMethod(plugin, 'reloadBacklinksView');
      await reloadBacklinksView();

      expect(recomputeBacklink).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('onBacklinksCorePluginEnable', () => {
    it('should invoke patchBacklinksPane asynchronously', () => {
      const { plugin } = createTestPlugin();

      const patchBacklinksPane = vi.fn().mockResolvedValue(undefined);
      Reflect.set(plugin, 'patchBacklinksPane', patchBacklinksPane);

      const onBacklinksCorePluginEnable = privateMethod(plugin, 'onBacklinksCorePluginEnable');
      onBacklinksCorePluginEnable();

      expect(patchBacklinksPane).toHaveBeenCalled();
    });
  });

  describe('patchBacklinksPane', () => {
    it('should return early when no backlink view exists', async () => {
      const { plugin } = createTestPlugin();

      const getBacklinkView = vi.fn().mockResolvedValue(null);
      Reflect.set(plugin, 'getBacklinkView', getBacklinkView);

      const patchBacklinksPane = privateMethod(plugin, 'patchBacklinksPane');
      await patchBacklinksPane();

      expect(getBacklinkView).toHaveBeenCalled();
    });

    it('should patch addResult on backlinkDom when view exists', async () => {
      const { plugin } = createTestPlugin();
      markPluginLoaded(plugin);

      const originalAddResult = vi.fn().mockImplementation(() => createMockResultDomItem(true));
      const backlinkDomProto = { addResult: originalAddResult };
      const backlinkView = mockProxy<BacklinkView>({
        backlink: mockProxy({
          backlinkDom: Object.create(backlinkDomProto) as object
        })
      });

      Reflect.set(plugin, 'getBacklinkView', vi.fn().mockResolvedValue(backlinkView));

      const patchBacklinksPane = privateMethod(plugin, 'patchBacklinksPane');
      await patchBacklinksPane();

      // The patchedAddResult is now on the prototype; call it to exercise the callback
      const file = createMockFile('folder/note.md');
      const result = mockProxy<ResultDomResult>({});
      const mockResultDom = Object.create(backlinkDomProto) as object;
      const patchedAddResult = backlinkDomProto.addResult as (
        file: TFile,
        result: ResultDomResult,
        content: string,
        shouldShowTitle?: boolean
      ) => ResultDomItem;
      const item = patchedAddResult.call(mockResultDom, file, result, 'content', true);

      expect(item).toBeDefined();
    });
  });

  describe('refreshBacklinkPanels with markdown leaves', () => {
    it('should skip leaves that are not MarkdownView instances', async () => {
      const { plugin } = createTestPlugin();

      Reflect.set(plugin, 'reloadBacklinksView', vi.fn().mockResolvedValue(undefined));

      const nonMarkdownLeaf = mockProxy<WorkspaceLeaf>({
        view: mockProxy({})
      });

      Reflect.set(
        plugin.app.workspace,
        'getLeavesOfType',
        vi.fn().mockImplementation((type: string) => {
          if (type === 'markdown') {
            return [nonMarkdownLeaf];
          }
          return [];
        })
      );

      const refreshBacklinkPanels = privateMethod(plugin, 'refreshBacklinkPanels');
      await refreshBacklinkPanels();
    });

    it('should skip MarkdownView leaves without backlinks', async () => {
      const { app, plugin } = createTestPlugin();

      Reflect.set(plugin, 'reloadBacklinksView', vi.fn().mockResolvedValue(undefined));

      const leaf = WorkspaceLeaf.create2__(app);
      const mdView = MarkdownView.create2__(leaf);
      Reflect.set(bypassStrictProxy(mdView), 'backlinks', undefined);
      Reflect.set(bypassStrictProxy(leaf), 'view', mdView);

      Reflect.set(
        plugin.app.workspace,
        'getLeavesOfType',
        vi.fn().mockImplementation((type: string) => {
          if (type === 'markdown') {
            return [leaf.asOriginalType__()];
          }
          return [];
        })
      );

      const refreshBacklinkPanels = privateMethod(plugin, 'refreshBacklinkPanels');
      await refreshBacklinkPanels();
    });

    it('should recompute backlinks for MarkdownView leaves with backlinks', async () => {
      const { app, plugin } = createTestPlugin();

      Reflect.set(plugin, 'reloadBacklinksView', vi.fn().mockResolvedValue(undefined));

      const leaf = WorkspaceLeaf.create2__(app);
      const mdView = MarkdownView.create2__(leaf);
      const mockFile = createMockFile('test2.md');
      const recomputeBacklink = vi.fn();
      Reflect.set(bypassStrictProxy(mdView), 'backlinks', { file: mockFile, recomputeBacklink });
      Reflect.set(bypassStrictProxy(leaf), 'view', mdView);

      Reflect.set(
        plugin.app.workspace,
        'getLeavesOfType',
        vi.fn().mockImplementation((type: string) => {
          if (type === 'markdown') {
            return [leaf.asOriginalType__()];
          }
          return [];
        })
      );

      const refreshBacklinkPanels = privateMethod(plugin, 'refreshBacklinkPanels');
      await refreshBacklinkPanels();

      expect(recomputeBacklink).toHaveBeenCalledWith(mockFile);
    });
  });
});
