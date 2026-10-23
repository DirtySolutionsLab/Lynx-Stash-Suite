"""Stash raw plugin. Python 3.9+, standard library only. See README.md."""
import base64
import contextlib
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler, ProxyHandler

PAGE_SIZE = 100
MAX_IMAGE_BYTES = 32 * 1024 * 1024
TIMEOUT = 60

MISSING = '''query Missing($page: Int!) {
  findPerformers(performer_filter: {is_missing: "image"},
    filter: {page: $page, per_page: 100, sort: "id", direction: ASC}) {
    count performers {id name}
  }
}'''
CHECK = '''query StillMissing($ids: [ID!]!) {
  findPerformers(ids: $ids, performer_filter: {is_missing: "image"},
    filter: {per_page: -1}) {count performers {id}}
}'''
IMAGES = '''query Candidates($criteria: ImageFilterType!, $page: Int!) {
  findImages(image_filter: $criteria,
    filter: {page: $page, per_page: 100, sort: "id", direction: ASC}) {
    count images {id files {width height} paths {image}}
  }
}'''
GALLERIES = '''query Galleries($criteria: GalleryFilterType!, $page: Int!) {
  findGalleries(gallery_filter: $criteria,
    filter: {page: $page, per_page: 100, sort: "id", direction: ASC}) {
    count galleries {id}
  }
}'''
UPDATE = '''mutation Assign($input: PerformerUpdateInput!) {
  performerUpdate(input: $input) {id}
}'''


def log(message, level="i"):
    # Stash raw plugin log protocol; stdout is reserved for the JSON result.
    safe = str(message).replace("\n", " ").replace("\r", " ")
    print("\x01" + level + "\x02" + safe, file=sys.stderr, flush=True)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Unexpected redirect; refusing to forward credentials")


class Client:
    def __init__(self, connection):
        scheme = connection.get("Scheme", "http")
        if scheme not in ("http", "https"):
            raise RuntimeError("Unsupported server scheme")
        host = connection.get("Host") or "localhost"
        if host in ("0.0.0.0", "::", "[::]"):
            host = "localhost"
        if ":" in host and not host.startswith("["):
            host = "[" + host + "]"
        self.base = "%s://%s:%d" % (scheme, host, int(connection["Port"]))
        cookie = connection.get("SessionCookie") or {}
        self.headers = {"Accept": "application/json"}
        if cookie.get("Value"):
            self.headers["Cookie"] = "%s=%s" % (cookie.get("Name") or "session", cookie["Value"])
        self.opener = build_opener(ProxyHandler({}), NoRedirect())

    def gql(self, query, variables):
        body = json.dumps({"query": query, "variables": variables}).encode("utf-8")
        headers = dict(self.headers, **{"Content-Type": "application/json"})
        req = Request(self.base + "/graphql", data=body, headers=headers)
        with self.opener.open(req, timeout=TIMEOUT) as response:
            result = json.load(response)
        if result.get("errors"):
            # Do not print variables: mutation variables contain image data.
            raise RuntimeError("GraphQL: " + "; ".join(e.get("message", "error") for e in result["errors"]))
        if not isinstance(result.get("data"), dict):
            raise RuntimeError("GraphQL returned no data")
        return result["data"]

    def download(self, candidate):
        # Always contact the authenticated local Stash server, never a remote URL.
        path = urlsplit(candidate["paths"]["image"])
        expected = "/image/%s/image" % candidate["id"]
        if path.path != expected:
            raise RuntimeError("Unexpected image endpoint")
        url = self.base + path.path + (("?" + path.query) if path.query else "")
        headers = dict(self.headers, Accept="image/*")
        with self.opener.open(Request(url, headers=headers), timeout=TIMEOUT) as response:
            data = response.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise RuntimeError("Image exceeds 32 MiB limit")
        mime = image_mime(data)
        return "data:%s;base64,%s" % (mime, base64.b64encode(data).decode("ascii"))


def image_mime(data):
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise RuntimeError("Not a supported JPEG, PNG, GIF or WebP image")


def pages(client, query, result_name, item_name, variables=None):
    page = 1
    while True:
        args = dict(variables or {}, page=page)
        result = client.gql(query, args)[result_name]
        items = result[item_name]
        yield from items
        if page * PAGE_SIZE >= result["count"]:
            return
        if not items:
            raise RuntimeError("Empty page before end of results")
        page += 1


def dimensions(image):
    files = image.get("files") or []
    # Stash orders files with the primary file first; paths.image serves it.
    if not files:
        return 0, 0
    return files[0].get("width", 0), files[0].get("height", 0)


def rank(image):
    width, height = dimensions(image)
    return (height > width, width * height, min(width, height), -int(image["id"]))


