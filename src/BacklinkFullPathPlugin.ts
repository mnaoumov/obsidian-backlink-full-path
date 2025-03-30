import type {
  PluginSettingTab,
  TFile
} from 'obsidian';
import type {
  BacklinkPlugin,
  BacklinkView,
  ResultDom,
  ResultDomResult,
  TreeDom
} from 'obsidian-typings';

import {
  MarkdownView,
  normalizePath
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';
import { getPrototypeOf } from 'obsidian-dev-utils/Object';
import { registerPatch } from 'obsidian-dev-utils/obsidian/MonkeyAround';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import { join } from 'obsidian-dev-utils/Path';
import {
  InternalPluginName,
  ViewType
} from 'obsidian-typings/implementations';

import { BacklinkFullPathPluginSettings } from './BacklinkFullPathPluginSettings.ts';
import { BacklinkFullPathPluginSettingsTab } from './BacklinkFullPathPluginSettingsTab.ts';

type AddResultFn = (file: TFile, result: ResultDomResult, content: string, shouldShowTitle?: boolean) => ResultDom;

export class BacklinkFullPathPlugin extends PluginBase<BacklinkFullPathPluginSettings> {
  public override async saveSettings(newSettings: BacklinkFullPathPluginSettings): Promise<void> {
    await super.saveSettings(newSettings);
    await this.refreshBacklinkPanels();
  }

  protected override createPluginSettings(data: unknown): BacklinkFullPathPluginSettings {
    return new BacklinkFullPathPluginSettings(data);
  }

  protected override createPluginSettingsTab(): null | PluginSettingTab {
    return new BacklinkFullPathPluginSettingsTab(this);
  }

  protected override async onLayoutReady(): Promise<void> {
    const backlinksCorePlugin = this.app.internalPlugins.getPluginById(InternalPluginName.Backlink);
    if (!backlinksCorePlugin) {
      return;
    }

    // eslint-disable-next-line consistent-this,@typescript-eslint/no-this-alias
    const plugin = this;
    registerPatch(this, getPrototypeOf(backlinksCorePlugin.instance), {
      onUserEnable: (next: () => void) =>
        function onUserEnablePatched(this: BacklinkPlugin): void {
          next.call(this);
          plugin.onBacklinksCorePluginEnable();
        }
    });

    if (backlinksCorePlugin.enabled) {
      await this.patchBacklinksPane();
      await this.refreshBacklinkPanels();
    }

    this.register(() => {
      invokeAsyncSafely(async () => {
        await this.refreshBacklinkPanels();
      });
    });
  }

  private addResult(next: AddResultFn, treeDom: TreeDom, file: TFile, result: ResultDomResult, content: string, shouldShowTitle?: boolean): ResultDom {
    const basename = file.basename;
    const name = file.name;
    const title = this.settings.shouldIncludeExtension ? normalizePath(join(file.parent?.path ?? '', file.basename)) : file.path;
    try {
      file.basename = title;
      file.name = title;
      return next.call(treeDom, file, result, content, shouldShowTitle);
    } finally {
      file.basename = basename;
      file.name = name;
    }
  }

  private async getBacklinkView(): Promise<BacklinkView | null> {
    const backlinksLeaf = this.app.workspace.getLeavesOfType(ViewType.Backlink)[0];
    if (!backlinksLeaf) {
      return null;
    }

    await backlinksLeaf.loadIfDeferred();
    return backlinksLeaf.view as BacklinkView;
  }

  private onBacklinksCorePluginEnable(): void {
    invokeAsyncSafely(() => this.patchBacklinksPane());
  }

  private async patchBacklinksPane(): Promise<void> {
    const backlinkView = await this.getBacklinkView();
    if (!backlinkView) {
      return;
    }

    // eslint-disable-next-line consistent-this,@typescript-eslint/no-this-alias
    const plugin = this;
    registerPatch(this, getPrototypeOf(backlinkView.backlink.backlinkDom), {
      addResult: (next: AddResultFn): AddResultFn =>
        function addResultPatched(this: TreeDom, file, result, content, shouldShowTitle?) {
          return plugin.addResult(next, this, file, result, content, shouldShowTitle);
        }
    });
  }

  private async refreshBacklinkPanels(): Promise<void> {
    await this.reloadBacklinksView();

    for (const leaf of this.app.workspace.getLeavesOfType(ViewType.Markdown)) {
      if (!(leaf.view instanceof MarkdownView)) {
        continue;
      }

      if (!leaf.view.backlinks) {
        continue;
      }

      leaf.view.backlinks.recomputeBacklink(leaf.view.backlinks.file);
    }
  }

  private async reloadBacklinksView(): Promise<void> {
    const backlinkView = await this.getBacklinkView();
    if (!backlinkView) {
      return;
    }
    if (backlinkView.file) {
      backlinkView.backlink.recomputeBacklink(backlinkView.file);
    }
  }
}
