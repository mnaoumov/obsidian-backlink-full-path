/**
 * @file
 *
 * Tests for the main module default export.
 */

import {
  describe,
  expect,
  it
} from 'vitest';

import { Plugin } from './plugin.ts';

describe('main', () => {
  it('should export Plugin as default export', async () => {
    const mainModule = await import('./main.ts') as { default: typeof Plugin };
    expect(mainModule.default).toBe(Plugin);
  });
});
