#!/usr/bin/env python3
"""Deterministic TEST-ONLY QRON source-review pointer; no product authentication claim."""
from pathlib import Path
import qrcode
from qrcode.constants import ERROR_CORRECT_H

root=Path(__file__).resolve().parents[1]
url='https://github.com/undone0603/authichain-unified/tree/feature/authichain-evidence-issuer-v01-20261106/docs/issuer'
qr=qrcode.QRCode(version=None,error_correction=ERROR_CORRECT_H,box_size=1,border=4)
qr.add_data(url)
qr.make(fit=True)
mat=qr.get_matrix(); N=len(mat)
# Each QR module is 6 SVG user units; contiguous row runs avoid excessive output.
module=6; left=72; top=80
rects=[]
for y,row in enumerate(mat):
    x=0
    while x<len(row):
        if not row[x]:x+=1;continue
        a=x
        while x<len(row) and row[x]: x+=1
        rects.append(f'<rect x="{left+a*module}" y="{top+y*module}" width="{(x-a)*module}" height="{module}"/>')
width=max(680,left*2+N*module)
height=top+N*module+132
svg=(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="QRON test-only source review QR">'
     f'<rect width="{width}" height="{height}" fill="white"/><text x="{left}" y="40" font-family="sans-serif" font-weight="bold" font-size="22" fill="black">QRON • Evidence Credential SOURCE PREVIEW</text>'
     f'<g fill="black">'+''.join(rects)+'</g>'
     f'<text x="{left}" y="{top+N*module+37}" font-family="sans-serif" font-weight="bold" font-size="18" fill="black">TEST ONLY • NOT A CERTIFICATE</text>'
     f'<text x="{left}" y="{top+N*module+66}" font-family="sans-serif" font-size="15" fill="black">Scans to GitHub source and independent test instructions.</text>'
     f'<text x="{left}" y="{top+N*module+93}" font-family="sans-serif" font-size="14" fill="black">No live issuer, product record, or payment verified.</text></svg>')
out=root/'docs/issuer/QRON_SOURCE_PREVIEW.svg';out.write_text(svg,encoding='utf-8')
print(f'{out} QR {N}x{N} modules URL {url}')
