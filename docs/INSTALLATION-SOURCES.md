# Stash installation sources

The repository includes an automated builder for separate Stash plugin/theme and scraper sources. Publishing requires the repository owner to enable GitHub Pages and successfully run the workflow.

**Prepared does not mean published.** Do not announce the addresses as working until the checks below pass.

## One-time owner setup

1. Commit and push the new scripts, workflow and documentation to `main`.
2. In the GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the Source.
4. Open **Actions → Publish Lynx Stash sources**.
5. If the first automatic run failed because Pages was not enabled, use **Re-run all jobs**. Alternatively, choose **Run workflow**, select `main` and confirm.
6. Wait for both **build** and **deploy** to succeed.
7. Open the published indexes below and check that they return package data, not a GitHub HTML page or 404.
8. Test installation in a separate Stash instance before announcing the source.

The first publication contains eight theme/plugin packages and two companion scraper packages. Screenshot Mode is not in the repository catalog and is not published automatically.

## Add plugins and themes in Stash

Go to **Settings → Plugins → Available Plugins → Add Source**.

| Field | Value |
| --- | --- |
| Name | Lynx Stash Suite |
| Source URL | `https://dirtysolutionslab.github.io/Lynx-Stash-Suite/main/index.yml` |
| Local path | `lynx` |

Install only the desired packages. Enable relevant modules, then refresh the browser. The theme is listed here too because Stash installs themes as UI plugins.

## Add companion scrapers

Go to **Settings → Metadata Providers → Available Scrapers → Add Source** (the exact section placement may vary by Stash version).

| Field | Value |
| --- | --- |
| Name | Lynx Scrapers |
| Source URL | `https://dirtysolutionslab.github.io/Lynx-Stash-Suite/main/scrapers/index.yml` |
| Local path | `lynx` |

Install Lynx XL Girls and/or Lynx Mature.nl as needed. The plugin source does not install these into the scraper directory automatically. Reload scrapers if required.

Python and Python dependencies still need to be installed in the environment running Stash. For example, Renamer requires `requests`. No automatic pip installation is performed by the package builder.

## Existing manual installations

Test on a separate instance first. Do not install a second copy alongside a manually installed plugin with the same internal ID.

For migration, stop Stash, back up its configuration/database and the full old component folder outside the plugins directory. Move the old active copy out before loading the source-managed copy.

Default managed destinations with local path `lynx` are:

- Theme: `<stash-config>/plugins/lynx/LynxTheme/`
- Performer Suite: `<stash-config>/plugins/lynx/LynxPerformerSuite/`
- Default Tabs: `<stash-config>/plugins/lynx/edit-unorganized/`
- Missing Performer Images: `<stash-config>/plugins/lynx/missing_performer_images/`
- XL Girls scraper: `<stash-config>/scrapers/lynx/LynxXLGirls-scraper/`

The folder uses the package/manifest ID, which may differ from the display name.

**Performer Suite migration requires transferring its runtime SQLite databases to the matching relative paths in the new suite folder before enabling automatic work.** Stop Stash while moving databases and retain a backup. Settings remain associated with the same internal plugin IDs; this is not an automatic migration of runtime files.

Preserve a local Renamer `config.py` if you still rely on its fallback values.

## Updates and data

Stash's checked package-manager implementation removes the files listed in the old installation manifest before extracting an update. Runtime files not shipped in the package are not in that list. This builder excludes SQLite databases, journals, locks, logs, `config.py`, environment files and generated archives.

This is not a guarantee for every Stash version or a replacement for backups. Validate update behavior on your Stash version. Do not uninstall a source or discard its folder as a migration shortcut.

Manual edits to packaged code files can be overwritten by source updates. Preserve customizations separately.

## Publishing later changes

The workflow rebuilds after pushes to `main` affecting `themes/`, `plugins/`, `scrapers/`, `scripts/` or the workflow. It does not wait for a GitHub release. Only catalog-listed components are published.

This is a **preview channel**: do not push experimental plugin changes to `main` unless you intend to offer them through the source. Use another branch for unfinished work. Pull requests run tests/builds but do not deploy.

Package versions include the manifest version plus a short content hash for identification. Stash's checked implementation offers updates based on a newer package date, not the hash alone. Dates come from the latest commit affecting the component or publication tooling. Still bump normal component versions for meaningful changes. Changing publication tooling can make all packages eligible for an update.

ZIP filenames are content-addressed and SHA-256 values are included in both indexes. ZIPs have their manifest at the archive root; these source-install packages intentionally differ from manual-release ZIPs with a top-level component folder.

## Add another component

1. Add its complete folder under `plugins/`, `themes/` or `scrapers/`.
2. Include its license and root manifest.
3. Add one entry to `scripts/package-catalog.json`.
4. For plugins, the version comes from the manifest. For scrapers without a version field, set it in the catalog.
5. Test and commit. No recursive auto-discovery publishes experimental folders.

Do not add cross-source `requires` dependencies. Plugin and scraper sources are independent; install companion scrapers separately.

## Local build (optional)

From the repository root:

```powershell
python -m pip install -r scripts/requirements-build.txt
python -B -m unittest discover -s scripts -p "test_*.py" -v
python -B scripts/build_packages.py
python -B scripts/verify_http.py
```

Output is `_site/` and is ignored by Git. Do not commit generated ZIPs or indexes. GitHub Actions builds and publishes its own output. Build requirements do not change plugin runtime requirements.

Without Git history the local build uses a 1970 date fallback; do not publish that local output. CI fetches full history and requires real dates. It uses the latest commit affecting the component or publication tooling. ZIP checksums and content versions do not depend on these dates.

## Troubleshooting

- **404:** enable Pages with GitHub Actions; check the deploy job and the exact URL/capitalization.
- **Workflow missing:** ensure `.github/workflows/publish-stash-sources.yml` was pushed, not just saved locally.
- **Build failure:** open the failing step. Missing files/licenses, unsafe paths and duplicate IDs stop publication.
- **No package listed:** check the source type and whether the package is already installed.
- **Duplicate plugin error:** remove the extra active copy after backing up and handling runtime data.
- **Update not appearing:** confirm the workflow completed, then refresh the source in Stash.

## Reference and validation scope

- [Official Stash plugin source format](https://docs.stashapp.cc/in-app-manual/plugins/)
- [Official Stash scraper source format](https://docs.stashapp.cc/in-app-manual/scraping/)
- [Official source-index template](https://github.com/stashapp/plugins-repo-template)
- [Checked Stash package installation implementation](https://github.com/stashapp/stash/blob/develop/pkg/pkg/manager.go)

Build scripts are newly written for this repository; no upstream shell builder is bundled. The build tooling's MIT license is in `scripts/BUILD-LICENSE.txt`. Component licenses and notices are retained in each package.

Local tests and archive validation do not prove GitHub deployment or live Stash installation. Those remain owner acceptance steps until actually completed.

See [SOURCE-VALIDATION.md](SOURCE-VALIDATION.md) for the local checks and remaining acceptance steps.
