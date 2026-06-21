import type {
  ResultDom,
  ResultDomItem,
  ResultDomResult
} from '@obsidian-typings/obsidian-public-latest';
import type { TFile } from 'obsidian';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
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

interface ResultDomProto {
  addResult(file: TFile, result: ResultDomResult, content: string, shouldShowTitle: boolean): ResultDomItem;
}

describe('ResultDomAddResultPatchComponent', () => {
  let settings: PluginSettings;
  let pluginSettingsComponent: PluginSettingsComponent;
  let resultDomProto: ResultDomProto;
  let resultDom: ResultDom;

  beforeEach(() => {
    settings = new PluginSettings();
    pluginSettingsComponent = strictProxy<PluginSettingsComponent>({
      settings
    });
    resultDomProto = {
      addResult: vi.fn().mockImplementation(() => createOriginalItem(true))
    };
    resultDom = castTo<ResultDom>(Object.create(resultDomProto));
  });

  it('should register a single method patch on load', () => {
    const component = createComponent();
    const registerMethodPatchSpy = vi.spyOn(component, 'registerMethodPatch');

    component.load();

    expect(registerMethodPatchSpy).toHaveBeenCalledTimes(1);
  });

  it('should leave the result untouched when there is no tree-item-inner', () => {
    resultDomProto.addResult = vi.fn().mockImplementation(() => createOriginalItem(false));
    const component = createComponent();
    component.load();

    const item = resultDomProto.addResult(createMockFile('note.md'), strictProxy<ResultDomResult>({}), 'content', true);

    expect(item.el.querySelector('.tree-item-inner')).toBeNull();
  });

  it('should remove the patch on unload', () => {
    const component = createComponent();
    component.load();
    component.unload();

    const item = resultDomProto.addResult(createMockFile('note.md'), strictProxy<ResultDomResult>({}), 'content', true);

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

  function createComponent(): ResultDomAddResultPatchComponent {
    return new ResultDomAddResultPatchComponent({
      pluginSettingsComponent,
      resultDom
    });
  }

  function generateContainer(filePath: string): HTMLDivElement {
    const component = createComponent();
    component.load();

    const item = resultDomProto.addResult(createMockFile(filePath), strictProxy<ResultDomResult>({}), 'content', true);
    const inner = item.el.querySelector('.tree-item-inner');
    const container = inner?.firstElementChild;
    if (!(container instanceof HTMLDivElement)) {
      throw new Error('Expected a generated backlink-full-path container');
    }
    return container;
  }
});

function createMockFile(path: string): TFile {
  const parts = path.split('/');
  const name = parts.at(-1) ?? '';
  const dotIndex = name.lastIndexOf('.');
  const basename = dotIndex >= 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex >= 0 ? name.slice(dotIndex + 1) : '';
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
  return container.shadowRoot?.querySelector(`[part="${part}"]`) ?? null;
}
