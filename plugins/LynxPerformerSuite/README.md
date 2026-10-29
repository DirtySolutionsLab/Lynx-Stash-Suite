# Lynx Performer Suite

> [!WARNING]
> **Pre-release software — use at your own risk.** This component is experimental and provided **AS IS**, without warranties or guarantees. It may cause errors, compatibility problems or unintended changes to your Stash installation or data. Back up your configuration, database and any affected files, and test in a separate Stash instance before enabling automatic or bulk operations. To the extent permitted by applicable law and the component's license, the maintainer accepts no liability for loss or damage arising from its use.

A Stash plugin for reviewing performer metadata, maintaining attribute tags, transferring tags and performer associations, matching performers to images or galleries, and displaying supporting images on performer pages.

This plugin works independently of Lynx Theme. Each feature has its own enable switch in **Settings → Plugins → Lynx Performer Suite**.

## Features

- **Performer Attributes:** editable starter rules for country, ethnicity, hair and eye colour, body type, breast type and size, tattoos, piercings, age and measurement-based estimates. Preview changes before applying them.
- **Tag Transfer:** explicit routes between performers, scenes, images and galleries, with allow/exclusion rules and optional removal of previously inherited tags.
- **Performer Links:** copy people from a gallery to its own images, with a separate optional reverse direction. This does not copy tag labels. Studio inheritance has its own switch.
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

## Copying people versus copying tags (1.1.3)

Use the **What do you want to copy?** panel at the top of the settings:

| Goal | Setting |
| --- | --- |
| Assign gallery performers to its images | Performer Links: Gallery to its images + automatic performer copying |
| Assign image performers to their galleries | Performer Links: Images to their galleries (optional, OFF by default) |
| Copy labels such as hair color or nationality | Tag Transfer: automatic tag copying + your chosen tag routes |
| Copy a gallery's studio to its images | Performer Links: separate studio inheritance switch |

The **Set performer copying: Gallery → Images** button enables only the performer module, its automation and the downward performer route, and disables the reverse performer route. It does not change tag copying or studio inheritance. Use **Turn off automatic tag copying** separately if you only want people copied automatically. No setup button starts a library task.

Automatic performer copying handles changed galleries/images and their linked items, never an unfiltered library scan. Large galleries still require reading their own images. Own performer writes skip the performer engine, but retain tag follow-up when tag copying is enabled. Own tag-transfer writes do not start another tag-transfer pass. Stash may still show hook jobs; these cannot all be prevented by the plugin.

Manual performer preview/apply requires 1–100 gallery IDs and does not drain unrelated pending work. The queue worker processes at most 100 pending items from a fixed snapshot per job; newer edits remain queued for a later coalesced job. Failed performer work is retained. Manual **Tag Transfer — Transfer library tags** remains an explicitly library-wide operation.

### Legacy queue migration

On first use of the new performer engine, old waiting work is moved into `archived_pending` inside the existing `performer-bridge.sqlite3`. It is not automatically replayed. Existing performer/studio provenance and all library associations remain unchanged. New waiting work is not archived on later runs. Back up the entire installed folder with Stash stopped before upgrading. This migration does not undo already-applied library changes.

## Runtime data

The plugin creates local SQLite files for queues and provenance at runtime. They are **not included** in this public package. Plugin settings remain in Stash's configuration. Crop and image-choice state for Supporting Images may also be held by the browser; back up your browser data if those choices matter to you.

Older internal plugin names and task aliases remain in code for settings compatibility. Visible settings and instructions are in English. Input aliases for non-English country names are deliberately retained so existing metadata can still be matched.

See [RULE-FORMATS.md](RULE-FORMATS.md) for editable-rule syntax and [CREDITS.md](CREDITS.md) for upstream attribution. This community plugin is not affiliated with the Stash project.
