"""Bounded public metadata/portrait requests. No login or age-gate automation."""
import base64
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import time
import unicodedata
import urllib.error
import urllib.request
from urllib.parse import urlsplit
from xlgirls_core import Document, next_page, parse_profile, profile_url, search_results, portrait_url


class SameSiteRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class PortraitRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # A redirect must retain the same profile ID, public CDN and portrait path.
        identifier = urlsplit(req.full_url).path.split('photo_')[-1].split('_')[0].split('.')[0]
        portrait_url(newurl, identifier)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def image_payload(data, url):
    if not data or len(data) > 5_000_000:
        raise ValueError('The profile image is empty or exceeds 5 MB.')
    if data.startswith(b'\xff\xd8\xff'):
        mime = 'image/jpeg'
    elif data.startswith(b'\x89PNG\r\n\x1a\n'):
        mime = 'image/png'
    elif data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        mime = 'image/webp'
    else:
        raise ValueError('The response was not a JPEG, PNG or WebP profile image.')
    return {'url': url, 'sha256': hashlib.sha256(data).hexdigest(),
            'data_uri': 'data:' + mime + ';base64,' + base64.b64encode(data).decode('ascii')}


def validate_public_url(url):
    p = urlsplit(url)
    if (p.scheme != 'https' or p.hostname not in ('xlgirls.com', 'www.xlgirls.com')
            or p.username or p.password or p.port not in (None, 443)
            or not p.path.startswith('/bbw-models/')):
        raise ValueError('Requests are limited to public XL Girls directories and profiles.')


class Client:
    def __init__(self, cache_path=None, verification=True):
        self.verification = verification
        self.cache_path = Path(cache_path or Path(__file__).with_name('public-index.sqlite3'))
        self.opener = urllib.request.build_opener(SameSiteRedirect())

    def fetch(self, url, timeout=15):
        validate_public_url(url)
        headers = {'User-Agent': 'LynxXLGirls/0.1.1 public-metadata', 'Accept': 'text/html'}
        # Public-site preference, controlled by the module's verification setting.
        if self.verification:
            headers['Cookie'] = 'tsg_verified=true'
        try:
            with self.opener.open(urllib.request.Request(url, headers=headers), timeout=timeout) as response:
                validate_public_url(response.url)
                data = response.read(2_000_001)
                if len(data) > 2_000_000:
                    raise ValueError('The XL Girls page exceeds the metadata size limit.')
                html = data.decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
        except urllib.error.HTTPError as error:
            raise ValueError(f'XL Girls denied the request (HTTP {error.code}). No information was saved.') from error
        except (urllib.error.URLError, TimeoutError) as error:
            raise ValueError('Could not reach XL Girls. Check your connection and try again.') from error
        # Check visible text rather than executing any downloaded JavaScript.
        titles = ' '.join(n.text() for n in Document(html).root.walk() if n.tag in ('title', 'h1', 'h2'))
        if any(s in titles.casefold() for s in ('verifying browser', 'security check', 'access denied', 'age verification')):
            raise ValueError('XL Girls requires an access/browser check. The scraper cannot read the page; nothing is changed.')
        return html

    def profile(self, url):
        url = profile_url(url)
        return parse_profile(self.fetch(url), url)

    def image(self, url):
        url = portrait_url(url)
        opener = urllib.request.build_opener(PortraitRedirect())
        request = urllib.request.Request(url, headers={
            'User-Agent': 'LynxXLGirls/0.1.1 public-metadata',
            'Accept': 'image/jpeg,image/png,image/webp', 'Referer': 'https://www.xlgirls.com/'})
        # No Stash credentials or site verification cookie are sent to the CDN.
        try:
            with opener.open(request, timeout=15) as response:
                identifier = urlsplit(url).path.split('photo_')[-1].split('_')[0].split('.')[0]
                portrait_url(response.url, identifier)
                return image_payload(response.read(5_000_001), url)
        except (urllib.error.URLError, TimeoutError) as error:
            raise ValueError('Could not fetch the profile image from the public XL Girls image server.') from error

    def page(self, url, query, timeout):
        # Cache only public names/URLs/pagination, never page HTML or imagery.
        connection = None
        try:
            connection = sqlite3.connect(self.cache_path, timeout=2)
            connection.execute('CREATE TABLE IF NOT EXISTS pages (url TEXT PRIMARY KEY, saved REAL, data TEXT)')
            row = connection.execute('SELECT saved,data FROM pages WHERE url=?', (url,)).fetchone()
            if row and time.time() - row[0] < 86400:
                all_results, following = json.loads(row[1])
                words = query.casefold().split()
                connection.close()
                connection = None
                return [p for p in all_results if all(w in p['name'].casefold() for w in words)], following
        except (sqlite3.Error, OSError, ValueError):
            if connection:
                connection.close()
            connection = None  # An unwritable cache must never prevent scraping.
        try:
            html = self.fetch(url, timeout=timeout)
            initial = unicodedata.normalize('NFKD', query)[0].upper()
            all_results = search_results(html, initial)
            following = next_page(html, url)
            if connection:
                try:
                    connection.execute('INSERT OR REPLACE INTO pages VALUES(?,?,?)',
                                       (url, time.time(), json.dumps([all_results, following])))
                    connection.commit()
                except sqlite3.Error:
                    pass
            return search_results(html, query), following
        finally:
            if connection:
                connection.close()

    def search(self, query):
        query = ' '.join(str(query).split())
        normalized = unicodedata.normalize('NFKD', query).encode('ascii', 'ignore').decode()
        if not query or len(query) > 50 or not normalized or not normalized[0].isalpha():
            raise ValueError('Enter a name of 1–50 characters starting with a letter, or use the profile URL.')
        current = 'https://www.xlgirls.com/bbw-models/browse/' + normalized[0].upper() + '/'
        started = time.monotonic()
        result, warning = {}, ''
        for _ in range(12):
            remaining = 50 - (time.monotonic() - started)
            if remaining < 2:
                warning = 'Search timed out; results may be incomplete. Try again (visited pages are cached) or enter the profile URL.'
                break
            matches, following = self.page(current, query, min(15, remaining))
            result.update((p['url'], p) for p in matches)
            if not following:
                break
            current = following
        else:
            warning = 'Search was limited to 12 directory pages. Enter the profile URL if the correct match is missing.'
        return {'results': sorted(result.values(), key=lambda p: (p['name'].casefold() != query.casefold(), p['name'].casefold())), 'warning': warning}


def native_fragment(profile):
    result = {'url': profile['url'], 'urls': [profile['url']]}
    for key, value in profile['fields'].items():
        result['height' if key == 'height_cm' else key] = str(value)
    if profile.get('image_url'):
        result['images'] = [profile['image_url']]
    return result
