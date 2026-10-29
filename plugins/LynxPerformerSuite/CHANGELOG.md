# Changelog

## 1.1.3 — scoped performer transfers

- Add independent Gallery → Images and Images → Gallery performer directions. The reverse direction defaults to OFF; gallery studio inheritance has a separate switch.
- Archive pre-upgrade performer backlog once, inside the existing runtime database, without modifying library metadata or provenance.
- Keep manual selected-gallery work isolated from unrelated waiting work; use bounded queue snapshots and preserve failed performer events.
- Filter unrelated hooks, disabled automation and own performer writes before launching child engines. Preserve tag follow-up for performer assignments.
- Mark tag-transfer mutations and skip their own follow-up hooks, including removals. Bound tag worker passes.
- Add an English setup guide, visible route status and one-click downward performer setup. Explicitly label tag-copying routes.
- Add offline transfer regression tests. Live installation, real hook payloads and visual acceptance are not verified by these tests.

## 1.1.2 — public review candidate

- Removed local settings backups, SQLite databases, lock files, Python caches and development-only build files from the distributable.
- Replaced a machine-specific Python executable path with `python`; installation instructions explain how to override it.
- Embedded the 25 bundled attribute starter-rule groups in the browser settings client so new installs show the same defaults as the backend.
- Updated the starter hair rule so Red and Redhead both map to Red Hair.
- Removed a stale reference to a missing CSS file and refreshed module cache keys.
- Added English installation, upgrade, safety and attribution documentation.

This candidate passed static validation but has not been accepted in a fresh Stash installation.

## 1.1.1 — installed source version

- Performer Matcher and other post-1.1.0 changes were present in the inspected installed source. The old folder name and README still said 1.1.0; the manifest identified this source as 1.1.1.
