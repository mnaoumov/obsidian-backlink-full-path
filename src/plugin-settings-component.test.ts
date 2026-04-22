/**
 * @file
 *
 * Tests for PluginSettingsComponent.
 */

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettings } from './plugin-settings.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';

describe('PluginSettingsComponent', () => {
  it('should create default settings as PluginSettings instance', () => {
    const component = new PluginSettingsComponent({
      loadData: vi.fn().mockResolvedValue(null),
      saveData: vi.fn().mockResolvedValue(undefined)
    });

    expect(component.defaultSettings).toBeInstanceOf(PluginSettings);
  });

  it('should have all 7 default setting properties', () => {
    const component = new PluginSettingsComponent({
      loadData: vi.fn().mockResolvedValue(null),
      saveData: vi.fn().mockResolvedValue(undefined)
    });

    const defaults = component.defaultSettings;
    expect(defaults).toHaveProperty('pathDepth');
    expect(defaults).toHaveProperty('rootPaths');
    expect(defaults).toHaveProperty('shouldDisplayParentPathOnSeparateLine');
    expect(defaults).toHaveProperty('shouldHighlightFileName');
    expect(defaults).toHaveProperty('shouldIncludeExtension');
    expect(defaults).toHaveProperty('shouldReversePathParts');
    expect(defaults).toHaveProperty('shouldShowEllipsisForSkippedPathParts');
  });
});
