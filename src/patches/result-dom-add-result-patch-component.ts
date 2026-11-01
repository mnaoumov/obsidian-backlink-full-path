import type { ResultDom } from '@obsidian-typings/obsidian-public-latest';
import type { App } from 'obsidian';

import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { getPrototypeOf } from '@mnaoumov/typescript-lib/object-utils';
import {
  setTooltip,
  TFile
} from 'obsidian';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';

/*
 * `ResultDom` is one class shared by every file result list: the backlinks component's linked and unlinked mentions,
 * core Search, embedded `query` blocks and the outgoing-links pane's unlinked mentions. The patch sits on its prototype,
 * so it has to pick the backlinks lists out itself. Obsidian's `BacklinkComponent` creates both of its lists as direct
 * children of its own `.backlink-pane`, in the pane and in the document alike, and nothing else uses that class.
 */
const BACKLINK_PANE_CLASS = 'backlink-pane';

interface ResultDomAddResultPatchComponentConstructorParams {
  readonly app: App;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly resultDom: ResultDom;
}

export class ResultDomAddResultPatchComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly resultDom: ResultDom;

  public constructor(params: ResultDomAddResultPatchComponentConstructorParams) {
    super();
    this.app = params.app;
    this.resultDom = params.resultDom;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
      $object: getPrototypeOf(this.resultDom),
      methodName: 'addResult',
      patchHandler: ({
        fallback,
        originalArguments: [file],
        originalThis
      }) => {
        const resultDomItem = fallback();
        if (!isBacklinkResultDom(originalThis)) {
          return resultDomItem;
        }
        const fileNameCaptionEl = resultDomItem.el.querySelector('.tree-item-inner');
        if (fileNameCaptionEl) {
          fileNameCaptionEl.empty();
          fileNameCaptionEl.append(this.generateBacklinkTitle(file));
        }
        return resultDomItem;
      }
    });
  }

  private generateBacklinkTitle(file: TFile): HTMLDivElement {
    let fileNamePart = this.pluginSettingsComponent.settings.shouldIncludeExtension ? file.name : file.basename;

    let parentPathParts = file.path.split('/').slice(0, -1);

    /*
     * In a folder-note vault every note is named `index` (or `README`), so the file name says nothing. The title
     * property, when the note has one, names it best; otherwise the note's own folder does, and that folder then
     * leaves the parent path so it is not shown twice.
     */
    const title = this.getTitle(file);
    if (title !== null) {
      fileNamePart = title;
    } else if (this.pluginSettingsComponent.settings.folderNoteFileNames.includes(file.basename)) {
      const folderName = parentPathParts.at(-1);
      if (folderName !== undefined) {
        fileNamePart = folderName;
        parentPathParts = parentPathParts.slice(0, -1);
      }
    }

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

    const pathSeparator = this.pluginSettingsComponent.settings.shouldReversePathParts ? ' \u{2190} ' : '/';
    const parentString = parentPathParts.join(pathSeparator);

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

    if (parentString) {
      let text = parentString;
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

  private getTitle(file: TFile): null | string {
    const titlePropertyName = this.pluginSettingsComponent.settings.titlePropertyName;
    if (!titlePropertyName) {
      return null;
    }

    const value: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter?.[titlePropertyName];
    const title: unknown = Array.isArray(value) ? value[0] : value;
    if (typeof title !== 'string') {
      return null;
    }

    const trimmedTitle = title.trim();
    return trimmedTitle || null;
  }
}

function isBacklinkResultDom(resultDom: ResultDom): boolean {
  return resultDom.el.parentElement?.classList.contains(BACKLINK_PANE_CLASS) ?? false;
}
