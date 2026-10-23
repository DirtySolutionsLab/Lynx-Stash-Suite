# Installation source validation

Prepared locally on 2026-10-23.

## Passed locally

- 12 builder regression tests, including an invocation with the GitHub Actions environment flag enabled.
- Workflow YAML parsing, trigger checks and Python syntax checks.
- Eight theme/plugin packages and two scraper packages built from the repository catalog.
- Root manifests, declared frontend assets, bundled LICENSE files and ZIP integrity checked.
- SHA-256 values checked against generated archives.
- Both index URLs and all ten relative ZIP URLs served and downloaded over a temporary loopback HTTP server; downloaded checksums matched.
- Local links in the updated root documentation and source setup guide checked.
- Generated output is excluded from Git; runtime databases, journals, locks, logs and selected private configuration files are excluded from packages.

These exclusion rules are not a general secret scanner. Review source content before publishing.

## Not yet verified

- GitHub Actions execution on the remote repository.
- GitHub Pages publication and public URL availability.
- Installation through a real Stash package-source UI.
- Live upgrades, runtime database preservation and manual-to-managed migration on the user's installed Stash version.
- Functional acceptance of all installed plugins or live website scraping.

## Owner acceptance

1. Commit/push and enable Pages with GitHub Actions.
2. Wait for build/deploy success and open both public indexes.
3. Add the plugin source in a separate Stash instance and install Lynx Theme.
4. Verify one loaded manifest, local assets, settings and page navigation.
5. Add the scraper source and install one scraper; verify it is listed under Metadata Providers.
6. Test remaining components individually, including Python requirements.
7. Before relying on managed updates for Performer Suite, test an update with a backed-up runtime database and confirm its contents remain intact.

See [the setup guide](INSTALLATION-SOURCES.md). The current publication workflow offers catalog-listed main-branch builds as a preview channel; GitHub releases remain a separate manual distribution.
