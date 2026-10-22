# Filename and destination rules

## A simple filename

`{$date - }$title`

For a scene titled "Example Scene" dated 2026-10-22, this produces `2026-10-22 - Example Scene` plus the original file extension. Without a date, it produces `Example Scene`.

Curly braces make a group optional. Do not add a file extension to the pattern. With **Require fields** enabled, a missing field outside an optional group causes the operation to be skipped.

Use the insert-field buttons to add supported fields such as `$title`, `$date`, `$performer`, `$studio` and `$height`. See the bundled `LynxRenamer_config.py` for the complete legacy configuration reference.

## Rule priority

Filename: **tag → studio → default**.

Destination: **unorganized override → tag → studio → current path → default → current folder**.

Tag and studio names are case-sensitive. Current-path rules match contained text. Rule order matters when more than one entry matches; use the priority controls and preview the scene.

Disabling the default destination does not disable conditional move rules. **Keep current folders — clear move rules** clears the move destinations in the draft. Save to apply.

## Exclusions

Exclusions can use exact or regular-expression matching. Exact matching compares the complete value, ignoring case. For a path, an exact rule therefore needs the complete file path; use a suitable regular expression to exclude an entire directory.

## Where settings are stored

The guided panel stores settings in Stash. An optional local `config.py` provides fallback values; otherwise the bundled `LynxRenamer_config.py` is used.

The preview uses the unsaved draft. Saving changes the stored rules. **Discard unsaved changes** returns to the last loaded or saved settings.
