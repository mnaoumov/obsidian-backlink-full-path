import type {
  ResultDom,
  ResultDomItem,
  ResultDomResult
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  CachedMetadata,
  MetadataCache,
  TFile
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';

import { PluginSettings } from '../plugin-settings.ts';
import { ResultDomAddResultPatchComponent } from './result-dom-add-result-patch-component.ts';

interface ResultDomPrototype {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Tests replace the prototype method to exercise different result shapes.
  addResult: (file: TFile, result: ResultDomResult, content: string, shouldShowTitle: boolean) => ResultDomItem;
}

describe('ResultDomAddResultPatchComponent', () => {
  let settings: PluginSettings;
  let pluginSettingsComponent: PluginSettingsComponent;
  let resultDomPrototype: ResultDomPrototype;
  let resultDom: ResultDom;
  let frontmatterByPath: Map<string, Record<string, unknown>>;
  let app: App;

  beforeEach(() => {
    frontmatterByPath = new Map();
    app = strictProxy<App>({
      metadataCache: strictProxy<MetadataCache>({
        getFileCache: (file: TFile): CachedMetadata | null => {
          const frontmatter = frontmatterByPath.get(file.path);
          return frontmatter ? { frontmatter } : null;
        }
      })
    });
    settings = new PluginSettings();
    pluginSettingsComponent = strictProxy<PluginSettingsComponent>({
      settings
    });
    resultDomPrototype = {
      addResult: vi.fn().mockImplementation(() => createOriginalItem(true))
    };
    resultDom = createResultDom(createDiv({ cls: 'backlink-pane' }));
  });

  it('should register a single method patch on load', () => {
    const component = createComponent();
    const registerMethodPatchSpy = vi.spyOn(component, 'registerMethodPatch');

    component.load();

    expect(registerMethodPatchSpy).toHaveBeenCalledTimes(1);
  });

  it('should leave the result untouched when there is no tree-item-inner', () => {
    resultDomPrototype.addResult = vi.fn().mockImplementation(() => createOriginalItem(false));
    const component = createComponent();
    component.load();

    const item = addResult(resultDom, 'note.md');

    expect(item.el.querySelector('.tree-item-inner')).toBeNull();
  });

  it('should leave a result list outside the backlinks pane untouched', () => {
    const component = createComponent();
    component.load();

    const item = addResult(createResultDom(createDiv({ cls: 'search-result-container' })), 'folder/note.md');

    expect(item.el.querySelector('.tree-item-inner')?.textContent).toBe('Original');
  });

  it('should leave a result list with no parent element untouched', () => {
    const component = createComponent();
    component.load();

    const item = addResult(createResultDom(null), 'folder/note.md');

    expect(item.el.querySelector('.tree-item-inner')?.textContent).toBe('Original');
  });

  it('should remove the patch on unload', () => {
    const component = createComponent();
    component.load();
    component.unload();

    const item = addResult(resultDom, 'note.md');

    expect(item.el.querySelector('.tree-item-inner')?.textContent).toBe('Original');
  });

  describe('generated backlink title', () => {
    it('should replace the tree-item-inner content with the generated title', () => {
      const container = generateContainer('folder/note.md');
      expect(container.classList.contains('backlink-full-path')).toBe(true);
    });

    it('should include the extension when shouldIncludeExtension is true', () => {
      settings.shouldIncludeExtension = true;
      const container = generateContainer('folder/note.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('note.md');
    });

    it('should exclude the extension when shouldIncludeExtension is false', () => {
      settings.shouldIncludeExtension = false;
      const container = generateContainer('folder/note.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('note');
    });

    it('should show no parent path for a file at the root', () => {
      const container = generateContainer('note.md');
      expect(getPart(container, 'parent-path')).toBeNull();
    });

    it('should show the parent path with a trailing separator', () => {
      settings.shouldReversePathParts = false;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = generateContainer('folder/note.md');
      expect(getPart(container, 'parent-path')?.textContent).toBe('folder/');
    });

    it('should strip a root path prefix', () => {
      settings.rootPaths = ['folder'];
      const container = generateContainer('folder/subfolder/note.md');
      expect(getPart(container, 'parent-path')?.textContent).toBe('subfolder/');
    });

    it('should strip a nested root path prefix', () => {
      settings.rootPaths = ['folder/subfolder'];
      const container = generateContainer('folder/subfolder/deep/note.md');
      expect(getPart(container, 'parent-path')?.textContent).toBe('deep/');
    });

    it('should limit depth with the pathDepth setting', () => {
      settings.pathDepth = 2;
      settings.shouldShowEllipsisForSkippedPathParts = false;
      const container = generateContainer('a/b/c/note.md');
      expect(getPart(container, 'parent-path')?.textContent).toBe('c/');
    });

    it('should add an ellipsis for skipped parts when enabled', () => {
      settings.pathDepth = 2;
      settings.shouldShowEllipsisForSkippedPathParts = true;
      const container = generateContainer('a/b/c/note.md');
      expect(getPart(container, 'parent-path')?.textContent).toBe('.../c/');
    });

    it('should not add an ellipsis when pathDepth does not truncate', () => {
      settings.pathDepth = 5;
      settings.shouldShowEllipsisForSkippedPathParts = true;
      const container = generateContainer('a/b/note.md');
      expect(getPart(container, 'parent-path')?.textContent).toBe('a/b/');
    });

    it('should reverse the path parts when shouldReversePathParts is true', () => {
      settings.shouldReversePathParts = true;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = generateContainer('a/b/note.md');
      expect(getPart(container, 'parent-path')?.textContent).toBe(' ← b ← a');
    });

    it('should display the parent path on a separate line without a separator', () => {
      settings.shouldDisplayParentPathOnSeparateLine = true;
      settings.shouldReversePathParts = false;
      const container = generateContainer('folder/note.md');
      expect(getPart(container, 'parent-path')?.textContent).toBe('folder');
    });

    it('should set dataset attributes for highlighting', () => {
      settings.shouldHighlightFileName = true;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = generateContainer('note.md');
      expect(container.dataset['shouldHighlightFileName']).toBe('true');
      expect(container.dataset['shouldDisplayParentPathOnSeparateLine']).toBe('false');
    });

    it('should include a full-path span with the file path', () => {
      const container = generateContainer('folder/note.md');
      expect(container.querySelector('.full-path')?.textContent).toBe('folder/note.md');
    });

    it('should prepend the parent path when not reversed and not on a separate line', () => {
      settings.shouldReversePathParts = false;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = generateContainer('folder/note.md');
      expect(container.shadowRoot?.firstElementChild?.getAttribute('part')).toBe('parent-path');
    });

    it('should append the parent path when reversed and not on a separate line', () => {
      settings.shouldReversePathParts = true;
      settings.shouldDisplayParentPathOnSeparateLine = false;
      const container = generateContainer('folder/note.md');
      expect(container.shadowRoot?.lastElementChild?.getAttribute('part')).toBe('parent-path');
    });

    it('should append the parent path when displaying on a separate line', () => {
      settings.shouldReversePathParts = false;
      settings.shouldDisplayParentPathOnSeparateLine = true;
      const container = generateContainer('folder/note.md');
      expect(container.shadowRoot?.lastElementChild?.getAttribute('part')).toBe('parent-path');
    });
  });

  describe('folder-note labels', () => {
    it('should keep the file name when the title property is not configured', () => {
      frontmatterByPath.set('a/index.md', { title: 'Alpha' });
      const container = generateContainer('a/index.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('index.md');
    });

    it('should show the title property value instead of the file name', () => {
      settings.titlePropertyName = 'title';
      frontmatterByPath.set('projects/alpha/index.md', { title: 'Alpha project' });
      const container = generateContainer('projects/alpha/index.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('Alpha project');
      expect(getPart(container, 'parent-path')?.textContent).toBe('projects/alpha/');
    });

    it('should use the first item of a list title property', () => {
      settings.titlePropertyName = 'aliases';
      frontmatterByPath.set('a/index.md', { aliases: ['First', 'Second'] });
      const container = generateContainer('a/index.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('First');
    });

    it.each([
      ['missing frontmatter', undefined],
      ['a missing property', {}],
      ['a non-string value', { title: 42 }],
      ['an empty list', { title: [] }],
      ['a blank string', { title: '  ' }]
    ])('should keep the file name for %s', (_caseName, frontmatter) => {
      settings.titlePropertyName = 'title';
      if (frontmatter) {
        frontmatterByPath.set('a/note.md', frontmatter);
      }
      const container = generateContainer('a/note.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('note.md');
    });

    it('should label a folder note by its folder and drop that folder from the parent path', () => {
      settings.folderNoteFileNames = ['index'];
      const container = generateContainer('projects/alpha/index.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('alpha');
      expect(getPart(container, 'parent-path')?.textContent).toBe('projects/');
    });

    it('should show no parent path for a folder note in a top-level folder', () => {
      settings.folderNoteFileNames = ['index'];
      const container = generateContainer('alpha/index.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('alpha');
      expect(getPart(container, 'parent-path')).toBeNull();
    });

    it('should keep the file name of a folder note at the vault root', () => {
      settings.folderNoteFileNames = ['index'];
      const container = generateContainer('index.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('index.md');
    });

    it('should leave notes with other names untouched', () => {
      settings.folderNoteFileNames = ['index'];
      const container = generateContainer('projects/alpha/notes.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('notes.md');
      expect(getPart(container, 'parent-path')?.textContent).toBe('projects/alpha/');
    });

    it('should prefer the title property over the folder name', () => {
      settings.titlePropertyName = 'title';
      settings.folderNoteFileNames = ['index'];
      frontmatterByPath.set('projects/alpha/index.md', { title: 'Alpha project' });
      const container = generateContainer('projects/alpha/index.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('Alpha project');
      expect(getPart(container, 'parent-path')?.textContent).toBe('projects/alpha/');
    });

    it('should fall back to the folder name when the folder note has no title', () => {
      settings.titlePropertyName = 'title';
      settings.folderNoteFileNames = ['index'];
      const container = generateContainer('projects/alpha/index.md');
      expect(getPart(container, 'file-name')?.textContent).toBe('alpha');
    });
  });

  function addResult(targetResultDom: ResultDom, filePath: string): ResultDomItem {
    return resultDomPrototype.addResult.call(targetResultDom, createMockFile(filePath), strictProxy<ResultDomResult>({}), 'content', true);
  }

  function createResultDom(parentEl: HTMLElement | null): ResultDom {
    const el = parentEl?.createDiv() ?? createDiv();
    return castTo<ResultDom>(Object.assign(Object.create(resultDomPrototype), { el }));
  }

  function createComponent(): ResultDomAddResultPatchComponent {
    return new ResultDomAddResultPatchComponent({
      app,
      pluginSettingsComponent,
      resultDom
    });
  }

  function generateContainer(filePath: string): HTMLDivElement {
    const component = createComponent();
    component.load();

    const item = addResult(resultDom, filePath);
    const inner = item.el.querySelector('.tree-item-inner');
    const container = inner?.firstElementChild;
    if (!(container instanceof HTMLDivElement)) {
      throw new TypeError('Expected a generated backlink-full-path container');
    }
    return container;
  }
});

function createMockFile(path: string): TFile {
  const parts = path.split('/');
  const name = parts.at(-1) ?? '';
  const dotIndex = name.lastIndexOf('.');
  const basename = dotIndex === -1 ? name : name.slice(0, dotIndex);
  const extension = dotIndex === -1 ? '' : name.slice(dotIndex + 1);
  return strictProxy<TFile>({
    basename,
    extension,
    name,
    path
  });
}

function createOriginalItem(hasTreeItemInner: boolean): ResultDomItem {
  const el = createDiv();
  if (hasTreeItemInner) {
    const inner = el.createDiv({ cls: 'tree-item-inner' });
    inner.textContent = 'Original';
  }
  return strictProxy<ResultDomItem>({ el });
}

function getPart(container: HTMLDivElement, part: string): Element | null {
  return container.shadowRoot?.querySelector(`[part="${CSS.escape(part)}"]`) ?? null;
}
