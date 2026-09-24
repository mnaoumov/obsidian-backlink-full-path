import type { BacklinkView } from '@obsidian-typings/obsidian-public-latest';
import type { BacklinkComponent } from '@obsidian-typings/obsidian-public-latest/implementations';
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
  getBacklinkComponent: () => Promise<BacklinkComponent | null>;
  getBacklinkView: () => Promise<BacklinkView | null>;
  onBacklinksCorePluginEnable: () => void;
  patchBacklinksPane: () => Promise<boolean>;
  patchLateBacklinks: () => Promise<void>;
  refreshBacklinkPanels: () => Promise<void>;
  reloadBacklinksView: () => Promise<void>;
}

interface CorePlugin {
  enabled: boolean;
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
  internalPluginsOn: ReturnType<typeof vi.fn>;
  markdownLeaves: WorkspaceLeaf[];
  on: ReturnType<typeof vi.fn>;
  triggerChange: () => void;
  triggerLayoutChange: () => void;
  workspaceOn: ReturnType<typeof vi.fn>;
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
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);

      await triggerLayoutReady();

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('should subscribe to internal plugin changes when the core plugin is found', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(false));
      vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);

      await triggerLayoutReady();

      expect(context.internalPluginsOn).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should patch the pane when the core plugin becomes enabled', async () => {
      const corePlugin = createCorePlugin(false);
      context.getPluginById.mockReturnValue(corePlugin);
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);

      await triggerLayoutReady();
      corePlugin.enabled = true;
      context.triggerChange();

      expect(patchSpy).toHaveBeenCalledOnce();
    });

    it('should patch the pane once per enable, not on every change', async () => {
      const corePlugin = createCorePlugin(false);
      context.getPluginById.mockReturnValue(corePlugin);
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);

      await triggerLayoutReady();
      corePlugin.enabled = true;
      context.triggerChange();
      context.triggerChange();

      expect(patchSpy).toHaveBeenCalledOnce();
    });

    it('should not patch the pane when the core plugin becomes disabled', async () => {
      const corePlugin = createCorePlugin(true);
      context.getPluginById.mockReturnValue(corePlugin);
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);
      vi.spyOn(internals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);

      await triggerLayoutReady();
      patchSpy.mockClear();
      corePlugin.enabled = false;
      context.triggerChange();

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('should patch the pane and refresh panels when the plugin is enabled', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(true));
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);
      const refreshSpy = vi.spyOn(internals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);

      await triggerLayoutReady();

      expect(patchSpy).toHaveBeenCalled();
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should not patch the pane when the plugin is disabled', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(false));
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);

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

    it('should retry the patch on a layout change while the core plugin is enabled and nothing is patched', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(true));
      vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);
      vi.spyOn(internals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);
      const patchLateSpy = vi.spyOn(internals(context.component), 'patchLateBacklinks').mockResolvedValue(undefined);

      await triggerLayoutReady();
      context.triggerLayoutChange();

      expect(context.workspaceOn).toHaveBeenCalledWith('layout-change', expect.any(Function));
      expect(patchLateSpy).toHaveBeenCalledOnce();
    });

    it('should not retry the patch on a layout change while the core plugin is disabled', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(false));
      const patchLateSpy = vi.spyOn(internals(context.component), 'patchLateBacklinks').mockResolvedValue(undefined);

      await triggerLayoutReady();
      context.triggerLayoutChange();

      expect(patchLateSpy).not.toHaveBeenCalled();
    });

    it('should not retry the patch on a layout change once it is installed', async () => {
      context.getPluginById.mockReturnValue(createCorePlugin(true));
      pushPatchableBacklinkView();
      vi.spyOn(internals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);
      const patchLateSpy = vi.spyOn(internals(context.component), 'patchLateBacklinks').mockResolvedValue(undefined);

      await triggerLayoutReady();
      context.triggerLayoutChange();

      expect(patchLateSpy).not.toHaveBeenCalled();
    });
  });

  describe('patchLateBacklinks', () => {
    it('should refresh the panels when the patch was installed now', async () => {
      vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(true);
      const refreshSpy = vi.spyOn(internals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);

      await internals(context.component).patchLateBacklinks();

      expect(refreshSpy).toHaveBeenCalledOnce();
    });

    it('should not refresh the panels when nothing was patched', async () => {
      vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);
      const refreshSpy = vi.spyOn(internals(context.component), 'refreshBacklinkPanels').mockResolvedValue(undefined);

      await internals(context.component).patchLateBacklinks();

      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('getBacklinkComponent', () => {
    it('should return the pane backlinks when the pane exists', async () => {
      const backlink = strictProxy<BacklinkComponent>({});
      context.backlinkLeaves.push(castTo<WorkspaceLeaf>({
        loadIfDeferred: vi.fn().mockResolvedValue(undefined),
        view: strictProxy<BacklinkView>({ backlink })
      }));

      await expect(internals(context.component).getBacklinkComponent()).resolves.toBe(backlink);
    });

    it('should fall back to the first in-document backlinks when the pane is closed', async () => {
      const backlinks = strictProxy<BacklinkComponent>({});
      context.markdownLeaves.push(castTo<WorkspaceLeaf>({ view: {} }), createMarkdownLeaf(null), createMarkdownLeaf(backlinks));

      await expect(internals(context.component).getBacklinkComponent()).resolves.toBe(backlinks);
    });

    it('should return null when neither the pane nor in-document backlinks exist', async () => {
      context.markdownLeaves.push(createMarkdownLeaf(null));

      await expect(internals(context.component).getBacklinkComponent()).resolves.toBeNull();
    });
  });

  describe('onBacklinksCorePluginEnable', () => {
    it('should patch the backlinks pane', () => {
      const patchSpy = vi.spyOn(internals(context.component), 'patchBacklinksPane').mockResolvedValue(false);

      internals(context.component).onBacklinksCorePluginEnable();

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
      const backlinkDomPrototype = { addResult: vi.fn() };
      const backlinkView = strictProxy<BacklinkView>({
        backlink: strictProxy({
          backlinkDom: Object.create(backlinkDomPrototype)
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

    it('should add the result-dom patch child only once across repeated calls', async () => {
      const backlinkDomPrototype = { addResult: vi.fn() };
      const backlinkView = strictProxy<BacklinkView>({
        backlink: strictProxy({
          backlinkDom: Object.create(backlinkDomPrototype)
        })
      });
      context.backlinkLeaves.push(castTo<WorkspaceLeaf>({
        loadIfDeferred: vi.fn().mockResolvedValue(undefined),
        view: backlinkView
      }));
      const addChildSpy = vi.spyOn(context.component, 'addChild');

      await Promise.all([
        internals(context.component).patchBacklinksPane(),
        internals(context.component).patchBacklinksPane()
      ]);
      await internals(context.component).patchBacklinksPane();

      expect(addChildSpy).toHaveBeenCalledOnce();
    });

    it('should still patch on a later call when an earlier one found no backlink view', async () => {
      const addChildSpy = vi.spyOn(context.component, 'addChild');
      await internals(context.component).patchBacklinksPane();

      const backlinkDomPrototype = { addResult: vi.fn() };
      const backlinkView = strictProxy<BacklinkView>({
        backlink: strictProxy({
          backlinkDom: Object.create(backlinkDomPrototype)
        })
      });
      context.backlinkLeaves.push(castTo<WorkspaceLeaf>({
        loadIfDeferred: vi.fn().mockResolvedValue(undefined),
        view: backlinkView
      }));
      await internals(context.component).patchBacklinksPane();

      expect(addChildSpy).toHaveBeenCalledOnce();
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

  function pushPatchableBacklinkView(): void {
    const backlinkView = strictProxy<BacklinkView>({
      backlink: strictProxy({
        backlinkDom: Object.create({ addResult: vi.fn() })
      })
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

function createCorePlugin(isEnabled: boolean): CorePlugin {
  return { enabled: isEnabled };
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
  const internalPluginsOn = vi.fn().mockReturnValue({});
  const on = vi.fn();
  const workspaceOn = vi.fn().mockReturnValue({});

  const app = strictProxy<App>({
    internalPlugins: {
      getPluginById,
      on: internalPluginsOn
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
      on: workspaceOn,
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
    internalPluginsOn,
    markdownLeaves,
    on,
    triggerChange: (): void => {
      castTo<() => void>(internalPluginsOn.mock.calls[0]?.[1])();
    },
    triggerLayoutChange: (): void => {
      castTo<() => void>(workspaceOn.mock.calls.find(([name]) => name === 'layout-change')?.[1])();
    },
    workspaceOn
  };
}

function internals(component: BacklinkFullPathComponent): ComponentInternals {
  return castTo<ComponentInternals>(component);
}
