"""Lynx Tag Bridge. Python standard library only; Stash >= 0.31.

Only original source tags are propagated. Plugin-added tags are persisted in
SQLite before mutations so later hook processes cannot echo them back.
"""
import contextlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import time
import urllib.request

PLUGIN_ID = 'LynxTagBridge'
ROOT = Path(__file__).resolve().parent
PLURALS = {'Scene': 'scenes', 'Image': 'images', 'Gallery': 'galleries'}
DEFAULTS = dict.fromkeys(('automatic', 'performerScenes', 'performerImages',
                         'performerGalleries', 'galleryImages', 'imagesGallery',
                         'imagesAll', 'skipOrganized'), False)
DEFAULTS.update(dict.fromkeys(('performerAllow', 'galleryAllow', 'imageAllow', 'excluded'), ''))


def log(message, level='i'):
    print('\x01' + level + '\x02' + str(message), file=sys.stderr, flush=True)


@contextlib.contextmanager
def exclusive_lock(path, wait=True):
    """Serialize plugin processes; release automatically even after a crash."""
    with open(path, 'a+b') as handle:
        handle.seek(0, 2)
        if not handle.tell():
            handle.write(b'0')
            handle.flush()
        deadline = time.monotonic() + 120
        while True:
            try:
                handle.seek(0)
                if os.name == 'nt':
                    import msvcrt
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except (OSError, BlockingIOError):
                if not wait:
                    yield False
                    return
                if time.monotonic() >= deadline:
                    raise RuntimeError('Another Lynx operation is running. Try again later.')
                time.sleep(.2)
        try:
            yield True
        finally:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


class API:
    def __init__(self, connection):
        host = connection.get('Host', 'localhost')
        if host in ('0.0.0.0', '::'):
            host = 'localhost'
        if ':' in host and not host.startswith('['):
            host = '[' + host + ']'
        self.url = '%s://%s:%s/graphql' % (connection.get('Scheme', 'http'), host,
                                         connection.get('Port', 9999))
        self.headers = {'Content-Type': 'application/json'}
        cookie = connection.get('SessionCookie') or {}
        if cookie.get('Value'):
            self.headers['Cookie'] = cookie.get('Name', 'session') + '=' + cookie['Value']
        if connection.get('ApiKey'):
            self.headers['ApiKey'] = connection['ApiKey']

    def gql(self, query, variables=None):
        payload = json.dumps({'query': query, 'variables': variables or {}}).encode()
        request = urllib.request.Request(self.url, data=payload, headers=self.headers)
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.load(response)
        if result.get('errors'):
            raise RuntimeError(json.dumps(result['errors'], ensure_ascii=False))
        return result['data']

    @staticmethod
    def fields(kind):
        if kind == 'Performer':
            return 'id tags { id name }'
        fields = 'id title organized tags { id name } performers { id tags { id name } }'
        if kind == 'Image':
            fields += ' galleries { id }'
        return fields

    def get(self, kind, identifier):
        name = 'find' + kind
        return self.gql('query($id:ID!){%s(id:$id){%s}}' % (name, self.fields(kind)),
                        {'id': str(identifier)})[name]

    def list(self, kind, criteria=None):
        plural = PLURALS[kind]
        name = 'find' + plural.capitalize()
        query = ('query($filter:FindFilterType!,$criteria:%sFilterType!){'
                 '%s(filter:$filter,%s_filter:$criteria){%s{%s}}}' %
                 (kind, name, kind.lower(), plural, self.fields(kind)))
        page = 1
        while True:
            items = self.gql(query, {'filter': {'page': page, 'per_page': 100,
                                               'sort': 'id', 'direction': 'ASC'},
                                     'criteria': criteria or {}})[name][plural]
            yield from items
            if len(items) < 100:
                break
            page += 1

    def add(self, kind, identifier, tag_ids):
        # ADD avoids overwriting user edits made after the read.
        name = 'bulk' + kind + 'Update'
        query = 'mutation($input:Bulk%sUpdateInput!){%s(input:$input){id}}' % (kind, name)
        self.gql(query, {'input': {'ids': [str(identifier)],
                                   'tag_ids': {'mode': 'ADD', 'ids': sorted(tag_ids)}}})

    def schedule(self):
        return self.gql('mutation($id:ID!){runPluginTask(plugin_id:$id,'
                        'task_name:"Lynx – bearbeta köade ändringar")}',
                        {'id': PLUGIN_ID})['runPluginTask']


