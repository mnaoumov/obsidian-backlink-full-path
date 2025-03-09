import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import { EmptySettings } from 'obsidian-dev-utils/obsidian/Plugin/EmptySettings';
import type { PluginSettingTab } from 'obsidian';

export class BacklinkFullPathPlugin extends PluginBase<EmptySettings> {
  protected override createPluginSettings(): EmptySettings {
    return new EmptySettings();
  }

  protected override createPluginSettingsTab(): null | PluginSettingTab {
    return null;
  }

  protected override async onLayoutReady(): Promise<void> {

  }
}
