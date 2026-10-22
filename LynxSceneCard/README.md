# Lynx Scene Card

Custom scene titles, performer and tag chips, compact overflow lists and portrait previews for Stash.

**Version 0.1.9 — public preview**

Lynx Scene Card replaces the details and popover components of Stash scene cards through the Plugin API. It is designed to complement Lynx Theme and can also run independently.

## Features

- Single-line titles with a full-title hover hint.
- Optional linked performer chips with portrait previews.
- Optional linked tag chips and related-scene previews.
- Compact overflow popups for additional performers and tags.
- Optional studio, date and view-count footer.
- Controls for Stash's thumbnail overlays, progress bar and hover scrubber.
- Shared, bounded request caching to avoid duplicate configuration and hover requests.

All options start disabled when no saved values exist; the custom title remains visible. Enable **Show Performer Chips**, **Show Tag Chips** and **Enable Footer** according to your preferred layout, then refresh the page.

## Installation

See [INSTALLATION.md](INSTALLATION.md) for installation, upgrades and rollback.

Copy the complete `LynxSceneCard` folder into Stash's plugins directory, reload plugins and enable **Lynx Scene Card**. Choose the card elements you want in plugin settings, then refresh your browser.

No Python, API key or external service is required. Fonts are bundled locally.

## Compatibility

Disable SerechopsSceneCard and other plugins that replace the same scene-card components. Lynx Theme can further style the cards; enable the companion plugin's chip options before expecting performer and tag rows to appear.

The plugin ID remains `LynxSceneCard`. Existing Lynx Scene Card settings are retained. Settings from the separate SerechopsSceneCard plugin ID are not imported.

## Public preview

See [PERFORMANCE.md](PERFORMANCE.md) for runtime behavior and validation limits. This preview has not been verified through a fresh installation during the release review.

Please report issues with your Stash and plugin versions, browser, active theme and a description of the problem.

## Credits and license

Based on SerechopsSceneCard by Serechops, with Lynx presentation, overflow popups and performance changes. The plugin is distributed under GPL-3.0; the bundled Poppins fonts retain the SIL Open Font License 1.1.

See [NOTICE.md](NOTICE.md), [LICENSE](LICENSE) and [fonts/OFL.txt](fonts/OFL.txt).
