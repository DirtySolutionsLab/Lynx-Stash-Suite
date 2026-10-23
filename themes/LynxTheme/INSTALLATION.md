# Installation and upgrade

## Fresh installation

Copy the `LynxTheme` directory in this repository into your Stash plugins directory. The final layout should be:

```text
<stash-config>/
  plugins/
    LynxTheme/
      LynxTheme.yml
      lynx-theme.js
      performer-details.js
      css/
      fonts/
      img/
```

Reload plugins in Stash under **Settings → Plugins**, enable **LynxTheme**, and refresh your browser. Disable any other full-page theme first.

Copy the complete `LynxTheme` directory, including the documentation bundled inside it. Keep only one `LynxTheme.yml` installed.

## Updating

1. Back up your existing `plugins/LynxTheme` directory and note your current Stash/plugin versions.
2. Replace that directory with the new `LynxTheme` directory.
3. Reload plugins and hard-refresh the browser if old styles remain cached.
4. Check the navigation, scene/performer cards, detail pages, filters and player.

The plugin ID must stay `LynxTheme`; changing the directory or manifest name can break asset URLs and saved settings.

## Rollback

Disable LynxTheme, restore your backed-up `plugins/LynxTheme` folder, reload plugins and refresh the browser. Your media library is not changed by installing this UI theme.

## Notes

The included theme is self-contained. Lynx Tools, Lynx Performer Suite, Lynx Scene Card and other functional plugins are separate and optional. If you use them, install each from its own release and avoid running duplicate/older versions alongside it.
