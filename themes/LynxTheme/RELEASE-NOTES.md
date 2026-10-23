## Lynx Theme v0.2.12 — Public Preview

The simplified transparent Lynx logo now appears automatically in the navbar home button. No Custom logo URL is needed for the bundled identity.

### What changed

- Use the bundled logo when Custom logo is empty instead of showing an empty orb.
- Include the simplified transparent navbar image for better small-size readability.
- Correct custom-logo rendering so a user-supplied image URL takes precedence over the bundled asset.
- Preserve custom image colors and transparency.
- Update the English setting description; existing settings and storage keys are retained.

To use the new default after updating, clear Custom logo under Settings → Interface → Lynx. Existing non-empty custom URLs are deliberately preserved.

### Installation and updates

Update through the Lynx plugin source after its publication workflow succeeds, or copy the complete LynxTheme folder from the manual ZIP into Stash's plugins directory. Keep only one active copy. Reload plugins and hard-refresh the browser.

### Validation

JavaScript syntax, manifest assets and mocked logo-selection tests checked, including default/custom/clear transitions, data URLs, repeated calls and anchor/button navigation variants. Fresh-install and live visual acceptance remain pending.

### Credits and licenses

Based in part on Refract by ordureconnoisseur. Theme code remains AGPL-3.0. Albert Sans retains the SIL Open Font License 1.1. See CREDITS.md and the bundled license notices.
