"""Performer inheritance and safe gallery-studio inheritance.

Persist the origin BEFORE writes: images -> gallery additions are never sources
for gallery -> images, and vice versa. Never replace entire performer lists.
"""
import contextlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import time
import urllib.request

PLUGIN_ID = 'LynxPerformerBridge'
ROOT = Path(__file__).resolve().parent
TASK = 'Lynx – bearbeta performer-kön'
BATCH = 100


def log(message, level='i'):
    print('\x01' + level + '\x02' + message, file=sys.stderr, flush=True)


@contextlib.contextmanager
def lock(path, wait=False):
    with open(path, 'a+b') as handle:
        handle.seek(0, 2)
        if not handle.tell():
            handle.write(b'0')
            handle.flush()
        deadline = time.monotonic() + 10
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
                if not wait or time.monotonic() >= deadline:
                    yield False
                    return
                time.sleep(.1)
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
        host = connection.get('Host') or 'localhost'
        if host in ('0.0.0.0', '::'):
            host = 'localhost'
        if ':' in host and not host.startswith('['):
            host = '[' + host + ']'
        self.url = f"{connection.get('Scheme', 'http')}://{host}:{connection.get('Port', 9999)}/graphql"
        self.headers = {'Content-Type': 'application/json'}
        cookie = connection.get('SessionCookie') or {}
        if cookie.get('Value'):
            self.headers['Cookie'] = cookie.get('Name', 'session') + '=' + cookie['Value']
        if connection.get('ApiKey'):
            self.headers['ApiKey'] = connection['ApiKey']

    def gql(self, query, variables=None):
        req = urllib.request.Request(self.url, data=json.dumps({'query': query, 'variables': variables or {}}).encode(), headers=self.headers)
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.load(response)
        if result.get('errors'):
            raise RuntimeError(json.dumps(result['errors'], ensure_ascii=False))
        return result['data']

    @staticmethod
    def fields(kind):
        return 'id title performers{id name} studio{id name}' + (' galleries{id}' if kind == 'Image' else '')

    def get(self, kind, identifier):
        key = 'find' + kind
        return self.gql('query($id:ID!){%s(id:$id){%s}}' % (key, self.fields(kind)), {'id': str(identifier)})[key]

    def images(self, gallery):
        page = 1
        while True:
            items = self.gql('query($f:FindFilterType!,$c:ImageFilterType!){findImages(filter:$f,image_filter:$c){images{%s}}}' % self.fields('Image'),
                {'f': {'page': page, 'per_page': BATCH, 'sort': 'id', 'direction': 'ASC'},
                 'c': {'galleries': {'value': [str(gallery)], 'modifier': 'INCLUDES'}}})['findImages']['images']
            yield items
            if len(items) < BATCH:
                break
            page += 1

    def add(self, kind, objects, performers):
        key = 'bulk' + kind + 'Update'
        return self.gql('mutation($input:Bulk%sUpdateInput!){%s(input:$input){id}}' % (kind, key),
            {'input': {'ids': [str(o['id']) for o in objects], 'clientMutationId': PLUGIN_ID,
                       'performer_ids': {'mode': 'ADD', 'ids': sorted(performers)}}})

    def set_image_studio(self, images, studio_id):
        return self.gql('mutation($input:BulkImageUpdateInput!){bulkImageUpdate(input:$input){id}}',
            {'input': {'ids': [str(image['id']) for image in images],
                       'clientMutationId': PLUGIN_ID, 'studio_id': str(studio_id)}})

    def schedule(self):
        return self.gql('mutation($id:ID!,$task:String!){runPluginTask(plugin_id:$id,task_name:$task)}',
                        {'id': PLUGIN_ID, 'task': TASK})


