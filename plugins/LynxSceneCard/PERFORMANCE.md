# Performance and validation

## Runtime behavior

The performance work introduced in 0.1.8 is retained:

- Identical in-flight GraphQL requests share a promise.
- Successful results are cached for 30 seconds, with a maximum of 64 entries.
- Failed requests back off for 3 seconds.
- Shared overlay CSS is written only when its contents change.
- Popup contents are mounted only while open.
- Outside-click listeners are attached only for open popups.
- Hover timers are retained across renders and cleared on unmount.
- Related tag-scene queries fetch at most two scenes; performer queries are bounded to three.
- Overflow positioning is limited to one animation frame per update.

Refresh after changing settings so all mounted cards use the same values.

## Release checks

The public package is checked for JavaScript syntax, manifest and font assets, English text, settings references and ZIP contents. Isolated component tests cover request deduplication, shared style writes, closed-popup listeners, lazy overlays and timer cleanup.

These are mocked operation counts and package checks, not real browser loading times. They do not establish a percentage speed improvement.

A fresh installation, visual/navigation check and end-to-end page-load measurement remain necessary in Stash. Other plugins, thumbnail decoding and the main Stash query may also affect page speed.
