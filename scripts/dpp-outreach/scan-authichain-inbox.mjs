#!/usr/bin/env node
/**
 * Scan authichain@gmail.com via IMAP (app password).
 * Credentials: ~/.config/authichain/gmail-authichain.env
 *   GMAIL_AUTHICHAIN_USER=authichain@gmail.com
 *   GMAIL_AUTHICHAIN_APP_PASSWORD=xxxx
 *
 * Usage: node scripts/dpp-outreach/scan-authichain-inbox.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

const envPath = path.join(homedir(), '.config/authichain/gmail-authichain.env');
if (!fs.existsSync(envPath)) {
  console.error('Missing', envPath);
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

// Prefer system python IMAP helper for zero new deps
import { spawnSync } from 'node:child_process';
const py = `
import imaplib, ssl, email, re, json
from email.header import decode_header
from pathlib import Path
env=dict(line.split('=',1) for line in Path(${JSON.stringify(envPath)}).read_text().splitlines() if '=' in line and not line.strip().startswith('#'))
user=env['GMAIL_AUTHICHAIN_USER'].strip(); pw=env['GMAIL_AUTHICHAIN_APP_PASSWORD'].strip().replace(' ','')
def dec(s):
  if not s: return ''
  return ''.join(t.decode(enc or 'utf-8','replace') if isinstance(t,bytes) else t for t,enc in decode_header(s))
M=imaplib.IMAP4_SSL('imap.gmail.com',993,ssl_context=ssl.create_default_context()); M.login(user,pw)
out={}
for box,q in [('INBOX','UNSEEN'),('"[Gmail]/Sent Mail"','SUBJECT partnership'),('"[Gmail]/All Mail"','FROM stiiizy.com'),('"[Gmail]/All Mail"','FROM tiffany.com'),('"[Gmail]/All Mail"','FROM tmtgcorp.com')]:
  typ,_=M.select(box, readonly=True)
  if typ!='OK': out[f'{box}|{q}']={'error':'select'}; continue
  typ,data=M.search(None,q); ids=data[0].split() if data and data[0] else []
  rows=[]
  for i in list(reversed(ids))[:8]:
    typ,msgdata=M.fetch(i,'(BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])')
    msg=email.message_from_bytes(msgdata[0][1])
    rows.append({'from':dec(msg.get('From')),'to':dec(msg.get('To')),'subject':dec(msg.get('Subject')),'date':msg.get('Date')})
  out[f'{box}|{q}']={'count':len(ids),'sample':rows}
M.logout(); print(json.dumps(out, indent=2))
`;
const r = spawnSync('python3', ['-c', py], { encoding: 'utf8', timeout: 120000 });
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