class State:
    def __init__(self, path):
        self.db = sqlite3.connect(path, timeout=30)
        self.db.execute('CREATE TABLE IF NOT EXISTS inherited '
                        '(kind TEXT, object_id TEXT, tag_id TEXT, '
                        'PRIMARY KEY(kind,object_id,tag_id))')
        self.db.execute('CREATE TABLE IF NOT EXISTS pending '
                        '(kind TEXT, object_id TEXT, payload TEXT, '
                        'PRIMARY KEY(kind,object_id))')
        self.db.commit()

    def inherited(self, kind, identifier):
        return {row[0] for row in self.db.execute(
            'SELECT tag_id FROM inherited WHERE kind=? AND object_id=?',
            (kind, str(identifier)))}

    def remember(self, kind, identifier, ids):
        self.db.executemany('INSERT OR IGNORE INTO inherited VALUES (?,?,?)',
                            [(kind, str(identifier), t) for t in ids])
        self.db.commit()

    def forget(self, kind, identifier, ids):
        self.db.executemany('DELETE FROM inherited WHERE kind=? AND object_id=? AND tag_id=?',
                            [(kind, str(identifier), t) for t in ids])
        self.db.commit()

    def close(self):
        self.db.close()

    def enqueue(self, hook):
        kind = hook['type'].split('.')[0]
        # Normalize inputFields: a newer event must not erase a relevant older one.
        hook = {'type': kind + '.Update.Post', 'id': str(hook['id'])}
        self.db.execute('INSERT OR REPLACE INTO pending VALUES (?,?,?)',
                        (kind, hook['id'], json.dumps(hook)))
        self.db.commit()

    def take(self):
        # Worker holds the OS lock. Hooks can insert concurrently between work items.
        self.db.execute('BEGIN IMMEDIATE')
        row = self.db.execute('SELECT kind,object_id,payload FROM pending LIMIT 1').fetchone()
        if row:
            self.db.execute('DELETE FROM pending WHERE kind=? AND object_id=?', row[:2])
        self.db.commit()
        return json.loads(row[2]) if row else None

    def has_pending(self):
        return self.db.execute('SELECT 1 FROM pending LIMIT 1').fetchone() is not None

    def reserve_job(self, now=None):
        """Coalesce queued jobs across hook processes; expire abandoned claims."""
        now = time.time() if now is None else now
        self.db.execute('CREATE TABLE IF NOT EXISTS scheduled_job '
                        '(id INTEGER PRIMARY KEY, expires REAL)')
        self.db.commit()
        self.db.execute('BEGIN IMMEDIATE')
        self.db.execute('DELETE FROM scheduled_job WHERE expires<=?', (now,))
        inserted = self.db.execute(
            'INSERT OR IGNORE INTO scheduled_job VALUES (1,?)', (now + 3600,)).rowcount
        self.db.commit()
        return bool(inserted)

    def release_job(self):
        self.db.execute('CREATE TABLE IF NOT EXISTS scheduled_job '
                        '(id INTEGER PRIMARY KEY, expires REAL)')
        self.db.execute('DELETE FROM scheduled_job WHERE id=1')
        self.db.commit()


def schedule_pending(api, state, lock_path):
    """Reserve a waiting job while serialized with worker startup/shutdown."""
    with exclusive_lock(lock_path, wait=False) as acquired:
        if acquired and state.has_pending() and state.reserve_job():
            try:
                api.schedule()
            except Exception:
                state.release_job()
                raise


def relevant_hook(hook):
    fields = hook.get('inputFields')
    return not (fields and '.Update.' in hook['type'] and not set(fields) & {
        'tag_ids', 'performer_ids', 'gallery_ids', 'organized'})


def queue_hook(api, state, hook, root=ROOT):
    """Hooks NEVER wait for the worker lock or perform library mutations."""
    if not relevant_hook(hook):
        return
    state.enqueue(hook)
    schedule_pending(api, state, root / 'lynx-tag-bridge.lock')
        # A running worker will consume this event when its mutation returns.


def drain(bridge):
    while True:
        hook = bridge.state.take()
        if hook is None:
            break
        try:
            bridge.hook(hook)
        except Exception:
            bridge.state.enqueue(hook)
            raise


def tokens(value):
    return {part.strip().casefold() for part in str(value or '').split(',') if part.strip()}


