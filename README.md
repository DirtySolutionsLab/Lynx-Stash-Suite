<div align="center">

<img src="docs/images/lynx-logo.png" alt="Lynx Stash Suite logo" width="190">

# Lynx Stash Suite

**A darker look. A clearer workflow. Your Stash, your way.**

A glass-inspired theme and a collection of practical tools for [Stash](https://github.com/stashapp/stash).

[Browse the plugins](#explore-the-suite) · [Download releases](https://github.com/DirtySolutionsLab/Lynx-Stash-Suite/releases) · [Installation](#installation) · [Report an issue](https://github.com/DirtySolutionsLab/Lynx-Stash-Suite/issues)

</div>

---

## Welcome to Lynx

Lynx brings together a dark interface, configurable cards, performer tools, metadata scraping and everyday library utilities. Install the parts you want — you do not need the entire suite.

This is my first GitHub project. I am new to publishing code, but I have been an active Stash user for a long time. These tools grew out of changes I wanted in my own library, developed with AI assistance and, where documented, building on community projects.

Feedback, reproducible bug reports and suggestions are welcome.

> **Public previews:** these projects are under active development. Read each component's release notes, back up your configuration and database, and test changes on a small selection before enabling automation.

## Quick navigation

- [Explore the suite](#explore-the-suite)
- [Lynx Theme](#lynx-theme)
- [Lynx Performer Suite](#lynx-performer-suite)
- [Lynx Scene Card](#lynx-scene-card)
- [Lynx Tools](#lynx-tools)
- [Lynx Scraping Suite](#lynx-scraping-suite)
- [Lynx Renamer](#lynx-renamer)
- [Lynx Missing Performer Images](#lynx-missing-performer-images)
- [Lynx Default Tabs](#lynx-default-tabs)
- [Installation](#installation)
- [Support and feedback](#support-and-feedback)
- [Credits and licenses](#credits-and-licenses)

## Explore the suite

| Component | What it adds | Documentation |
| --- | --- | --- |
| **Lynx Theme** | Dark glass styling for navigation, cards, filters, detail pages and the player. | [Read more](LynxTheme/README.md) |
| **Lynx Performer Suite** | Attribute tags, tag transfer, performer matching, performer links and supporting images. | [Read more](LynxPerformerSuite/README.md) |
| **Lynx Scene Card** | Custom titles, performer and tag chips, overflow lists and hover previews. | [Read more](LynxSceneCard/README.md) |
| **Lynx Tools** | Context menus, image cropping and single-eye VR viewing modes. | [Read more](LynxTools/README.md) |
| **Lynx Scraping Suite** | Performer scraping and reviewed batch imports from XL Girls and Mature.nl. | [Read more](LynxScrapingSuite/README.md) |
| **Lynx Renamer** | Guided filename and destination rules, previews and optional automation. | [Read more](LynxRenamer/README.md) |
| **Lynx Missing Performer Images** | Find, review and approve portraits for performers without an image. | [Read more](LynxMissingPerformerImages/README.md) |
| **Lynx Default Tabs** | Open scenes, images and galleries on your preferred tab. | [Read more](LynxDefaultTabs/README.md) |

Download individual component ZIPs from [Releases](https://github.com/DirtySolutionsLab/Lynx-Stash-Suite/releases). Release titles identify the component; the repository's single “Latest” label does not necessarily identify the newest version of every plugin.

---

## Lynx Theme

A dark, glass-inspired interface with colored navigation icons, compact cards and coordinated detail pages.

- Styling for navigation, filters and media cards.
- Performer and studio detail-page presentation.
- Player styling and configurable visual options.
- Bundled fonts and Lynx artwork.

The theme handles presentation. The functional tools below are separate plugins and are not required to use the theme.

<!-- Screenshot: upload docs/screenshots/lynx-theme.png, then uncomment:
![Lynx Theme — navigation and library cards](docs/screenshots/lynx-theme.png)
-->

[Documentation](LynxTheme/README.md) · [Installation](LynxTheme/INSTALLATION.md) · [Releases](https://github.com/DirtySolutionsLab/Lynx-Stash-Suite/releases)

## Lynx Performer Suite

Keep performer information and related library items organized with modules you can enable individually.

- **Performer Attributes:** configurable metadata-to-tag rules and optional measurement-based estimates.
- **Tag Transfer:** transfer tags along selected routes between performers, scenes, images and galleries.
- **Performer Links:** synchronize performer associations between galleries and their images.
- **Performer Matcher:** review names from filenames and folders, match existing performers or explicitly create new ones.
- **Supporting Images:** configurable image categories, including Face, Eyes, Breasts, Ass, Body Type and Dressed.

Preview rule changes before applying them. Measurement-based categories are optional estimates, not objective descriptions of people.

<!-- Screenshot: upload docs/screenshots/performer-suite.png, then uncomment:
![Lynx Performer Suite — performer details and supporting images](docs/screenshots/performer-suite.png)
-->

[Documentation](LynxPerformerSuite/README.md) · [Installation](LynxPerformerSuite/INSTALLATION.md) · [Rule formats](LynxPerformerSuite/RULE-FORMATS.md)

## Lynx Scene Card

Bring more useful information into the scene grid without overcrowding each card.

- Single-line titles with full-title hover hints.
- Linked performer and tag chips.
- Compact overflow lists and performer portrait previews.
- Optional footer and thumbnail controls.

Enable the card elements you want in plugin settings. Disable other plugins that replace the same scene-card components.

<!-- Screenshot: upload docs/screenshots/scene-card.png, then uncomment:
![Lynx Scene Card — performer chips and compact overflow](docs/screenshots/scene-card.png)
-->

[Documentation](LynxSceneCard/README.md) · [Installation](LynxSceneCard/INSTALLATION.md)

## Lynx Tools

Optional utilities for everyday actions in Stash.

- Searchable context menus for scenes, galleries, images, performers, tags and settings.
- Performer selection by name or alias.
- Image cropping with aspect-ratio snapping.
- Single-eye viewing for supported stereoscopic video layouts.

Display crops do not rewrite original image files. Saving a performer crop updates the performer's portrait. The VR viewer changes the visible region; it does not transcode media or guarantee smoother playback.

<!-- Screenshot: upload docs/screenshots/lynx-tools.png, then uncomment:
![Lynx Tools — searchable context-menu picker](docs/screenshots/lynx-tools.png)
-->

[Documentation](LynxTools/README.md) · [Installation](LynxTools/INSTALLATION.md)

## Lynx Scraping Suite

Search performer profiles, compare source data and explicitly import the fields you want.

**Included sources:** XL Girls and Mature.nl.

- Name and supported profile-URL lookup.
- Selected-performer batch review.
- Field-by-field import choices.
- XL Girls height and weight conversion to centimetres and kilograms, while preserving measurement notation.

Available data depends on the source profile and website access. Website changes or access checks can interrupt scraping.

**Install both parts:** the plugin belongs in Stash's plugins directory; the companion definitions in the repository's `scrapers` folder belong in Stash's scrapers directory.

<!-- Screenshot: upload docs/screenshots/scraping-suite.png, then uncomment:
![Lynx Scraping Suite — review source metadata before importing](docs/screenshots/scraping-suite.png)
-->

[Documentation](LynxScrapingSuite/README.md) · [Installation](LynxScrapingSuite/INSTALLATION.md) · [Companion scrapers](scrapers/)

## Lynx Renamer

Build scene filenames and destination folders from metadata using guided settings and previews.

- Filename presets and insertable metadata fields.
- Destination folders and conditional rules.
- Preview a scene before applying changes.
- Optional automatic processing and associated-file renaming.

**Live operations rename or move files and update Stash's database directly.** Keep dry-run enabled while testing and back up your database and media before live processing.

<!-- Screenshot: upload docs/screenshots/renamer.png, then uncomment:
![Lynx Renamer — filename rules and path preview](docs/screenshots/renamer.png)
-->

[Documentation](LynxRenamer/README.md) · [Installation](LynxRenamer/INSTALLATION.md) · [Rules](LynxRenamer/RULES.md)

## Lynx Missing Performer Images

Fill missing portrait slots with a review-first workflow.

- Find candidates in linked images and galleries.
- Search installed performer scrapers.
- Preview direct image URLs or upload a local image.
- Approve individual portraits or selected reviewed cards.

The review imports only the image, not other performer metadata. Google Images opens as an external search shortcut. Separate library assignment tasks use their own ranked candidates, not review-page selections.

<!-- Screenshot: upload docs/screenshots/missing-performer-images.png, then uncomment:
![Lynx Missing Performer Images — review and approve portraits](docs/screenshots/missing-performer-images.png)
-->

[Documentation](LynxMissingPerformerImages/README.md) · [Installation](LynxMissingPerformerImages/INSTALLATION.md) · [Credits and source history](LynxMissingPerformerImages/CREDITS.md)

## Lynx Default Tabs

Open scenes, images and galleries on your preferred tab, including the edit tab for unorganized items.

A small workflow utility based on **edit-unorganized by feederbox826**. The internal manifest remains `edit-unorganized.yml` for compatibility.

[Documentation](LynxDefaultTabs/README.md) · [Installation](LynxDefaultTabs/INSTALLATION.md) · [Credits](LynxDefaultTabs/CREDITS.md)

---

## Installation

1. Open [Releases](https://github.com/DirtySolutionsLab/Lynx-Stash-Suite/releases) and choose the component you want.
2. Download its attached component ZIP, rather than assuming GitHub's automatic “Source code” archive is an installable plugin.
3. Read the component's `INSTALLATION.md` and back up any existing installation.
4. Extract and copy the actual plugin folder into your Stash plugins directory. Keep its manifest directly inside that folder.
5. Reload plugins in Stash, enable the plugin or desired modules, then refresh your browser.
6. Start with a small preview before enabling automatic updates.

Do not install this entire repository as a single plugin. Do not leave duplicate or backup plugin copies inside Stash's plugins directory.

**Upgrading Performer Suite:** preserve its runtime SQLite databases and follow its upgrade guide; they record information used to reconcile inherited tags and performer links.

**Python:** Performer Suite, Renamer, Missing Performer Images and the companion scrapers use Python. Read each component's requirements and ensure Stash can find the correct interpreter.

**Scraping Suite:** copy the companion scraper folders separately to Stash's scrapers directory.

## Support and feedback

[Open an issue](https://github.com/DirtySolutionsLab/Lynx-Stash-Suite/issues) with:

- Component name and version.
- Stash version, operating system and browser.
- Steps to reproduce the problem.
- Expected and actual behavior.
- Relevant errors or a redacted screenshot.

Remove API keys, private URLs, personal file paths and other sensitive information before sharing logs or screenshots.

## Credits and licenses

Lynx is an independent community project, not an official Stash product.

Several components build on existing community work, including Refract, Serechops' scene-card and context-menu plugins, SimpleImageCrop, renamerOnUpdate and edit-unorganized. Original authors, sources and license notices are documented in the relevant component folders.

**There is no single license covering every component in this repository.** Read each component's `LICENSE`, `CREDITS.md` and any bundled font or third-party notices before redistributing it. Missing Performer Images also documents the limits of its known source history.

Thank you to the Stash developers and community contributors whose work makes these tools possible.
