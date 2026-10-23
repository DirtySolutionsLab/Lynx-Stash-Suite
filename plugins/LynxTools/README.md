# Lynx Tools

Optional context menus, image cropping and single-eye VR viewing modes for Stash.

**Version 1.0.0-rc.2 — public preview**

## Modules

| Module | Purpose |
| --- | --- |
| Scene Context Menu | Search and add related performers, tags and other supported scene links. |
| Gallery Context Menu | Add performers, tags and scenes through a searchable picker. |
| Image Context Menu | Manage related performers, tags, galleries and studio links. |
| Performer Context Menu | Choose profile images, add tags and access supported local or Stash-box actions. |
| Tag Context Menu | Manage tag relationships through the shared picker. |
| Settings Context Menu | Open configuration editors and supported tasks from the Settings control. |
| Cropper | Crop displayed images with optional aspect-ratio snapping, or save a cropped performer profile image. |
| VR Viewer | Display the original video or a single eye from side-by-side and over/under stereoscopic video. |

Enable only the modules you need under **Settings → Plugins**, then refresh the browser. New configurations have all module switches off. Lynx Theme is optional.

The performer picker supports names and aliases. A multi-word search requires the complete name or alias, rather than matching a shared first or last name.

## Cropping behavior

Image display crops are stored in the current browser. They do not rewrite the original image file. Saving a performer crop replaces the performer's profile image through Stash. Back up a profile image before replacing it.

The VR viewer changes the visible video region; it does not transcode media or guarantee smoother playback.

## Requirements

Stash with frontend plugin support and a modern browser. No Python or mandatory external JavaScript library is required. Local actions use Stash's own GraphQL API.

External performer-image or missing-scene actions require suitable Stash-box endpoints and keys configured in Stash. No credentials are included in this package.

See [INSTALLATION.md](INSTALLATION.md) for installation and upgrades.

## Preview status

This package is checked with syntax, module-loading, settings-isolation and name/alias picker tests. Fresh installation and complete live testing of every action remain pending.

## Credits and licenses

Context menus are based on Serechops' right-click plugins. The cropper is based on SimpleImageCrop by RollainKraus. Lynx adds the shared interface, integration and VR viewing module.

See [CREDITS.md](CREDITS.md), [LICENSE](LICENSE) and [licenses/Serechops-GPL-3.0.txt](licenses/Serechops-GPL-3.0.txt).
