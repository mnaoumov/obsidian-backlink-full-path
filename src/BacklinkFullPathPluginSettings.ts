import { PluginSettingsBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsBase';

export class BacklinkFullPathPluginSettings extends PluginSettingsBase {
  public pathDepth = 0;
  public shouldHighlightFileName = true;
  public shouldIncludeExtension = true;
  public shouldReversePathParts = false;
  public shouldShowEllipsisForSkippedPathParts = true;

  public constructor(data: unknown) {
    super();
    this.init(data);
  }
}
