# Lynx for Stash

A dark, customizable theme and a collection of practical plugins for [Stash](https://github.com/stashapp/stash).

This is my first GitHub project. I am new to sharing and maintaining software here, but I have been an active Stash user for a long time. Lynx grew out of the changes and tools I wanted in my own library. I hope others find parts of it useful too.

> **Project status:** Early public release. The components have been developed and used in my own setup, but a clean installation on a different computer may need additional setup. Please read the notes for each component and back up your Stash configuration before trying it.

## What's included

| Component | Purpose |
| --- | --- |
| **Lynx Theme** | A dark glass-style interface with customized navigation, cards, filters, detail pages, and player styling. |
| **Lynx Scene Card** | A separate scene-card companion with its own display and customization options. |
| **Lynx Performer Suite** | Performer attribute rules, tag transfer, performer links, image matching, and supporting images. Its modules can be enabled separately. |
| **Lynx Tools** | Optional tools including image cropping, right-click menus, and VR viewing controls. |
| **Lynx Scraping Suite** | Performer lookup and reviewed-import tools, currently including XL Girls and Mature.nl integrations. |
| **Lynx Renamer** | Guided filename and folder rules with a preview before changes are applied. |
| **Missing Performer Images** | A review workflow for finding and choosing portraits for performers without an image. |
| **edit-unorganized** | Opens a chosen tab automatically on scene, image, or gallery detail pages. |

The last two are additional plugins in this collection, not required parts of the Lynx theme. You can install only the components you want.

## Getting started

1. Install and run Stash first. Make a backup of your Stash configuration and library database.
2. Download the component you want from this repository's **Releases** page when a release package is available. Read that component's README or release notes before installing it.
3. Place its actual plugin folder in your Stash `plugins` directory. Do not copy a surrounding archive or collection folder as an extra nesting level.
4. Reload plugins in Stash, enable the new plugin, and refresh the browser. Some UI changes may require a hard refresh (`Ctrl+F5`).
5. Start with a small preview or test selection before running any tool that changes metadata or files in bulk.

**Lynx Theme is the visual base; the other plugins are optional.** Some tools require Python or other dependencies, and a plugin manifest may need its Python executable path adjusted for your computer. Check the instructions shipped with each release rather than assuming my local Windows paths will work on your system.

## Privacy and safe use

This repository is intended to contain distributable source files and release packages, **not** a copy of a personal Stash installation. Never publish your Stash `config.yml`, API keys, passwords, private settings backups, databases, logs, cache files, or personal library paths. Review every file before uploading it to a public repository.

Scrapers depend on the availability and structure of third-party websites. Use them in accordance with the relevant sites' terms and applicable law. Always review imported metadata before saving it.

## Credits and licensing

Lynx is an independent community project and is not affiliated with the Stash team. It includes customized or adapted work alongside original code. In particular, Lynx Theme has Refract-based roots, and Lynx Scene Card was derived from a modified SerechopsSceneCard. Their original authors' rights and license terms still apply. See the notices and licenses included with individual components; do not assume that one license covers the entire collection.

If you notice a missing credit, a licensing problem, or a bug, please open an issue so it can be corrected.

## Feedback

Bug reports and suggestions are welcome. Please include the component name, its version, your Stash version, the steps to reproduce the problem, and relevant log lines. Remove API keys, private paths, and personal information before posting logs or screenshots.
