# Lynx Theme

> [!WARNING]
> **NSFW content advisory.** Screenshots, videos, example metadata and linked previews may contain adult-oriented imagery, explicit titles or sexual terminology. Open previews only if you are comfortable viewing this material. Visual masking is not guaranteed to hide every detail.

> [!WARNING]
> **Pre-release software — use at your own risk.** This component is experimental and provided **AS IS**, without warranties or guarantees. It may cause errors, compatibility problems or unintended changes to your Stash installation or data. Back up your configuration, database and any affected files, and test in a separate Stash instance before enabling automatic or bulk operations. To the extent permitted by applicable law and the component's license, the maintainer accepts no liability for loss or damage arising from its use.

A dark, glass-inspired theme for [Stash](https://github.com/stashapp/stash). Lynx Theme styles the navigation, cards, filters, detail pages and video player. The theme is based in part on [Refract](https://github.com/ordureconnoisseur/stash-refract) and includes substantial Lynx-specific styling and behavior.

The theme is one Stash UI plugin. Other Lynx plugins are separate projects and are **not required** to install it.

## Preview gallery

[![Lynx Theme — home page and coordinated navigation](../../docs/screenshots/lynx-theme/front-page.png)](../../docs/screenshots/lynx-theme/front-page.png)

*Home page — dark glass navigation and coordinated scene, group and performer cards.*

> **Preview note:** these examples show a customized Stash installation. Some views also include optional companion plugins, including Lynx Scene Card and Supporting Images from Lynx Performer Suite; those functions are not all supplied by the theme alone. Previews contain adult-oriented metadata and imagery. Many screenshot thumbnails are blurred, but the video recordings are not fully masked. Library artwork and metadata are examples, not bundled theme content.

### Screenshots

Click any screenshot to open the full-size image.

| Library views | Detail views |
| --- | --- |
| **Scenes**<br>[![Scenes — Lynx Theme](../../docs/screenshots/lynx-theme/scenes.png)](../../docs/screenshots/lynx-theme/scenes.png)<br>Compact cards, yellow titles, performer/tag chips and colored counters. | **Scene details**<br>[![Scene details — Lynx Theme](../../docs/screenshots/lynx-theme/scene.png)](../../docs/screenshots/lynx-theme/scene.png)<br>Player layout, metadata sidebar and performer links. |
| **Performers**<br>[![Performers — Lynx Theme](../../docs/screenshots/lynx-theme/performers.png)](../../docs/screenshots/lynx-theme/performers.png)<br>Consistent portrait cards, country flags and library counters. | **Performer details**<br>[![Performer details — Lynx Theme](../../docs/screenshots/lynx-theme/performer.png)](../../docs/screenshots/lynx-theme/performer.png)<br>Grouped information, a dedicated tag row and a companion Supporting Images panel. |
| **Studios**<br>[![Studios — Lynx Theme](../../docs/screenshots/lynx-theme/studios.png)](../../docs/screenshots/lynx-theme/studios.png)<br>Studio logo cards with compact, color-coordinated counters. | **Tags**<br>[![Tags — Lynx Theme](../../docs/screenshots/lynx-theme/tags.png)](../../docs/screenshots/lynx-theme/tags.png)<br>Centered labels, parent relationships and related-item counters. |

**Theme settings**

Accent choices, card previews and visible-element controls.

[![Lynx Theme settings and card customizer](../../docs/screenshots/lynx-theme/settings.png)](../../docs/screenshots/lynx-theme/settings.png)

### Animated previews

Looping WebP previews display directly in the README as animated images. For the original resolution, smoother motion and playback controls, download the linked MP4 files and open them in your browser or media player.

**Performer page — approximately 48 seconds**

[![Animated Lynx performer page walkthrough](../../docs/videos/lynx-theme/performer-preview.webp)](../../docs/videos/lynx-theme/performer-preview.webp)

[Download full-resolution Performer MP4 · 3.7 MB](../../docs/videos/lynx-theme/Performer-compressed.mp4)

**Scene page — approximately 38 seconds**

[![Animated Lynx scene page walkthrough](../../docs/videos/lynx-theme/scene-preview.webp)](../../docs/videos/lynx-theme/scene-preview.webp)

[Download full-resolution Scene MP4 · 4.1 MB](../../docs/videos/lynx-theme/Scene-compressed.mp4)

*Animations are silent and loop automatically. They contain the same visible content as the recordings; no additional masking has been applied.*


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

The simplified transparent Lynx logo is bundled and displayed automatically. Leave **Custom logo** empty to use it, or enter your own image URL under **Settings → Interface → Lynx**. Clearing a custom URL restores the bundled logo. Existing custom-logo settings are preserved.

Some internal CSS classes and browser-storage keys retain their Refract-era names so existing settings and selectors continue to work. These internal names do not mean that a second plugin must be installed. Stash UI markup can change between releases; visual and interaction testing on your own Stash version is recommended.

## Credits and licenses

Lynx Theme builds on [Refract by ordureconnoisseur](https://github.com/ordureconnoisseur/stash-refract). Theme code is distributed under the GNU Affero General Public License v3; see [LynxTheme/LICENSE](LICENSE). The bundled Albert Sans font is under the SIL Open Font License 1.1; see [LynxTheme/fonts/OFL-AlbertSans.txt](fonts/OFL-AlbertSans.txt). More details are in [CREDITS.md](CREDITS.md).

This is an independent community project, not an official Stash plugin.
