import { Setting } from 'obsidian';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';

import type { BacklinkFullPathPlugin } from './BacklinkFullPathPlugin.ts';

export class BacklinkFullPathPluginSettingsTab extends PluginSettingsTabBase<BacklinkFullPathPlugin> {
  public override display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName('Include Extension')
      .setDesc('Whether to include file extension in backlinks.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldIncludeExtension');
      });
  }
}