class State:
    def __init__(self, path):
        self.db = sqlite3.connect(path, timeout=10)
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS inherited(kind TEXT,object_id TEXT,performer_id TEXT,PRIMARY KEY(kind,object_id,performer_id));
            CREATE TABLE IF NOT EXISTS pending(kind TEXT,object_id TEXT,revision INTEGER,PRIMARY KEY(kind,object_id));
            CREATE TABLE IF NOT EXISTS job(id INTEGER PRIMARY KEY,expires REAL);
            CREATE TABLE IF NOT EXISTS inherited_studio(image_id TEXT PRIMARY KEY,gallery_id TEXT,studio_id TEXT);
        ''')

    def owned(self, kind, identifier):
        return {r[0] for r in self.db.execute('SELECT performer_id FROM inherited WHERE kind=? AND object_id=?', (kind, str(identifier)))}

    def remember(self, kind, records):
        self.db.executemany('INSERT OR IGNORE INTO inherited VALUES(?,?,?)',
            [(kind, str(identifier), str(p)) for identifier, ids in records for p in ids])
        self.db.commit()

    def prune(self, kind, identifier, present):
        gone = self.owned(kind, identifier) - present
        self.db.executemany('DELETE FROM inherited WHERE kind=? AND object_id=? AND performer_id=?',
                            [(kind, str(identifier), p) for p in gone])
        self.db.commit()

    def studio_origin(self, image_id):
        return self.db.execute('SELECT gallery_id,studio_id FROM inherited_studio WHERE image_id=?',
                               (str(image_id),)).fetchone()

    def remember_studios(self, gallery_id, images, studio_id):
        self.db.executemany('INSERT INTO inherited_studio VALUES(?,?,?) '
                            'ON CONFLICT(image_id) DO UPDATE SET gallery_id=excluded.gallery_id,studio_id=excluded.studio_id',
                            [(str(image['id']), str(gallery_id), str(studio_id)) for image in images])
        self.db.commit()

    def forget_studio(self, image_id):
        self.db.execute('DELETE FROM inherited_studio WHERE image_id=?', (str(image_id),))
        self.db.commit()

    def enqueue(self, kind, identifier):
        self.db.execute('INSERT INTO pending VALUES(?,?,1) ON CONFLICT(kind,object_id) DO UPDATE SET revision=revision+1', (kind, str(identifier)))
        self.db.commit()

    def take(self):
        # Retain pending rows until work succeeds. Crash/timeout can be resumed.
        return self.db.execute('SELECT kind,object_id,revision FROM pending ORDER BY kind,object_id LIMIT 1').fetchone()

    def ack(self, event):
        self.db.execute('DELETE FROM pending WHERE kind=? AND object_id=? AND revision=?', event)
        self.db.commit()

    def reserve(self):
        self.db.execute('BEGIN IMMEDIATE')
        self.db.execute('DELETE FROM job WHERE expires<=?', (time.time(),))
        inserted = self.db.execute('INSERT OR IGNORE INTO job VALUES(1,?)', (time.time() + 3600,)).rowcount
        self.db.commit()
        return bool(inserted)

    def release(self):
        self.db.execute('DELETE FROM job')
        self.db.commit()

    def close(self):
        self.db.close()


def ids(obj):
    return {str(p['id']) for p in obj.get('performers', [])}


def studio_id(obj):
    return str((obj.get('studio') or {}).get('id') or '')


class Bridge:
    def __init__(self, api, state, preview=False):
        self.api, self.state, self.preview = api, state, preview
        self.overlay = {}
        self.objects = self.links = self.calls = 0
        self.studio_images = self.studio_calls = self.studio_conflicts = 0
        self.studio_overlay = {}

    def copy_gallery_studio(self, gallery, images, agreed_multi_gallery=False):
        target = studio_id(gallery)
        if not target:
            return
        selected = []
        for image in images:
            if len(image.get('galleries') or []) > 1 and not agreed_multi_gallery:
                # A gallery update alone cannot establish which of several
                # different gallery studios should win.
                self.studio_conflicts += 1
                continue
            identifier = str(image['id'])
            current = self.studio_overlay.get(identifier, studio_id(image))
            origin = self.state.studio_origin(identifier)
            # An inherited value can follow later gallery-studio changes. Never
            # replace a different studio that was set manually or by another gallery.
            if current == target:
                continue
            if current and not (origin and origin == (str(gallery['id']), current)):
                self.studio_conflicts += 1
                continue
            selected.append(image)
        if not selected:
            return
        self.studio_images += len(selected)
        log('%s gallery #%s studio #%s on %s images' %
            ('PLANNED' if self.preview else 'SETTING', gallery['id'], target, len(selected)))
        if self.preview:
            self.studio_overlay.update({str(image['id']): target for image in selected})
            return
        # Write provenance first so synchronous post hooks cannot treat these
        # changes as manual edits. Preserve successful writes after partial errors.
        previous = {str(image['id']): self.state.studio_origin(image['id']) for image in selected}
        self.state.remember_studios(gallery['id'], selected, target)
        try:
            self.api.set_image_studio(selected, target)
        except Exception:
            for image in selected:
                fresh = self.api.get('Image', image['id'])
                if not fresh or studio_id(fresh) != target:
                    old = previous[str(image['id'])]
                    if old:
                        self.state.remember_studios(old[0], [image], old[1])
                    else:
                        self.state.forget_studio(image['id'])
            raise
        self.studio_calls += 1

    def direct(self, kind, obj):
        return ids(obj) - self.state.owned(kind, obj['id']) - self.overlay.get((kind, str(obj['id'])), set())

    def add_many(self, kind, objects, wanted):
        groups = {}
        for obj in objects:
            missing = wanted - ids(obj) - self.overlay.get((kind, str(obj['id'])), set())
            if missing:
                groups.setdefault(tuple(sorted(missing)), []).append(obj)
        for performers, targets in groups.items():
            needed = set(performers)
            self.objects += len(targets)
            self.links += len(targets) * len(needed)
            log('%s %s: %s objects, performer-ID %s' % ('PLANNED' if self.preview else 'ADDING', kind, len(targets), ', '.join(performers)))
            if self.preview:
                for obj in targets:
                    self.overlay.setdefault((kind, str(obj['id'])), set()).update(needed)
                continue
            # Hooks can run synchronously during mutation: save origins first.
            self.state.remember(kind, [(o['id'], needed) for o in targets])
            try:
                self.api.add(kind, targets, needed)
            except Exception:
                # Failure/timeout may follow partial commit; preserve only origins
                # that actually exist. Never remove any Stash performer links.
                for obj in targets:
                    fresh = self.api.get(kind, obj['id'])
                    if fresh is not None:
                        self.state.prune(kind, obj['id'], ids(fresh))
                raise
            self.calls += 1

    def gallery(self, identifier):
        gallery = self.api.get('Gallery', identifier)
        if not gallery:
            log('Gallery #%s no longer exists; skipping.' % identifier, 'w')
            return
        if not self.preview:
            self.state.prune('Gallery', identifier, ids(gallery))
        down = self.direct('Gallery', gallery)
        # Gallery reads are cached only inside this pass; ADD never overwrites edits.
        for images in self.api.images(identifier):
            self.copy_gallery_studio(gallery, images)
            self.add_many('Image', images, down)
            up = set()
            for image in images:
                up.update(self.direct('Image', image))
            self.add_many('Gallery', [gallery], up)
            if not self.preview:
                gallery = self.api.get('Gallery', identifier)
                if not gallery:
                    break

    def image(self, identifier):
        image = self.api.get('Image', identifier)
        if not image:
            return
        if not self.preview:
            self.state.prune('Image', identifier, ids(image))
        up = self.direct('Image', image)
        down = set()
        studio_galleries = []
        for ref in image.get('galleries', []):
            gallery = self.api.get('Gallery', ref['id'])
            if gallery:
                if studio_id(gallery):
                    studio_galleries.append(gallery)
                down.update(self.direct('Gallery', gallery))
                self.add_many('Gallery', [gallery], up)
        if len({studio_id(gallery) for gallery in studio_galleries}) == 1 and studio_galleries:
            self.copy_gallery_studio(studio_galleries[0], [image], agreed_multi_gallery=True)
        elif len({studio_id(gallery) for gallery in studio_galleries}) > 1:
            self.studio_conflicts += 1
        # Newly linked images inherit explicit gallery performers, too.
        self.add_many('Image', [image], down)


def schedule(api, state, path):
    with lock(path) as acquired:
        if acquired and state.take() and state.reserve():
            try:
                api.schedule()
            except Exception:
                state.release()
                raise


def queue_hook(api, state, hook, path):
    kind = str(hook.get('type', '')).split('.')[0]
    identifier = str(hook.get('id', ''))
    if kind not in ('Gallery', 'Image') or not re.fullmatch(r'[1-9]\d*', identifier):
        return
    fields = hook.get('inputFields')
    incoming = hook.get('input') or {}
    if kind == 'Image' and 'studio_id' in set(fields or []) and incoming.get('clientMutationId') != PLUGIN_ID:
        state.forget_studio(identifier)
    relevant = {'performer_ids', 'gallery_ids'} | ({'studio_id', 'image_ids'} if kind == 'Gallery' else set())
    if '.Update.' in hook['type'] and fields and not set(fields) & relevant:
        return
    if incoming.get('clientMutationId') in (PLUGIN_ID, 'LynxPerformerMatcher'):
        return
    changes = incoming.get('performer_ids')
    if isinstance(changes, dict) and changes.get('mode') == 'ADD' and not set(fields or []) & {'gallery_ids'}:
        added = set(map(str, changes.get('ids') or []))
        if added and added <= state.owned(kind, identifier):
            return
    state.enqueue(kind, identifier)
    schedule(api, state, path)


def scope(value):
    parts = [p.strip() for p in str(value or '').split(',') if p.strip()]
    if not parts or len(parts) > 100 or any(not re.fullmatch(r'[1-9]\d*', p) for p in parts):
        raise ValueError('Enter 1–100 gallery IDs in Manual gallery selection. Empty never processes the entire library.')
    return list(dict.fromkeys(parts))


def main(payload):
    args = payload.get('args') or {}
    api = API(payload['server_connection'])
    settings = (api.gql('{configuration{plugins}}')['configuration']['plugins'] or {}).get(PLUGIN_ID) or {}
    mode = args.get('mode')
    if mode not in ('queued', 'preview', 'apply') and not args.get('hookContext'):
        raise ValueError('Unknown operation mode.')
    if args.get('hookContext') and settings.get('automatic') is not True:
        return {'output': 'Automation disabled.'}
    selected = scope(settings.get('galleryIds')) if mode in ('preview', 'apply') else []
    state = State(ROOT / 'performer-bridge.sqlite3')
    path = ROOT / 'performer-bridge.lock'
    try:
        if args.get('hookContext'):
            try:
                queue_hook(api, state, args['hookContext'], path)
            except Exception as error:
                log('The performer change is already saved. Could not start the queue: %s. Run Process performer queue manually.' % error, 'w')
                return {'output': 'Could not start the queue; see the log.'}
            return {'output': 'Change handled.'}
        with lock(path, wait=True) as acquired:
            if not acquired:
                return {'output': 'Another performer transfer is running. The queue is preserved.'}
            bridge = Bridge(api, state, preview=mode == 'preview')
            if not bridge.preview:
                state.release()
            for identifier in selected:
                bridge.gallery(identifier)
            # A manually started queue task also resumes failed work when auto is off.
            if mode == 'queued' or mode == 'apply' and settings.get('automatic') is True:
                while (event := state.take()) is not None:
                    kind, identifier, revision = event
                    (bridge.gallery if kind == 'Gallery' else bridge.image)(identifier)
                    state.ack(event)
            summary = ('%s objects, %s performer links %s; %s performer bulk calls; '
                       '%s image studios %s, %s studio bulk calls, %s studio conflicts skipped. No removals.') % (
                           bridge.objects, bridge.links, 'planned' if bridge.preview else 'added', bridge.calls,
                           bridge.studio_images, 'planned' if bridge.preview else 'set', bridge.studio_calls,
                           bridge.studio_conflicts)
            log(summary)
        if mode != 'preview' and settings.get('automatic') is True:
            schedule(api, state, path)
        return {'output': summary}
    finally:
        state.close()



import sys as _lynx_sys
from pathlib import Path as _LynxPath
_lynx_sys.path.insert(0,str(_LynxPath(__file__).resolve().parents[2]))
from backend_adapter import adapt_api as _lynx_adapt
_lynx_adapt(API)

if __name__ == '__main__':
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    try:
        print(json.dumps(main(json.load(sys.stdin)), ensure_ascii=False))
    except Exception as error:
        log(str(error), 'e')
        print(json.dumps({'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
