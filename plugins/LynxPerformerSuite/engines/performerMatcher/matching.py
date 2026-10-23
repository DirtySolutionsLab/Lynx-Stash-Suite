"""Filename/folder evidence only. No image recognition or inferred identities."""
import re
import unicodedata
from pathlib import PureWindowsPath

MONTHS = set('january february march april may june july august september october november december jan feb mar apr jun jul aug sep oct nov dec'.split())
GENERIC = set('images image img pictures picture pics photo photos gallery galleries set sets unknown unnamed unassigned sorted unsorted downloads collection collections'.split())


def calendar_folder(value):
    """Recognize year/month/date directories without treating them as model names."""
    return (norm(value) in MONTHS or
            re.fullmatch(r'(?:19|20)\d{2}(?:[-_.](?:0?[1-9]|1[0-2])(?:[-_.](?:0?[1-9]|[12]\d|3[01]))?)?', value) is not None)


def norm(value):
    value = unicodedata.normalize('NFKC', str(value)).casefold()
    return ' '.join(re.sub(r'[^\w]+|_', ' ', value, flags=re.UNICODE).split())


def compact(value):
    return norm(value).replace(' ', '')


def valid_name(value):
    value = str(value).strip()
    return (1 < len(value) <= 100 and any(c.isalpha() for c in value)
            and not any(ord(c) < 32 for c in value)
            and not re.search(r'[/\\<>|]', value)
            and norm(value) not in GENERIC
            and not re.fullmatch(r'(?:img|image|photo|pic|set|dsc)[ _-]*\d*', value, re.I)
            and not re.fullmatch(r'\d{4}[-_.]\d{1,2}[-_.]\d{1,2}', value))


def name_text(value):
    value = re.sub(r'\.(?:jpe?g|png|webp|gif|bmp|avif|zip|cbz)$', '', value, flags=re.I)
    value = re.split(r'\s+-\s+', value, maxsplit=1)[0]
    value = re.sub(r'\s*\(\d{4,}\).*$', '', value)
    value = re.sub(r'[ _.-]+\d+(?:[ _.-]+\d+)*$', '', value)
    return ' '.join(value.replace('_', ' ').split()).strip(' .-')


def path_parts(path):
    return [p for p in re.split(r'[/\\]+', str(path)) if p and not re.fullmatch(r'[A-Za-z]:', p)]


def path_candidate(path, is_file=True):
    parts = path_parts(path)
    folders = parts[:-1] if is_file else parts
    # A named performer directory is explicit evidence, including an alphabetic index.
    for i, part in enumerate(folders):
        if compact(part) in ('performers', 'models'):
            rest = folders[i+1:]
            if rest and len(rest[0]) == 1: rest = rest[1:]
            if rest:
                candidate = name_text(rest[0])
                if valid_name(candidate): return candidate, 'Performer folder', path
    # Site rips: the first model folder after site/year/month is not a set title.
    for i, part in enumerate(folders):
        if re.fullmatch(r'\[[^\]]+\]', part):
            rest = folders[i+1:]
            while rest and calendar_folder(rest[0]):
                rest = rest[1:]
            if rest:
                candidate = name_text(rest[0])
                if valid_name(candidate): return candidate, part.strip('[]') + ' model folder', path
    return None


class Index:
    def __init__(self, people):
        self.people = {str(p['id']): p for p in people}
        self.names = {}
        self.compact_names = {}
        for person in people:
            for name in [person['name'], *(person.get('alias_list') or [])]:
                if not name: continue
                self.names.setdefault(norm(name), set()).add(str(person['id']))
                self.compact_names.setdefault(compact(name), set()).add(str(person['id']))

    def exact(self, name):
        ids = self.names.get(norm(name), set()) | self.compact_names.get(compact(name), set())
        return [self.people[i] for i in sorted(ids)]

    def contained(self, text):
        text = ' ' + norm(text) + ' '
        found = {}
        for name, ids in self.names.items():
            if len(name) >= 4 and ' ' + name + ' ' in text:
                for i in ids: found[i] = self.people[i]
        return list(found.values())

    def propose(self, item):
        paths = item.get('source_paths') or []
        evidence = [path_candidate(p['path'], p['is_file']) for p in paths]
        evidence = [e for e in evidence if e]
        # Conflicting file locations are reviewable, never silently decided.
        if evidence:
            names = {compact(e[0]): e for e in evidence}
            if len(names) > 1:
                return {'name': evidence[0][0], 'status': 'review', 'matches': [],
                        'reason': 'Conflicting performer folders', 'evidence': [list(e) for e in names.values()]}
            name, reason, source = evidence[0]
        else:
            filename = next((PureWindowsPath(p['path'].replace('/', '\\')).name for p in paths if p['is_file']), '')
            text = filename or item.get('title') or ''
            known = self.contained(text)
            if known:
                return {'name': known[0]['name'], 'status': 'exact' if len(known) == 1 else 'review',
                        'matches': [p['id'] for p in known], 'reason': 'Existing name or alias in title / filename',
                        'evidence': [['Title / filename', text]]}
            name = name_text(text)
            reason, source = 'Title / filename proposal', text
            if not valid_name(name):
                return {'name': '', 'status': 'none', 'matches': [], 'reason': 'No usable name found', 'evidence': []}
        found = self.exact(name)
        return {'name': name, 'status': 'exact' if len(found) == 1 else 'review' if found else 'new',
                'matches': [p['id'] for p in found], 'reason': reason, 'evidence': [[reason, source]]}
