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

/**
 * The AVD the mobile shots are taken on: 900x1600 at density 320, which is the
 * size the community store asks for, captured natively with no crop or rescale.
 * The shared `obsidian_test` AVD is a Pixel 10 Pro XL at 1344x2992 (~9:20) and
 * cannot produce it, and resizing it at runtime destroys the Appium session.
 *
 * Needs one-time provisioning (install the Obsidian APK with snapshot saving
 * ENABLED, then launch it once) — see [[T461-P21]].
 */
const SCREENSHOT_AVD_NAME = 'obsidian_screenshots';

const APPIUM_URL = 'http://localhost:4723';
const LAYOUT_READY_TIMEOUT_IN_MILLISECONDS = 240_000;

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
          environmentOptions: {
            obsidianTransport: {
              appiumUrl: APPIUM_URL,
              avdName: SCREENSHOT_AVD_NAME,
              // The screenshot AVD is cold-booted and rarely used, so Obsidian's
              // First layout on it is much slower than on the well-warmed shared
              // One. The 90s default expires while it is still starting up.
              layoutReadyTimeoutInMilliseconds: LAYOUT_READY_TIMEOUT_IN_MILLISECONDS,
              type: 'obsidian-android-appium'
            }
          },
          include: [ANDROID_CAPTURE_TEST_FILES],
          name: 'capture-screenshots:android'
        }
      }
    ];
  }
});
