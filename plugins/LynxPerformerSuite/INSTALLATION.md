# Installation and upgrade

## Requirements

- Stash with UI plugin and Python-backed plugin support
- Python 3 available as `python` in the environment that launches Stash
- Write access to the installed plugin directory for its runtime SQLite databases

The plugin manifest uses `exec: [python, '{pluginDir}/dispatch.py']`. If Stash cannot find `python`, change only the first `exec` entry in `LynxPerformerSuite.yml` to the absolute path of your Python 3 executable. Do not use a path copied from someone else's computer. Restart or reload plugins after changing the manifest.

## Fresh installation

1. Copy the whole `LynxPerformerSuite` directory into your Stash plugins directory, beside any other plugin directories.
2. Confirm the manifest is at `<stash-config>/plugins/LynxPerformerSuite/LynxPerformerSuite.yml`.
3. In Stash, use **Settings → Plugins → Reload plugins**.
4. Enable the suite and only the modules you intend to use. Refresh the browser.
5. Run a small preview before any bulk operation.

The plugin creates its own queue/provenance databases on first use. No personal data or pre-populated databases are included in this package.

## Upgrade an existing installation

1. Stop Stash and back up the **entire existing suite directory**, including all `*.sqlite3` files. Store the backup outside Stash's plugins directory.
2. Copy the new code files into the existing suite directory, replacing matching code files while **preserving existing `*.sqlite3` files and Stash settings**. If you prefer a new directory name, move the databases with the code and ensure the old manifest is no longer inside Stash's plugins directory.
3. Check that only one `LynxPerformerSuite.yml` remains active.
4. Start Stash, reload plugins, and hard-refresh the browser.
5. Confirm the displayed version is `1.1.3`, review your saved settings, and preview a small selection before applying changes.

### Upgrading to 1.1.3: performer transfers

The first performer-engine invocation archives the pre-upgrade waiting queue inside the same SQLite database. It does not delete provenance or change library metadata. Do not upgrade while an old worker is running: stop Stash first. Keep the full pre-upgrade backup if you need the previous queue state.

Open **What do you want to copy?** and choose **Set performer copying: Gallery → Images** for the recommended one-way performer route. Tag copying and studio inheritance are separate. The reverse performer route now defaults to OFF unless explicitly enabled. Review this change if you previously relied on automatic image-to-gallery copying.

To test, add a performer to one small gallery, save, let the queue finish, and inspect its images. Then verify a different gallery has not been changed. This release is tested offline; real Stash hook payloads and visual acceptance still need verification on your installation.

Do not overwrite existing SQLite databases with another person's files. Removing the databases loses queue and provenance history and can make later tag-removal behaviour less predictable.

## Rollback

Stop Stash, restore the backed-up directory and any preserved databases, then restart Stash and reload plugins. Review any metadata updates already applied before rolling back; restoring plugin files alone does not undo changes to your library.
