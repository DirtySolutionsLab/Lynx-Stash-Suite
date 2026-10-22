# Installation and use

This is a review draft with unresolved baseline provenance. See `CREDITS.md` before treating it as a publication-ready release.

## Install for local testing

1. Back up your current plugin folder outside the Stash plugins directory.
2. Copy `LynxMissingPerformerImages` into your Stash plugins directory.
3. Keep `missing_performer_images.yml` directly inside that folder, together with both Python files, JavaScript and CSS.
4. Keep only one installed copy of `missing_performer_images.yml`.
5. Reload plugins, enable **Lynx Missing Performer Images**, then refresh your browser.

The manifest uses `python`. If Stash cannot find Python, change the first `exec` entry to your Python executable's full path or `python3`, as appropriate. Python must be available in the environment running Stash. No pip packages are required by this plugin.

Backend library tasks need write access to the plugin folder for their operating-system lock file.

The plugin ID remains `missing_performer_images`, the page route remains `/plugins/missing-performer-images`, and the page-size preference is retained. The new folder name and visible Lynx name do not change those identifiers.

## Image sources

**Library:** the review starts with images linked to the performer, with linked galleries as alternatives.

**Installed scrapers:** the source dropdown lists your installed performer name-search scrapers. For a URL-only source, paste a supported profile URL. Search results may need **Load profile photos** before an image appears.

**Direct image URL:** use an actual image address rather than a web page. The Python backend downloads and validates the image before selection.

**Upload:** choose a JPEG, PNG, GIF or WebP from your computer.

**Google Images:** opens another tab. Return to the plugin to upload a saved image or preview a direct image URL.

External downloads and uploads are limited to 8 MiB. Scraper-supplied encoded images use the existing frontend limit of 32 MiB.

## Saving and existing images

**Use this image** changes the card selection. **Approve & save** performs the update.

The plugin checks that the performer is still missing a portrait before saving. Stash does not provide an atomic compare-and-set for this field; avoid running competing image imports during review.

After a connection error, refresh to check the actual saved state. Updates are not automatically retried.

## Troubleshooting

- No sources: install a suitable performer scraper or use a direct URL/upload.
- Blocked source: try the scraper in normal Stash scraping, another source or an upload.
- Unknown plugin: keep `missing_performer_images.yml` unchanged and reload plugins.
- Existing image protected: the performer already has a portrait; this workflow does not replace it.
- Lock file: the backend creates `missing_performer_images.lock`. Its existence does not mean a task is running; the operating-system lock controls concurrency. Generated lock files are not included in the release draft.

## Upgrade and rollback

Back up and replace the old plugin files, reload plugins and refresh the browser. Do not leave the backup inside the plugins directory.

Restoring old plugin code does not undo profile images already saved. The plugin has no automatic image rollback.
