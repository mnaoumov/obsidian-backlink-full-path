import type { BacklinkView } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  TFile,
  WorkspaceLeaf
} from 'obsidian';
import type { Mock } from 'vitest';

import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import { MarkdownView } from 'obsidian';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { BacklinkFullPathComponent } from './backlink-full-path-component.ts';
import { ResultDomAddResultPatchComponent } from './patches/result-dom-add-result-patch-component.ts';
import { PluginSettings } from './plugin-settings.ts';

interface ComponentInternals {
  getBacklinkView(): Promise<BacklinkView | null>;
  patchBacklinksPane(): Promise<void>;
  refreshBacklinkPanels(): Promise<void>;
  reloadBacklinksView(): Promise<void>;
}

interface CorePlugin {
  enabled: boolean;
  instance: object;
}

interface PushBacklinkViewParams {
  readonly file: null | TFile;
  readonly recomputeBacklink: Mock<(backlinkFile: null | TFile) => void>;
}

interface TestContext {
  app: App;
  backlinkLeaves: WorkspaceLeaf[];
  component: BacklinkFullPathComponent;
  getPluginById: ReturnType<typeof vi.fn>;
  markdownLeaves: WorkspaceLeaf[];
  on: ReturnType<typeof vi.fn>;
}

describe('BacklinkFullPathComponent', () => {
  let context: TestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('onLayoutReady', () => {
    it('should register a saveSettings handler that refreshes panels', async () => {
      context.getPluginById.mockReturnValue(undefined);
      const refreshSpy = vi.spyOn(internals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);

      await triggerLayoutReady();

      expect(context.on).toHaveBeenCalledWith('saveSettings', expect.any(Function));
      const handler = castTo<() => Promise<void>>(context.on.mock.calls[0]?.[1]);
      await handler();
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should not patch the pane when the backlinks core plugin is not found', async () => {
      context.getPluginById.mockReturnValue(undefined);
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(undefined);

      await triggerLayoutReady();

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('should add the onUserEnable patch child when the core plugin is found', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(false));
      vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(undefined);
      const addChildSpy = vi.spyOn(context.component, 'addChild');

      await triggerLayoutReady();

      expect(addChildSpy).toHaveBeenCalled();
    });

    it('should patch the pane and refresh panels when the plugin is enabled', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(true));
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(undefined);
      const refreshSpy = vi.spyOn(internals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);

      await triggerLayoutReady();

      expect(patchSpy).toHaveBeenCalled();
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should not patch the pane when the plugin is disabled', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(false));
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(undefined);

      await triggerLayoutReady();

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('should register an unload callback that refreshes panels', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(false));
      const refreshSpy = vi.spyOn(internals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);
      const registerSpy = vi.spyOn(context.component, 'register');

      await triggerLayoutReady();

      const unloadCallback = registerSpy.mock.calls.at(-1)?.[0];
      unloadCallback?.();

      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('onBacklinksCorePluginEnable', () => {
    it('should patch the backlinks pane', () => {
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(undefined);

      context.component.onBacklinksCorePluginEnable();

      expect(patchSpy).toHaveBeenCalled();
    });
  });

  describe('getBacklinkView', () => {
    it('should return null when no backlink leaf exists', async () => {
      const view = await internals(context.component).getBacklinkView();
      expect(view).toBeNull();
    });

    it('should load the deferred leaf and return its view', async () => {
      const backlinkView = strictProxy<BacklinkView>({});
      const loadIfDeferred = vi.fn().mockResolvedValue(undefined);
      context.backlinkLeaves.push(castTo<WorkspaceLeaf>({
        loadIfDeferred,
        view: backlinkView
      }));

      const view = await internals(context.component).getBacklinkView();

      expect(loadIfDeferred).toHaveBeenCalled();
      expect(view).toBe(backlinkView);
    });
  });

  describe('patchBacklinksPane', () => {
    it('should do nothing when no backlink view exists', async () => {
      const addChildSpy = vi.spyOn(context.component, 'addChild');

      await internals(context.component).patchBacklinksPane();

      expect(addChildSpy).not.toHaveBeenCalled();
    });

    it('should add a result-dom patch child when a backlink view exists', async () => {
      const backlinkDomProto = { addResult: vi.fn() };
      const backlinkView = strictProxy<BacklinkView>({
        backlink: strictProxy({
          backlinkDom: Object.create(backlinkDomProto)
        })
      });
      context.backlinkLeaves.push(castTo<WorkspaceLeaf>({
        loadIfDeferred: vi.fn().mockResolvedValue(undefined),
        view: backlinkView
      }));
      const addChildSpy = vi.spyOn(context.component, 'addChild');

      await internals(context.component).patchBacklinksPane();

      expect(addChildSpy).toHaveBeenCalledWith(expect.any(ResultDomAddResultPatchComponent));
    });
  });

  describe('reloadBacklinksView', () => {
    it('should do nothing when no backlink view exists', async () => {
      await expect(internals(context.component).reloadBacklinksView()).resolves.toBeUndefined();
    });

    it('should not recompute when the backlink view has no file', async () => {
      const recomputeBacklink = vi.fn<(backlinkFile: null | TFile) => void>();
      pushBacklinkView({ file: null, recomputeBacklink });

      await internals(context.component).reloadBacklinksView();

      expect(recomputeBacklink).not.toHaveBeenCalled();
    });

    it('should recompute when the backlink view has a file', async () => {
      const file = createMockFile('note.md');
      const recomputeBacklink = vi.fn<(backlinkFile: null | TFile) => void>();
      pushBacklinkView({ file, recomputeBacklink });

      await internals(context.component).reloadBacklinksView();

      expect(recomputeBacklink).toHaveBeenCalledWith(file);
    });
  });

  describe('refreshBacklinkPanels', () => {
    beforeEach(() => {
      vi.spyOn(internals(context.component), 'reloadBacklinksView').mockResolvedValue(undefined);
    });

    it('should skip leaves that are not MarkdownView instances', async () => {
      context.markdownLeaves.push(castTo<WorkspaceLeaf>({ view: {} }));

      await expect(internals(context.component).refreshBacklinkPanels()).resolves.toBeUndefined();
    });

    it('should skip MarkdownView leaves without backlinks', async () => {
      context.markdownLeaves.push(createMarkdownLeaf(undefined));

      await expect(internals(context.component).refreshBacklinkPanels()).resolves.toBeUndefined();
    });

    it('should recompute backlinks for MarkdownView leaves with backlinks', async () => {
      const file = createMockFile('note.md');
      const recomputeBacklink = vi.fn();
      context.markdownLeaves.push(createMarkdownLeaf({ file, recomputeBacklink }));

      await internals(context.component).refreshBacklinkPanels();

      expect(recomputeBacklink).toHaveBeenCalledWith(file);
    });
  });

  function pushBacklinkView(backlink: PushBacklinkViewParams): void {
    const backlinkView = strictProxy<BacklinkView>({
      backlink: strictProxy({ recomputeBacklink: backlink.recomputeBacklink }),
      file: backlink.file
    });
    context.backlinkLeaves.push(castTo<WorkspaceLeaf>({
      loadIfDeferred: vi.fn().mockResolvedValue(undefined),
      view: backlinkView
    }));
  }

  async function triggerLayoutReady(): Promise<void> {
    vi.useFakeTimers();
    context.component.load();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  }
});

function createCorePlugin(enabled: boolean): CorePlugin {
  return {
    enabled,
    instance: Object.create({ onUserEnable: vi.fn() })
  };
}

function createMarkdownLeaf(backlinks: unknown): WorkspaceLeaf {
  return castTo<WorkspaceLeaf>({
    view: Object.assign(Object.create(MarkdownView.prototype), { backlinks })
  });
}

function createMockFile(path: string): TFile {
  return strictProxy<TFile>({ path });
}

function createTestContext(): TestContext {
  const backlinkLeaves: WorkspaceLeaf[] = [];
  const markdownLeaves: WorkspaceLeaf[] = [];
  const getPluginById = vi.fn();
  const on = vi.fn();

  const app = strictProxy<App>({
    internalPlugins: {
      getPluginById
    },
    workspace: {
      getLeavesOfType: vi.fn().mockImplementation((type: string) => {
        if (type === ViewType.Backlink) {
          return backlinkLeaves;
        }
        if (type === ViewType.Markdown) {
          return markdownLeaves;
        }
        return [];
      }),
      onLayoutReady: vi.fn().mockImplementation((callback: () => void) => {
        callback();
      })
    }
  });

  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({
    on,
    settings: new PluginSettings()
  });

  const component = new BacklinkFullPathComponent({
    app,
    pluginSettingsComponent
  });

  return {
    app,
    backlinkLeaves,
    component,
    getPluginById,
    markdownLeaves,
    on
  };
}

function internals(component: BacklinkFullPathComponent): ComponentInternals {
  return castTo<ComponentInternals>(component);
}
