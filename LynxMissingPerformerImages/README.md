# Lynx Missing Performer Images

A Lynx-maintained version of the supplied **Missing Performer Images** installation, developed further with AI assistance.

**Version 1.2.1 — release-review draft**

**Provenance status:** the supplied files do not identify a separate original author, repository or license. The maintainer is unsure whether the baseline was created with AI assistance or adapted from an existing plugin. This review draft does not invent an upstream author or license. See [CREDITS.md](CREDITS.md).

## What it does

Review performers without a profile image, choose a portrait from your library or another supported source, and approve it before saving.

- Find candidates among linked images and linked galleries.
- Choose an alternative library image.
- Search installed Stash performer scrapers by name or supported profile URL.
- Preview a direct image URL or upload a local JPEG, PNG, GIF or WebP.
- Review and save individual portraits or explicitly selected cards.
- Preserve performers that already have a portrait.

Only the profile image is imported. Names, tags, URLs and other performer metadata are not imported by the review workflow.

The Google Images button opens a separate browser tab. This release does not embed Google results and does not require a Google API key.

## Review workflow

1. Open **Review performer images** from the navigation portrait icon, or visit `/plugins/missing-performer-images`.
2. Click **Load performers**.
3. Inspect the suggested library image or click **Choose image**.
4. Use **Find online / upload** if you need another source.
5. Click **Use this image** to select a candidate on the card.
6. Click **Approve & save**, or explicitly select reviewed cards and use **Save selected**.

Selecting a candidate does not save it. Saving changes the performer's profile image in Stash.

## Library tasks are separate

**Preview Missing Performer Images** logs a ranked library candidate for each performer missing a portrait.

**Assign Missing Performer Images** assigns ranked library images across the library. It does not use the candidates or checkboxes selected in the review page. Run the preview first.

These tasks do not search online, and neither task is limited by the filters currently open in Stash.

## Requirements

Python 3.9 or later and Stash frontend plugin support. The Python code uses only the standard library. Online scraper search depends on the performer scrapers you have installed, including their own dependencies and source access.

See [INSTALLATION.md](INSTALLATION.md) for installation, updates and troubleshooting.

## Preview status

Offline regression tests cover ranking, pagination, review selections, image-only saves, stale data and download checks. A fresh installation and live scraping/image assignment have not been verified for this review.
