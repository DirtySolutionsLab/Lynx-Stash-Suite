"""Offline regression tests. Never connect to Stash or edit real library data."""
import copy
import importlib.util
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


links = load('scoped_links', 'engines/performerLinks/lynx_performer_bridge.py')
tags = load('scoped_tags', 'engines/tagTransfer/lynx_tag_bridge.py')
dispatch = load('scoped_dispatch', 'dispatch.py')


def obj(identifier, performers=(), galleries=()):
    return {'id': str(identifier), 'performers': [{'id': str(p)} for p in performers],
            'galleries': [{'id': str(g)} for g in galleries], 'studio': None}


class FakeAPI:
    def __init__(self):
        self.records = {('Gallery', '1'): obj(1, [10]),
                        ('Gallery', '2'): obj(2, [99]),
                        ('Image', '3'): obj(3, [], [1]),
                        ('Image', '4'): obj(4, [], [2])}
        self.reads, self.writes = [], []

    def get(self, kind, identifier):
        self.reads.append((kind, str(identifier)))
        return copy.deepcopy(self.records.get((kind, str(identifier))))

    def images(self, gallery):
        records = [copy.deepcopy(o) for (kind, _), o in self.records.items()
                   if kind == 'Image' and {'id': str(gallery)} in o['galleries']]
        for start in range(0, len(records), links.BATCH):
            yield records[start:start + links.BATCH]

    def add(self, kind, objects, performers):
        self.writes.append((kind, [o['id'] for o in objects], set(performers)))
        for o in objects:
            target = self.records[kind, o['id']]
            existing = links.ids(target)
            target['performers'] += [{'id': p} for p in performers - existing]


