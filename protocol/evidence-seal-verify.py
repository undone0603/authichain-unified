#!/usr/bin/env python3
"""Independent offline AuthiChain Evidence Credential v0.1 verifier (Python).

Runs entirely offline; requires the widely used 'cryptography' Python package.
This program DOES NOT issue credentials, validate actual underlying observations,
or constitute a SEAL Standard v9 verifier. A signature proves integrity of a
self-issued evidence statement, not that the service, product or payment is safe.

Example:
  python3 protocol/evidence-seal-verify.py demo/test-only.jws \
    demo/test-only-jwks.json https://issuer.example https://service.example/mcp \
    --at 1794000001 --evidence demo/test-only-observation.json
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qsl, urlsplit

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from cryptography.exceptions import InvalidSignature
except ImportError:
    print('Missing dependency: install cryptography in a credential-free environment', file=sys.stderr)
    raise SystemExit(2)

SCHEMA = 'authichain:evidence-credential:v0.1'
POLICY = 'authichain:evidence-boundary:v0.1'
HEADER_TYPE = 'AC-EVIDENCE+JWS'
B64 = re.compile(r'^[A-Za-z0-9_-]+$')
SHA = re.compile(r'^[0-9a-f]{64}$')
UUID = re.compile(r'^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
SECRET_NAME = re.compile(r'token|secret|password|api.?key|auth|session|code', re.I)
FIELDS = {'schema','policy','iss','sub','jti','iat','exp','issuer_relationship','decision','evidence','limitations'}
EVIDENCE_FIELDS = {'id','kind','url','sha256','observed_at','collector','scope'}


class CredentialError(ValueError):
    pass


def require(condition: bool, reason: str):
    if not condition:
        raise CredentialError(reason)


def is_dict(value):
    return type(value) is dict


def nonnegative_int(value):
    return type(value) is int and 0 <= value <= 9007199254740991


def unique_pairs(pairs):
    obj = {}
    for k,v in pairs:
        require(k not in obj, 'duplicate_json_keys')
        obj[k] = v
    return obj


def parse_json_strict(text: str):
    def bad_constant(x):
        raise CredentialError('invalid_json_constant')
    def bad_float(x):
        # Required AEC fields use only integers, strings, booleans, arrays, objects.
        # Do not accept alternate float serializations across languages.
        raise CredentialError('unsupported_json_float')
    return json.loads(text, object_pairs_hook=unique_pairs, parse_constant=bad_constant, parse_float=bad_float)


def canonical(v):
    if v is None or type(v) in (bool,int,str):
        return json.dumps(v, ensure_ascii=False, separators=(',',':'))
    if type(v) is list:
        return '['+','.join(map(canonical,v))+']'
    require(is_dict(v), 'invalid_json_type')
    # JSON object keys in this credential's strict schema are all ASCII.
    require(all(type(k) is str and k.isascii() for k in v), 'nonascii_json_key')
    return '{'+','.join(json.dumps(k, ensure_ascii=False, separators=(',',':'))+':'+canonical(v[k]) for k in sorted(v))+'}'


def b64decode(s, limit):
    require(type(s) is str and bool(B64.fullmatch(s)), 'invalid_base64url')
    raw = base64.urlsafe_b64decode(s+'='*(-len(s)%4))
    require(len(raw) <= limit and base64.urlsafe_b64encode(raw).decode().rstrip('=') == s, 'invalid_base64url')
    return raw


def canonical_segment(segment, max_bytes):
    raw = b64decode(segment,max_bytes)
    require(raw.decode('utf-8').encode('utf-8') == raw, 'invalid_utf8')
    payload = parse_json_strict(raw.decode('utf-8'))
    require(canonical(payload).encode('utf-8') == raw, 'noncanonical_json')
    return payload


def safe_url(raw, issuer=False):
    if type(raw) is not str or not raw or len(raw) > 2048 or any(ord(c)<32 for c in raw):
        return False
    try:
        v = urlsplit(raw)
        if v.scheme != 'https' or not v.hostname or v.username or v.password or v.fragment:
            return False
        # Reject Unicode confusables and private/loopback IPv4/IPv6 literals.
        host = v.hostname
        if host == 'localhost' or not host.isascii():
            return False
        try:
            ipaddress.ip_address(host)
            return False
        except ValueError:
            pass
        if host.endswith('.local') or not '.' in host:
            return False
        if any(SECRET_NAME.search(k) for k,_ in parse_qsl(v.query, keep_blank_values=True)):
            return False
        if issuer and (v.path not in ('','/') or v.query):
            return False
        return True
    except (ValueError, UnicodeError):
        return False


def validate_payload(p):
    require(is_dict(p) and set(p)==FIELDS and p.get('schema')==SCHEMA and p.get('policy')==POLICY, 'invalid_schema')
    require(safe_url(p['iss'], issuer=True) and safe_url(p['sub']), 'invalid_identity_url')
    require(type(p['jti']) is str and UUID.fullmatch(p['jti']), 'invalid_jti')
    require(nonnegative_int(p['iat']) and nonnegative_int(p['exp']) and 0 < p['exp'] - p['iat'] <= 86400, 'invalid_lifetime')
    require(p['issuer_relationship']=='self' and p['decision'] in ('observed','indeterminate'), 'invalid_claim_semantics')
    require(type(p['evidence']) is list and 1 <= len(p['evidence']) <= 16, 'invalid_evidence')
    seen = set()
    for e in p['evidence']:
        require(is_dict(e) and set(e)==EVIDENCE_FIELDS, 'invalid_evidence_structure')
        require(type(e['id']) is str and 0 < len(e['id']) <= 256 and not any(ord(c)<32 for c in e['id']) and e['id'] not in seen, 'invalid_evidence_id')
        seen.add(e['id'])
        require(e['kind'] in ('mcp_discovery','x402_unpaid_challenge','signed_record_check'), 'invalid_evidence_kind')
        require(safe_url(e['url']) and type(e['sha256']) is str and SHA.fullmatch(e['sha256']), 'invalid_evidence_reference')
        require(nonnegative_int(e['observed_at']) and 0 <= p['iat']-e['observed_at'] <= 86400, 'invalid_evidence_time')
        require(e['collector']=='issuer' and e['scope']=='read_only', 'unverified_independent_or_paid_claim')
    limitations=p['limitations']
    require(type(limitations) is list and 2 <= len(limitations) <= 8 and all(type(x) is str and 0 < len(x) <= 300 for x in limitations), 'invalid_limitations')
    require(any(re.search(r'self.assert|issuer.assert|self.report',x,re.I) for x in limitations), 'missing_self_issuance_disclosure')
    require(any(re.search(r'not.*(safety|paid|authentic|certif|execution)|do(es)? not prove',x,re.I) for x in limitations), 'missing_scope_disclosure')


def verify_credential(credential: str, pinned_jwks: dict, expected_issuer: str, expected_subject: str, at: int, revoked_ids=frozenset(), evidence_bytes=None):
    try:
        require(type(credential) is str and len(credential) < 65536, 'malformed_receipt')
        require(safe_url(expected_issuer,issuer=True) and safe_url(expected_subject), 'missing_expected_identity')
        require(nonnegative_int(at), 'invalid_clock')
        parts=credential.split('.')
        require(len(parts)==3, 'malformed_jws')
        header=canonical_segment(parts[0], 2048)
        payload=canonical_segment(parts[1], 65535)
        require(is_dict(header) and set(header)=={'alg','kid','typ'} and header['alg']=='EdDSA' and header['typ']==HEADER_TYPE and type(header['kid']) is str and 0 < len(header['kid']) <= 80,'invalid_header')
        validate_payload(payload)
        require(payload['iss']==expected_issuer and payload['sub']==expected_subject,'wrong_issuer_or_subject')
        require(is_dict(pinned_jwks) and type(pinned_jwks.get('keys')) is list and 1 <= len(pinned_jwks['keys']) <= 16,'untrusted_jwks')
        selected=None
        kids=set()
        for k in pinned_jwks['keys']:
            require(is_dict(k) and type(k.get('kid')) is str and k['kid'] not in kids,'invalid_or_duplicate_kid')
            kids.add(k['kid'])
            require(k.get('kty')=='OKP' and k.get('crv')=='Ed25519' and k.get('alg')=='EdDSA' and k.get('use')=='sig' and 'd' not in k and 'key_ops' not in k, 'invalid_jwk')
            x=b64decode(k.get('x'),64)
            require(len(x)==32,'invalid_jwk_key')
            if k['kid']==header['kid']: selected=x
        require(selected is not None,'unknown_kid')
        sig=b64decode(parts[2],128)
        require(len(sig)==64,'invalid_signature')
        try: Ed25519PublicKey.from_public_bytes(selected).verify(sig,(parts[0]+'.'+parts[1]).encode('ascii'))
        except InvalidSignature: raise CredentialError('invalid_signature')
        require(at + 300 >= payload['iat'], 'not_yet_valid')
        require(at < payload['exp'], 'expired')
        require(payload['jti'] not in revoked_ids,'revoked')
        # The digest proves only that THESE bytes match the hash signed by the issuer;
        # it does not prove the issuer really observed what the bytes describe.
        if evidence_bytes is not None:
            require(len(payload['evidence'])==1,'ambiguous_evidence_input')
            require(hashlib.sha256(evidence_bytes).hexdigest()==payload['evidence'][0]['sha256'],'evidence_digest_mismatch')
        return {'valid':True,'reason':None,'issuer':payload['iss'],'subject':payload['sub'],'jti':payload['jti'],'scope':payload['decision'],
                'issuer_relationship':'self','evidence_digest_match':evidence_bytes is not None,'evidence_independently_reproduced':False,
                'not_certification':True,'not_paid_receipt':True}
    except (CredentialError,KeyError,TypeError,ValueError,UnicodeDecodeError,OverflowError) as ex:
        return {'valid':False,'reason':str(ex) if isinstance(ex,CredentialError) else 'invalid_structure','evidence_digest_match':False,
                'evidence_independently_reproduced':False,'not_certification':True}


def main():
    ap=argparse.ArgumentParser(description='Offline AEC v0.1 verifier; does not grant standing, authorization or certification')
    ap.add_argument('jws',type=Path)
    ap.add_argument('jwks',type=Path)
    ap.add_argument('issuer')
    ap.add_argument('subject')
    ap.add_argument('--at',type=int,default=None,help='Unix time to evaluate; required for test-only historical fixture')
    ap.add_argument('--evidence',type=Path,default=None,help='Optional pinned raw evidence bytes for a single evidence record')
    ap.add_argument('--jwks-sha256',default=None,help='Optional expected hash of the pinned JWKS file bytes')
    ap.add_argument('--revoked',action='append',default=[])
    a=ap.parse_args()
    import time
    b=a.jwks.read_bytes()
    if a.jwks_sha256 and hashlib.sha256(b).hexdigest()!=a.jwks_sha256:
        print(json.dumps({'valid':False,'reason':'pinned_jwks_digest_mismatch'}))
        return 1
    try:
        result=verify_credential(a.jws.read_text().strip(), parse_json_strict(b.decode('utf8')),a.issuer,a.subject,
                                a.at if a.at is not None else int(time.time()),frozenset(a.revoked),
                                a.evidence.read_bytes() if a.evidence else None)
    except (OSError,ValueError) as e:
        result={'valid':False,'reason':'unreadable_fixture_or_jwks'}
    print(json.dumps(result,indent=2,sort_keys=True))
    return 0 if result.get('valid') else 1

if __name__=='__main__': sys.exit(main())
