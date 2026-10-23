"""Smoke-test generated source URLs over loopback HTTP, not live Stash.

Copyright (c) 2026 DirtySolutionsLab. MIT: see BUILD-LICENSE.txt.
"""
import argparse
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from urllib.parse import urljoin
from urllib.request import urlopen


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=Path("_site"))
    args = parser.parse_args()
    handler = partial(QuietHandler, directory=str(args.directory.resolve()))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    count = 0
    try:
        base = f"http://127.0.0.1:{server.server_port}/"
        for route in ("main/index.yml", "main/scrapers/index.yml"):
            index_url = urljoin(base, route)
            with urlopen(index_url, timeout=10) as response:
                items = json.load(response)
            for item in items:
                with urlopen(urljoin(index_url, item["path"]), timeout=10) as response:
                    data = response.read()
                if hashlib.sha256(data).hexdigest() != item["sha256"]:
                    raise ValueError(f"Downloaded checksum mismatch: {item['id']}")
                count += 1
        print(f"PASS: both indexes and {count} ZIP downloads over HTTP with matching SHA-256")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
