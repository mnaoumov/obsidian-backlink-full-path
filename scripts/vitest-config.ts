import type { ObsidianPluginVitestConfigContext } from 'obsidian-dev-utils/script-utils/test-runners/vitest-config';
import type { TestProjectConfiguration } from 'vitest/config';

import { defineObsidianPluginVitestConfig } from 'obsidian-dev-utils/script-utils/test-runners/vitest-config';

/**
 * The screenshot-capture suites (T461-P21) that write `images/screenshot-*.png`.
 *
 * They are named `*.desktop-capture.` / `*.android-capture.` rather than
 * `*.desktop.` / `*.android.` so they match NONE of the standard project globs.
 * That keeps them out of `npm run test:integration` entirely — capturing is an
 * explicit operation (`npm run capture:screenshots`), not something every test
 * run does. Folding them into the standard projects would rewrite five PNGs on
 * every run and dirty the tree mid-release.
 */
const DESKTOP_CAPTURE_TEST_FILES = 'src/**/*.desktop-capture.integration.test.ts';
const ANDROID_CAPTURE_TEST_FILES = 'src/**/*.android-capture.integration.test.ts';

export const config = defineObsidianPluginVitestConfig({
  customProjects(context: ObsidianPluginVitestConfigContext): TestProjectConfiguration[] {
    return [
      {
        test: {
          ...context.desktop,
          include: [DESKTOP_CAPTURE_TEST_FILES],
          name: 'capture-screenshots:desktop'
        }
      },
      {
        test: {
          ...context.android,
          include: [ANDROID_CAPTURE_TEST_FILES],
          name: 'capture-screenshots:android'
        }
      }
    ];
  }
});
