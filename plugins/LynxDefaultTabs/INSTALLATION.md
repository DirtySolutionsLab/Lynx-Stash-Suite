# Installation and settings

## Install

1. Disable an existing edit-unorganized plugin or duplicate Lynx adaptation.
2. Extract the ZIP and copy the complete `LynxDefaultTabs` folder into your Stash plugins directory.
3. Confirm that `edit-unorganized.yml` is directly inside the folder.
4. Reload plugins in Stash and enable **Lynx Default Tabs**.
5. Open its settings, choose your tabs and refresh your browser.

No Python, external library or other Lynx plugin is required.

## Settings

- **Open the chosen tab for organized items too:** off limits the behavior to unorganized items; on applies it to all supported items.
- **Default scene tab:** for example, `edit` or `details`.
- **Default image tab:** for example, `edit` or `file-info`.
- **Default gallery tab:** for example, `edit` or `chapters`.

Leave a tab setting blank to use `edit`. Refresh after changing settings; configuration is read at page startup.

The plugin waits for the relevant controls, selects the tab once and stops. It does not keep forcing you back when you manually switch tabs.

## Upgrade

Back up the old plugin folder outside Stash's plugins directory. Replace it with this package, keeping only one `edit-unorganized.yml` installed.

The visible name changes to Lynx Default Tabs. The internal ID remains `edit-unorganized`, so the current settings keys are preserved. The folder can be named `LynxDefaultTabs`; the manifest filename must remain unchanged.

The old generated source-manager `manifest` is not included in this manual release. It points to the upstream distribution rather than this Lynx adaptation. Do not install the upstream package alongside this one.

## Troubleshooting

If nothing happens, refresh the browser, check the organized-only option and verify that the requested tab exists. The plugin waits up to 30 seconds for page controls. It relies on Stash's current tab markup and organized-button classes.

## Rollback

Disable the plugin, restore your backed-up folder, reload plugins and refresh. No library metadata is changed by this plugin.
