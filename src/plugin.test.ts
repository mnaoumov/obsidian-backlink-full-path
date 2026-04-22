/**
 * @file
 *
 * Tests for the Plugin class.
 */

import type { PluginManifest } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { Plugin } from './plugin.ts';

/**
 * Creates a minimal PluginManifest for testing.
 *
 * @returns A test PluginManifest.
 */
function createTestManifest(): PluginManifest {
  return {
    author: 'test',
    description: 'test',
    id: 'backlink-full-path',
    minAppVersion: '0.0.0',
    name: 'Backlink Full Path',
    version: '1.0.0'
  };
}

describe('Plugin', () => {
  it('should be constructable', () => {
    const app = App.createConfigured__();
    const manifest = createTestManifest();
    const plugin = new Plugin(app.asOriginalType__(), manifest);
    expect(plugin).toBeInstanceOf(Plugin);
  });

  it('should have the correct manifest id', () => {
    const app = App.createConfigured__();
    const manifest = createTestManifest();
    const plugin = new Plugin(app.asOriginalType__(), manifest);
    expect(plugin.manifest.id).toBe('backlink-full-path');
  });
});
