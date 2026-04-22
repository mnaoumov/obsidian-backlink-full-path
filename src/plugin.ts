/**
 * @file
 *
 * Main plugin class for the Backlink Full Path plugin.
 */

import type {
  App,
  PluginManifest,
  TFile
} from 'obsidian';
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
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import { getPrototypeOf } from 'obsidian-dev-utils/object-utils';
import { registerPatch } from 'obsidian-dev-utils/obsidian/monkey-around';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/plugin/components/plugin-settings-tab-component';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';
import {
  InternalPluginName,
  ViewType
} from 'obsidian-typings/implementations';

import type { PluginSettings } from './plugin-settings.ts';

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

    this.pluginSettingsComponent = this.registerComponent({
      component: new PluginSettingsComponent({
        loadData: this.loadData.bind(this),
        saveData: this.saveData.bind(this)
      }),
      shouldPreload: true
    });

    this.registerComponent({
      component: new PluginSettingsTabComponent(
        this,
        new PluginSettingsTab({
          plugin: this,
          settingsComponent: this.pluginSettingsComponent
        })
      )
    });
  }

  /**
   * Called after pre-loaded components are initialized.
   */
  protected override async onloadImpl(): Promise<void> {
    await super.onloadImpl();

    this.pluginSettingsComponent.on('saveSettings', () => {
      invokeAsyncSafely(() => this.refreshBacklinkPanels());
    });
  }

  /**
   * Called when the workspace layout is ready.
   */
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

  private get pluginSettings(): PluginSettings {
    return this.pluginSettingsComponent.settings as PluginSettings;
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
    const fileNamePart = this.pluginSettings.shouldIncludeExtension ? file.name : file.basename;

    let parentPathParts = file.path.split('/').slice(0, -1);

    for (let length = parentPathParts.length; length >= 1; length--) {
      const rootPath = parentPathParts.slice(0, length).join('/');
      if (this.pluginSettings.rootPaths.includes(rootPath)) {
        parentPathParts = parentPathParts.slice(length);
        break;
      }
    }

    if (this.pluginSettings.pathDepth > 0) {
      const partsToSkipCount = Math.max(0, parentPathParts.length - this.pluginSettings.pathDepth + 1);
      if (partsToSkipCount > 0) {
        parentPathParts.splice(0, partsToSkipCount);
        if (this.pluginSettings.shouldShowEllipsisForSkippedPathParts) {
          parentPathParts.unshift('...');
        }
      }
    }

    if (this.pluginSettings.shouldReversePathParts) {
      parentPathParts.reverse();
    }

    const pathSeparator = this.pluginSettings.shouldReversePathParts ? ' \u2190 ' : '/';
    const parentStr = parentPathParts.join(pathSeparator);

    const container = createDiv({
      cls: ['backlink-full-path', 'backlink-control']
    });
    container.dataset['shouldHighlightFileName'] = this.pluginSettings.shouldHighlightFileName.toString();
    container.dataset['shouldDisplayParentPathOnSeparateLine'] = this.pluginSettings.shouldDisplayParentPathOnSeparateLine.toString();
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
      if (!this.pluginSettings.shouldDisplayParentPathOnSeparateLine) {
        text = this.pluginSettings.shouldReversePathParts ? pathSeparator + text : text + pathSeparator;
      }
      shadowRoot.createSpan({
        attr: {
          part: 'parent-path'
        },
        prepend: !this.pluginSettings.shouldReversePathParts && !this.pluginSettings.shouldDisplayParentPathOnSeparateLine,
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
