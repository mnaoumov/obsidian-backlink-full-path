# CLAUDE.md

## Known Issues

- Lint, format, and spellcheck scripts fail when `obsidian-dev-utils` is installed via `file:` protocol because transitive tool dependencies (cspell, dprint, eslint-plugin-no-unsanitized) are not hoisted into the consumer's `node_modules`. This will resolve when obsidian-dev-utils v2 is published to npm.
