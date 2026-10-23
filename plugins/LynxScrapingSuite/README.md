# Lynx Scraping Suite

> [!WARNING]
> **Pre-release software — use at your own risk.** This component is experimental and provided **AS IS**, without warranties or guarantees. It may cause errors, compatibility problems or unintended changes to your Stash installation or data. Back up your configuration, database and any affected files, and test in a separate Stash instance before enabling automatic or bulk operations. To the extent permitted by applicable law and the component's license, the maintainer accepts no liability for loss or damage arising from its use.

Search public performer profiles from **XL Girls** and **Mature.nl**, compare source data with your Stash metadata, and import the fields you choose.

**Version 1.0.0-rc.4 — public preview**

## Included sources

| Source | Supported information |
| --- | --- |
| XL Girls | Name, hair and eye color, ethnicity, height, weight, measurements, birthdate when provided, Body Type, Bra Size and profile image. |
| Mature.nl | Name, country, biography, ethnicity, Body Type, Breast Size, source categories as tags and profile image when provided. |

Only information actually present on a readable public profile is offered. Site changes or access checks may prevent a request.

The suite adds source buttons and selected-performer batch review to Stash's Performer Tagger. Search and preview do not update performer metadata. Review the comparison and explicitly import chosen fields.

XL Girls height and weight are converted to centimetres and kilograms. Measurements keep the source notation, including cup letters. Native Stash fields are used where supported; Body Type, Breast Size and Bra Size use named custom fields. Use matching field names in Lynx Performer Suite if you also use attribute tagging.

## Two installation parts

The release contains:

- `LynxScrapingSuite/` — the plugin for Tagger buttons, batch review and optional XL Girls Bra Size completion.
- `scrapers/LynxXLGirls/` and `scrapers/LynxMatureNL/` — companion native Stash scrapers for name/URL scraping.

See [INSTALLATION.md](INSTALLATION.md) for where to put each folder. Python 3.9 or later is required; these modules use the Python standard library and need no pip packages.

## First use

Enable the source modules you want under **Settings → Plugins**, then refresh the page. Open Performers in Tagger view, use a source button to search or paste a profile URL, and preview before importing.

Batch processing uses the performers selected with that source's controls on the current page, up to 100 per batch. Saved source URLs are preferred; a name lookup needs a unique exact match. Ambiguous results are skipped for manual review.

Automatic Bra Size completion is optional and requires its own switch. It uses one saved XL Girls profile and preserves an existing value unless replacement is enabled. Mature.nl has no automatic update hook.

## Settings

Settings are grouped by source, with mapping editors collapsed. Source switches only control this suite's plugin modules; native scraper definitions are installed separately.

Mature.nl mappings use `source=value;source=value`. For example:

```text
Normal weight=Average;Slim=Slim
```

Age ranges, height categories and body modifications become tags. The source's Skincolor label is mapped to the ethnicity value under the existing importer rules. These imported labels describe the source metadata and can be reviewed before saving.

## Preview status

This public package is checked with syntax, source-routing, mocked import and UI tests. A clean installation and live scraping have not been verified during this release review.

## License

Lynx code is distributed under GPL-3.0; see [LICENSE](LICENSE) and [CREDITS.md](CREDITS.md). This project is independent of Stash and the source websites. Website content is not included in this package.
