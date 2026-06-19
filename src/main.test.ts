import {
  describe,
  expect,
  it
} from 'vitest';

// eslint-disable-next-line import-x/no-rename-default -- Renamed to avoid collision with the named `Plugin` import.
import mainExport from './main.ts';
import { Plugin } from './plugin.ts';

describe('main', () => {
  it('should export Plugin as default export', () => {
    expect(mainExport).toBe(Plugin);
  });
});
