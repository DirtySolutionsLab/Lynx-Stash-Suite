# Installation

## Requirements

- Stash with plugin support and access to its media and SQLite database.
- Python 3.9 or later, with the `requests` package installed in that interpreter.
- A modern browser for the guided settings panel.

The inherited engine supports database layouts from Stash's file refactor, but this preview does not claim compatibility with every Stash version. Test a single scene first.

## Install

1. Extract the release ZIP and copy the `LynxRenamer` folder into your Stash plugins directory. Keep `LynxRenamer.yml` directly inside that folder.
2. Open a terminal in that folder and install the dependency:

   ```powershell
   python -m pip install -r requirements.txt
   ```

3. The manifest uses `python`. If Stash cannot find it, edit the first entry under `exec` in `LynxRenamer.yml` to your Python executable's full path, or `python3` on systems where that is the command. Install dependencies with that same interpreter.
4. Reload plugins under **Settings → Plugins**. Enable Lynx Renamer if necessary.
5. Refresh your browser, then open the Lynx Renamer settings panel under **Settings → Plugins**.
6. Preview one scene before saving rules or enabling automation.

For Docker, install Python and dependencies inside the environment running Stash. Destination paths must be paths visible inside that environment.

No other Lynx plugin is required. No files need to be copied into Stash's custom JavaScript or CSS fields.

## Upgrade

Back up the current plugin folder, Stash configuration and database. Keep the backup outside the plugins directory to avoid duplicate loading. Replace the old plugin with this folder, keeping only one `LynxRenamer.yml` installed.

Settings saved through the Lynx panel remain in Stash under the same plugin ID and `configJson` key. If you previously edited `config.py` manually, retain your own copy in the new folder: it supplies fallback values for settings not saved in Stash. This public release does not include a personal `config.py`.

Existing saved settings can have automation on and dry-run off. The safe defaults apply to new configurations; check your status before updating scenes.

Do not run another rename-on-update plugin against the same scenes at the same time.

## Optional dependencies

`psutil` enables checks for processes holding files open. `Unidecode` enables transliteration when the ASCII option is enabled. Install only if you use those features:

```powershell
python -m pip install psutil Unidecode
```

Process termination is disabled by default. It can terminate applications that are using a media file, including Stash.

## Roll back

Stop active rename tasks, restore your backed-up plugin folder, reload plugins and refresh the browser. Restoring plugin code does not reverse settings changes or file moves. Use your backups and rename logs as appropriate.
