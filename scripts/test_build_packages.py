"""Offline regression tests; not a substitute for a live Stash install."""
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import build_packages as builder


class BuildTests(unittest.TestCase):
    def setUp(self):
        # Fixtures deliberately have no Git history, including on CI runners.
        self.enterContext(patch.dict(builder.os.environ, {"GITHUB_ACTIONS": "false"}))
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for folder, manifest in (("plugins/Demo", "Demo.yml"), ("scrapers/Source", "Source.yml")):
            target = self.root / folder
            target.mkdir(parents=True)
            (target / manifest).write_text("name: Demo\nversion: 1.0\n", encoding="utf-8")
            (target / "LICENSE").write_text("fixture only", encoding="utf-8")
        self.catalog = {"repository": "https://example.com/repo", "packages": [
            {"kind": "plugin", "directory": "plugins/Demo", "manifest": "Demo.yml"},
            {"kind": "scraper", "directory": "scrapers/Source", "manifest": "Source.yml",
             "version": "2.0"},
        ]}

    def build(self, folder="out"):
        return builder.build(self.root, self.root / folder, self.catalog)

    def test_root_manifest_and_checksum(self):
        indexes = self.build()
        self.assertEqual(len(indexes["plugin"]), 1)
        item = indexes["plugin"][0]
        data = (self.root / "out/main" / item["path"]).read_bytes()
        self.assertEqual(hashlib.sha256(data).hexdigest(), item["sha256"])
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            self.assertEqual(sorted(archive.namelist()), ["Demo.yml", "LICENSE"])
        loaded = builder.load_yaml((self.root / "out/main/index.yml").read_text())
        self.assertEqual(loaded, indexes["plugin"])

    def test_deterministic_build_and_content_version(self):
        first = self.build("a")
        second = self.build("b")
        self.assertEqual(first, second)
        (self.root / "plugins/Demo/new.txt").write_text("change")
        third = self.build("c")
        self.assertNotEqual(first["plugin"][0]["version"], third["plugin"][0]["version"])
        self.assertEqual(first["scraper"], third["scraper"])

    def test_runtime_files_excluded_and_dotignore_retained(self):
        folder = self.root / "plugins/Demo"
        for name in ("history.sqlite3", "history.sqlite3-wal", "jobs.db-shm",
                     ".env", ".env.local", "config.py", "manifest", "old.zip", "a.lock"):
            (folder / name).write_text("private")
        (folder / ".gitignore").write_text("*.sqlite3")
        files = dict(builder.package_files(folder))
        self.assertEqual(set(files), {"Demo.yml", "LICENSE", ".gitignore"})

    def test_unsafe_paths_rejected(self):
        for name in ("../outside", "/absolute", "C:/absolute", "a\\b"):
            with self.assertRaises(ValueError):
                builder.contained(self.root, name)

    def test_duplicate_ids_rejected(self):
        self.catalog["packages"].append(self.catalog["packages"][0])
        with self.assertRaises(ValueError):
            self.build()
        self.assertFalse((self.root / "out").exists())

    def test_missing_ui_asset_rejected(self):
        (self.root / "plugins/Demo/Demo.yml").write_text(
            "name: Demo\nversion: 1\nui:\n  javascript: [absent.js]\n")
        with self.assertRaises(ValueError):
            self.build()

    def test_missing_license_rejected(self):
        (self.root / "plugins/Demo/LICENSE").unlink()
        with self.assertRaises(ValueError):
            self.build()

    def test_tampered_archive_rejected(self):
        indexes = self.build()
        item = indexes["plugin"][0]
        (self.root / "out/main" / item["path"]).write_bytes(b"tampered")
        with self.assertRaises(ValueError):
            builder.verify(self.root / "out")

    def test_source_output_rejected(self):
        with self.assertRaises(ValueError):
            builder.build(self.root, self.root / "plugins/Demo/out", self.catalog)

    def test_unexpected_root_manifest_rejected(self):
        # Multiple root scraper/plugin definitions must not be silently packaged.
        files = [("Demo.yml", b"name: Demo"), ("LICENSE", b"license"), ("other.yml", b"x: 1")]
        with self.assertRaises(ValueError):
            builder.validate_manifest(self.root, "Demo.yml", files, "plugin")

    def test_catalog_is_explicit(self):
        (self.root / "plugins/Unlisted").mkdir()
        (self.root / "plugins/Unlisted/private.txt").write_text("not published")
        indexes = self.build()
        self.assertEqual([x["id"] for x in indexes["plugin"]], ["Demo"])

    def test_update_dates_include_publication_changes(self):
        with patch.object(builder.subprocess, "check_output", return_value="1792742400"):
            date = builder.source_date(self.root, "plugins/Demo")
            self.assertRegex(date, r"^2026-\d\d-\d\d \d\d:\d\d:\d\d$")
        with patch.dict(builder.os.environ, {"GITHUB_ACTIONS": "true"}):
            with patch.object(builder.subprocess, "check_output", return_value=""):
                with self.assertRaises(ValueError):
                    builder.source_date(self.root, "plugins/Demo")


if __name__ == "__main__":
    unittest.main()
