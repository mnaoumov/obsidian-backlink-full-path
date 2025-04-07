import type { TFile } from 'obsidian';
import type {
  BacklinkPlugin,
  BacklinkView,
  ResultDom,
  ResultDomResult,
  TreeDom
} from 'obsidian-typings';

import {
  MarkdownView,
  setTooltip
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';
import { getPrototypeOf } from 'obsidian-dev-utils/Object';
import { registerPatch } from 'obsidian-dev-utils/obsidian/MonkeyAround';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import {
  InternalPluginName,
  ViewType
} from 'obsidian-typings/implementations';

import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

type AddResultFn = TreeDom['addResult'];

export class Plugin extends PluginBase<PluginTypes> {
  public override async onSaveSettings(): Promise<void> {
    await this.refreshBacklinkPanels();
  }

  protected override createPluginSettingsTab(): null | PluginSettingsTab {
    return new PluginSettingsTab(this);
  }

  protected override createSettingsManager(): PluginSettingsManager {
    return new PluginSettingsManager(this);
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
    const resultDom = next.call(treeDom, file, result, content, shouldShowTitle);
    const fileNameCaptionEl = resultDom.el.querySelector('.tree-item-inner');
    if (fileNameCaptionEl) {
      fileNameCaptionEl.empty();
      fileNameCaptionEl.appendChild(this.generateBacklinkTitle(file));
    }
    return resultDom;
  }

  private generateBacklinkTitle(file: TFile): HTMLDivElement {
    const fileNamePart = this.settings.shouldIncludeExtension ? file.name : file.basename;

    const parentPathParts = file.path.split('/');
    parentPathParts[parentPathParts.length - 1] = '';
    if (this.settings.pathDepth > 0) {
      const partsToSkipCount = Math.max(0, parentPathParts.length - this.settings.pathDepth);
      if (partsToSkipCount > 0) {
        parentPathParts.splice(0, partsToSkipCount);
        if (this.settings.shouldShowEllipsisForSkippedPathParts) {
          parentPathParts.unshift('...');
        }
      }
    }

    if (this.settings.shouldReversePathParts) {
      parentPathParts.reverse();
    }

    if (parentPathParts.length === 1) {
      parentPathParts.pop();
    }

    const pathSeparator = this.settings.shouldReversePathParts ? ' ← ' : '/';
    const parentStr = parentPathParts.join(pathSeparator);

    const container = createDiv();
    setTooltip(container, file.path);
    container.appendText(parentStr);
    container.createEl('span', {
      cls: this.settings.shouldHighlightFileName ? 'backlink-full-path file-name' : '',
      prepend: this.settings.shouldReversePathParts,
      text: fileNamePart
    });
    return container;
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
