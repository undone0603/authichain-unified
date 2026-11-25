"""Offline EIP-191 and filesystem/peer-credential regression suite."""
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import time

from cryptography.hazmat.primitives.asymmetric import ec
import pytest

from agentz.treasury_proof import signer

P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = signer.CURVE_ORDER
G = (55066263022277343669578718895168534326250603453777594175500187360389116729240,
     32670510020758816978083085130507043184471273380659243275938904335757337482424)


def add(a, b):
    if a is None: return b
    if b is None: return a
    if a[0] == b[0] and (a[1] + b[1]) % P == 0: return None
    slope = ((3 * a[0]**2) * pow(2 * a[1], -1, P) if a == b else
             (b[1] - a[1]) * pow((b[0] - a[0]) % P, -1, P)) % P
    x = (slope * slope - a[0] - b[0]) % P
    return x, (slope * (a[0] - x) - a[1]) % P


def mul(k, a):
    result = None
    while k:
        if k & 1: result = add(result, a)
        a = add(a, a)
        k >>= 1
    return result


def recover(message, signature):
    raw = bytes.fromhex(signature[2:])
    assert len(raw) == 65
    r, s, v = int.from_bytes(raw[:32], 'big'), int.from_bytes(raw[32:64], 'big'), raw[64]
    assert 1 <= r < N and 1 <= s <= N // 2 and v in (27, 28)
    y = pow((r**3 + 7) % P, (P+1)//4, P)
    if y % 2 != v-27: y = P-y
    z = int.from_bytes(signer.personal_hash(message), 'big')
    q = add(mul(s * pow(r, -1, N) % N, (r, y)), mul(-z * pow(r, -1, N) % N, G))
    return '0x' + signer.keccak256(q[0].to_bytes(32,'big') + q[1].to_bytes(32,'big'))[-20:].hex()


def test_real_disposable_eip191_roundtrip_and_tamper():
    assert signer.keccak256(b'hello').hex() == '1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8'
    for _ in range(5):
        key = ec.generate_private_key(ec.SECP256K1())
        message = 'AuthiChain ownership-only nonce:' + os.urandom(32).hex()
        sig = signer.eip191_sign(key, message)
        assert recover(message, sig) == signer.account_address(key)
        assert recover(message + 'tampered', sig) != signer.account_address(key)


def test_durable_replay_and_mode(tmp_path):
    d = tmp_path / 'state'
    d.mkdir(mode=0o700)
    cfg = signer.Config(os.geteuid(), os.getegid(), 61234, 61235, '0x'+'ab'*20,
        d, d, d/'key', d/'used.sqlite', d, d/'receipt')
    nonce = '0x' + 'ee'*32
    signer._use_nonce(cfg, nonce, int(time.time())+100)
    assert stat.S_IMODE(cfg.nonce_db.stat().st_mode) == 0o600
    with pytest.raises(signer.ProofError): signer._use_nonce(cfg, nonce, int(time.time())+100)
    with pytest.raises(signer.ProofError): signer._use_nonce(cfg, nonce, int(time.time())+100)
    cfg.nonce_db.chmod(0o666)
    with pytest.raises(signer.ProofError): signer._use_nonce(cfg, '0x'+'dd'*32, int(time.time())+100)


def test_same_uid_and_arbitrary_transaction_fields_refused(monkeypatch, tmp_path):
    cfg = signer.Config(61231, 61232, 61231, 61234, '0x'+'aa'*20,
        tmp_path, tmp_path, tmp_path/'key', tmp_path/'used', tmp_path, tmp_path/'receipt')
    monkeypatch.setattr(signer.os, 'geteuid', lambda: 61231)
    monkeypatch.setattr(signer.os, 'getegid', lambda: 61232)
    request = {'nonce': '0x'+'ee'*32, 'expires_at': '2030-01-01T00:00:00Z',
               'expected_wallet': cfg.expected_wallet, 'purpose': signer.PURPOSE}
    with pytest.raises(signer.ProofError): signer.sign_proof(cfg, request)
    cfg = signer.Config(61231, 61232, 61233, 61234, cfg.expected_wallet,
        tmp_path, tmp_path, tmp_path/'key', tmp_path/'used', tmp_path, tmp_path/'receipt')
    with pytest.raises(signer.ProofError, match='only four'):
        signer.sign_proof(cfg, {**request, 'to': '0x'+'ff'*20, 'value': 1})
    with pytest.raises(signer.ProofError):
        signer.sign_proof(cfg, {**request, 'purpose': 'transaction'})


@pytest.mark.skipif(sys.platform != 'linux' or os.geteuid() != 0, reason='requires disposable root Linux')
def test_real_socket_different_uid_group_and_restart():
    suid, ouid, intruder, group, obsgrp = 61101, 61102, 61103, 61104, 61105
    base = Path('/tmp') / ('agentz-proof-' + os.urandom(8).hex())
    base.mkdir(mode=0o755)
    run, private, state, obs = (base/k for k in ('run','private','state','observer'))
    for path in (run,private,state,obs): path.mkdir(mode=0o700)
    os.chown(run, suid, group);run.chmod(0o750)
    for path in (private,state): os.chown(path,suid,suid)
    os.chown(obs,0,obsgrp);obs.chmod(0o750)
    key = ec.generate_private_key(ec.SECP256K1())
    wallet = signer.account_address(key)
    keyfile = private/'key.hex'
    keyfile.write_text(f'{key.private_numbers().private_value:064x}')
    keyfile.chmod(0o600);os.chown(keyfile,suid,suid)
    receipt = obs/'receipt.json'
    stamp = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    receipt.write_text(json.dumps({'observation_id':'host-test-observer-1','observed_at':stamp,
       'host_process':{'pid':123,'start_time_utc':stamp,'image_id':'sha256:'+'a'*64,'health_status':'healthy'},
       'provenance':{'source_sha':'a'*40,'artifact_sha256':'b'*64}}))
    receipt.chmod(0o640);os.chown(receipt,0,obsgrp)
    socketpath = run/'ownership.sock'
    cmd = [sys.executable,'-m','agentz.treasury_proof.signer','--signer-uid',str(suid),
       '--socket-gid',str(group),'--operator-uid',str(ouid),'--observer-gid',str(obsgrp),
       '--wallet',wallet,'--socket-dir',str(run),'--private-dir',str(private),
       '--key-file',str(keyfile),'--nonce-db',str(state/'used.sqlite'),
       '--observation-dir',str(obs),'--observation-file',str(receipt)]
    env = {**os.environ,'PYTHONPATH':str(Path(__file__).resolve().parents[2]),
           'AGENTZ_TREASURY_SOFTWARE_KEY_FIXTURE_ONLY':'yes-disposable-only'}
    def demote(uid,gid,groups):
        def f(): os.setgroups(groups);os.setgid(gid);os.setuid(uid)
        return f
    def launch():
        p = subprocess.Popen(cmd,env=env,cwd='/tmp',preexec_fn=demote(suid,group,[obsgrp]),
                             stderr=subprocess.PIPE)
        for _ in range(200):
            if socketpath.exists() or p.poll() is not None: break
            time.sleep(.02)
        assert p.poll() is None, p.stderr.read().decode()
        assert socketpath.exists()
        return p
    def call(uid,group_access,nonce):
        script = '''import json,sys
from pathlib import Path
from agentz.treasury_proof.client import request_proof
try:
 print(json.dumps(request_proof(Path(sys.argv[1]),int(sys.argv[2]),json.loads(sys.argv[3]))))
except Exception as e:
 print(type(e).__name__,str(e));sys.exit(2)
'''
        request = {'nonce':'0x'+nonce*32,'expires_at':
          (__import__('datetime').datetime.now(__import__('datetime').timezone.utc)+
           __import__('datetime').timedelta(seconds=150)).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'expected_wallet':wallet,'purpose':signer.PURPOSE}
        return subprocess.run([sys.executable,'-c',script,str(socketpath),str(suid),json.dumps(request)],
             env=env,cwd='/tmp',preexec_fn=demote(uid,uid,[group] if group_access else []),
             capture_output=True,text=True,timeout=5)
    import shutil
    try:
        p=launch()
        try:
            assert stat.S_IMODE(socketpath.stat().st_mode)==0o660
            assert call(intruder,False,'12').returncode != 0  # VFS denies
            assert call(intruder,True,'12').returncode != 0   # SO_PEERCRED denies
            proof_response=call(ouid,True,'12')
            assert proof_response.returncode == 0,proof_response.stdout+proof_response.stderr
            proof=json.loads(proof_response.stdout)
            assert proof['signer_uid']==suid and proof['signer_pid']==p.pid
            assert recover(proof['message'],proof['signature'])==wallet
            assert proof['host_observation_independently_verified'] is False
            assert call(ouid,True,'12').returncode != 0
            p.terminate();p.wait(timeout=5)
            p=launch()
            assert call(ouid,True,'12').returncode != 0 # restart persistence
            assert call(ouid,True,'13').returncode == 0
            private_probe=subprocess.run([sys.executable,'-c','open(__import__("sys").argv[1]).read()',str(keyfile)],
               env=env,preexec_fn=demote(ouid,ouid,[group]),capture_output=True,text=True)
            assert private_probe.returncode != 0 and 'PermissionError' in private_probe.stderr
        finally:
            if p.poll() is None:p.terminate();p.wait(timeout=5)
    finally:
        shutil.rmtree(base)
