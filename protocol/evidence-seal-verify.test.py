"""Cross-language AEC v0.1 negative tests; Python verifier against Node issuer fixture."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('aec_python_verifier', HERE/'evidence-seal-verify.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

class CrossRuntimeVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='aec-python-repro-')
        cls.root = Path(cls.tmp.name)
        p = subprocess.run(['node',str(HERE/'evidence-seal-cli.mjs'),'demo',str(cls.root)],capture_output=True,text=True,check=True)
        cls.jws = (cls.root/'test-only.jws').read_text().strip()
        cls.jwks = json.loads((cls.root/'test-only-jwks.json').read_text())
        cls.evidence = (cls.root/'test-only-observation.json').read_bytes()
        cls.iss = 'https://issuer.example'
        cls.sub = 'https://service.example/mcp'
        cls.at = 1794000001
    @classmethod
    def tearDownClass(cls): cls.tmp.cleanup()
    def check(self, jws=None, jwks=None, iss=None, sub=None, at=None, evidence='omit', revoked_ids=frozenset()):
        return verifier.verify_credential(self.jws if jws is None else jws,self.jwks if jwks is None else jwks,
               self.iss if iss is None else iss,self.sub if sub is None else sub,self.at if at is None else at,
               revoked_ids, self.evidence if evidence=='match' else None if evidence=='omit' else evidence)
    def alter_segment(self, i, value):
        parts=self.jws.split('.')
        parts[i]=b64url(value.encode('utf-8') if isinstance(value,str) else value)
        return '.'.join(parts)
    def test_valid_cross_language(self):
        r=self.check(evidence='match')
        self.assertTrue(r['valid'],r)
        self.assertTrue(r['evidence_digest_match'])
        self.assertFalse(r['evidence_independently_reproduced'])
        self.assertTrue(r['not_certification'])
    def test_without_evidence_does_not_claim_digest(self):
        r=self.check()
        self.assertTrue(r['valid'])
        self.assertFalse(r['evidence_digest_match'])
    def test_tampered_evidence(self): self.assertFalse(self.check(evidence=b'altered')['valid'])
    def test_wrong_issuer(self): self.assertFalse(self.check(iss='https://evil.example')['valid'])
    def test_wrong_subject(self): self.assertFalse(self.check(sub='https://evil.example/mcp')['valid'])
    def test_expired(self): self.assertEqual(self.check(at=1794003600)['reason'],'expired')
    def test_future(self): self.assertEqual(self.check(at=1793999699)['reason'],'not_yet_valid')
    def test_revoked(self): self.assertEqual(self.check(revoked_ids={'urn:uuid:00000000-0000-4000-8000-000000000001'})['reason'],'revoked')
    def test_altered_signature(self): self.assertFalse(self.check(jws=self.alter_segment(2,b'a'*64))['valid'])
    def test_wrong_key(self):
        j=json.loads(json.dumps(self.jwks));j['keys'][0]['x']=b64url(b'0'*32)
        self.assertFalse(self.check(jwks=j)['valid'])
    def test_empty_jwks(self): self.assertFalse(self.check(jwks={'keys':[]})['valid'])
    def test_duplicate_kid(self): self.assertFalse(self.check(jwks={'keys':self.jwks['keys']*2})['valid'])
    def test_private_key_in_jwks(self):
        j=json.loads(json.dumps(self.jwks));j['keys'][0]['d']=b64url(b'0'*32)
        self.assertFalse(self.check(jwks=j)['valid'])
    def test_modified_header_algorithm(self):
        h={'alg':'none','kid':'PUBLIC-TEST-ONLY-k1','typ':'AC-EVIDENCE+JWS'}
        self.assertFalse(self.check(jws=self.alter_segment(0,verifier.canonical(h)))['valid'])
    def test_modified_payload_new_standing(self):
        p=verifier.canonical_segment(self.jws.split('.')[1],65535);p['level']='gold'
        self.assertFalse(self.check(jws=self.alter_segment(1,verifier.canonical(p)))['valid'])
    def test_modified_payload_independent(self):
        p=verifier.canonical_segment(self.jws.split('.')[1],65535);p['issuer_relationship']='independent'
        self.assertFalse(self.check(jws=self.alter_segment(1,verifier.canonical(p)))['valid'])
    def test_duplicate_header_json_fields(self):
        header='{"alg":"EdDSA","kid":"PUBLIC-TEST-ONLY-k1","kid":"PUBLIC-TEST-ONLY-k1","typ":"AC-EVIDENCE+JWS"}'
        self.assertFalse(self.check(jws=self.alter_segment(0,header))['valid'])
    def test_noncanonical_header(self):
        header='{"typ":"AC-EVIDENCE+JWS","kid":"PUBLIC-TEST-ONLY-k1","alg":"EdDSA"}'
        self.assertFalse(self.check(jws=self.alter_segment(0,header))['valid'])
    def test_missing_expected_identity(self): self.assertFalse(self.check(sub='')['valid'])
    def test_url_with_secret(self): self.assertFalse(self.check(sub='https://service.example/mcp?api_key=test')['valid'])
    def test_reject_jwks_digest_mismatch_cli(self):
        r=subprocess.run([sys.executable,str(HERE/'evidence-seal-verify.py'),str(self.root/'test-only.jws'),str(self.root/'test-only-jwks.json'),self.iss,self.sub,'--at',str(self.at),'--jwks-sha256','0'*64],capture_output=True,text=True)
        self.assertEqual(r.returncode,1);self.assertIn('pinned_jwks_digest_mismatch',r.stdout)
    def test_cli_pinned_jwks_and_raw_evidence(self):
        jwks_bytes=(self.root/'test-only-jwks.json').read_bytes()
        r=subprocess.run([sys.executable,str(HERE/'evidence-seal-verify.py'),str(self.root/'test-only.jws'),str(self.root/'test-only-jwks.json'),self.iss,self.sub,'--at',str(self.at),'--evidence',str(self.root/'test-only-observation.json'),'--jwks-sha256',hashlib.sha256(jwks_bytes).hexdigest()],capture_output=True,text=True)
        self.assertEqual(r.returncode,0,r.stdout+'\n'+r.stderr)
        self.assertTrue(json.loads(r.stdout)['evidence_digest_match'])

if __name__ == '__main__': unittest.main()