def ranked(images):
    unique = {}
    for image in images:
        width, height = dimensions(image)
        if width > 0 and height > 0 and (image.get("paths") or {}).get("image"):
            unique[image["id"]] = image
    return sorted(unique.values(), key=rank, reverse=True)


def candidates(client, performer_id):
    criteria = {"performers": {"value": [performer_id], "modifier": "INCLUDES"}}
    direct = ranked(pages(client, IMAGES, "findImages", "images", {"criteria": criteria}))
    yield "direct", direct
    galleries = pages(client, GALLERIES, "findGalleries", "galleries", {"criteria": criteria})
    gallery_ids = [g["id"] for g in galleries]
    images = []
    for start in range(0, len(gallery_ids), PAGE_SIZE):
        filt = {"galleries": {"value": gallery_ids[start:start + PAGE_SIZE], "modifier": "INCLUDES"}}
        images.extend(pages(client, IMAGES, "findImages", "images", {"criteria": filt}))
    direct_ids = {i["id"] for i in direct}
    yield "gallery", [i for i in ranked(images) if i["id"] not in direct_ids]


def still_missing(client, performer_id):
    result = client.gql(CHECK, {"ids": [performer_id]})["findPerformers"]
    return any(str(p["id"]) == str(performer_id) for p in result["performers"])


def process(client, performer, mode):
    pid = performer["id"]
    label = "%s [performer %s]" % (performer["name"], pid)
    if not still_missing(client, pid):
        log(label + " -> skipped: image already present or performer deleted")
        return "skipped"
    for source, images in candidates(client, pid):
        for candidate in images:
            try:
                # Preview also verifies downloadability, without any mutations.
                data_url = client.download(candidate)
            except Exception as exc:
                log(label + " -> image %s unavailable (%s)" % (candidate["id"], type(exc).__name__), "w")
                continue
            width, height = dimensions(candidate)
            detail = "image %s (%s, %sx%s)" % (candidate["id"], source, width, height)
            if mode == "preview":
                log("PREVIEW " + label + " -> " + detail)
                return "previewed"
            if not still_missing(client, pid):
                log(label + " -> skipped: image added during candidate lookup")
                return "skipped"
            # The public API has no compare-and-set. See concurrency limit in README.
            result = client.gql(UPDATE, {"input": {"id": pid, "image": data_url}})
            if not result.get("performerUpdate") or str(result["performerUpdate"]["id"]) != str(pid):
                raise RuntimeError("Mutation did not confirm the performer")
            log("ASSIGNED " + label + " -> " + detail)
            return "assigned"
    log(label + " -> no usable linked image found")
    return "no_candidate"


def run(client, mode):
    if mode not in ("preview", "assign"):
        raise ValueError("Mode must be preview or assign")
    # Collect the snapshot BEFORE mutations; otherwise shrinking missing-image
    # results would shift subsequent pages and silently skip performers.
    performers = list(pages(client, MISSING, "findPerformers", "performers"))
    performers = list({p["id"]: p for p in performers}.values())
    counts = dict(previewed=0, assigned=0, skipped=0, no_candidate=0, errors=0)
    log("%s: %d performers missing images" % (mode.upper(), len(performers)))
    for index, performer in enumerate(performers):
        try:
            counts[process(client, performer, mode)] += 1
        except Exception as exc:
            counts["errors"] += 1
            log("Performer %s: %s; no retry of mutations" % (performer["id"], type(exc).__name__), "e")
        log(str((index + 1) / len(performers)), "p")
    log("Summary: " + json.dumps(counts))
    return counts


@contextlib.contextmanager
def single_run():
    # OS releases the lock after cancellation/crash. Keep the file, not a stale PID.
    path = Path(__file__).resolve().with_suffix(".lock")
    with path.open("a+b") as lock:
        lock.seek(0, os.SEEK_END)
        if lock.tell() == 0:
            lock.write(b"0")
            lock.flush()
        lock.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise RuntimeError("Another plugin run is already active") from exc
        try:
            yield
        finally:
            lock.seek(0)
            if os.name == "nt":
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def main():
    try:
        payload = json.load(sys.stdin)
        mode = payload.get("args", {}).get("mode", "preview")
        if mode == "fetch_image":
            from online_images import fetch_image
            image = fetch_image(payload.get("args", {}).get("url"), image_mime)
            print(json.dumps({"output": json.dumps({"image": image})}))
            return 0
        with single_run():
            counts = run(Client(payload["server_connection"]), mode)
        output = {"output": json.dumps(counts)}
        if counts["errors"]:
            output["error"] = "Some performers failed; see plugin log. Completed assignments remain saved."
        print(json.dumps(output))
        return 1 if counts["errors"] else 0
    except Exception as exc:
        # No raw connection payload, cookie, image data or traceback in logs.
        log("Plugin stopped: " + str(exc), "e")
        print(json.dumps({"error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
