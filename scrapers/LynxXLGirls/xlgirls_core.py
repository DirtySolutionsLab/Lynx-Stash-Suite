"""Metadata parsing and metric conversion for public XL Girls profiles.

This module deliberately performs no network requests or Stash writes.
"""
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
from html.parser import HTMLParser
import re
from urllib.parse import urlsplit, urlunsplit, unquote, urljoin, parse_qs


INCH_CM = Decimal('2.54')
POUND_KG = Decimal('0.45359237')


def integer(value):
    return int(value.quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def profile_url(value):
    p = urlsplit(value)
    if (p.scheme != 'https' or p.hostname not in ('xlgirls.com', 'www.xlgirls.com')
            or p.username or p.password or p.port not in (None, 443)
            or not re.fullmatch(r'/bbw-models/[A-Za-z0-9%_-]+/[1-9]\d*/?', p.path)):
        raise ValueError('Enter a public XL Girls profile URL with HTTPS and a profile ID.')
    return urlunsplit(('https', 'www.xlgirls.com', p.path.rstrip('/') + '/', '', ''))


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []

    def text(self):
        return ''.join(c if isinstance(c, str) else c.text() for c in self.children)

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def has_class(self, name):
        return name in self.attrs.get('class', '').split()


class Document(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def height_cm(text):
    text = text.strip().replace('′', "'").replace('″', '"')
    feet = re.fullmatch(r'(\d)\s*(?:\'|ft|feet)\s*(\d{1,2}(?:\.\d+)?)?\s*(?:\'\'|\"|in|inches)?\.?', text, re.I)
    if feet:
        inches = Decimal(feet[2] or '0')
        if inches >= 12:
            return None
        value = (Decimal(feet[1]) * 12 + inches) * INCH_CM
    else:
        number = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(cm|m|in|inches|inch)', text, re.I)
        if not number:
            return None
        unit = number[2].lower()
        value = Decimal(number[1]) * (100 if unit == 'm' else 1 if unit == 'cm' else INCH_CM)
    return value if 80 <= value <= 250 else None


def weight_kg(text):
    number = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kgs)\.?', text.strip(), re.I)
    if not number:
        return None
    value = Decimal(number[1])
    if number[2].lower().startswith(('lb', 'pound')):
        value *= POUND_KG
    return value if 20 <= value <= 500 else None


def portrait_url(value, identifier=None):
    """Only the observed public portrait CDN/path; never posting/scene images."""
    p = urlsplit(value)
    match = re.fullmatch(r'/modeldir/data/photos/\d+/\d+/photo_([1-9]\d*)(?:_(?:xl|250|med))?\.(?:jpg|jpeg|png|webp)', p.path, re.I)
    if (p.scheme != 'https' or p.hostname != 'cdn77.scoreuniverse.com' or p.username or p.password
            or p.port not in (None, 443) or not match or p.query or p.fragment
            or identifier is not None and match[1] != str(identifier)):
        raise ValueError('Only the public XL Girls portrait for the matching model ID is allowed.')
    return urlunsplit(('https', p.hostname, p.path, '', ''))


def find_portrait(nodes, url):
    identifier = urlsplit(url).path.rstrip('/').split('/')[-1]
    # Prefer the main profile portrait; og:image is a same-ID portrait fallback.
    for tag in ('img', 'meta'):
        for node in nodes:
            if node.tag != tag or tag == 'meta' and node.attrs.get('property') != 'og:image':
                continue
            value = node.attrs.get('src') or node.attrs.get('data-src') if tag == 'img' else node.attrs.get('content')
            try:
                return portrait_url(urljoin(url, value or ''), identifier)
            except ValueError:
                continue
    return None


def birthday_iso(text):
    if not re.search(r'\b(?:19|20)\d{2}\b', text):
        return None
    cleaned = re.sub(r'(?<=\d)(st|nd|rd|th)\b', '', text, flags=re.I)
    cleaned = ' '.join(cleaned.replace('.', '').replace(',', ' ').split())
    for pattern in ('%Y-%m-%d', '%b %d %Y', '%B %d %Y', '%d %b %Y', '%d %B %Y'):
        try:
            value = datetime.strptime(cleaned, pattern).date()
            return value.isoformat() if date(1900, 1, 1) <= value <= date.today() else None
        except ValueError:
            pass
    return None


def parse_profile(html, url):
    url = profile_url(url)
    nodes = list(Document(html).root.walk())
    headings = [n.text().strip() for n in nodes if n.tag == 'h1']
    # Names ending in s use a bare possessive apostrophe (Steels' Profile).
    name = next((re.sub(r"['’](?:s)?\s+Profile$", '', h, flags=re.I).strip()
                 for h in headings if re.search(r"['’](?:s)?\s+Profile$", h, re.I)), None)
    if not name:
        raise ValueError('No public profile was found. The site may be showing a browser check, age check or login page.')
    raw = {}
    for node in nodes:
        if not node.has_class('stat'):
            continue
        label = next((n.text().strip().rstrip(':').lower() for n in node.walk() if n.has_class('label')), '')
        value = next((' '.join(n.text().split()) for n in node.walk() if n.has_class('value')), '')
        if label and value:
            raw[label] = value
    fields = {'name': name}
    warnings = []
    for label, target in [('hair color', 'hair_color'), ('eye color', 'eye_color'), ('ethnicity', 'ethnicity')]:
        if raw.get(label):
            fields[target] = raw[label]
    for label, convert, target in [('height', height_cm, 'height_cm'), ('weight', weight_kg, 'weight')]:
        if raw.get(label):
            value = convert(raw[label])
            if value is not None:
                fields[target] = integer(value)  # Stash uses integer cm and kg.
            else:
                warnings.append('Could not reliably parse ' + label + ': ' + raw[label])
    if raw.get('measurements'):
        fields['measurements'] = raw['measurements']  # Preserve source units/cup notation verbatim.
    if raw.get('birthday'):
        birthdate = birthday_iso(raw['birthday'])
        if birthdate:
            fields['birthdate'] = birthdate
        else:
            warnings.append('Birthday is not imported without a verified complete date including the year.')
    custom = {key: raw[label] for label, key in [('body type', 'body_type'), ('bra size', 'bra_size')] if raw.get(label)}
    return {'url': url, 'fields': fields, 'custom': custom, 'original': raw, 'warnings': warnings,
            'image_url': find_portrait(nodes, url)}


def search_results(html, query):
    query = ' '.join(query.split()).casefold()
    if not query or len(query) > 50:
        raise ValueError('Enter a name of 1–50 characters.')
    result = {}
    for node in Document(html).root.walk():
        if node.tag != 'a':
            continue
        try:
            url = profile_url(urljoin('https://www.xlgirls.com', node.attrs.get('href', '')))
        except ValueError:
            continue
        slug = urlsplit(url).path.split('/')[-3]
        name = ' '.join(node.text().split()) or unquote(slug).replace('-', ' ')
        if len(name) > 100:
            name = unquote(slug).replace('-', ' ')
        if all(word in name.casefold() for word in query.split()):
            result[url] = {'name': name, 'url': url}
    return sorted(result.values(), key=lambda item: (item['name'].casefold() != query, item['name'].casefold()))


def next_page(html, current):
    """Use only the observed directory's next-page links, never external links."""
    path = urlsplit(current).path
    page = int(parse_qs(urlsplit(current).query).get('page', ['1'])[0])
    for node in Document(html).root.walk():
        if node.tag == 'a' and node.has_class('next-pg'):
            candidate = urlsplit(urljoin(current, node.attrs.get('href', '')))
            number = parse_qs(candidate.query).get('page', [''])[0]
            if (candidate.scheme == 'https' and candidate.hostname in ('xlgirls.com', 'www.xlgirls.com')
                    and candidate.path == path and number.isdigit() and int(number) == page + 1):
                return urlunsplit(('https', 'www.xlgirls.com', path, 'page=' + number, ''))
    return None
