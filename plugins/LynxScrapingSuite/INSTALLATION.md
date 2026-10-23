# Installation

## New installation

1. Install Python 3.9 or later in the environment running Stash. No additional Python packages are required.
2. Extract the release ZIP.
3. Copy `LynxScrapingSuite` into your Stash **plugins** directory.
4. Copy the two folders inside the ZIP's `scrapers` directory into your Stash **scrapers** directory.
5. Reload plugins and scrapers in Stash.
6. Under **Settings → Plugins → Lynx Scraping Suite**, enable XL Girls and/or Mature.nl.
7. Refresh your browser and open Performers in Tagger view.

```text
<stash-config>/
├── plugins/
│   └── LynxScrapingSuite/
│       └── LynxScrapingSuite.yml
└── scrapers/
    ├── LynxXLGirls/
    │   └── LynxXLGirls-scraper.yml
    └── LynxMatureNL/
        └── LynxMatureNL.yml
```

The plugin adds source buttons and reviewed batch operations. The separate native scrapers add name/URL scraping to Stash. You can install only the plugin if you do not need native scraper entries.

## Python command

The plugin manifest and companion scraper definitions use `python`. If Stash cannot find that command, replace it with your Python executable's full path, or `python3` where appropriate. Update the plugin's `exec` entry and every scraper `script` command you use.

For Docker, Python must be installed inside the Stash runtime environment.

## Upgrade

Back up the installed plugin and companion scraper folders outside the active plugin/scraper directories. Keep only one manifest for each plugin or scraper. Replace files with the reviewed package, reload plugins and scrapers, then refresh your browser.

The plugin ID remains `LynxScrapingSuite`; existing saved `xl__` and `mature__` settings remain valid. The old directory name `LynxScrapingSuite_1.0.0-rc.1` does not need to match the release version.

Automatic Bra Size completion now runs only when explicitly enabled. Check that switch if you previously relied on its implicit default.

The generated `public-index.sqlite3` is a disposable directory-search cache. It is excluded from the release and recreated when needed. It is not a Stash database.

## Source-specific notes

XL Girls can send its existing public-site verification cookie when enabled. It is not an account login. Access/browser challenges can still prevent scraping.

Mature.nl requires explicit reviewed imports and does not attach a background update hook. Optional category mappings can align imported custom values with your attribute-tagging rules.

Profile images are imported only when selected. Body Type, Breast Size and Bra Size field names should match your attribute plugin if you want those values to feed its rules.

## Rollback

Restore your backed-up plugin and scraper folders, reload both and refresh the browser. Restoring code does not undo metadata already imported.
