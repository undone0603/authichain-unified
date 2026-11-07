/** Read-only AEC presentation. Never equate valid signature with authenticity. */
import { verifyEvidenceCredential } from './evidence-seal.mjs';
const esc=v=>String(v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function safeLink(u) { try {const x = new URL(u); return x.protocol==='https:' && !x.username && !x.password ? x.href : '#';}catch{return '#';}}
export function renderEvidencePage({credential,jwks,expectedIssuer,expectedSubject,now,revokedIds=new Set()}={}) {
  const res=verifyEvidenceCredential(credential,jwks,{expectedIssuer,expectedSubject,now,revokedIds});
  const good=res.valid;
  const p=res.payload;
  const title=good?'Signature verified — evidence uncorroborated':`No valid current credential (${res.reason})`;
  const rows=good?p.evidence.map(e=>`<li><strong>${esc(e.kind)}</strong>: ${esc(e.id)}; SHA-256 ${esc(e.sha256)}. <a rel="noopener noreferrer" href="${esc(safeLink(e.url))}">Source</a></li>`).join(''):'';
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>AuthiChain evidence credential</title><style>body{font:16px system-ui;max-width:54rem;margin:4rem auto;padding:0 1rem;line-height:1.55}h1{font-size:1.5rem}code{overflow-wrap:anywhere}small{color:#444}</style>'+`<h1>${esc(title)}</h1>`+
   (good?`<p><strong>Issuer:</strong> ${esc(p.iss)} · <strong>Subject:</strong> ${esc(p.sub)}</p><p><strong>Decision:</strong> ${esc(p.decision)} · <strong>Relationship:</strong> SELF-ISSUED</p><p><strong>Receipt:</strong> <code>${esc(p.jti)}</code><br><strong>Expires:</strong> ${esc(new Date(p.exp*1000).toISOString())}</p><h2>Referenced observations</h2><ul>${rows}</ul><h2>Limits</h2><ul>${p.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>No badge, trust standing or transaction claim can be inferred from this credential.</p>')+
   '<p><small>AuthiChain Evidence Credential (draft v0.1). A valid signature establishes who signed a statement, not whether the statement or physical item is true or safe. Source documents must be reproduced and verified separately.</small></p></html>';
}
export function renderEvidenceBadge({credential,jwks,expectedIssuer,expectedSubject,now,revokedIds=new Set()}={}) {
  const r=verifyEvidenceCredential(credential,jwks,{expectedIssuer,expectedSubject,now,revokedIds});
  const status=r.valid?'SIGNATURE VALID':'NO VALID CREDENTIAL';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="64" role="img" aria-label="AuthiChain: ${esc(status)}"><rect x="1" y="1" width="318" height="62" rx="8" fill="#fff" stroke="#222" stroke-width="2"/><text x="16" y="25" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#222">AuthiChain Evidence</text><text x="16" y="46" font-family="Arial, sans-serif" font-size="12" fill="#222">${status} · NOT CERTIFICATION</text></svg>`;
}
