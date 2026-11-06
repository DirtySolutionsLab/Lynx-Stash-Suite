## Lynx Theme v0.2.13 — Plugin Order & Scene Card Details

Restores the enabled-first plugin list in **Settings → Plugins**. Enabled plugins appear first, followed by disabled plugins, with alphabetical ordering within each group.

The sorting fix restores the list layout used by the existing sorter. It does not enable or disable plugins or move React-managed elements.

Under **Settings → Interface → Lynx → Scene card elements**, the new **Details** toggle lets you show or hide scene descriptions. It is off by default and works with both native cards and LynxSceneCard. The description sits between the title and performers. Long text starts as a two-line preview; **Show more / Show less** expands or collapses that card only, preserving line breaks. Scenes without a description do not gain placeholder text; scene detail pages are unaffected.

### Update

Use the Lynx plugin source once the new build is published, or update the existing theme with the release ZIP. Keep only one active theme copy. Reload plugins if needed and hard-refresh the browser.

### Preview status

Checked with simulated plugin-list and scene-card tests and package validation. Live visual verification in Stash is still pending. Based in part on Refract by ordureconnoisseur; existing licenses and attribution are unchanged.
