# Changelog

## 0.2.13 — 2026-11-06 — Public preview

- Restore enabled-first ordering under Settings → Plugins by reinstating the list's flex layout. Plugins remain alphabetical within each group.
- Scope the fix to lists marked by the existing theme sorter. No plugin settings or activation states are changed.
- Add a Details toggle under Scene card elements. Descriptions stay hidden by default and can be shown on native and LynxSceneCard cards without changing scene detail pages.
- Place descriptions between the title and performer row. Show long descriptions as a two-line preview with per-card Show more / Show less controls and preserve line breaks when expanded.

## 0.2.12 — 2026-10-23 — Public preview

- Show the bundled Lynx logo when Custom logo is empty, rather than an empty orb.
- Include the simplified transparent navbar logo for small-size readability.
- Respect custom image URLs instead of overriding them with a hardcoded CSS image.
- Preserve custom image colors and transparency; retain the existing storage key.
- Clarify the English Custom logo setting description.

Syntax, packaged assets and mocked logo-selection tests checked. Live Stash visual acceptance remains pending.

## 0.2.11 — 2026-10-22 — Public preview

- Translate the remaining Swedish source comments into English.
- Place the README, installation guide and credits inside the installable theme folder.
- Keep the reviewed 0.2.10 appearance and behavior.
- Include the existing Refract attribution, AGPL license and Albert Sans font license.

JavaScript/CSS runtime content is compared with 0.2.10 after removing comments. This packaging update makes no functional styling changes. Fresh-install testing remains pending.
