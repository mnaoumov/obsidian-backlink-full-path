/**
 * @file
 *
 * Tests for PluginSettings default values.
 */

import {
  describe,
  expect,
  it
} from 'vitest';

import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettings', () => {
  it('should have correct default pathDepth', () => {
    const settings = new PluginSettings();
    expect(settings.pathDepth).toBe(0);
  });

  it('should have correct default rootPaths', () => {
    const settings = new PluginSettings();
    expect(settings.rootPaths).toEqual([]);
  });

  it('should have correct default shouldDisplayParentPathOnSeparateLine', () => {
    const settings = new PluginSettings();
    expect(settings.shouldDisplayParentPathOnSeparateLine).toBe(false);
  });

  it('should have correct default shouldHighlightFileName', () => {
    const settings = new PluginSettings();
    expect(settings.shouldHighlightFileName).toBe(true);
  });

  it('should have correct default shouldIncludeExtension', () => {
    const settings = new PluginSettings();
    expect(settings.shouldIncludeExtension).toBe(true);
  });

  it('should have correct default shouldReversePathParts', () => {
    const settings = new PluginSettings();
    expect(settings.shouldReversePathParts).toBe(false);
  });

  it('should have correct default shouldShowEllipsisForSkippedPathParts', () => {
    const settings = new PluginSettings();
    expect(settings.shouldShowEllipsisForSkippedPathParts).toBe(true);
  });
});
