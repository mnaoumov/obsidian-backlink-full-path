import type { BacklinkView } from '@obsidian-typings/obsidian-public-latest';
import type { App } from 'obsidian';

import {
  InternalPluginName,
  ViewType
} from '@obsidian-typings/obsidian-public-latest/implementations';
import { MarkdownView } from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import { LayoutReadyComponent } from 'obsidian-dev-utils/obsidian/components/layout-ready-component';

import { ResultDomAddResultPatchComponent } from './patches/result-dom-add-result-patch-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';

interface BacklinkFullPathComponentConstructorParams {
  readonly app: App;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class BacklinkFullPathComponent extends LayoutReadyComponent {
  private isBacklinksPanePatched = false;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: BacklinkFullPathComponentConstructorParams) {
    super(params.app);

    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  protected override async onLayoutReady(): Promise<void> {
    this.pluginSettingsComponent.on('saveSettings', async () => {
      await this.refreshBacklinkPanels();
    });

    const backlinksCorePlugin = this.app.internalPlugins.getPluginById(InternalPluginName.Backlink);
    if (!backlinksCorePlugin) {
      return;
    }

    /*
     * Obsidian publishes this itself: `InternalPlugin.enable()` sets `enabled` as its first statement and
     * raises `change` on the manager as its last, and `disable()` mirrors that, so the flag read inside the
     * handler is always the post-transition one. Obsidian's own Core plugins settings tab listens to the
     * same signal. Diffing it replaces a monkey patch of `onUserEnable` on the `BacklinkPluginInstance`
     * prototype, which every vault shares.
     */
    let wasBacklinksCorePluginEnabled = backlinksCorePlugin.enabled;
    this.registerEvent(this.app.internalPlugins.on('change', () => {
      const isBacklinksCorePluginEnabled = backlinksCorePlugin.enabled;
      const hasBacklinksCorePluginJustBeenEnabled = isBacklinksCorePluginEnabled && !wasBacklinksCorePluginEnabled;
      wasBacklinksCorePluginEnabled = isBacklinksCorePluginEnabled;

      if (hasBacklinksCorePluginJustBeenEnabled) {
        this.onBacklinksCorePluginEnable();
      }
    }));

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

  private onBacklinksCorePluginEnable(): void {
    invokeAsyncSafely(() => this.patchBacklinksPane());
  }

  private async patchBacklinksPane(): Promise<void> {
    const backlinkView = await this.getBacklinkView();

    /*
     * Install the patch once. It sits on the `ResultDom` prototype, which outlives the pane: disabling the core
     * Backlinks plugin leaves it in place and re-enabling it reuses the same class, so patching on every enable
     * only stacks another wrapper around every result row. The enable path still matters for the one case it
     * covers alone - the core plugin was disabled when this component loaded, so there was no pane to reach.
     * Checked after the `await`, so a load-time call and an enable racing it cannot both install.
     */
    if (!backlinkView || this.isBacklinksPanePatched) {
      return;
    }

    this.isBacklinksPanePatched = true;
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
