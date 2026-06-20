import type { BacklinkView } from '@obsidian-typings/obsidian-public-latest';
import type { App } from 'obsidian';

import {
  InternalPluginName,
  ViewType
} from '@obsidian-typings/obsidian-public-latest/implementations';
import { MarkdownView } from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import { LayoutReadyComponent } from 'obsidian-dev-utils/obsidian/components/layout-ready-component';

import { BacklinkPluginInstanceOnUserEnablePatchComponent } from './patches/backlink-plugin-instance-on-user-enable-patch-component.ts';
import { ResultDomAddResultPatchComponent } from './patches/result-dom-add-result-patch-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';

interface BacklinkFullPathComponentConstructorParams {
  readonly app: App;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class BacklinkFullPathComponent extends LayoutReadyComponent {
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: BacklinkFullPathComponentConstructorParams) {
    super(params.app);

    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public onBacklinksCorePluginEnable(): void {
    invokeAsyncSafely(() => this.patchBacklinksPane());
  }

  protected override async onLayoutReady(): Promise<void> {
    this.pluginSettingsComponent.on('saveSettings', async () => {
      await this.refreshBacklinkPanels();
    });

    const backlinksCorePlugin = this.app.internalPlugins.getPluginById(InternalPluginName.Backlink);
    if (!backlinksCorePlugin) {
      return;
    }

    this.addChild(
      new BacklinkPluginInstanceOnUserEnablePatchComponent({
        backlinkFullPathComponent: this,
        backlinkPluginInstance: backlinksCorePlugin.instance
      })
    );

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

  private async getBacklinkView(): Promise<BacklinkView | null> {
    const backlinksLeaf = this.app.workspace.getLeavesOfType(ViewType.Backlink)[0];
    if (!backlinksLeaf) {
      return null;
    }

    await backlinksLeaf.loadIfDeferred();
    return backlinksLeaf.view as BacklinkView;
  }

  private async patchBacklinksPane(): Promise<void> {
    const backlinkView = await this.getBacklinkView();
    if (!backlinkView) {
      return;
    }

    this.addChild(
      new ResultDomAddResultPatchComponent({
        pluginSettingsComponent: this.pluginSettingsComponent,
        resultDom: backlinkView.backlink.backlinkDom
      })
    );
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
