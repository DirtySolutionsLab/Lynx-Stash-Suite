#!/usr/bin/env python3
"""Build Stash plugin and scraper sources without executing plugin code.

Copyright (c) 2026 DirtySolutionsLab. MIT: see BUILD-LICENSE.txt.
Component licenses remain unchanged.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import html
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import zipfile
from ruamel.yaml import YAML

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", ".mypy_cache", "node_modules", ".venv"}
SKIP_SUFFIXES = {".pyc", ".pyo", ".db", ".sqlite", ".sqlite3", ".lock", ".log",
                 ".zip", ".bak", ".etl", ".pem", ".key"}
SKIP_NAMES = {"manifest", ".DS_Store", "Thumbs.db", "config.py", ".env"}


def contained(root: Path, relative: str) -> Path:
    value = PurePosixPath(relative)
    if not relative or value.is_absolute() or ".." in value.parts or "\\" in relative or ":" in relative:
        raise ValueError(f"Unsafe relative path: {relative}")
    path = root.joinpath(*value.parts)
    cursor = path
    while cursor != root:
        if cursor.is_symlink():
            raise ValueError(f"Symbolic links are not packaged: {cursor}")
        cursor = cursor.parent
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Path outside source: {relative}")
    return path


def excluded(relative: Path) -> bool:
    return (any(part in SKIP_DIRS for part in relative.parts)
            or relative.name in SKIP_NAMES or relative.name.startswith(".env.")
            or relative.suffix.lower() in SKIP_SUFFIXES
            or re.search(r"\.(?:sqlite3?|db)-(?:wal|shm|journal)$", relative.name) is not None)


def package_files(directory: Path) -> list[tuple[str, bytes]]:
    files = []
    if not directory.is_dir():
        raise ValueError(f"Missing component: {directory}")
    for file in sorted(directory.rglob("*")):
        relative = file.relative_to(directory)
        if excluded(relative):
            continue
        if file.is_symlink():
            raise ValueError(f"Symbolic links are not packaged: {file}")
        if file.is_file():
            files.append((relative.as_posix(), file.read_bytes()))
    names = [name.casefold() for name, _ in files]
    if not files or len(set(names)) != len(names):
        raise ValueError(f"Empty package or case-insensitive collision: {directory}")
    return files


def zip_bytes(files: list[tuple[str, bytes]]) -> bytes:
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in files:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
    return result.getvalue()


def source_date(root: Path, relative: str) -> str:
    try:
        raw = subprocess.check_output(
            ["git", "-C", str(root), "log", "-1", "--format=%ct", "--", relative,
             "scripts", ".github/workflows/publish-stash-sources.yml"],
            stderr=subprocess.DEVNULL, text=True).strip()
        timestamp = int(raw) if raw else 0
    except (OSError, ValueError, subprocess.CalledProcessError):
        timestamp = 0
    if timestamp == 0 and os.environ.get("GITHUB_ACTIONS") == "true":
        raise ValueError("Git history is required when publishing from GitHub Actions")
    # Stable fallback for local source exports without accessible Git history.
    return datetime.fromtimestamp(timestamp, timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def load_yaml(text: str):
    return YAML(typ="safe").load(text)


def validate_manifest(directory: Path, manifest_name: str, files, kind: str):
    if "/" in manifest_name or not manifest_name.endswith(".yml"):
        raise ValueError(f"Manifest must be at package root: {manifest_name}")
    payload = dict(files)
    if manifest_name not in payload or "LICENSE" not in payload:
        raise ValueError(f"Missing manifest or LICENSE: {directory}")
    manifests = [name for name in payload if "/" not in name and name.endswith(".yml")]
    if manifests != [manifest_name]:
        raise ValueError(f"Unexpected root manifests: {manifests}")
    manifest = load_yaml(payload[manifest_name].decode("utf-8-sig"))
    if not isinstance(manifest, dict) or not manifest.get("name"):
        raise ValueError(f"Invalid manifest: {directory}")
    if kind == "plugin":
        ui = manifest.get("ui", {})
        for key in ("javascript", "css"):
            for asset in ui.get(key, []):
                if asset.startswith(("https://", "http://")):
                    continue
                contained(directory, asset)
                if asset not in payload:
                    raise ValueError(f"Missing UI asset: {directory}/{asset}")
        for disk_path in ui.get("assets", {}).values():
            if not contained(directory, disk_path).exists():
                raise ValueError(f"Missing asset directory: {disk_path}")
    return manifest


def build(root: Path, output: Path, catalog: dict) -> dict:
    root, output = root.resolve(), output.resolve()
    if output == root or any(output.is_relative_to(root / part)
                             for part in ("plugins", "themes", "scrapers", ".git")):
        raise ValueError("Output must not be inside source components or repository root")
    indexes = {"plugin": [], "scraper": []}
    seen, prepared = set(), []
    for entry in catalog["packages"]:
        kind = entry["kind"]
        if kind not in indexes:
            raise ValueError(f"Unknown kind: {kind}")
        directory = contained(root, entry["directory"])
        files = package_files(directory)
        manifest = validate_manifest(directory, entry["manifest"], files, kind)
        package_id = Path(entry["manifest"]).stem
        if not re.fullmatch(r"[A-Za-z0-9_-]+", package_id) or (kind, package_id.casefold()) in seen:
            raise ValueError(f"Unsafe or duplicate ID: {package_id}")
        seen.add((kind, package_id.casefold()))
        base_version = str(entry.get("version", manifest.get("version", "")))
        if not base_version or base_version == "None":
            raise ValueError(f"Missing version: {package_id}")
        data = zip_bytes(files)
        sha = hashlib.sha256(data).hexdigest()
        filename = f"{package_id}-{sha[:16]}.zip"
        bucket = Path("main") if kind == "plugin" else Path("main/scrapers")
        item = {
            "id": package_id, "name": str(manifest["name"]),
            "version": f"{base_version}-{sha[:12]}",
            "date": source_date(root, entry["directory"]),
            "path": filename, "sha256": sha,
            "metadata": {
                "description": str(entry.get("description", manifest.get("description", ""))),
                "url": catalog["repository"] + "/tree/main/" + entry["directory"],
            },
        }
        if entry.get("requires"):
            item["requires"] = entry["requires"]
        indexes[kind].append(item)
        prepared.append((bucket / filename, data))
        print(f"PACKAGE {kind}: {package_id} — {len(files)} files")
    for kind, items in indexes.items():
        if not items:
            raise ValueError(f"Empty {kind} source")
        available = {item["id"] for item in items}
        for item in items:
            if not set(item.get("requires", [])).issubset(available):
                raise ValueError(f"Dependency missing from source: {item['id']}")
    # Validate all inputs before writing any publication output. Never delete a directory.
    output.mkdir(parents=True, exist_ok=True)
    for name, data in prepared:
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    for kind, items in indexes.items():
        folder = output / ("main" if kind == "plugin" else "main/scrapers")
        # JSON syntax is supported by YAML parsers, including Stash's decoder.
        (folder / "index.yml").write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n",
                                          encoding="utf-8")
    (output / ".nojekyll").write_text("", encoding="utf-8")
    rows = "".join("<li>" + html.escape(item["name"]) + "</li>"
                   for items in indexes.values() for item in items)
    landing = (
        "<!doctype html><html lang='en'><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>Lynx Stash Suite — installation sources</title>"
        "<style>body{max-width:850px;margin:3rem auto;padding:1rem;background:#111923;"
        "color:#e4edf8;font:17px/1.6 system-ui}a{color:#76b4ff}</style>"
        "<h1>Lynx Stash Suite</h1><p>Public preview installation sources for Stash.</p>"
        "<h2>Plugins and themes</h2><p>Settings → Plugins. Local path: <code>lynx</code>.</p>"
        "<p><a href='main/index.yml'>Plugin index</a></p>"
        "<h2>Companion scrapers</h2><p>Settings → Metadata Providers. Local path: <code>lynx</code>.</p>"
        "<p><a href='main/scrapers/index.yml'>Scraper index</a></p>"
        "<p>Install only what you need. Python requirements still apply. Back up existing "
        "installations and avoid duplicate plugin IDs.</p><ul>" + rows + "</ul>"
        "<p><a href='" + html.escape(catalog["repository"], quote=True) +
        "'>Documentation, credits and releases</a></p></html>")
    (output / "index.html").write_text(landing, encoding="utf-8")
    verify(output)
    return indexes


def verify(output: Path):
    for relative in ("main/index.yml", "main/scrapers/index.yml"):
        path = output / relative
        items = load_yaml(path.read_text(encoding="utf-8"))
        if not isinstance(items, list) or not items:
            raise ValueError(f"Invalid index: {path}")
        for item in items:
            archive_path = contained(path.parent, item["path"])
            data = archive_path.read_bytes()
            if hashlib.sha256(data).hexdigest() != item["sha256"]:
                raise ValueError(f"SHA-256 mismatch: {archive_path}")
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if archive.testzip() is not None:
                    raise ValueError(f"Invalid ZIP: {archive_path}")
                if item["id"] + ".yml" not in archive.namelist():
                    raise ValueError(f"Root manifest missing: {archive_path}")
                for name in archive.namelist():
                    contained(Path("/safe-package-root"), name)
                    if excluded(Path(name)):
                        raise ValueError(f"Runtime/private file in ZIP: {name}")
    print("PASS: indexes, ZIP integrity, root manifests and SHA-256 checksums")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "_site")
    args = parser.parse_args()
    catalog = json.loads((ROOT / "scripts/package-catalog.json").read_text(encoding="utf-8"))
    build(ROOT, args.output, catalog)


if __name__ == "__main__":
    main()
