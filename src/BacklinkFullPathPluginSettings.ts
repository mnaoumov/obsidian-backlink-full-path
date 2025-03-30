import { PluginSettingsBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsBase';

export class BacklinkFullPathPluginSettings extends PluginSettingsBase {
  public shouldIncludeExtension = true;

  public constructor(data: unknown) {
    super();
    this.init(data);
  }
}
