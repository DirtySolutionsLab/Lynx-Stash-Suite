"""Offline tests: python -m unittest -v test_plugin.py"""
import contextlib
import io
import unittest
import tempfile
from unittest.mock import patch
import missing_performer_images as p


def image(i, width=800, height=1200):
    return {"id": str(i), "files": [{"width": width, "height": height}],
            "paths": {"image": "http://localhost:9999/image/%s/image" % i}}


class FakeClient:
    def __init__(self, count=1):
        self.people = {str(i): {"id": str(i), "name": "Person " + str(i)} for i in range(1, count + 1)}
        self.direct = [image(10)]
        self.gallery = [image(20, 1600, 2400)]
        self.existing = set()
        self.bad = set()
        self.mutations = []
        self.calls = []
        self.race = False
        self.fail_check = False
        self.fail_update = False

    def gql(self, query, variables):
        self.calls.append(query)
        if query == p.MISSING:
            people = [v for k, v in self.people.items() if k not in self.existing]
            start = (variables["page"] - 1) * 100
            return {"findPerformers": {"count": len(people), "performers": people[start:start + 100]}}
        if query == p.CHECK:
            if self.fail_check:
                raise RuntimeError("check failed")
            people = [self.people[i] for i in variables["ids"] if i in self.people and i not in self.existing]
            return {"findPerformers": {"count": len(people), "performers": people}}
        if query == p.IMAGES:
            items = self.direct if "performers" in variables["criteria"] else self.gallery
            start = (variables["page"] - 1) * 100
            return {"findImages": {"count": len(items), "images": items[start:start + 100]}}
        if query == p.GALLERIES:
            return {"findGalleries": {"count": 1, "galleries": [{"id": "9"}]}}
        if query == p.UPDATE:
            self.mutations.append(variables["input"])
            if self.fail_update:
                raise TimeoutError("unknown outcome")
            pid = variables["input"]["id"]
            if pid in self.existing:
                raise AssertionError("attempted overwrite")
            self.existing.add(pid)
            return {"performerUpdate": {"id": pid}}
        raise AssertionError("unexpected query")

    def download(self, candidate):
        if candidate["id"] in self.bad:
            raise RuntimeError("unavailable")
        if self.race:
            self.existing.add("1")
        return "data:image/jpeg;base64," + candidate["id"]


class PluginTests(unittest.TestCase):
    def setUp(self):
        self.logs = contextlib.redirect_stderr(io.StringIO())
        self.logs.__enter__()

    def tearDown(self):
        self.logs.__exit__(None, None, None)

    def test_portrait_before_larger_landscape(self):
        self.assertEqual(p.ranked([image(1, 4000, 2000), image(2, 500, 800)])[0]["id"], "2")

    def test_resolution_then_stable_id(self):
        self.assertEqual([i["id"] for i in p.ranked([image(3), image(2), image(4, 1200, 1800)])], ["4", "2", "3"])

    def test_direct_precedence(self):
        c = FakeClient()
        p.run(c, "assign")
        self.assertTrue(c.mutations[0]["image"].endswith("10"))
        self.assertNotIn(p.GALLERIES, c.calls)
        self.assertEqual(set(c.mutations[0]), {"id", "image"})

    def test_gallery_fallback(self):
        c = FakeClient()
        c.direct = []
        p.run(c, "assign")
        self.assertTrue(c.mutations[0]["image"].endswith("20"))

    def test_failed_direct_download_fallback(self):
        c = FakeClient()
        c.bad.add("10")
        p.run(c, "assign")
        self.assertTrue(c.mutations[0]["image"].endswith("20"))

    def test_preview_no_mutations(self):
        c = FakeClient()
        self.assertEqual(p.run(c, "preview")["previewed"], 1)
        self.assertEqual(c.mutations, [])

    def test_existing_never_updated(self):
        c = FakeClient()
        c.existing.add("1")
        self.assertEqual(p.process(c, c.people["1"], "assign"), "skipped")
        self.assertEqual(c.mutations, [])

    def test_image_added_during_download(self):
        c = FakeClient()
        c.race = True
        self.assertEqual(p.run(c, "assign")["skipped"], 1)
        self.assertEqual(c.mutations, [])

    def test_check_failure_blocks_write(self):
        c = FakeClient()
        c.fail_check = True
        self.assertEqual(p.run(c, "assign")["errors"], 1)
        self.assertEqual(c.mutations, [])

    def test_mutation_timeout_no_retry(self):
        c = FakeClient()
        c.fail_update = True
        self.assertEqual(p.run(c, "assign")["errors"], 1)
        self.assertEqual(len(c.mutations), 1)

    def test_missing_pagination_does_not_skip(self):
        c = FakeClient(205)
        self.assertEqual(p.run(c, "assign")["assigned"], 205)
        self.assertEqual(len(c.mutations), 205)

    def test_candidate_pagination(self):
        c = FakeClient()
        c.direct = [image(i, 500, 800) for i in range(101)] + [image(200, 2000, 3000)]
        p.run(c, "assign")
        self.assertTrue(c.mutations[0]["image"].endswith("200"))

    def test_no_candidates(self):
        c = FakeClient()
        c.direct = c.gallery = []
        self.assertEqual(p.run(c, "assign")["no_candidate"], 1)
        self.assertEqual(c.mutations, [])

    def test_idempotent_second_run(self):
        c = FakeClient()
        p.run(c, "assign")
        self.assertEqual(p.run(c, "assign")["assigned"], 0)
        self.assertEqual(len(c.mutations), 1)

    def test_reject_invalid_mode(self):
        with self.assertRaises(ValueError):
            p.run(FakeClient(), "delete")

    def test_image_signature(self):
        self.assertEqual(p.image_mime(b"\xff\xd8\xff\x00"), "image/jpeg")
        with self.assertRaises(RuntimeError):
            p.image_mime(b"<html>login</html>")

    def test_connection_and_cookie(self):
        c = p.Client({"Host": "0.0.0.0", "Port": 9999, "Scheme": "http",
                      "SessionCookie": {"Name": "session", "Value": "test"}})
        self.assertEqual(c.base, "http://localhost:9999")
        self.assertEqual(c.headers["Cookie"], "session=test")

    def test_double_run_lock(self):
        with tempfile.TemporaryDirectory(dir=p.Path(__file__).resolve().parent) as folder:
            with patch.object(p, "__file__", str(p.Path(folder) / "missing_performer_images.py")):
                with p.single_run():
                    with self.assertRaises(RuntimeError):
                        with p.single_run():
                            self.fail("Lock allowed two simultaneous runs")


if __name__ == "__main__":
    unittest.main()
