/**
 * @file
 *
 * Main plugin class for the Backlink Full Path plugin.
 */

import type {
  BacklinkPlugin,
  BacklinkView,
  ResultDom,
  ResultDomItem,
  ResultDomResult
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  PluginManifest,
  TFile
} from 'obsidian';

import {
  InternalPluginName,
  ViewType
} from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  MarkdownView,
  setTooltip
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import { getPrototypeOf } from 'obsidian-dev-utils/object-utils';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';
import { PluginEventSourceImpl } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

/**
 * Type alias for the `addResult` method on `ResultDom`.
 */
type AddResultFn = ResultDom['addResult'];

/**
 * The Backlink Full Path plugin. Replaces backlink titles with full paths.
 */
export class Plugin extends PluginBase {
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  /**
   * Creates a new Backlink Full Path plugin.
   *
   * @param app - The Obsidian app instance.
   * @param manifest - The plugin manifest.
   */
  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);

    this.pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler: new PluginDataHandler(this),
        pluginEventSource: new PluginEventSourceImpl(this)
      })
    );

    this.addChild(
      new PluginSettingsTabComponent({
        plugin: this,
        pluginSettingsTab: new PluginSettingsTab({
          plugin: this,
          pluginSettingsComponent: this.pluginSettingsComponent
        })
      })
    );
  }

  /**
   * Called after pre-loaded components are initialized.
   */
  public override onload(): void {
    this.pluginSettingsComponent.on('saveSettings', async () => {
      await this.refreshBacklinkPanels();
    });
  }

  /**
   * Called when the workspace layout is ready.
   */
  protected async onLayoutReady(): Promise<void> {
    const backlinksCorePlugin = this.app.internalPlugins.getPluginById(InternalPluginName.Backlink);
    if (!backlinksCorePlugin) {
      return;
    }

    const that = this;
    const patch = this.addChild(new MonkeyAroundComponent());
    patch.registerPatch(getPrototypeOf(backlinksCorePlugin.instance), {
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
    const fileNamePart = this.pluginSettingsComponent.settings.shouldIncludeExtension ? file.name : file.basename;

    let parentPathParts = file.path.split('/').slice(0, -1);

    for (let length = parentPathParts.length; length >= 1; length--) {
      const rootPath = parentPathParts.slice(0, length).join('/');
      if (this.pluginSettingsComponent.settings.rootPaths.includes(rootPath)) {
        parentPathParts = parentPathParts.slice(length);
        break;
      }
    }

    if (this.pluginSettingsComponent.settings.pathDepth > 0) {
      const partsToSkipCount = Math.max(0, parentPathParts.length - this.pluginSettingsComponent.settings.pathDepth + 1);
      if (partsToSkipCount > 0) {
        parentPathParts.splice(0, partsToSkipCount);
        if (this.pluginSettingsComponent.settings.shouldShowEllipsisForSkippedPathParts) {
          parentPathParts.unshift('...');
        }
      }
    }

    if (this.pluginSettingsComponent.settings.shouldReversePathParts) {
      parentPathParts.reverse();
    }

    const pathSeparator = this.pluginSettingsComponent.settings.shouldReversePathParts ? ' \u2190 ' : '/';
    const parentStr = parentPathParts.join(pathSeparator);

    const container = createDiv({
      cls: ['backlink-full-path', 'backlink-control']
    });
    container.dataset['shouldHighlightFileName'] = this.pluginSettingsComponent.settings.shouldHighlightFileName.toString();
    container.dataset['shouldDisplayParentPathOnSeparateLine'] = this.pluginSettingsComponent.settings.shouldDisplayParentPathOnSeparateLine.toString();
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
      if (!this.pluginSettingsComponent.settings.shouldDisplayParentPathOnSeparateLine) {
        text = this.pluginSettingsComponent.settings.shouldReversePathParts ? pathSeparator + text : text + pathSeparator;
      }
      shadowRoot.createSpan({
        attr: {
          part: 'parent-path'
        },
        prepend: !this.pluginSettingsComponent.settings.shouldReversePathParts && !this.pluginSettingsComponent.settings.shouldDisplayParentPathOnSeparateLine,
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
    const patch = this.addChild(new MonkeyAroundComponent());
    patch.registerPatch(getPrototypeOf(backlinkView.backlink.backlinkDom), {
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
