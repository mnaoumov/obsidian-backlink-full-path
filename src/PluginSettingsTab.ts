import { Setting } from 'obsidian';
import { appendCodeBlock } from 'obsidian-dev-utils/HTMLElement';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { SettingEx } from 'obsidian-dev-utils/obsidian/SettingEx';

import type { PluginTypes } from './PluginTypes.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName('Include extension')
      .setDesc('Whether to include file extension in backlinks.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldIncludeExtension');
      });

    new SettingEx(this.containerEl)
      .setName('Path depth')
      .setDesc(createFragment((f) => {
        f.appendText('The depth of the path to include in backlinks.');
        f.createEl('br');
        appendCodeBlock(f, '1');
        f.appendText(' - only file name ');
        appendCodeBlock(f, 'foo.md');
        f.appendText(' (default Obsidian behavior).');
        f.createEl('br');
        appendCodeBlock(f, '2');
        f.appendText(' - file name and its parent folder ');
        appendCodeBlock(f, 'bar/foo.md');
        f.appendText(' .');
        f.createEl('br');
        appendCodeBlock(f, '3');
        f.appendText(' - file name and its parent and grandparent folders ');
        appendCodeBlock(f, 'baz/bar/foo.md');
        f.appendText(' .');
        f.createEl('br');
        f.appendText('etc.');
        f.createEl('br');
        appendCodeBlock(f, '0');
        f.appendText(' - for unlimited depth.');
      }))
      .addNumber((numberComponent) => {
        this.bind(numberComponent, 'pathDepth')
          .setMin(0);
      });

    new Setting(this.containerEl)
      .setName('Show ellipsis for skipped path parts')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to show ellipsis for skipped path parts (for exceeded path depth setting).');
        f.createEl('br');
        f.appendText('If enabled, replaces skipped path parts with ellipsis: ');
        appendCodeBlock(f, '.../bar/foo.md');
        f.appendText('.');
        f.createEl('br');
        f.appendText('If disabled, hides the trimmed path parts: ');
        appendCodeBlock(f, 'bar/foo.md');
        f.appendText('.');
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldShowEllipsisForSkippedPathParts');
      });

    new Setting(this.containerEl)
      .setName('Highlight file name')
      .setDesc('Whether to highlight the file name.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldHighlightFileName');
      });

    new Setting(this.containerEl)
      .setName('Reverse path parts')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to reverse the path parts.');
        f.createEl('br');
        f.appendText('If enabled, shows paths in reverse order: ');
        appendCodeBlock(f, 'foo.md ← bar ← baz');
        f.createEl('br');
        f.appendText('If disabled, shows paths as is: ');
        appendCodeBlock(f, 'baz/bar/foo.md');
        f.appendText('.');
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldReversePathParts');
      });
  }
}
