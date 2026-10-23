# Installation

1. Extract the release ZIP.
2. Copy the `LynxTools` folder into your Stash plugins directory.
3. Disable separate older right-click, SimpleImageCrop/Lynx Cropper or Lynx VR View plugins that duplicate modules you plan to use.
4. Reload plugins and enable **Lynx Tools**.
5. Open **Settings → Plugins** and enable the desired modules.
6. Refresh the browser with **Ctrl+F5**.

The manifest must be directly at `<plugins>/LynxTools/LynxTools.yml`. Do not leave duplicate installed copies.

## First checks

Enable one module first, refresh, and try its corresponding page. For example, enable Gallery Context Menu, open Galleries and right-click a card.

In the performer picker, use a full name or full alias for exact multi-word searches. Short single-word searches can show partial matches.

The settings context menu attaches to the Settings control. Image editing opens in a modal; selecting an action that runs a task can modify your Stash data.

## External performer sources

Local gallery images work without a remote account. Remote image and missing-scene actions read configured Stash-box endpoints and API keys from Stash. The manifest permits the supported StashDB, FansDB and ThePornDB endpoints. Availability depends on your configured service and account.

Routine GraphQL responses and configuration values are no longer printed to the browser console.

## Browser crop data

Display-only image crops and snapping preferences stay in the same browser and Stash origin. Another browser or port does not automatically share them.

Performer **Save Image** updates the profile image stored by Stash. It is different from a browser-only display crop.

## Upgrade and rollback

Back up the old plugin folder outside the plugins directory, replace it with this package, reload plugins and refresh the browser. The plugin ID remains `LynxTools`; existing module settings retain their keys. A version suffix in an old folder name is not required for the new folder.

Keep one active module provider for each context menu, cropper or VR viewer. Restoring plugin code does not undo edits, profile-image replacements or saved settings.