class Bridge:
    def __init__(self, api, settings, state, preview=False):
        self.api, self.settings, self.state, self.preview = api, settings, state, preview
        self.changed = 0
        self.added = 0
        self.scanned = 0

    def source(self, kind, obj, allow_key):
        inherited = self.state.inherited(kind, obj['id'])
        allowed = tokens(self.settings[allow_key])
        excluded = tokens(self.settings['excluded'])
        result = set()
        for tag in obj.get('tags', []):
            identifier = str(tag['id'])
            keys = {tag['name'].casefold(), '#' + identifier}
            if identifier not in inherited and not (keys & excluded) and (
                    not allowed or keys & allowed):
                result.add(identifier)
        return result

    def desired(self, kind, obj):
        wanted = set()
        key = {'Scene': 'performerScenes', 'Image': 'performerImages',
               'Gallery': 'performerGalleries'}[kind]
        if self.settings[key]:
            for performer in obj.get('performers', []):
                wanted |= self.source('Performer', performer, 'performerAllow')
        if kind == 'Image' and self.settings['galleryImages']:
            for ref in obj.get('galleries', []):
                gallery = self.api.get('Gallery', ref['id'])
                if gallery:
                    wanted |= self.source('Gallery', gallery, 'galleryAllow')
        if kind == 'Gallery' and self.settings['imagesGallery']:
            images = self.api.list('Image', {'galleries': {'value': [str(obj['id'])],
                                                          'modifier': 'INCLUDES'}})
            collected = None
            for image in images:
                tags = self.source('Image', image, 'imageAllow')
                if collected is None:
                    collected = tags
                elif self.settings['imagesAll']:
                    collected &= tags
                else:
                    collected |= tags
            wanted |= collected or set()
        return wanted

    def process(self, kind, obj):
        if not obj:
            return
        self.scanned += 1
        if self.settings['skipOrganized'] and obj.get('organized'):
            return
        existing = {str(t['id']) for t in obj.get('tags', [])}
        missing = self.desired(kind, obj) - existing
        if not missing:
            return
        self.changed += 1
        self.added += len(missing)
        prefix = 'PLANNED' if self.preview else 'ADDING'
        log('%s %s #%s (%s): tag IDs %s' %
            (prefix, kind, obj['id'], obj.get('title') or '', ', '.join(sorted(missing))))
        if self.preview:
            return
        old = self.state.inherited(kind, obj['id'])
        self.state.remember(kind, obj['id'], missing)
        try:
            self.api.add(kind, obj['id'], missing)
        except Exception:
            # Keep only tags that actually reached Stash (timeout may occur after commit).
            current = self.api.get(kind, obj['id'])
            present = {str(t['id']) for t in (current or {}).get('tags', [])}
            self.state.forget(kind, obj['id'], missing - old - present)
            raise

    def run_all(self):
        # Sources never include inherited tags, so a single pass is enough.
        for kind in ('Gallery', 'Image', 'Scene'):
            enabled = (self.settings[{'Gallery': 'performerGalleries', 'Image': 'performerImages',
                                      'Scene': 'performerScenes'}[kind]] or
                       (kind == 'Gallery' and self.settings['imagesGallery']) or
                       (kind == 'Image' and self.settings['galleryImages']))
            if enabled:
                for obj in self.api.list(kind):
                    self.process(kind, obj)

    def hook(self, hook):
        kind = hook['type'].split('.')[0]
        identifier = str(hook['id'])
        fields = hook.get('inputFields')
        if fields and '.Update.' in hook['type'] and not set(fields) & {
                'tag_ids', 'performer_ids', 'gallery_ids', 'organized'}:
            return
        if kind == 'Performer':
            for target, flag in [('Scene', 'performerScenes'), ('Image', 'performerImages'),
                                 ('Gallery', 'performerGalleries')]:
                if self.settings[flag]:
                    for obj in self.api.list(target, {'performers': {'value': [identifier],
                                                                    'modifier': 'INCLUDES'}}):
                        self.process(target, obj)
        else:
            obj = self.api.get(kind, identifier)
            if not obj:
                return
            self.process(kind, obj)
            if kind == 'Gallery' and self.settings['galleryImages']:
                for image in self.api.list('Image', {'galleries': {'value': [identifier],
                                                                 'modifier': 'INCLUDES'}}):
                    self.process('Image', image)
            if kind == 'Image' and self.settings['imagesGallery']:
                for gallery in obj.get('galleries', []):
                    self.process('Gallery', self.api.get('Gallery', gallery['id']))


def main():
    payload = json.load(sys.stdin)
    args = payload.get('args', {})
    api = API(payload['server_connection'])
    configured = api.gql('{configuration{plugins}}')['configuration']['plugins'] or {}
    settings = {**DEFAULTS, **configured.get(PLUGIN_ID, {})}
    mode = args.get('mode')
    if mode not in ('preview', 'apply') and not settings['automatic']:
        return {'output': 'Automation disabled.'}
    state = State(ROOT / 'lynx-tag-bridge.sqlite3')
    try:
        if args.get('hookContext'):
            queue_hook(api, state, args['hookContext'])
            return {'output': 'Change queued for background processing.'}
        with exclusive_lock(ROOT / 'lynx-tag-bridge.lock'):
            bridge = Bridge(api, settings, state, preview=mode == 'preview')
            if mode in ('preview', 'apply'):
                bridge.run_all()
            if not bridge.preview and settings['automatic']:
                drain(bridge)
            summary = '%s objects checked; %s objects, %s tag additions %s.' % (
                bridge.scanned, bridge.changed, bridge.added,
                'planned' if bridge.preview else 'performed')
            log(summary)
        # Close the handoff race: events inserted just before releasing the lock
        # must get a job even if their hook saw the worker as still running.
        if not bridge.preview and settings['automatic'] and state.has_pending():
            api.schedule()
        return {'output': summary}
    finally:
        state.close()


if __name__ == '__main__':
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except Exception as exc:
        log(str(exc), 'e')
        print(json.dumps({'error': str(exc)}))
        sys.exit(1)
