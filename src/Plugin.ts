import type { TFile } from 'obsidian';
import type {
  BacklinkPlugin,
  BacklinkView,
  ResultDom,
  ResultDomItem,
  ResultDomResult
} from 'obsidian-typings';

import {
  MarkdownView,
  setTooltip
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';
import { getPrototypeOf } from 'obsidian-dev-utils/ObjectUtils';
import { registerPatch } from 'obsidian-dev-utils/obsidian/MonkeyAround';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import {
  InternalPluginName,
  ViewType
} from 'obsidian-typings/implementations';

import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

type AddResultFn = ResultDom['addResult'];

export class Plugin extends PluginBase<PluginTypes> {
  public override async onSaveSettings(): Promise<void> {
    await this.refreshBacklinkPanels();
  }

  protected override createSettingsManager(): PluginSettingsManager {
    return new PluginSettingsManager(this);
  }

  protected override createSettingsTab(): null | PluginSettingsTab {
    return new PluginSettingsTab(this);
  }

  protected override async onLayoutReady(): Promise<void> {
    const backlinksCorePlugin = this.app.internalPlugins.getPluginById(InternalPluginName.Backlink);
    if (!backlinksCorePlugin) {
      return;
    }

    const that = this;
    registerPatch(this, getPrototypeOf(backlinksCorePlugin.instance), {
      onUserEnable: (next: () => void) => {
        return function onUserEnablePatched(this: BacklinkPlugin): void {
          next.call(this);
          that.onBacklinksCorePluginEnable();
        };
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

  private addResult(next: AddResultFn, resultDom: ResultDom, file: TFile, result: ResultDomResult, content: string, shouldShowTitle?: boolean): ResultDomItem {
    const resultDomItem = next.call(resultDom, file, result, content, shouldShowTitle);
    const fileNameCaptionEl = resultDomItem.el.querySelector('.tree-item-inner');
    if (fileNameCaptionEl) {
      fileNameCaptionEl.empty();
      fileNameCaptionEl.appendChild(this.generateBacklinkTitle(file));
    }
    return resultDomItem;
  }

  private generateBacklinkTitle(file: TFile): HTMLDivElement {
    const fileNamePart = this.settings.shouldIncludeExtension ? file.name : file.basename;

    const parentPathParts = file.path.split('/').slice(0, -1);
    if (this.settings.pathDepth > 0) {
      const partsToSkipCount = Math.max(0, parentPathParts.length - this.settings.pathDepth + 1);
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

    const pathSeparator = this.settings.shouldReversePathParts ? ' ← ' : '/';
    const parentStr = parentPathParts.join(pathSeparator);

    const container = createDiv({
      cls: ['backlink-full-path', 'backlink-control']
    });
    container.dataset['shouldHighlightFileName'] = this.settings.shouldHighlightFileName.toString();
    container.dataset['shouldDisplayParentPathOnSeparateLine'] = this.settings.shouldDisplayParentPathOnSeparateLine.toString();
    container.createSpan({
      cls: 'full-path',
      text: file.path
    });
    const shadowRoot = container.attachShadow({ mode: 'open' });
    setTooltip(container, file.path);
    shadowRoot.createSpan({
      attr: {
        part: 'file-name'
      },
      text: fileNamePart
    });

    if (parentStr) {
      let text = parentStr;
      if (!this.settings.shouldDisplayParentPathOnSeparateLine) {
        text = this.settings.shouldReversePathParts ? pathSeparator + text : text + pathSeparator;
      }
      shadowRoot.createSpan({
        attr: {
          part: 'parent-path'
        },
        prepend: !this.settings.shouldReversePathParts && !this.settings.shouldDisplayParentPathOnSeparateLine,
        text
      });
    }

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

    const that = this;
    registerPatch(this, getPrototypeOf(backlinkView.backlink.backlinkDom), {
      addResult: (next: AddResultFn): AddResultFn => {
        return function addResultPatched(this: ResultDom, file: TFile, result: ResultDomResult, content: string, shouldShowTitle?: boolean): ResultDomItem {
          return that.addResult(next, this, file, result, content, shouldShowTitle);
        };
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
