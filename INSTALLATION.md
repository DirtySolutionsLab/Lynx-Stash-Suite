# Installation and upgrades

Install only the Lynx components you want. This repository is a collection of separate themes, plugins and companion scrapers, not one all-in-one Stash plugin.

[Suite overview](README.md) · [Credits and licenses](CREDITS.md)

## 1. Choose a component

Open [Releases](https://github.com/DirtySolutionsLab/Lynx-Stash-Suite/releases) and choose the release for the component you want. Download its attached component ZIP. GitHub's automatic Source code archives contain the repository snapshot, not necessarily an installation-ready component.

Some releases are public previews. Read the release notes and component-specific instructions before installing.

## 2. Back up first

Back up Stash's configuration and database. For upgrades, also back up the existing component folder, including any runtime databases and locally edited configuration. Store backups outside Stash's plugins directory.

Test bulk changes on a small selection. Back up media before operations that rename, move or replace files.

## 3. Put the files in the right place

The repository uses these categories:

| Repository path | Installation destination |
| --- | --- |
| `themes/LynxTheme/` | `<stash-config>/plugins/LynxTheme/` |
| `plugins/<component>/` | `<stash-config>/plugins/<component>/` |
| `scrapers/LynxXLGirls/` | `<stash-config>/scrapers/LynxXLGirls/` |
| `scrapers/LynxMatureNL/` | `<stash-config>/scrapers/LynxMatureNL/` |
| `docs/` | Documentation only; do not install as a plugin. |

Replace `<stash-config>` with your actual Stash configuration directory. Container installations must use paths visible to Stash inside the container.

Copy the complete component folder, not the repository's outer `themes` or `plugins` wrapper. The component's YAML manifest must sit directly inside its installed folder, not inside another nested copy.

**Themes still install as Stash plugins.** The repository's `themes` category is only for organizing source files.

Keep internal manifest filenames unchanged. For example, Lynx Default Tabs retains `edit-unorganized.yml`; Lynx Missing Performer Images retains `missing_performer_images.yml`.

## 4. Install requirements

| Component | Runtime requirements |
| --- | --- |
| Lynx Theme | Stash frontend plugin support and a modern browser. |
| Lynx Scene Card | Stash frontend plugin support; no Python required. |
| Lynx Tools | Stash frontend plugin support; no Python required for its modules. Some external actions need separately configured Stash-box sources. |
| Lynx Performer Suite | Python 3; standard-library backend and write access for runtime SQLite databases. |
| Lynx Renamer | Python 3.9 or later and `requests`; see its requirements file and optional dependencies. |
| Lynx Scraping Suite | Python 3.9 or later; install both the plugin and companion scrapers. The included Python modules use the standard library. |
| Lynx Missing Performer Images | Python 3.9 or later; standard-library backend. Separately installed scrapers may need additional dependencies. |
| Lynx Default Tabs | Stash frontend plugin support; no Python required. |

Python must be available to the process running Stash, not just to an unrelated terminal or Python environment. Follow the component guide if you need to configure an interpreter path.

For Docker, dependencies must be available inside the Stash runtime environment. Installing them only on the host does not install them in a container.

## 5. Enable and test

1. Reload plugins under **Settings → Plugins**.
2. Enable the installed component and only the modules you want.
3. Refresh the browser. Use a hard refresh if old scripts or styles remain cached.
4. Follow the component's first-use instructions.
5. Preview a small selection before applying metadata changes or enabling automation.

Lynx Theme is optional for the functional plugins. Disable competing full-page themes before testing Lynx Theme. Disable other scene-card replacements before enabling Lynx Scene Card. Avoid duplicate context-menu and rename-on-update plugins.

For Scraping Suite, also reload scrapers in Stash as needed. Enabling the suite does not install missing scraper definitions.

## Component guides

- [Lynx Theme](themes/LynxTheme/INSTALLATION.md)
- [Lynx Performer Suite](plugins/LynxPerformerSuite/INSTALLATION.md)
- [Lynx Scene Card](plugins/LynxSceneCard/INSTALLATION.md)
- [Lynx Tools](plugins/LynxTools/INSTALLATION.md)
- [Lynx Scraping Suite](plugins/LynxScrapingSuite/INSTALLATION.md)
- [Lynx Renamer](plugins/LynxRenamer/INSTALLATION.md)
- [Lynx Missing Performer Images](plugins/LynxMissingPerformerImages/INSTALLATION.md)
- [Lynx Default Tabs](plugins/LynxDefaultTabs/INSTALLATION.md)

## Upgrading safely

Read the specific upgrade guide before replacing files. Keep only one active copy of each component manifest. Backups left inside the plugins directory may load as duplicate plugins.

**Performer Suite:** stop Stash and back up the entire existing suite folder. Replace code while preserving its runtime `*.sqlite3` databases and Stash settings. Those databases record queue and provenance information used to reconcile inherited tags and performer associations. Do not replace them with another person's databases.

**Renamer:** preserve any locally maintained `config.py` as instructed by its guide. Check saved automation and dry-run settings; safe defaults for new users do not override existing settings. Live operations rename or move media and update Stash's database directly.

**Supporting Images and Cropper:** some image choices and display crops are browser-local. Preserve browser data if those choices matter to you.

## Rollback

Stop active jobs and follow the component's rollback guide. Restore the backed-up code, configuration and runtime data as appropriate, then reload plugins and refresh the browser.

Restoring plugin files alone does not undo metadata edits, replaced portraits, renamed files or moved media. Use your database/media backups and operation logs where needed.

## Troubleshooting

- **Plugin missing:** check the folder nesting, manifest filename and Stash logs.
- **No visible change:** enable the desired module, refresh the browser and check for competing plugins.
- **Python error:** check the exact interpreter used by Stash and install dependencies into that interpreter.
- **Unexpected duplicate actions:** remove duplicate installations or old standalone modules after consulting the upgrade guide.
- **Scraper unavailable:** check that the companion scraper definitions are installed and that their dependencies and source website are accessible.

For help, [open an issue](https://github.com/DirtySolutionsLab/Lynx-Stash-Suite/issues) with component/Stash versions, reproduction steps and relevant errors. Remove private paths, credentials and identifying data before sharing logs.
