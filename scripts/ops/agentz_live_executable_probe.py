#!/usr/bin/env python3
"""Read-only, fail-closed Linux AgentZ executable / protected image comparison.

Must run on the real Linux host as root under an authenticated operator session.
Does NOT access environment variables, passwords, wallet keys, or /proc/PID/mem.
Does NOT deploy, start, stop, or modify processes, Docker images, or Git state.
Output is an observation, not a host-signed attestation by itself.

Example:
  sudo python3 -B agentz_live_executable_probe.py --port 8000 \
    --archive /verified/agentz-linux-arm64.tar.gz \
    --release-json /verified/release.json \
    --github-receipt-sha256 e504942018146d1ff20d36986f87bc0f9a45370487617d0dc9c4a12d74b2fc5a
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import stat
import subprocess
import sys
import urllib.error
import urllib.request

REPO = 'undone0603/authichain-unified'
SHA256_RE = re.compile(r'[a-f0-9]{64}\Z')
REV_RE = re.compile(r'[a-f0-9]{40}\Z')
IMAGE_RE = re.compile(r'sha256:[a-f0-9]{64}\Z')
SOCKET_RE = re.compile(r'socket:\[(\d+)\]\Z')

class Hold(Exception):
    pass

def require(ok: bool, message: str) -> None:
    if not ok:
        raise Hold(message)

def file_digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()

def start_identity(pid: int) -> dict:
    # PID comm may include parenthesis and spaces; use last ') '.
    rest = Path(f'/proc/{pid}/stat').read_text().rsplit(') ',1)[1].split()
    ticks = int(rest[19])  # Linux stat field 22
    btime = int(next(x.split()[1] for x in Path('/proc/stat').read_text().splitlines()
                     if x.startswith('btime ')))
    seconds = btime + ticks / os.sysconf('SC_CLK_TCK')
    stamp = dt.datetime.fromtimestamp(seconds,dt.timezone.utc).isoformat()
    return {'ticks':ticks,'started_at_utc':stamp,'parent_pid':int(rest[1])}

def listening_socket_inodes(port: int) -> set[int]:
    inodes = set()
    for name in ('tcp','tcp6'):
        try:
            lines = Path(f'/proc/net/{name}').read_text().splitlines()[1:]
        except OSError:
            continue
        for row in lines:
            fields=row.split()
            if len(fields)<10: continue
            if fields[3]!='0A': continue  # listening
            try:
                local_port=int(fields[1].split(':')[1],16)
                inode=int(fields[9])
            except (IndexError,ValueError): continue
            if local_port==port and inode>0: inodes.add(inode)
    return inodes

def pid_socket_inodes(pid: int) -> set[int]:
    found=set()
    try:
        entries=list(Path(f'/proc/{pid}/fd').iterdir())
    except OSError:
        return found
    for path in entries:
        try:
            match=SOCKET_RE.fullmatch(os.readlink(path))
            if match: found.add(int(match.group(1)))
        except OSError:
            continue
    return found

def run(args: list[str], timeout: int=5) -> tuple[int,str]:
    try:
        p=subprocess.run(args,capture_output=True,text=True,timeout=timeout,check=False)
        return p.returncode,p.stdout.strip()
    except (OSError,subprocess.TimeoutExpired):
        return 127,''

def source_evidence(pid: int) -> dict:
    result={'source_path_checked':False,'source_sha256':None,'checkout_sha':None,
            'checkout_source_matches_disk':False,'loaded_python_source_attested':False}
    try:
        cwd=Path(f'/proc/{pid}/cwd').resolve(strict=True)
        source=cwd/'agentz/api/main.py'
        if source.is_file():
            result['source_path_checked']=True
            result['source_sha256']=file_digest(source)
            rc,revision=run(['git','-C',str(cwd),'rev-parse','--verify','HEAD'])
            if rc==0 and REV_RE.fullmatch(revision):
                result['checkout_sha']=revision
                try:
                    blob=subprocess.run(['git','-C',str(cwd),'show','HEAD:agentz/api/main.py'],
                                        capture_output=True,check=True,timeout=5).stdout
                    result['checkout_source_matches_disk']=(
                        hashlib.sha256(blob).hexdigest()==result['source_sha256'])
                except (OSError,subprocess.SubprocessError):
                    pass
    except (OSError,ValueError): pass
    return result

def candidate_processes(port: int) -> list[dict]:
    listening=listening_socket_inodes(port)
    result=[]
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():continue
        pid=int(entry.name)
        try:
            argv=(entry/'cmdline').read_bytes().split(b'\0')
            cmd=b' '.join(x for x in argv if x)
            if b'agentz.api.main:app' not in cmd or b'uvicorn' not in cmd:continue
            started=start_identity(pid)
            exe=(entry/'exe').resolve(strict=True)
            ns=os.stat(entry/'ns/pid').st_ino
            sockets=pid_socket_inodes(pid)
            data={'pid':pid,'started_at_utc':started['started_at_utc'],
                  'start_ticks':started['ticks'],'parent_pid':started['parent_pid'],
                  'executable_path':str(exe),
                  'executable_sha256_not_application':file_digest(exe),
                  'pid_namespace_inode':ns,'listening_port_socket_owner':bool(sockets&listening),
                  'matching_listener_inodes':sorted(sockets&listening)}
            data.update(source_evidence(pid))
            result.append(data)
        except (OSError,ValueError,IndexError,StopIteration): continue
    return sorted(result,key=lambda x:x['pid'])

def docker_containers() -> tuple[str,list[dict]]:
    rc,stdout=run(['docker','ps','--quiet','--no-trunc'],6)
    if rc: return 'docker_unavailable',[]
    cids=stdout.splitlines()
    if len(cids)>128:return 'too_many_containers',[]
    containers=[]
    for cid in cids:
        rc,raw=run(['docker','inspect',cid],6)
        if rc:continue
        try:
            container=json.loads(raw)[0]
            pid=int(container.get('State',{}).get('Pid') or 0)
            if pid<2:continue
            ns=os.stat(f'/proc/{pid}/ns/pid').st_ino
            containers.append({'id':cid,'image_id':container.get('Image'),
                               'container_start':container.get('State',{}).get('StartedAt'),
                               'pid_ns_inode':ns,'init_host_pid':pid,
                               'mounts':container.get('Mounts',[])})
        except (ValueError,KeyError,TypeError,OSError,IndexError):continue
    return 'inspected',containers

def verified_build_receipt(archive:Path|None,receipt:Path|None,pin:str|None) -> dict:
    info={'receipt_verified':False,'archive_verified':False,'expected_source_sha':None,
          'expected_image_id':None,'expected_archive_sha256':None}
    if any((archive, receipt, pin)):
        require(bool(archive and receipt and pin),
                'incomplete independent artifact inputs; require archive, release JSON and GitHub digest')
    else:
        return info
    require(bool(SHA256_RE.fullmatch(pin)),'invalid independently pinned GitHub receipt digest')
    require(file_digest(receipt)==pin,'downloaded release.json does not match GitHub asset')
    value=json.loads(receipt.read_bytes())
    require(isinstance(value,dict) and value.get('repository')==REPO and
            value.get('platform')=='linux/arm64' and
            REV_RE.fullmatch(str(value.get('source_sha',''))) and
            IMAGE_RE.fullmatch(str(value.get('image_id',''))) and
            SHA256_RE.fullmatch(str(value.get('sha256',''))) and
            value.get('filename')=='agentz-linux-arm64.tar.gz',
            'invalid protected ARM64 receipt schema')
    info['receipt_verified']=True
    info['expected_source_sha']=value['source_sha']
    info['expected_image_id']=value['image_id']
    info['expected_archive_sha256']=value['sha256']
    require(file_digest(archive)==value['sha256'],'archive digest mismatch')
    info['archive_verified']=True
    return info

def probe(port:int,archive:Path|None=None,receipt:Path|None=None,
          receipt_pin:str|None=None) -> dict:
    require(sys.platform.startswith('linux') and os.geteuid()==0,
            'must execute as root on actual Linux origin host')
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    boot=Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    baseline=verified_build_receipt(archive,receipt,receipt_pin)
    processes=candidate_processes(port)
    status,containers=docker_containers()
    # Probe loopback 127.0.0.1 without following redirects and with small read bound.
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),
                                       urllib.request.HTTPHandler())
    try:
        req=urllib.request.Request(f'http://127.0.0.1:{port}/health',
                                   headers={'Accept':'application/json'})
        with opener.open(req,timeout=4) as response:
            http_status=response.status
            payload=response.read(65537)
        health={'http_status':http_status,'bytes':len(payload),
                'sha256':hashlib.sha256(payload).hexdigest(),
                'json_object':len(payload)<=65536 and isinstance(json.loads(payload),dict)}
    except (OSError,ValueError,urllib.error.HTTPError) as exc:
        health={'http_status':None,'error':type(exc).__name__}
    # Match exact kernel listening socket: a 200 from localhost is NOT enough.
    owners=[p for p in processes if p['listening_port_socket_owner']]
    result={'schema':'authichain.agentz.executable-host-probe/1',
            'host':socket.gethostname(),'boot_id':boot,'observed_at_utc':now,
            'port':port,'candidate_count':len(processes),
            'listener_owner_count':len(owners),'candidates':processes,
            'docker_inspection':status,'health':health,
            'protected_build_receipt':baseline,'image_match':False,
            'source_loaded_proven':False,'result':'HOLD'}
    if len(owners)!=1:
        result['hold_reason']='origin listening socket ownership is missing or ambiguous'
        return result
    owner=owners[0]
    try:
        after=start_identity(owner['pid'])
        if owner['start_ticks']!=after['ticks']:
            result['hold_reason']='PID recycled during health probe'
            return result
    except (OSError,ValueError):
        result['hold_reason']='PID disappeared during health probe'
        return result
    result['owner_pid']=owner['pid']
    result['owner_executable_sha256']=owner['executable_sha256_not_application']
    if health.get('http_status')!=200 or not health.get('json_object'):
        result['hold_reason']='health is unverified'
        return result
    matches=[x for x in containers if x['pid_ns_inode']==owner['pid_namespace_inode']]
    result['container_matches']=[{'id_short':x['id'][:12],
                                  'image_id':x['image_id'],
                                  'started_at':x['container_start']} for x in matches]
    if len(matches)!=1:
        result['hold_reason']='serving process not bound to exactly one inspected Docker container'
        return result
    cont=matches[0]
    shadow=any(str(m.get('Destination','')).rstrip('/') in ('/app','/app/agentz')
               or str(m.get('Destination','')).startswith('/app/agentz/')
               for m in cont['mounts'])
    if shadow:
        result['hold_reason']='application source shadowed by container mount'
        return result
    if not baseline['archive_verified']:
        result['hold_reason']='no independently verified protected archive and release receipt'
        return result
    if cont['image_id']!=baseline['expected_image_id']:
        result['hold_reason']='running Docker image differs from verified protected image'
        return result
    rc,meta=run(['docker','image','inspect',cont['image_id']],6)
    if rc:
        result['hold_reason']='Docker image revision label unavailable'
        return result
    try:
        label=json.loads(meta)[0]['Config']['Labels'].get('org.opencontainers.image.revision')
    except (KeyError,TypeError,ValueError,IndexError):label=None
    if label!=baseline['expected_source_sha']:
        result['hold_reason']='Docker image source label differs from protected source'
        return result
    result['image_match']=True
    result['result']='LOCAL_PROCESS_AND_PROTECTED_IMAGE_MATCH_NOT_REMOTE_SIGNED'
    # This is a local observation. A distinct authenticated operator / independently
    # signed receipt is still needed before asserting remote host attestation.
    return result

def main() -> int:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--port',type=int,default=8000)
    p.add_argument('--archive',type=Path)
    p.add_argument('--release-json',type=Path)
    p.add_argument('--github-receipt-sha256')
    args=p.parse_args()
    try:
        require(0<args.port<=65535,'invalid TCP port')
        report=probe(args.port,args.archive,args.release_json,args.github_receipt_sha256)
    except (Hold,OSError,ValueError,TypeError,KeyError) as exc:
        report={'schema':'authichain.agentz.executable-host-probe/1','result':'HOLD',
                'reason':str(exc)}
    print('AGENTZ_HOST_EXECUTABLE_PROBE='+json.dumps(report,sort_keys=True))
    return 0 if report.get('result')=='LOCAL_PROCESS_AND_PROTECTED_IMAGE_MATCH_NOT_REMOTE_SIGNED' else 1

if __name__=='__main__':raise SystemExit(main())
