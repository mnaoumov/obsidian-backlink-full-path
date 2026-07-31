import type { SettingDefinitionItem } from 'obsidian';

import { appendCodeBlock } from 'obsidian-dev-utils/obsidian/html-element';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      this.settingEx({
        desc: 'Whether to include file extension in backlinks.',
        name: 'Include extension',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldIncludeExtension', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
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
        }),
        name: 'Path depth',
        render: (setting) => {
          setting.addNumber((numberComponent) => {
            this.bind({ propertyName: 'pathDepth', valueComponent: numberComponent })
              .setMin(0);
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to show ellipsis for skipped path parts (for exceeded path depth setting).');
          f.createEl('br');
          f.appendText('If enabled, replaces skipped path parts with ellipsis: ');
          appendCodeBlock(f, '.../bar/foo.md');
          f.appendText('.');
          f.createEl('br');
          f.appendText('If disabled, hides the trimmed path parts: ');
          appendCodeBlock(f, 'bar/foo.md');
          f.appendText('.');
        }),
        name: 'Show ellipsis for skipped path parts',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldShowEllipsisForSkippedPathParts', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: 'Whether to highlight the file name.',
        name: 'Highlight file name',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldHighlightFileName', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to reverse the path parts.');
          f.createEl('br');
          f.appendText('If enabled, shows paths in reverse order: ');
          appendCodeBlock(f, 'foo.md ← bar ← baz');
          f.createEl('br');
          f.appendText('If disabled, shows paths as is: ');
          appendCodeBlock(f, 'baz/bar/foo.md');
          f.appendText('.');
        }),
        name: 'Reverse path parts',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldReversePathParts', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: 'Whether to display the parent path on a separate line.',
        name: 'Display parent path on separate line',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldDisplayParentPathOnSeparateLine', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: 'The paths to be treated as root paths.',
        name: 'Root paths',
        render: (setting) => {
          setting.addMultipleText((multipleText) => {
            this.bind({ propertyName: 'rootPaths', valueComponent: multipleText });
          });
        }
      })
    ];
  }
}
