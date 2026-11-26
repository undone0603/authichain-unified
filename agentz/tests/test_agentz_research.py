"""agentz.core.research: search -> isolated-browser reads -> cited, untrusted sources."""
import json
import unittest

import subprocess

from agentz.core.web_research import research, search_results

SNAP = '- heading "Title" [level=1]\n- paragraph\n  - StaticText "Body text"\n- link "x" [ref=e1]'


def fake_search(results, *, structured=True):
    def search(q):
        if structured:
            return {"ok": True, "structured_content": {"results": results}, "content": ["not json"]}
        return {"ok": True, "structured_content": None, "content": [json.dumps({"results": results})]}
    return search


class ResearchTests(unittest.TestCase):
    def test_structured_results_preferred_and_https_only_deduped(self):
        raw = {"structured_content": {"results": [
            {"url": "https://a.example/1"}, {"url": "http://insecure.example"},
            {"url": "https://a.example/1"}, {"url": "https://b.example/2"}]},
            "content": [json.dumps({"results": [{"url": "https://ignored.example"}]})]}
        self.assertEqual([r["url"] for r in search_results(raw)],
                         ["https://a.example/1", "https://b.example/2"])

    def test_text_block_fallback(self):
        raw = {"structured_content": None, "content": ["junk", json.dumps({"results": [{"url": "https://c.example"}]})]}
        self.assertEqual([r["url"] for r in search_results(raw)], ["https://c.example"])

    def test_reads_top_n_and_marks_untrusted(self):
        visited = []
        def nav(url):
            visited.append(url)
            return {"snapshot": SNAP}
        out = research("battery passport vendors", 2,
                       search=fake_search([{"url": f"https://s{i}.example", "title": f"S{i}"} for i in range(4)]),
                       navigate=nav)
        self.assertEqual(visited, ["https://s0.example", "https://s1.example"])
        self.assertEqual(out["read"], 2)
        self.assertFalse(out["trusted"])
        self.assertIn('"Body text"', out["sources"][0]["text"])

    def test_navigation_errors_are_reported_not_raised(self):
        def nav(url):
            raise RuntimeError("navigation failed")
        out = research("q", 1, search=fake_search([{"url": "https://x.example"}], structured=False), navigate=nav)
        self.assertEqual(out["read"], 0)
        self.assertIn("navigation failed", out["sources"][0]["error"])

    def test_aria_paragraph_text_is_kept(self):
        snap = '- heading "Title" [level=1]\n- paragraph: The actual article body.'
        out = research("q", 1, search=fake_search([{"url": "https://p.example"}]), navigate=lambda u: {"snapshot": snap})
        self.assertIn("The actual article body.", out["sources"][0]["text"])

    def test_browser_timeout_is_a_per_source_error(self):
        calls = []
        def nav(url):
            calls.append(url)
            if url.endswith("slow.example"):
                raise subprocess.TimeoutExpired(cmd="agent-browser", timeout=45)
            return {"snapshot": "- paragraph: ok"}
        out = research("q", 2, search=fake_search([{"url": "https://slow.example"}, {"url": "https://fast.example"}]),
                       navigate=nav)
        self.assertEqual(len(calls), 2)
        self.assertIn("TimeoutExpired", out["sources"][0]["error"])
        self.assertEqual(out["read"], 1)

    def test_original_research_module_is_untouched(self):
        from agentz.core import research as legacy
        self.assertTrue(hasattr(legacy, "research_lead_context"))

    def test_input_validation(self):
        for bad in ("", " ", "x" * 501):
            with self.assertRaises(ValueError):
                research(bad, 1, search=fake_search([]), navigate=lambda u: {})
        for n in (0, 6, "3"):
            with self.assertRaises(ValueError):
                research("q", n, search=fake_search([]), navigate=lambda u: {})

    def test_failed_search_raises(self):
        with self.assertRaises(RuntimeError):
            research("q", 1, search=lambda q: {"ok": False}, navigate=lambda u: {})


if __name__ == "__main__":
    unittest.main()
