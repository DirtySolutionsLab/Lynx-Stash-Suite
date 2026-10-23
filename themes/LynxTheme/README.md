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

All eight views are visible below. Click a thumbnail to open the full-size screenshot.

<table>
<tr>
<td align="center" width="25%"><a href="../../docs/screenshots/lynx-theme/front-page.png"><img src="../../docs/screenshots/lynx-theme/front-page.png" alt="Lynx Theme — Home page" width="220"></a><br><strong>Home page</strong></td>
<td align="center" width="25%"><a href="../../docs/screenshots/lynx-theme/scenes.png"><img src="../../docs/screenshots/lynx-theme/scenes.png" alt="Lynx Theme — Scenes" width="220"></a><br><strong>Scenes</strong></td>
<td align="center" width="25%"><a href="../../docs/screenshots/lynx-theme/scene.png"><img src="../../docs/screenshots/lynx-theme/scene.png" alt="Lynx Theme — Scene details" width="220"></a><br><strong>Scene details</strong></td>
<td align="center" width="25%"><a href="../../docs/screenshots/lynx-theme/settings.png"><img src="../../docs/screenshots/lynx-theme/settings.png" alt="Lynx Theme — Theme settings" width="220"></a><br><strong>Theme settings</strong></td>
</tr>
<tr>
<td align="center" width="25%"><a href="../../docs/screenshots/lynx-theme/performers.png"><img src="../../docs/screenshots/lynx-theme/performers.png" alt="Lynx Theme — Performers" width="220"></a><br><strong>Performers</strong></td>
<td align="center" width="25%"><a href="../../docs/screenshots/lynx-theme/performer.png"><img src="../../docs/screenshots/lynx-theme/performer.png" alt="Lynx Theme — Performer details" width="220"></a><br><strong>Performer details</strong></td>
<td align="center" width="25%"><a href="../../docs/screenshots/lynx-theme/studios.png"><img src="../../docs/screenshots/lynx-theme/studios.png" alt="Lynx Theme — Studios" width="220"></a><br><strong>Studios</strong></td>
<td align="center" width="25%"><a href="../../docs/screenshots/lynx-theme/tags.png"><img src="../../docs/screenshots/lynx-theme/tags.png" alt="Lynx Theme — Tags" width="220"></a><br><strong>Tags</strong></td>
</tr>
</table>

### Animated previews

Two silent, looping previews shown side by side. Click either animation to open it at a larger size, or download the original-resolution MP4 for sharper text and playback controls.

<table>
<tr>
<td align="center" width="50%"><strong>Performer page · 48 seconds</strong><br><a href="../../docs/videos/lynx-theme/performer-preview.webp"><img src="../../docs/videos/lynx-theme/performer-preview.webp" alt="Animated Lynx performer page walkthrough" width="440"></a><br><a href="../../docs/videos/lynx-theme/Performer-compressed.mp4">Download full-resolution MP4 · 3.7 MB</a></td>
<td align="center" width="50%"><strong>Scene page · 38 seconds</strong><br><a href="../../docs/videos/lynx-theme/scene-preview.webp"><img src="../../docs/videos/lynx-theme/scene-preview.webp" alt="Animated Lynx scene page walkthrough" width="440"></a><br><a href="../../docs/videos/lynx-theme/Scene-compressed.mp4">Download full-resolution MP4 · 4.1 MB</a></td>
</tr>
</table>

*Animations loop automatically and contain the same visible content as the recordings. No additional masking has been applied.*


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
