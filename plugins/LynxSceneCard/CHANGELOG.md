# Changelog

## 0.1.9 — 2026-10-22 — Public preview

- Add English public installation, settings and release documentation.
- Translate the remaining Swedish CSS comments without changing their declarations.
- Include the upstream GPL-3.0 license and the Poppins SIL Open Font License.
- Remove the unused Custom Studio Overlay setting.
- Scope progress and scrubber styles to scene cards.
- Guard against repeated script evaluation and report missing frontend API dependencies.
- Keep the plugin ID, active settings keys, request cache and card markup.

## 0.1.8 - 2026-10-16

- Deduplicate identical configuration requests across cards, including simultaneous in-flight requests.
- Reuse successful GraphQL results for 30 seconds; bound the cache to 64 entries and back off failed requests for 3 seconds.
- Apply shared dynamic CSS only when its contents change, not once per card mount.
- Mount performer/tag overlay contents only while the popup is open.
- Attach outside-click listeners only to open popups.
- Preserve hover timers across renders and clear them on unmount.
- Query two related tag scenes and at most three performer scenes (to allow exclusion of the current scene), rather than fetching entire scene collections.
- Throttle overflow-popup repositioning to one animation frame and cancel pending frames on close.
- Remove verbose related-scene logging; fix a legacy preview variable and handle rejected video play promises.
- Keep CSS, plugin ID and settings keys unchanged. Related performer scenes are now a title-sorted bounded sample.


## 0.1.5 - 2026-08-03

- Removed the search label and input from overflow performer/tag popovers.
- Removed the associated search state, filtering and obsolete CSS.
- Overflow popovers now show their remaining items immediately.

## 0.1.4 - 2026-08-03

- Restored the original rectangular performer portrait with lightly rounded corners.
- Kept the performer name and simplified popup from 0.1.3.

## 0.1.3 - 2026-08-03

- Removed Related Scenes completely from performer hover popovers.
- Removed Bootstrap popover arrows, including the small white corner marker.
- Performer popovers now contain only the portrait and performer name.

## 0.1.2 - 2026-08-03

- Added the performer name below the portrait in scene-card hover popovers.
- Made performer portraits fully rounded while preserving their existing dimensions.
- Added matching responsive name and profile sizing for mobile layouts.

## 0.1.1 - 2026-08-03

- Removed the complete badge row above scene titles.
- Removed badge generation for New, Popular, ratings and resolutions.
- Removed the obsolete Enable Badges setting.

## 0.1.0 - 2026-08-03

- Forked the supplied modified SerechopsSceneCard 1.6 as LynxSceneCard.
- Changed the Stash plugin/configuration ID to `LynxSceneCard`.
- Renamed JavaScript, CSS and manifest files consistently.
- Corrected bundled font asset URLs and declared all four included Poppins weights.
- Connected the card accent to LynxTheme's `--accent` variable with a standalone fallback.
- Removed a stale source-map reference.
- Added installation, compatibility and upstream-attribution documentation.
