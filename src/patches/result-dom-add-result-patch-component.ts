import type { ResultDom } from '@obsidian-typings/obsidian-public-latest';

import {
  setTooltip,
  TFile
} from 'obsidian';
import { getPrototypeOf } from 'obsidian-dev-utils/object-utils';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';

interface ResultDomAddResultPatchComponentConstructorParams {
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly resultDom: ResultDom;
}

export class ResultDomAddResultPatchComponent extends MonkeyAroundComponent {
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly resultDom: ResultDom;

  public constructor(params: ResultDomAddResultPatchComponentConstructorParams) {
    super();
    this.resultDom = params.resultDom;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
      methodName: 'addResult',
      obj: getPrototypeOf(this.resultDom),
      patchHandler: ({
        fallback,
        originalArgs: [file]
      }) => {
        const resultDomItem = fallback();
        const fileNameCaptionEl = resultDomItem.el.querySelector('.tree-item-inner');
        if (fileNameCaptionEl) {
          fileNameCaptionEl.empty();
          fileNameCaptionEl.appendChild(this.generateBacklinkTitle(file));
        }
        return resultDomItem;
      }
    });
  }

  private generateBacklinkTitle(file: TFile): HTMLDivElement {
    const fileNamePart = this.pluginSettingsComponent.settings.shouldIncludeExtension ? file.name : file.basename;

    let parentPathParts = file.path.split('/').slice(0, -1);

    for (let length = parentPathParts.length; length >= 1; length--) {
      const rootPath = parentPathParts.slice(0, length).join('/');
      if (this.pluginSettingsComponent.settings.rootPaths.includes(rootPath)) {
        parentPathParts = parentPathParts.slice(length);
        break;
      }
    }

    if (this.pluginSettingsComponent.settings.pathDepth > 0) {
      const partsToSkipCount = Math.max(0, parentPathParts.length - this.pluginSettingsComponent.settings.pathDepth + 1);
      if (partsToSkipCount > 0) {
        parentPathParts.splice(0, partsToSkipCount);
        if (this.pluginSettingsComponent.settings.shouldShowEllipsisForSkippedPathParts) {
          parentPathParts.unshift('...');
        }
      }
    }

    if (this.pluginSettingsComponent.settings.shouldReversePathParts) {
      parentPathParts.reverse();
    }

    const pathSeparator = this.pluginSettingsComponent.settings.shouldReversePathParts ? ' \u2190 ' : '/';
    const parentStr = parentPathParts.join(pathSeparator);

    const container = createDiv({
      cls: ['backlink-full-path', 'backlink-control']
    });
    container.dataset['shouldHighlightFileName'] = this.pluginSettingsComponent.settings.shouldHighlightFileName.toString();
    container.dataset['shouldDisplayParentPathOnSeparateLine'] = this.pluginSettingsComponent.settings.shouldDisplayParentPathOnSeparateLine.toString();
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
      if (!this.pluginSettingsComponent.settings.shouldDisplayParentPathOnSeparateLine) {
        text = this.pluginSettingsComponent.settings.shouldReversePathParts ? pathSeparator + text : text + pathSeparator;
      }
      shadowRoot.createSpan({
        attr: {
          part: 'parent-path'
        },
        prepend: !this.pluginSettingsComponent.settings.shouldReversePathParts && !this.pluginSettingsComponent.settings.shouldDisplayParentPathOnSeparateLine,
        text
      });
    }

    return container;
  }
}
