# Backlink Full Path

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov) [![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-backlink-full-path)](https://github.com/mnaoumov/obsidian-backlink-full-path/releases) [![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-backlink-full-path/total)](https://github.com/mnaoumov/obsidian-backlink-full-path/releases) [![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/mnaoumov/obsidian-backlink-full-path)

[Obsidian](https://obsidian.md/)'s Backlinks pane lists each backlink by note name alone. If you keep a `Meeting` note in three different project folders — which is the natural way to organize them — the pane shows three identical rows and no way to tell which is which without opening each one.

This plugin shows each backlink's **full path** instead, so the list identifies its notes.

<!-- markdownlint-disable MD033 -->

<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-desktop-1.png"><img src="images/screenshots/screenshot-desktop-1.png" alt="Every backlink shows its full folder path" width="600"></a>

<details>
<summary>More screenshots</summary>

<div>
<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-desktop-2.png"><img src="images/screenshots/screenshot-desktop-2.png" alt="Without the plugin: seven notes, all named Meeting" width="600"></a>
<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-desktop-3.png"><img src="images/screenshots/screenshot-desktop-3.png" alt="Show paths relative to a folder you choose" width="600"></a>
<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-desktop-4.png"><img src="images/screenshots/screenshot-desktop-4.png" alt="Trim long paths to the folder that matters" width="600"></a>
<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-desktop-5.png"><img src="images/screenshots/screenshot-desktop-5.png" alt="Or read the path outwards, file name first" width="600"></a>
<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-mobile-1.png"><img src="images/screenshots/screenshot-mobile-1.png" alt="Every backlink shows its full folder path" width="270"></a>
<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-mobile-2.png"><img src="images/screenshots/screenshot-mobile-2.png" alt="Without the plugin: seven notes, all named Meeting" width="270"></a>
<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-mobile-3.png"><img src="images/screenshots/screenshot-mobile-3.png" alt="Show paths relative to a folder you choose" width="270"></a>
<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-mobile-4.png"><img src="images/screenshots/screenshot-mobile-4.png" alt="Trim long paths to the folder that matters" width="270"></a>
<a href="https://github.com/mnaoumov/obsidian-backlink-full-path/blob/HEAD/images/screenshots/screenshot-mobile-5.png"><img src="images/screenshots/screenshot-mobile-5.png" alt="Or read the path outwards, file name first" width="270"></a>
</div>

</details>

<!-- markdownlint-enable MD033 -->

## Demo vault

**The documentation is a demo vault.** Every feature has a note that explains what it does and why you would want it, with three same-named notes already in place so the ambiguity is in front of you.

**[Start reading here](<./demo-vault/00 Start.md>)** — it is plain markdown, so it works on GitHub with nothing installed.

A copy of the vault ships with every release. You can access it via any of the following:

1. Running the **Backlink Full Path: Open demo vault** command.
2. Downloading `backlink-full-path-demo-vault-<version>.zip` (`<version>` is the release version) from the [Releases](https://github.com/mnaoumov/obsidian-backlink-full-path/releases).
3. Browsing its source in [`demo-vault/`](./demo-vault/README.md) in this repository.

## What it does

- **Full paths in the Backlinks pane**, so notes sharing a name are distinguishable — shown side by side with Obsidian's default. [01 Backlink full path](<./demo-vault/01 Backlink full path.md>)
- **Every setting**, by the key it is stored under. [02 Settings](<./demo-vault/02 Settings.md>)

## Installation

The plugin is available in [the official Community Plugins repository](https://obsidian.md/plugins?id=backlink-full-path).

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://obsidian.md/plugins) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-backlink-full-path).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Debugging

By default, debug messages for this plugin are hidden.

To show them, run the following command:

```js
window.DEBUG.enable('backlink-full-path');
```

For more details, refer to the [documentation](https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/).

## Changelog

All notable changes to this project will be documented in the [CHANGELOG](./CHANGELOG.md).

## Contributing

Contributions are welcome — see [CONTRIBUTING](./CONTRIBUTING.md) to get set up.

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

<!-- markdownlint-enable MD033 -->

## My other Obsidian resources

[See my other Obsidian resources](https://github.com/mnaoumov/obsidian-resources).

## License

© [Michael Naumov](https://github.com/mnaoumov/)
