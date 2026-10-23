# Installation

## Requirements

Stash with the frontend Plugin API, including the SceneCard component patches, React, ReactDOM, Bootstrap overlays, React Router and Intl libraries. Use a modern browser.

This plugin does not need Python, an API key or an external service. Lynx Theme is optional. Existing theme overrides can affect the final appearance.

## Install

1. Download the release ZIP and extract it.
2. Copy the complete `LynxSceneCard` folder into your Stash plugins directory.
3. Disable SerechopsSceneCard and other plugins that replace scene-card details or popovers.
4. Reload plugins in Stash and enable **Lynx Scene Card**.
5. Configure the options under **Settings → Plugins**.
6. Refresh the browser with **Ctrl+F5**.

The manifest must be directly inside the plugin folder:

```text
plugins/
└── LynxSceneCard/
    ├── LynxSceneCard.yml
    ├── LynxSceneCard.js
    ├── LynxSceneCard.css
    └── fonts/
```

Initially, performer chips, tag chips, the footer and optional thumbnail overlays are off unless existing settings enable them. Turn on the parts you want, then refresh the page.

## Settings

| Option | What it controls |
| --- | --- |
| Enable Footer | Studio name, view count and scene date. |
| Show Performer Chips | Linked names with portrait previews and an overflow popup. |
| Show Tag Chips | Linked tags, related-scene previews and an overflow popup. |
| Show Studio Overlay | The native studio-logo overlay. |
| Show Scene Specs Overlay | Native scene specifications. |
| Show Interactive Speed Overlay | The native interactive-speed overlay, when available. |
| Show Progress Bar | The progress indicator inside scene cards. |
| Show Hover Scrubber | The native thumbnail scrubber, when preview assets exist. |
| Show Hover Scrubber Indicator | The native scrubber position indicator. |

The native scene-card popover row is replaced by this plugin. Use its performer and tag chip controls to show those items.

Settings are read when a card mounts. Refresh after changing them to update the full page consistently.

## Upgrade

Back up your installed plugin folder outside Stash's plugins directory. Replace its contents with this package. Keep only one `LynxSceneCard.yml` installed, even if the old folder was named `LynxSceneCard_0.1.8`.

The plugin ID remains `LynxSceneCard` and existing active settings keep their keys. The display name now includes spaces. The unused **Custom Studio Overlay** option has been removed; it did not control any code.

Settings from the separate SerechopsSceneCard plugin ID are not imported.

## Check after installation

Open Scenes and check title navigation, card selection, performer portraits, overflow lists and your chosen overlays. Try the same page with and without Lynx Theme if you need to isolate a styling conflict.

## Rollback

Disable the plugin, restore your backed-up folder, reload plugins and refresh the browser. Disabling the plugin and refreshing restores Stash's native card components.
