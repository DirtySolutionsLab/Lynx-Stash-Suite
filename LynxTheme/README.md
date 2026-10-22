# Lynx Theme

A dark, glass-inspired theme for [Stash](https://github.com/stashapp/stash). Lynx Theme styles the navigation, cards, filters, detail pages and video player. The theme is based in part on [Refract](https://github.com/ordureconnoisseur/stash-refract) and includes substantial Lynx-specific styling and behavior.

The theme is one Stash UI plugin. Other Lynx plugins are separate projects and are **not required** to install it.

## Installation

1. Copy this complete `LynxTheme` folder into your Stash plugins directory, so the manifest is at `<stash-config>/plugins/LynxTheme/LynxTheme.yml`.
2. In Stash, reload plugins under **Settings → Plugins**.
3. Enable **LynxTheme**, then refresh the browser. If an older theme is active, disable it first to avoid conflicting styles.

See [INSTALLATION.md](INSTALLATION.md) for upgrade and rollback guidance.

## What is included

- Theme CSS and JavaScript for cards, navigation, filters, detail pages and the player
- The Lynx logo and UI artwork
- Self-hosted Albert Sans font files

The plugin does not include media files, metadata scrapers, renaming tools or the other Lynx plugins.

## Compatibility notes

Some internal CSS classes and browser-storage keys retain their Refract-era names so existing settings and selectors continue to work. These internal names do not mean that a second plugin must be installed. Stash UI markup can change between releases; visual and interaction testing on your own Stash version is recommended.

## Credits and licenses

Lynx Theme builds on [Refract by ordureconnoisseur](https://github.com/ordureconnoisseur/stash-refract). Theme code is distributed under the GNU Affero General Public License v3; see [LynxTheme/LICENSE](LICENSE). The bundled Albert Sans font is under the SIL Open Font License 1.1; see [LynxTheme/fonts/OFL-AlbertSans.txt](fonts/OFL-AlbertSans.txt). More details are in [CREDITS.md](CREDITS.md).

This is an independent community project, not an official Stash plugin.
