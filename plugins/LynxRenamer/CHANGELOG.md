# Changelog

## 1.1.1 — Public preview

- Replace installation-specific paths and rules with portable defaults.
- Start new configurations with automation disabled, dry-run enabled and no move destinations.
- Align browser and Python default values.
- Load the Renamer interface directly, without registering the older shared suite runtime or shared settings patch.
- Queue the library dry-run directly through Stash.
- Stop processing if saved JSON configuration is invalid, instead of falling back to unrelated rules.
- Preserve optional local configuration overrides; a broken local configuration no longer silently falls back to bundled values.
- Add English public installation, rules, credits and release documentation.
- Exclude personal configuration, Python caches and runtime data from the public package.

### Validation

JavaScript/Python syntax, manifest assets, default consistency and mocked settings/preview/dry-run behavior are checked for this package. These checks do not replace a clean installation test or live file-operation testing in Stash.

## 1.1.0 — Guided settings

- Filename presets, field insertion and destination builder.
- Read-only single-scene preview using the draft configuration.
- Conditional rules, exclusions and status information.
- Dry-run protection independent of a configured log file.
