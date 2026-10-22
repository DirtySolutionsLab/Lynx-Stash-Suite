# Lynx Performer Suite

A Stash plugin for reviewing performer metadata, maintaining attribute tags, transferring tags and performer associations, matching performers to images or galleries, and displaying supporting images on performer pages.

This plugin works independently of Lynx Theme. Each feature has its own enable switch in **Settings → Plugins → Lynx Performer Suite**.

## Features

- **Performer Attributes:** editable starter rules for country, ethnicity, hair and eye colour, body type, breast type and size, tattoos, piercings, age and measurement-based estimates. Preview changes before applying them.
- **Tag Transfer:** explicit routes between performers, scenes, images and galleries, with allow/exclusion rules and optional removal of previously inherited tags.
- **Performer Links:** transfer performer associations between galleries and their images.
- **Performer Matcher:** review name suggestions from image and gallery filenames or folders, match existing performers, or explicitly create new performers.
- **Supporting Images:** configure tagged or manually selected Face, Breasts, Dressed, Ass, Body Type and Eyes image slots.

The rules in this release are starting points, not objective descriptions of people. Inference based on measurements is optional and should be reviewed before use.

## Install or upgrade

Read [INSTALLATION.md](INSTALLATION.md) before installing. The Python backend requires a `python` command available to the Stash process. The runtime uses Python's standard library; the optional development scripts are not part of this plugin package.

Copy this `LynxPerformerSuite` folder into Stash's plugins directory. Keep only one `LynxPerformerSuite.yml` active. Reload plugins, enable the desired modules, and refresh the browser.

For an existing installation, **do not delete the existing plugin directory or its SQLite databases before reading the upgrade steps**. Those databases record tag and performer-link provenance used for safe reconciliation.

## First use

1. Open the suite's settings and enable only the modules you want. Refresh the browser after changing a module switch.
2. Review the bundled starter rules; saved custom values take precedence.
3. Start with a small preview. No metadata is saved by a preview task.
4. Apply changes only after reviewing proposed additions and removals.
5. Enable automatic processing later if you want new metadata changes to be queued automatically.

Some settings can remove old Lynx-managed tags. The broader legacy/manual reconciliation option may affect manually assigned mapped tags, so leave it off unless you intend to use it.

## Data and compatibility

The plugin creates local SQLite files for queues and provenance at runtime. They are **not included** in this public package. Plugin settings remain in Stash's configuration. Crop and image-choice state for Supporting Images may also be held by the browser; back up your browser data if those choices matter to you.

Older internal plugin names and task aliases remain in code for settings compatibility. Visible settings and instructions are in English. Input aliases for non-English country names are deliberately retained so existing metadata can still be matched.

See [RULE-FORMATS.md](RULE-FORMATS.md) for editable-rule syntax and [CREDITS.md](CREDITS.md) for upstream attribution. This community plugin is not affiliated with the Stash project.
