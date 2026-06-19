import type {
  BacklinkView,
  ResultDomItem,
  ResultDomResult
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import { MarkdownView } from 'obsidian';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { BacklinkFullPathComponent } from './backlink-full-path-component.ts';
import { PluginSettings } from './plugin-settings.ts';

interface BacklinkDom {
  addResult(file: TFile, result: ResultDomResult, content: string, shouldShowTitle: boolean): ResultDomItem;
}

interface ComponentInternals {
  generateBacklinkTitle(file: TFile): HTMLDivElement;
  getBacklinkView(): Promise<BacklinkView | null>;
  onBacklinksCorePluginEnable(): void;
  onLayoutReady(): Promise<void>;
  patchBacklinksPane(): Promise<void>;
  refreshBacklinkPanels(): Promise<void>;
  reloadBacklinksView(): Promise<void>;
}

interface CorePlugin {
  enabled: boolean;
  instance: object;
}

interface PatchableTarget {
  addResult?(...args: never[]): unknown;
  onUserEnable?(...args: never[]): unknown;
}

interface PatchHandlerParams {
  fallback(): unknown;
  readonly originalArgs: readonly unknown[];
}

interface RegisteredCallbacksHolder {
  registeredCallbacks: (() => void)[];
}

interface RegisterMethodPatchParams {
  readonly methodName: 'addResult' | 'onUserEnable';
  readonly obj: PatchableTarget;
  patchHandler(params: PatchHandlerParams): unknown;
}

interface TestContext {
  app: App;
  component: BacklinkFullPathComponent;
  getPluginById: ReturnType<typeof vi.fn>;
  markdownLeaves: WorkspaceLeaf[];
  on: ReturnType<typeof vi.fn>;
  registeredCallbacks: (() => void)[];
  settings: PluginSettings;
}

vi.mock('obsidian-dev-utils/async', () => ({
  invokeAsyncSafely: vi.fn((fn: () => Promise<void>) => fn())
}));

vi.mock('obsidian-dev-utils/obsidian/components/layout-ready-component', () => ({
  LayoutReadyComponent: class MockLayoutReadyComponent {
    public app: App;
    public readonly registeredCallbacks: (() => void)[] = [];

    public constructor(app: App) {
      this.app = app;
    }

    public addChild(child: unknown): unknown {
      return child;
    }

    public register(callback: () => void): void {
      this.registeredCallbacks.push(callback);
    }
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/monkey-around-component', () => ({
  MonkeyAroundComponent: class MockMonkeyAroundComponent {
    public registerMethodPatch(params: RegisterMethodPatchParams): void {
      const {
        methodName,
        obj,
        patchHandler
      } = params;
      const originalMethod = obj[methodName];
      obj[methodName] = function patched(this: unknown, ...originalArgs: never[]): unknown {
        return patchHandler({
          fallback: () => originalMethod?.apply(this, originalArgs),
          originalArgs
        });
      };
    }
  }
}));

function asInternals(component: BacklinkFullPathComponent): ComponentInternals {
  return castTo<ComponentInternals>(component);
}

function createCorePlugin(enabled: boolean, instanceProto: object = {}): CorePlugin {
  return {
    enabled,
    instance: Object.create(instanceProto)
  };
}

function createMarkdownLeaf(backlinks: unknown): WorkspaceLeaf {
  return castTo<WorkspaceLeaf>({
    view: Object.assign(Object.create(MarkdownView.prototype), { backlinks })
  });
}

function createMockFile(path: string): TFile {
  const parts = path.split('/');
  const name = parts.at(-1) ?? '';
  const dotIndex = name.lastIndexOf('.');
  const basename = dotIndex >= 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex >= 0 ? name.slice(dotIndex + 1) : '';
  return strictProxy<TFile>({
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
  return strictProxy<ResultDomItem>({ el });
}

function createTestContext(): TestContext {
  const settings = new PluginSettings();
  const markdownLeaves: WorkspaceLeaf[] = [];
  const getPluginById = vi.fn();
  const on = vi.fn();

  const app = strictProxy<App>({
    internalPlugins: {
      getPluginById
    },
    workspace: {
      getLeavesOfType: vi.fn().mockImplementation((type: string) => {
        if (type === ViewType.Markdown) {
          return markdownLeaves;
        }
        return [];
      })
    }
  });

  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({
    on,
    settings
  });

  const component = new BacklinkFullPathComponent({
    app,
    pluginSettingsComponent
  });

  const registeredCallbacks = castTo<RegisteredCallbacksHolder>(component).registeredCallbacks;

  return {
    app,
    component,
    getPluginById,
    markdownLeaves,
    on,
    registeredCallbacks,
    settings
  };
}

describe('BacklinkFullPathComponent', () => {
  let context: TestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  describe('onLayoutReady', () => {
    it('should register a saveSettings handler that refreshes panels', async () => {
      context.getPluginById.mockReturnValue(undefined);
      const refreshSpy = vi.spyOn(asInternals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);

      await asInternals(context.component).onLayoutReady();

      expect(context.on).toHaveBeenCalledWith('saveSettings', expect.any(Function));
      const handler = context.on.mock.calls[0]?.[1] as () => Promise<void>;
      await handler();
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should return early when backlinks core plugin is not found', async () => {
      context.getPluginById.mockReturnValue(undefined);
      const patchSpy = vi.spyOn(asInternals(context.component), 'patchBacklinksPane').mockResolvedValue(undefined);

      await asInternals(context.component).onLayoutReady();

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('should patch onUserEnable to call onBacklinksCorePluginEnable', async () => {
      const originalOnUserEnable = vi.fn();
      const instanceProto = { onUserEnable: originalOnUserEnable };
      const corePlugin = createCorePlugin(false, instanceProto);
      context.getPluginById.mockReturnValue(corePlugin);

      const enableSpy = vi.spyOn(asInternals(context.component), 'onBacklinksCorePluginEnable').mockReturnValue(undefined);

      await asInternals(context.component).onLayoutReady();

      instanceProto.onUserEnable.call(corePlugin.instance);

      expect(originalOnUserEnable).toHaveBeenCalled();
      expect(enableSpy).toHaveBeenCalled();
    });

    it('should patch pane and refresh panels when plugin is enabled', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(true));
      const patchSpy = vi.spyOn(asInternals(context.component), 'patchBacklinksPane').mockResolvedValue(undefined);
      const refreshSpy = vi.spyOn(asInternals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);

      await asInternals(context.component).onLayoutReady();

      expect(patchSpy).toHaveBeenCalled();
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should not patch pane when plugin is disabled', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(false));
      const patchSpy = vi.spyOn(asInternals(context.component), 'patchBacklinksPane').mockResolvedValue(undefined);

      await asInternals(context.component).onLayoutReady();

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('should register an unload callback that refreshes panels', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(false));
      const refreshSpy = vi.spyOn(asInternals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);

      await asInternals(context.component).onLayoutReady();

      expect(context.registeredCallbacks.length).toBeGreaterThan(0);
      const callback = context.registeredCallbacks[0];
      callback?.();

      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('generateBacklinkTitle', () => {
    function callGenerateBacklinkTitle(file: TFile): HTMLDivElement {
      return asInternals(context.component).generateBacklinkTitle.call(context.component, file);
    }

    it('should include extension when shouldIncludeExtension is true', () => {
      context.settings.shouldIncludeExtension = true;
      const container = callGenerateBacklinkTitle(createMockFile('folder/note.md'));
      const fileNameSpan = container.shadowRoot?.querySelector('[part="file-name"]');
      expect(fileNameSpan?.textContent).toBe('note.md');
    });

    it('should exclude extension when shouldIncludeExtension is false', () => {
      context.settings.shouldIncludeExtension = false;
      const container = callGenerateBacklinkTitle(createMockFile('folder/note.md'));
      const fileNameSpan = container.shadowRoot?.querySelector('[part="file-name"]');
      expect(fileNameSpan?.textContent).toBe('note');
    });

    it('should show file at root with no parent path', () => {
      const container = callGenerateBacklinkTitle(createMockFile('note.md'));
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan).toBeNull();
    });

    it('should show parent path with trailing separator', () => {
      context.settings.shouldReversePathParts = false;
      context.settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = callGenerateBacklinkTitle(createMockFile('folder/note.md'));
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('folder/');
    });

    it('should strip root path prefix', () => {
      context.settings.rootPaths = ['folder'];
      const container = callGenerateBacklinkTitle(createMockFile('folder/subfolder/note.md'));
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('subfolder/');
    });

    it('should strip nested root path prefix', () => {
      context.settings.rootPaths = ['folder/subfolder'];
      const container = callGenerateBacklinkTitle(createMockFile('folder/subfolder/deep/note.md'));
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('deep/');
    });

    it('should limit depth with pathDepth setting', () => {
      context.settings.pathDepth = 2;
      context.settings.shouldShowEllipsisForSkippedPathParts = false;
      const container = callGenerateBacklinkTitle(createMockFile('a/b/c/note.md'));
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('c/');
    });

    it('should add ellipsis for skipped parts when enabled', () => {
      context.settings.pathDepth = 2;
      context.settings.shouldShowEllipsisForSkippedPathParts = true;
      const container = callGenerateBacklinkTitle(createMockFile('a/b/c/note.md'));
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('.../c/');
    });

    it('should not add ellipsis when pathDepth does not truncate', () => {
      context.settings.pathDepth = 5;
      context.settings.shouldShowEllipsisForSkippedPathParts = true;
      const container = callGenerateBacklinkTitle(createMockFile('a/b/note.md'));
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('a/b/');
    });

    it('should reverse path parts when shouldReversePathParts is true', () => {
      context.settings.shouldReversePathParts = true;
      context.settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = callGenerateBacklinkTitle(createMockFile('a/b/note.md'));
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe(' ← b ← a');
    });

    it('should display parent path on separate line without separator', () => {
      context.settings.shouldDisplayParentPathOnSeparateLine = true;
      context.settings.shouldReversePathParts = false;
      const container = callGenerateBacklinkTitle(createMockFile('folder/note.md'));
      const parentPathSpan = container.shadowRoot?.querySelector('[part="parent-path"]');
      expect(parentPathSpan?.textContent).toBe('folder');
    });

    it('should set dataset attributes for highlighting', () => {
      context.settings.shouldHighlightFileName = true;
      context.settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = callGenerateBacklinkTitle(createMockFile('note.md'));
      expect(container.dataset['shouldHighlightFileName']).toBe('true');
      expect(container.dataset['shouldDisplayParentPathOnSeparateLine']).toBe('false');
    });

    it('should include full-path span with file path', () => {
      const container = callGenerateBacklinkTitle(createMockFile('folder/note.md'));
      const fullPathSpan = container.querySelector('.full-path');
      expect(fullPathSpan?.textContent).toBe('folder/note.md');
    });

    it('should prepend parent path when not reversed and not on separate line', () => {
      context.settings.shouldReversePathParts = false;
      context.settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = callGenerateBacklinkTitle(createMockFile('folder/note.md'));
      const firstChild = container.shadowRoot?.firstElementChild;
      expect(firstChild?.getAttribute('part')).toBe('parent-path');
    });

    it('should append parent path when reversed and not on separate line', () => {
      context.settings.shouldReversePathParts = true;
      context.settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = callGenerateBacklinkTitle(createMockFile('folder/note.md'));
      const lastChild = container.shadowRoot?.lastElementChild;
      expect(lastChild?.getAttribute('part')).toBe('parent-path');
    });

    it('should not prepend when displaying on separate line', () => {
      context.settings.shouldReversePathParts = false;
      context.settings.shouldDisplayParentPathOnSeparateLine = true;
      const container = callGenerateBacklinkTitle(createMockFile('folder/note.md'));
      const lastChild = container.shadowRoot?.lastElementChild;
      expect(lastChild?.getAttribute('part')).toBe('parent-path');
    });
  });

  describe('getBacklinkView', () => {
    it('should return null when no backlink leaf exists', async () => {
      const view = await asInternals(context.component).getBacklinkView();
      expect(view).toBeNull();
    });

    it('should return the view when a backlink leaf exists', async () => {
      const mockView = strictProxy<BacklinkView>({});
      const loadIfDeferred = vi.fn().mockResolvedValue(undefined);
      const mockLeaf = castTo<WorkspaceLeaf>({
        loadIfDeferred,
        view: mockView
      });

      vi.mocked(context.app.workspace.getLeavesOfType).mockImplementation((type: string) => {
        if (type === ViewType.Backlink) {
          return [mockLeaf];
        }
        return [];
      });

      const view = await asInternals(context.component).getBacklinkView();

      expect(loadIfDeferred).toHaveBeenCalled();
      expect(view).toBe(mockView);
    });
  });

  describe('onBacklinksCorePluginEnable', () => {
    it('should invoke patchBacklinksPane', () => {
      const patchSpy = vi.spyOn(asInternals(context.component), 'patchBacklinksPane').mockResolvedValue(undefined);

      asInternals(context.component).onBacklinksCorePluginEnable();

      expect(patchSpy).toHaveBeenCalled();
    });
  });

  describe('patchBacklinksPane', () => {
    it('should return early when no backlink view exists', async () => {
      const getViewSpy = vi.spyOn(asInternals(context.component), 'getBacklinkView').mockResolvedValue(null);

      await asInternals(context.component).patchBacklinksPane();

      expect(getViewSpy).toHaveBeenCalled();
    });

    it('should patch addResult to replace tree-item-inner with generated title', async () => {
      const originalAddResult = vi.fn().mockImplementation(() => createMockResultDomItem(true));
      const backlinkDomProto: BacklinkDom = { addResult: originalAddResult };
      const backlinkView = strictProxy<BacklinkView>({
        backlink: strictProxy({
          backlinkDom: Object.create(backlinkDomProto)
        })
      });
      vi.spyOn(asInternals(context.component), 'getBacklinkView').mockResolvedValue(backlinkView);

      await asInternals(context.component).patchBacklinksPane();

      const file = createMockFile('folder/note.md');
      const result = strictProxy<ResultDomResult>({});
      const item = backlinkDomProto.addResult(file, result, 'content', true);

      const inner = item.el.querySelector('.tree-item-inner');
      expect(inner?.textContent).not.toBe('Original');
    });

    it('should leave result unchanged when tree-item-inner is absent', async () => {
      const originalAddResult = vi.fn().mockImplementation(() => createMockResultDomItem(false));
      const backlinkDomProto: BacklinkDom = { addResult: originalAddResult };
      const backlinkView = strictProxy<BacklinkView>({
        backlink: strictProxy({
          backlinkDom: Object.create(backlinkDomProto)
        })
      });
      vi.spyOn(asInternals(context.component), 'getBacklinkView').mockResolvedValue(backlinkView);

      await asInternals(context.component).patchBacklinksPane();

      const file = createMockFile('note.md');
      const result = strictProxy<ResultDomResult>({});
      const item = backlinkDomProto.addResult(file, result, 'content', true);

      expect(item.el.querySelector('.tree-item-inner')).toBeNull();
    });
  });

  describe('reloadBacklinksView', () => {
    it('should do nothing when no backlink view exists', async () => {
      const getViewSpy = vi.spyOn(asInternals(context.component), 'getBacklinkView').mockResolvedValue(null);

      await asInternals(context.component).reloadBacklinksView();

      expect(getViewSpy).toHaveBeenCalled();
    });

    it('should not recompute when backlink view has no file', async () => {
      const recomputeBacklink = vi.fn();
      const backlinkView = strictProxy<BacklinkView>({
        backlink: strictProxy({ recomputeBacklink }),
        file: null
      });
      vi.spyOn(asInternals(context.component), 'getBacklinkView').mockResolvedValue(backlinkView);

      await asInternals(context.component).reloadBacklinksView();

      expect(recomputeBacklink).not.toHaveBeenCalled();
    });

    it('should recompute when backlink view has a file', async () => {
      const mockFile = createMockFile('note.md');
      const recomputeBacklink = vi.fn();
      const backlinkView = strictProxy<BacklinkView>({
        backlink: strictProxy({ recomputeBacklink }),
        file: mockFile
      });
      vi.spyOn(asInternals(context.component), 'getBacklinkView').mockResolvedValue(backlinkView);

      await asInternals(context.component).reloadBacklinksView();

      expect(recomputeBacklink).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('refreshBacklinkPanels', () => {
    beforeEach(() => {
      vi.spyOn(asInternals(context.component), 'reloadBacklinksView').mockResolvedValue(undefined);
    });

    it('should skip leaves that are not MarkdownView instances', async () => {
      context.markdownLeaves.push(castTo<WorkspaceLeaf>({ view: {} }));

      await asInternals(context.component).refreshBacklinkPanels();

      expect(asInternals(context.component).reloadBacklinksView).toHaveBeenCalled();
    });

    it('should skip MarkdownView leaves without backlinks', async () => {
      context.markdownLeaves.push(createMarkdownLeaf(undefined));

      await asInternals(context.component).refreshBacklinkPanels();

      expect(asInternals(context.component).reloadBacklinksView).toHaveBeenCalled();
    });

    it('should recompute backlinks for MarkdownView leaves with backlinks', async () => {
      const mockFile = createMockFile('test2.md');
      const recomputeBacklink = vi.fn();
      context.markdownLeaves.push(createMarkdownLeaf({ file: mockFile, recomputeBacklink }));

      await asInternals(context.component).refreshBacklinkPanels();

      expect(recomputeBacklink).toHaveBeenCalledWith(mockFile);
    });
  });
});
