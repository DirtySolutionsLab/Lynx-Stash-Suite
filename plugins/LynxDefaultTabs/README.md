# Lynx Default Tabs

A Lynx adaptation of **[edit-unorganized by feederbox826](https://github.com/feederbox826/plugins/tree/main/plugins/edit-unorganized)**. Credit for the original plugin and default-tab workflow belongs to feederbox826.

**Version 0.3.1 — public preview**

Choose which tab opens when you visit a scene, image or gallery in Stash. By default, unorganized items open on **Edit**. You can also apply the behavior to organized items.

## What the Lynx version adds

- Standalone navigation handling without CommunityScripts UI Library or wfke.
- Waits for asynchronously rendered tabs and organized controls.
- Handles direct page loads and Stash's client-side navigation.
- Opens the chosen tab once per visit, then stops observing that page.
- English descriptions and installation documentation.

The plugin selects a tab; it does not save edits or change library metadata.

## Installation

Copy `LynxDefaultTabs` into your Stash plugins directory, reload plugins, enable **Lynx Default Tabs** and refresh your browser. Disable the upstream plugin or another installed copy of this adaptation first.

The manifest filename remains `edit-unorganized.yml`. This preserves the internal plugin ID and existing settings.

See [INSTALLATION.md](INSTALLATION.md) for upgrades, tab names and rollback.

## Available tabs

| Page | Accepted setting values |
| --- | --- |
| Scenes | `details`, `queue`, `markers`, `filters`, `file-info`, `history`, `edit` |
| Images | `details`, `file-info`, `edit` |
| Galleries | `details`, `chapters`, `edit` |

An empty value uses `edit`. Scene `filters` is mapped to the native video-filter tab. A requested tab must exist in your Stash version.

## Credits and license

This is a modified community plugin, not an original implementation of the feature by DirtySolutionsLab and not an official upstream release.

The original MIT copyright and permission notice are retained in [LICENSE](LICENSE). See [CREDITS.md](CREDITS.md) for provenance and the scope of Lynx changes.

## Preview status

The package is checked with JavaScript syntax, manifest/assets and mocked navigation tests. A fresh installation and live UI acceptance test have not been performed for this release.
