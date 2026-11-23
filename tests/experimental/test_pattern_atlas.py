"""Offline regression tests for the Pattern Atlas candidate/evidence engine."""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'experimental' / 'pattern_atlas.py'
spec = importlib.util.spec_from_file_location('pattern_atlas', SCRIPT)
pa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pa)


def fact(id, kind, value, sources=None, provenance='unspecified'):
    return {'id': id, 'kind': kind, 'value': value, 'claim': f'Fixture claim for {id}',
            'sources': sources or [], 'provenance': provenance}


def payload(*facts, as_of=None):
    value = {'schema': 'pattern-atlas/v1', 'facts': list(facts)}
    if as_of:
        value['as_of'] = as_of
    return value


class PatternAtlasTests(unittest.TestCase):
    def test_reverse_year_day_first_and_no_mystical_inference(self):
        p = payload(fact('year', 'year', '1423'), fact('date', 'date', '2041-02-03'))
        with tempfile.TemporaryDirectory() as tmp:
            r = pa.analyze(p, Path(tmp))
        c = next(c for c in r['candidates'] if c['rule_id'] == 'reverse_year_to_day_first_date')
        self.assertEqual([s['output'] for s in c['transformations']], ['3241', '3241'])
        self.assertTrue(c['exploratory_not_causal'])
        self.assertEqual(c['statistical_significance'], 'not_assessed')
        self.assertEqual(c['fact_evidence_status']['year'], 'unsupported')

    def test_no_match_when_transform_does_not_fit(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = pa.analyze(payload(fact('a', 'year', '1423'), fact('b', 'date', '2041-03-02')), Path(tmp))
        self.assertFalse(any(c['rule_id'] == 'reverse_year_to_day_first_date' for c in r['candidates']))

    def test_anagram_and_reverse_word(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = pa.analyze(payload(fact('a','word','listen'), fact('b','word','silent'),
                                   fact('c','word','drawer'), fact('d','word','reward')), Path(tmp))
        rules = [c['rule_id'] for c in r['candidates']]
        self.assertEqual(rules.count('anagram'), 2)
        self.assertIn('reverse_word', rules)

    def test_shared_birthday_month_day_not_year(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = pa.analyze(payload(fact('a','date','2019-06-03'),fact('b','date','2022-06-03')),
                           Path(tmp))
        self.assertEqual([c['rule_id'] for c in r['candidates']], ['shared_month_day'])

    def test_anniversary_year_echo_requires_exact_day(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = payload(fact('date','date','1963-11-22'), as_of='2026-11-22')
            self.assertEqual([c['rule_id'] for c in pa.analyze(p,Path(tmp))['candidates']],
                             ['anniversary_age_equals_year_suffix'])
            p['as_of']='2026-11-23'
            self.assertEqual(pa.analyze(p,Path(tmp))['candidates'], [])

    def test_two_snapshot_domains_still_not_authenticity_verified(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'s1.txt').write_text('A fictional event occurred on April 5, 2020.')
            (root/'s2.txt').write_text('A fictional event occurred on April 5, 2020.')
            sources=[{'url':f'https://{host}/article','snapshot':f's{i}.txt',
                      'quote':'A fictional event occurred on April 5, 2020.'}
                     for i,host in [(1,'one.example'),(2,'two.example')]]
            r = pa.analyze(payload(fact('x','date','2020-04-05', sources)), root)
            self.assertEqual(r['facts'][0]['verification_status'], 'multi_domain_snapshot_match')
            self.assertFalse(r['facts'][0]['remote_authenticity_verified'])
            self.assertTrue(all(s['exact_quote_and_value_match'] for s in r['facts'][0]['sources']))

    def test_source_quote_must_contain_value_and_be_in_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'s.txt').write_text('Occurred in 2017 not in 2020.')
            sources=[{'url':'https://one.example/article','snapshot':'s.txt','quote':'Occurred in 2017'}]
            r = pa.analyze(payload(fact('x','year','2020',sources)),root)
            self.assertEqual(r['facts'][0]['verification_status'],'source_mismatch')

    def test_snapshot_traversal_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            sources=[{'url':'https://one.example','snapshot':'../outside.txt','quote':'2020'}]
            with self.assertRaisesRegex(ValueError, 'unsafe snapshot path'):
                pa.analyze(payload(fact('x','year','2020',sources)),Path(tmp))

    def test_self_report_not_independent(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=pa.analyze(payload(fact('birthday','date','2000-01-01',provenance='self_reported')),Path(tmp))
            self.assertEqual(r['facts'][0]['verification_status'],'self_reported_only')

    def test_deterministic_digest_not_clock_dependent(self):
        p=payload(fact('a','word','listen'),fact('b','word','silent'))
        with tempfile.TemporaryDirectory() as tmp:
            a=pa.analyze(p,Path(tmp));b=pa.analyze(p,Path(tmp))
            self.assertEqual(a['analysis_sha256'],b['analysis_sha256'])
            self.assertEqual(a['candidates'],b['candidates'])

    def test_cli_writes_and_exits_cleanly(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);input_file=root/'input.json';out=root/'report.json'
            input_file.write_text(json.dumps(payload(fact('a','word','listen'),fact('b','word','silent'))))
            result=subprocess.run([sys.executable,str(SCRIPT),str(input_file),'--output',str(out)],
                                  capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            report=json.loads(out.read_text())
            self.assertEqual(report['candidates'][0]['rule_id'],'anagram')


if __name__ == '__main__':
    unittest.main()
