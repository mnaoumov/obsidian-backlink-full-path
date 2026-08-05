import {
  describe,
  expect,
  it
} from 'vitest';

import mainExport from './main.ts';
import { Plugin } from './plugin.ts';

describe('main', () => {
  it('should export Plugin as default export', () => {
    expect(mainExport).toBe(Plugin);
  });
});
