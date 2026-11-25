from __future__ import annotations
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import json
import hashlib
import pytest

spec=importlib.util.spec_from_file_location('audit', str(Path(__file__).resolve().parents[2] / 'scripts/ops/agentz_live_executable_probe.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

def test_protected_receipt_does_not_accept_wrong_github_digest(tmp_path):
    archive=tmp_path/'agentz-linux-arm64.tar.gz'
    archive.write_bytes(b'fixture')
    receipt=tmp_path/'release.json'
    value={'repository':audit.REPO,'platform':'linux/arm64','source_sha':'a'*40,
           'image_id':'sha256:'+'b'*64,'sha256':audit.file_digest(archive),
           'filename':archive.name}
    receipt.write_text(json.dumps(value))
    assert audit.verified_build_receipt(archive,receipt,audit.file_digest(receipt))['archive_verified']
    with pytest.raises(audit.Hold,match='GitHub asset'):
        audit.verified_build_receipt(archive,receipt,'c'*64)
    archive.write_bytes(b'corrupted')
    with pytest.raises(audit.Hold,match='archive digest'):
        audit.verified_build_receipt(archive,receipt,audit.file_digest(receipt))

def test_ambiguous_live_processes_always_hold(monkeypatch):
    monkeypatch.setattr(audit.os,'geteuid',lambda:0)
    monkeypatch.setattr(audit.sys,'platform','linux')
    monkeypatch.setattr(audit,'candidate_processes',lambda p:[
        {'pid':100,'listening_port_socket_owner':True,'start_ticks':10,
         'executable_sha256_not_application':'a'*64},
        {'pid':101,'listening_port_socket_owner':True,'start_ticks':11,
         'executable_sha256_not_application':'b'*64}])
    monkeypatch.setattr(audit,'docker_containers',lambda:('inspected',[]))
    monkeypatch.setattr(audit,'verified_build_receipt',lambda *a:{'archive_verified':False})
    monkeypatch.setattr(audit.Path,'read_text',lambda self:'boot-id')
    class NoNetwork:
        def open(self,*a,**k):raise OSError('network unavailable')
    monkeypatch.setattr(audit.urllib.request,'build_opener',lambda *a:NoNetwork())
    report=audit.probe(8000)
    assert report['result']=='HOLD'
    assert report['listener_owner_count']==2
    assert 'ambiguous' in report['hold_reason']

def test_unknown_image_and_bare_host_holds(monkeypatch):
    monkeypatch.setattr(audit.os,'geteuid',lambda:0)
    monkeypatch.setattr(audit.sys,'platform','linux')
    monkeypatch.setattr(audit,'candidate_processes',lambda p:[
        {'pid':100,'listening_port_socket_owner':True,'start_ticks':10,
         'executable_sha256_not_application':'a'*64,'pid_namespace_inode':999}])
    monkeypatch.setattr(audit,'docker_containers',lambda:('inspected',[]))
    monkeypatch.setattr(audit,'verified_build_receipt',lambda *a:{'archive_verified':False})
    monkeypatch.setattr(audit,'start_identity',lambda pid:{'ticks':10})
    monkeypatch.setattr(audit.Path,'read_text',lambda self:'boot-id')
    class FakeHttp:
        status=200
        def __enter__(self):return self
        def __exit__(self,*a):pass
        def read(self,n):return b'{"ok":true}'
    class FakeNetwork:
        def open(self,*a,**k):return FakeHttp()
    monkeypatch.setattr(audit.urllib.request,'build_opener',lambda *a:FakeNetwork())
    r=audit.probe(8000)
    assert r['result']=='HOLD'
    assert r['hold_reason'].startswith('serving process not bound')
