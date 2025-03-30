import { Setting } from 'obsidian';
import { appendCodeBlock } from 'obsidian-dev-utils/HTMLElement';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { SettingEx } from 'obsidian-dev-utils/obsidian/SettingEx';

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
          .setMin(0)
          .setPlaceholder('0');
        numberComponent.inputEl.required = true;
      });
  }
}
