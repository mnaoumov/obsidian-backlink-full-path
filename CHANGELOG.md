# CHANGELOG

## 1.6.3

- chore: update libs
- chore: upgrade dependencies and green up all checks
- chore: update libs
- docs: fix
- chore: update template
- chore: update libs
- refactor: migrate to @obsidian-typings/obsidian-public-latest - Replace obsidian-typings with @obsidian-typings/obsidian-public-latest - Update vitest config: replace ssr.noExternal with server.deps.inline - Add DOM.Iterable to tsconfig lib - Remove obsolete overrides (@antfu/utils, boolean, dompurify) - Upgrade dependencies via npm-check-updates
- refactor: simplify PluginSettingsComponent constructor to accept plugin directly Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
- refactor: pass pluginSettingsComponent instead of pluginSettings getter Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
- chore: update package-lock.json Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
- fix: remove unnecessary PluginSettingsTabBase cast after TS 6 upgrade Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
- refactor!: migrate to obsidian-dev-utils v2 component architecture - Delete PluginTypes.ts and remove generic from PluginBase - Convert PluginSettingsManager to PluginSettingsComponent with DI params - Use constructor registerComponent() pattern for settings and settings tab - Replace onSaveSettings override with event subscription on settings component - Rename all source files to kebab-case (Plugin.ts -> plugin.ts, etc.) - Add vitest test infrastructure with jsdom environment and obsidian-test-mocks - Add 14 tests covering settings defaults, component creation, and plugin construction - Update tsconfig: remove allowJs, svelte types; add vitest.config.ts to include - Add obsidian-test-mocks, sass-embedded, vitest, jsdom as dev dependencies BREAKING CHANGE: Requires obsidian-dev-utils v2 (component architecture). Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
- chore: update libs
- chore: update template
- chore: update libs Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
- chore: add @total-typescript/ts-reset, better-typescript-lib, and libReplacement Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
- chore: unify rules
- chore: add English language requirement to issue templates Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

## 1.6.2

- chore: update template

## 1.6.1

- chore: update libs

## 1.6.0

- feat: add root paths re #7
- chore: update libs

## 1.5.19

- chore: update libs

## 1.5.18

- chore: update libs

## 1.5.17

- chore: update libs
- chore: lint
- chore: enable markdownlint

## 1.5.16

- fix: build
- chore: update libs

## 1.5.15

- chore: enable conventional commits

## 1.5.14

- Minor changes

## 1.5.13

- Minor changes

## 1.5.12

- Minor changes

## 1.5.11

- Minor changes

## 1.5.10

- Minor changes

## 1.5.9

- Minor changes

## 1.5.8

- Minor changes

## 1.5.7

- Minor changes

## 1.5.6

- Minor changes

## 1.5.5

- Minor changes

## 1.5.4

- Minor changes

## 1.5.3

- Minor changes

## 1.5.2

- Minor changes

## 1.5.1

- Minor changes

## 1.5.0

- Refactor to shadow-root.
- This keeps `textContent` value used by [Supercharged Links](https://github.com/mdelobelle/obsidian_supercharged_links) (#5)

## 1.4.0

- shouldDisplayParentPathOnSeparateLine

## 1.3.4

- Minor changes

## 1.3.3

- Minor changes

## 1.3.2

- Minor changes

## 1.3.1

- New template

## 1.3.0

- Add tooltip

## 1.2.0

- Settings to change title

## 1.1.0

- Add setting: Path depth
- Add setting: Should include extension

## 1.0.1

- Remove escaping

## 1.0.0

- Reload backlinks on plugin enable/disable
- Patch backlinks dom