class ScopedTransfers(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.state = links.State(self.path / 'performer-bridge.sqlite3')
        self.api = FakeAPI()

    def tearDown(self):
        self.state.close()
        self.temp.cleanup()

    def bridge(self, **settings):
        return links.Bridge(self.api, self.state, settings={'galleryStudio': False, **settings})

    def test_gallery_only_touches_own_images(self):
        self.bridge().gallery('1')
        self.assertEqual(self.api.writes, [('Image', ['3'], {'10'})])
        self.assertNotIn(('Gallery', '2'), self.api.reads)
        self.assertFalse(links.ids(self.api.records['Image', '4']))

    def test_reverse_off_by_default(self):
        self.api.records['Image', '3']['performers'] = [{'id': '20'}]
        self.bridge().gallery('1')
        self.assertEqual(links.ids(self.api.records['Gallery', '1']), {'10'})

    def test_reverse_can_be_enabled(self):
        self.api.records['Image', '3']['performers'] = [{'id': '20'}]
        self.bridge(imagesToGallery=True, galleryToImages=False).image('3')
        self.assertEqual(links.ids(self.api.records['Gallery', '1']), {'10', '20'})

    def test_inherited_performer_not_echoed_up(self):
        self.api.records['Image', '3']['performers'] = [{'id': '20'}]
        self.state.remember('Image', [('3', {'20'})])
        self.bridge(imagesToGallery=True, galleryToImages=False).image('3')
        self.assertEqual(self.api.writes, [])

    def test_disabled_down_route(self):
        self.bridge(galleryToImages=False).gallery('1')
        self.assertEqual(self.api.writes, [])

    def test_idempotent_second_pass(self):
        bridge = self.bridge()
        bridge.gallery('1')
        bridge.gallery('1')
        self.assertEqual(len(self.api.writes), 1)

    def test_many_images_use_bulk_updates_without_gallery_rereads(self):
        for identifier in range(100, 350):
            self.api.records['Image', str(identifier)] = obj(identifier, [], [1])
        self.bridge().gallery('1')
        self.assertEqual(len(self.api.writes), 3)
        self.assertEqual(self.api.reads, [('Gallery', '1')])

    def test_preview_does_not_write_metadata_or_provenance(self):
        bridge = links.Bridge(self.api, self.state, preview=True, settings={'galleryStudio': False})
        bridge.gallery('1')
        self.assertEqual(self.api.writes, [])
        self.assertEqual(self.state.owned('Image', '3'), set())
        self.assertEqual(bridge.links, 1)

    def test_revision_ack_retains_newer_edit(self):
        self.state.enqueue('Gallery', '1')
        event = self.state.take()
        self.state.enqueue('Gallery', '1')
        self.state.ack(event)
        self.assertEqual(self.state.take(), ('Gallery', '1', 2))

    def test_legacy_backlog_archived_once_without_touching_provenance(self):
        path = self.path / 'legacy.sqlite3'
        db = sqlite3.connect(path)
        db.executescript("CREATE TABLE pending(kind TEXT,object_id TEXT,revision INTEGER,PRIMARY KEY(kind,object_id));"
                         "INSERT INTO pending VALUES('Image','999',1);"
                         "CREATE TABLE inherited(kind TEXT,object_id TEXT,performer_id TEXT,PRIMARY KEY(kind,object_id,performer_id));"
                         "INSERT INTO inherited VALUES('Image','999','10');")
        db.close()
        state = links.State(path)
        self.assertIsNone(state.take())
        self.assertEqual(state.db.execute('SELECT COUNT(*) FROM archived_pending').fetchone()[0], 1)
        self.assertEqual(state.owned('Image', '999'), {'10'})
        state.enqueue('Gallery', '1')
        state.close()
        state = links.State(path)
        self.assertEqual(state.take(), ('Gallery', '1', 1))
        state.close()

    def run_main(self, mode):
        fake = self.api
        fake.gql = lambda *a, **k: {'configuration': {'plugins': {
            'LynxPerformerBridge': {'automatic': True, 'galleryIds': '1', 'galleryStudio': False}}}}
        with patch.object(links, 'ROOT', self.path), patch.object(links, 'API', lambda c: fake), patch.object(links, 'schedule') as schedule:
            result = links.main({'server_connection': {}, 'args': {'mode': mode}})
        return result, schedule

    def test_manual_apply_does_not_drain_or_schedule_unrelated_pending(self):
        self.state.enqueue('Gallery', '2')
        result, schedule = self.run_main('apply')
        self.assertEqual(self.state.take(), ('Gallery', '2', 1))
        schedule.assert_not_called()
        self.assertNotIn(('Gallery', '2'), self.api.reads)

    def test_worker_does_not_consume_events_created_during_pass(self):
        self.state.enqueue('Gallery', '1')
        original = self.api.add
        def add(*args):
            original(*args)
            self.state.enqueue('Gallery', '2')
        self.api.add = add
        self.run_main('queued')
        self.assertEqual(self.state.take(), ('Gallery', '2', 1))
        self.assertNotIn(('Gallery', '2'), self.api.reads)

    def test_failed_worker_preserves_pending(self):
        self.state.enqueue('Gallery', '1')
        self.api.add = lambda *a: (_ for _ in ()).throw(RuntimeError('simulated'))
        with self.assertRaises(RuntimeError):
            self.run_main('queued')
        self.assertEqual(self.state.take(), ('Gallery', '1', 1))

    def dispatch_hook(self, origin=None, fields=None, kind='Image'):
        called = []
        settings = {'links_enabled': True, 'links__automatic': True,
                    'tags_enabled': True, 'tags__automatic': True}
        dispatch.run({'args': {'hookContext': {'type': kind + '.Update.Post', 'id': '3',
                     'inputFields': fields, 'input': {'clientMutationId': origin}}}},
                     configuration={'LynxPerformerSuite': settings},
                     invoke=lambda name, *args: called.append(name))
        return called

    def test_own_performer_writes_skip_link_engine_but_keep_tag_followup(self):
        self.assertEqual(self.dispatch_hook('LynxPerformerBridge', ['performer_ids']), ['tagTransfer'])

    def test_own_tag_writes_start_neither_transfer_engine(self):
        self.assertEqual(self.dispatch_hook('LynxTagBridge', ['tag_ids']), [])

    def test_user_performer_assignment_still_runs_both_engines(self):
        self.assertEqual(self.dispatch_hook(None, ['performer_ids']), ['performerLinks', 'tagTransfer'])

    def test_unrelated_image_edit_starts_neither_engine(self):
        self.assertEqual(self.dispatch_hook(None, ['title']), [])

    def test_performer_edit_never_starts_link_engine(self):
        self.assertEqual(self.dispatch_hook(None, ['tag_ids'], kind='Performer'), ['tagTransfer'])

    def test_tag_hook_recognizes_own_marker(self):
        self.assertFalse(tags.relevant_hook({'type': 'Image.Update.Post', 'input': {'clientMutationId': 'LynxTagBridge'}}))

    def test_tag_add_and_remove_mark_origin(self):
        captured = []
        api = object.__new__(tags.API)
        api.gql = lambda q, v: captured.append(v['input'])
        api.add_many('Image', ['3'], {'10'})
        api.remove_many('Image', ['3'], {'10'})
        self.assertTrue(all(v['clientMutationId'] == 'LynxTagBridge' for v in captured))

    def test_tag_worker_leaves_later_edits_for_next_job(self):
        state = tags.State(self.path / 'tags.sqlite3')
        try:
            state.enqueue({'type': 'Image.Update.Post', 'id': '3'})
            class Worker:
                pass
            worker = Worker()
            worker.state = state
            worker.hook_images = lambda events: state.enqueue({'type': 'Image.Update.Post', 'id': '4'})
            tags.drain(worker)
            self.assertEqual(state.take()['id'], '4')
        finally:
            state.close()

    def test_tag_worker_batches_images(self):
        state = tags.State(self.path / 'tags.sqlite3')
        try:
            for identifier in range(251):
                state.enqueue({'type': 'Image.Update.Post', 'id': str(identifier)})
            class Worker:
                pass
            worker = Worker()
            worker.state = state
            sizes = []
            worker.hook_images = lambda events: sizes.append(len(events))
            tags.drain(worker)
            self.assertEqual(sizes, [250, 1])
            self.assertFalse(state.has_pending())
        finally:
            state.close()

    def test_failed_tag_batch_requeues_work(self):
        state = tags.State(self.path / 'tags.sqlite3')
        try:
            state.enqueue({'type': 'Image.Update.Post', 'id': '3'})
            class Worker:
                pass
            worker = Worker()
            worker.state = state
            worker.hook_images = lambda events: (_ for _ in ()).throw(RuntimeError('simulated'))
            with self.assertRaises(RuntimeError):
                tags.drain(worker)
            self.assertEqual(state.take()['id'], '3')
        finally:
            state.close()


if __name__ == '__main__':
    unittest.main()
