"""Public image download for an explicit user action; no third-party dependencies."""
import base64
import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urlsplit, urljoin

MAX_BYTES = 8 * 1024 * 1024


def public_target(url):
    if not isinstance(url, str) or len(url) > 4096 or any(ord(c) < 32 for c in url):
        raise ValueError("Invalid image URL")
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Use a public HTTP or HTTPS image URL without credentials")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port != (443 if parsed.scheme == "https" else 80):
        raise ValueError("Only standard web ports are allowed")
    addresses = list(dict.fromkeys(item[4][0] for item in socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)))
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError("Local, private and reserved network addresses are not allowed")
    return parsed, port, addresses[0]


def fetch_image(url, validate_image):
    for _ in range(4):
        parsed, port, address = public_target(url)
        cls = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
        kwargs = {"timeout": 15}
        if parsed.scheme == "https":
            kwargs["context"] = ssl.create_default_context()
        connection = cls(parsed.hostname, port, **kwargs)
        # Pin the validated address. TLS still verifies the original hostname.
        connection._create_connection = lambda target, timeout, source_address=None: socket.create_connection((address, port), timeout, source_address)
        try:
            path = parsed.path or "/"
            if parsed.query:
                path += "?" + parsed.query
            connection.request("GET", path, headers={"Accept": "image/*", "Accept-Encoding": "identity", "User-Agent": "Lynx-Missing-Performer-Images/1.2"})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                redirect = response.getheader("Location")
                if not redirect:
                    raise ValueError("Image redirect has no destination")
                new_url = urljoin(url, redirect)
                if parsed.scheme == "https" and urlsplit(new_url).scheme != "https":
                    raise ValueError("Insecure image redirect refused")
                url = new_url
                continue
            if response.status != 200:
                raise ValueError("Image host returned HTTP %s. Try another image or upload a saved file." % response.status)
            length = response.getheader("Content-Length")
            if length and int(length) > MAX_BYTES:
                raise ValueError("Online image exceeds 8 MiB")
            data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError("Online image exceeds 8 MiB")
            mime = validate_image(data)
            return "data:%s;base64,%s" % (mime, base64.b64encode(data).decode("ascii"))
        finally:
            connection.close()
    raise ValueError("Too many image redirects")
