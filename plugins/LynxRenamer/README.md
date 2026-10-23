# Lynx Renamer

Build filenames and destination folders from your scene metadata in Stash, with guided settings and a preview before you apply changes.

**Version 1.1.1 — public preview**

## What it does

- Build a filename using presets and insertable metadata fields.
- Choose a destination folder and optional studio or performer subfolders.
- Add conditional rules for tags, studios and existing paths.
- Preview a real scene using your unsaved settings.
- Process scenes automatically when they are updated, or run a library task.
- Keep associated subtitle and funscript filenames in sync when configured.
- Exclude scenes by tag, studio or path.

The interface and documentation are in English. Lynx Theme and the other Lynx plugins are optional.

## Start here

Follow [INSTALLATION.md](INSTALLATION.md), then open **Settings → Plugins** and find the Lynx Renamer panel.

1. Choose a filename preset or edit the pattern.
2. Set a destination only if you want to move files.
3. Enter a scene ID and click **Preview this scene**.
4. Review the proposed path and save your settings.
5. Keep dry-run enabled while testing. Enable automation only when you want scene updates to trigger processing.

On a new installation, automatic renaming is **off**, dry-run is **on**, and no move destinations are configured. The default filename is `{$date - }$title`: the date is optional and the title is required. Existing settings saved in Stash take precedence over these defaults.

## Preview and live operations

**Preview this scene** calculates a proposed path without saving settings, opening the database or changing files. It uses the current unsaved draft.

**Dry-run entire library** saves the draft with dry-run enabled and queues a library task. It does not rename or move media, but configured log files may be written.

**Live processing** renames or moves media and updates Stash's SQLite database directly. The Stash server must have access to both the database and media paths. Back up your database and test on a small set of files before enabling live operations. A calculated preview does not verify destination permissions or all file collisions.

Saving settings alone does not start a rename. When automatic processing is enabled and dry-run is off, later scene updates use those settings.

See [RULES.md](RULES.md) for templates, rule priority and exclusions.

## Public preview

This release is prepared for public testing. Static checks and mocked preview/dry-run tests are documented in [CHANGELOG.md](CHANGELOG.md). A fresh installation and live file operations have not been verified as part of this release review.

Please report issues with your Stash version, operating system, plugin version and the relevant error message. Remove private paths and credentials before posting logs.

## Credits and license

Lynx Renamer builds on the community **renamerOnUpdate** plugin. See [CREDITS.md](CREDITS.md) for upstream sources and [LICENSE](LICENSE) for the GNU Affero General Public License v3.
